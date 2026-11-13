import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../shared/database/prisma.service';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { PapelUsuario as Role } from '../usuario/domain/papel-usuario.enum';
import { TipoDocumento } from '../cliente/domain/cliente.entity';
import { Delivery, Order } from './contracts';
import { OrderStore } from './store';
import { DistributedOrders } from './service';
import { TelemetryService } from '../shared/observability/telemetry.service';

function fixture(): Order {
  return {
    id: 'os-test',
    numero: 1,
    filialId: 'filial-sp',
    clienteId: 'cl-test',
    veiculoId: 've-test',
    mecanicoResponsavelId: 'mech-test',
    status: 'RECEBIDA',
    sagaId: 'saga-test',
    sagaState: 'AWAITING_DIAGNOSIS',
    paymentConfirmed: false,
    problemasRelatados: [],
    servicosSolicitados: [],
    criadoEm: '2026-11-04T12:00:00Z',
    atualizadoEm: '2026-11-04T12:00:00Z',
    historico: [],
    notasInternas: 'private workshop note',
    failure: 'private integration failure',
  };
}
const admin: JwtPayload = { sub: 'admin-test', papel: Role.ADMINISTRADOR };
const client: JwtPayload = {
  sub: 'client-user',
  papel: Role.CLIENTE,
  clienteId: 'cl-test',
};
function setup(value = fixture()) {
  const deliveries: Delivery[] = [];
  const store = {
    get: jest.fn().mockResolvedValue(value),
    list: jest.fn().mockResolvedValue([value]),
    pendingRegistrations: jest.fn().mockResolvedValue([]),
    create: jest.fn(async (created: Order) => created),
    mutate: jest.fn(
      async (_id: string, change: (current: Order) => Delivery[]) => {
        deliveries.push(...change(value));
        return value;
      },
    ),
  };
  const prisma = {
    cliente: {
      findUnique: jest.fn().mockResolvedValue({ id: 'cl-test', ativo: true }),
      findMany: jest
        .fn()
        .mockResolvedValue([{ id: 'cl-test', nome: 'João Silva' }]),
      create: jest.fn().mockResolvedValue({ id: 'new-client' }),
    },
    veiculo: {
      findUnique: jest.fn().mockResolvedValue({ id: 've-test', ativo: true }),
      findMany: jest
        .fn()
        .mockResolvedValue([
          { id: 've-test', placa: 'ABC1D23', marca: 'Marca', modelo: 'Modelo' },
        ]),
      create: jest.fn().mockResolvedValue({ id: 'new-vehicle' }),
    },
    usuario: {
      findMany: jest
        .fn()
        .mockResolvedValue([{ id: 'mech-test', nome: 'Mecânico' }]),
    },
    servicoOficina: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue({
        id: 'service-test',
        nome: 'Revisão',
        ativo: true,
      }),
    },
  };
  const telemetry = { serviceOrderCreated: jest.fn() };
  return {
    service: new DistributedOrders(
      store as unknown as OrderStore,
      prisma as unknown as PrismaService,
      telemetry as unknown as TelemetryService,
    ),
    store,
    prisma,
    telemetry,
    value,
    deliveries,
  };
}

describe('DistributedOrders authorization and lifecycle', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.replaceProperty(process, 'env', { ...process.env });
  });

  it('requires customer ownership and assigned mechanic before accessing OS', () => {
    const { service, value } = setup();
    expect(() => service.assertAccess(value, client)).not.toThrow();
    expect(() =>
      service.assertAccess(value, {
        ...client,
        clienteId: undefined,
        client_id: 'cl-test',
      }),
    ).not.toThrow();
    expect(() =>
      service.assertAccess(value, {
        ...client,
        clienteId: undefined,
        sub: 'cl-test',
      }),
    ).not.toThrow();
    expect(() =>
      service.assertAccess(value, { ...client, clienteId: 'other' }),
    ).toThrow(ForbiddenException);
    expect(() =>
      service.assertAccess(value, { sub: 'other', papel: Role.MECANICO }),
    ).toThrow(ForbiddenException);
    expect(() =>
      service.assertAccess(value, { sub: 'mech-test', papel: Role.MECANICO }),
    ).not.toThrow();
    expect(() => service.assertAccess(value, admin)).not.toThrow();
  });

  it('opens an OS locally and registers both remote participants through its outbox', async () => {
    const { service, store, telemetry } = setup();
    const result = await service.open(
      {
        clienteId: 'cl-test',
        veiculoId: 've-test',
        filialId: 'filial-rj',
        problemasRelatados: [{ descricao: 'Freios' }],
      },
      admin,
    );
    expect(result).toMatchObject({
      status: 'RECEBIDA',
      sagaState: 'AWAITING_DIAGNOSIS',
      filialId: 'filial-rj',
      paymentConfirmed: false,
    });
    expect(result.historico).toHaveLength(1);
    expect(telemetry.serviceOrderCreated).toHaveBeenCalledTimes(1);
    expect(store.create.mock.calls[0][1]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ destination: 'REGISTER_BILLING' }),
        expect.objectContaining({ destination: 'REGISTER_PRODUCTION' }),
      ]),
    );
  });

  it('does not count an order whose durable transaction fails', async () => {
    const { service, store, telemetry } = setup();
    store.create.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(
      service.open({ clienteId: 'cl-test', veiculoId: 've-test' }, admin),
    ).rejects.toThrow('database unavailable');
    expect(telemetry.serviceOrderCreated).not.toHaveBeenCalled();
  });

  it('validates customer and vehicle existence and active state', async () => {
    const { service, store, prisma } = setup();
    await expect(service.open({}, admin)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    prisma.cliente.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.open({ clienteId: 'missing', veiculoId: 've-test' }, admin),
    ).rejects.toBeInstanceOf(BadRequestException);
    prisma.veiculo.findUnique.mockResolvedValueOnce({
      id: 've-test',
      ativo: false,
    });
    await expect(
      service.open({ clienteId: 'cl-test', veiculoId: 've-test' }, admin),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(store.create).not.toHaveBeenCalled();
  });

  it('reuses inline registrations by document and plate before creating new records', async () => {
    const { service, prisma } = setup();
    await service.open(
      {
        cliente: {
          tipoDoc: TipoDocumento.CPF,
          numeroDoc: '529.982.247-25',
          nome: 'Demo',
          email: 'demo@example.test',
          telefone: '11999999999',
        },
        veiculo: {
          placa: 'ABC1D23',
          renavam: '123',
          chassi: '123',
          marca: 'Demo',
          modelo: 'Car',
          ano: 2020,
          cor: 'Blue',
        },
      },
      admin,
    );
    expect(prisma.cliente.findUnique).toHaveBeenCalledWith({
      where: { numeroDoc: '52998224725' },
    });
    expect(prisma.cliente.create).not.toHaveBeenCalled();
    expect(prisma.veiculo.create).not.toHaveBeenCalled();
  });

  it('creates supplied new customer and vehicle when no registration exists', async () => {
    const { service, prisma } = setup();
    prisma.cliente.findUnique.mockResolvedValueOnce(null);
    prisma.veiculo.findUnique.mockResolvedValueOnce(null);
    const result = await service.open(
      {
        cliente: {
          tipoDoc: TipoDocumento.CPF,
          numeroDoc: '529.982.247-25',
          nome: 'Demo',
          email: 'demo@example.test',
          telefone: '11999999999',
          endereco: { cidade: 'Sao Paulo' },
        },
        veiculo: {
          placa: 'ABC1D23',
          renavam: '123',
          chassi: '123',
          marca: 'Demo',
          modelo: 'Car',
          ano: 2020,
          cor: 'Blue',
        },
        notasInternas: 'private',
        notasCliente: 'public',
      },
      admin,
    );
    expect(result).toMatchObject({
      clienteId: 'new-client',
      veiculoId: 'new-vehicle',
      filialId: 'filial-sp',
    });
    expect(prisma.cliente.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        numeroDoc: '52998224725',
        cidade: 'Sao Paulo',
      }),
    });
  });

  it('composes responsible-service snapshots and hides internal notes from clients', async () => {
    const { service } = setup();
    const remote = jest
      .spyOn(service, 'remote')
      .mockImplementation(async (target) =>
        target === 'billing'
          ? {
              budget: {
                totalCents: 20050,
                version: 1,
                approved: true,
                items: [
                  {
                    description: 'Oil',
                    quantity: 2,
                    unitPriceCents: 5025,
                    pecaId: 'oil',
                  },
                  { description: 'Labor', quantity: 1, unitPriceCents: 10000 },
                ],
              },
              updatedAt: 'approved-at',
              payment: { status: 'approved' },
            }
          : {
              diagnosis: 'Freios',
              mecanicoId: 'remote-mech',
              consumptions: [{ pecaId: 'oil' }],
            },
      );
    const result = await service.read('os-test', client);
    expect(result).not.toHaveProperty('notasInternas');
    expect(result).not.toHaveProperty('failure');
    expect(result.orcamento).toMatchObject({
      total: 200.5,
      aprovadoEm: 'approved-at',
      grupos: [
        expect.objectContaining({
          linhasServico: [
            expect.objectContaining({ tipo: 'MATERIAL', subtotal: 100.5 }),
            expect.objectContaining({ tipo: 'SERVICO', subtotal: 100 }),
          ],
        }),
      ],
    });
    expect(result.diagnostico).toEqual({ descricao: 'Freios' });
    expect(result.mecanicoResponsavelId).toBe('remote-mech');
    expect(remote).toHaveBeenCalledTimes(2);
  });

  it('keeps admin details and handles absent or unapproved remote snapshots', async () => {
    const { service } = setup();
    const remote = jest.spyOn(service, 'remote').mockResolvedValue({});
    expect(await service.read('os-test', admin)).toMatchObject({
      orcamento: null,
      diagnostico: null,
      consumosPeca: [],
      notasInternas: 'private workshop note',
    });
    remote.mockImplementation(async (target) =>
      target === 'billing'
        ? {
            budget: { totalCents: 100, version: 1, approved: false, items: [] },
          }
        : { diagnosis: { descricao: 'Object diagnosis' } },
    );
    expect(await service.read('os-test', admin)).toMatchObject({
      orcamento: { aprovadoEm: null },
      diagnostico: { descricao: 'Object diagnosis' },
    });
  });

  it('checks access before forwarding remote actions or fetching private data', async () => {
    const { service } = setup();
    const remote = jest.spyOn(service, 'remote').mockResolvedValue({});
    const stranger = { ...client, clienteId: 'other' };
    await expect(service.read('os-test', stranger)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(
      service.forward(
        'os-test',
        stranger,
        'Bearer token',
        'billing',
        'approve',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(remote).not.toHaveBeenCalled();
    await service.forward(
      'os-test',
      client,
      'Bearer token',
      'billing',
      'approve',
    );
    expect(remote).toHaveBeenCalledWith(
      'billing',
      '/orders/os-test/approve',
      'POST',
      undefined,
      'Bearer token',
    );
  });

  it('filters ownership, status, branch and pagination and redacts list entries', async () => {
    const { service, store, value } = setup();
    store.list.mockResolvedValue([
      value,
      { ...value, id: 'other-owner', clienteId: 'other' },
      { ...value, id: 'other-branch', filialId: 'filial-rj' },
    ]);
    const result = await service.list(client, {
      status: 'RECEBIDA',
      filialId: 'filial-sp',
      pagina: '0',
      porPagina: '1000',
    });
    expect(result.meta).toEqual({
      pagina: 1,
      porPagina: 100,
      total: 1,
      totalPaginas: 1,
    });
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).not.toHaveProperty('notasInternas');
    expect((await service.list(admin, {})).data).toHaveLength(3);
    expect((await service.list(admin, { status: 'ENTREGUE' })).meta.total).toBe(
      0,
    );
  });

  it('delivers only after payment confirmation and ready state', async () => {
    const { service, value } = setup();
    await expect(service.deliver(value.id, admin)).rejects.toBeInstanceOf(
      ConflictException,
    );
    value.paymentConfirmed = true;
    await expect(service.deliver(value.id, admin)).rejects.toBeInstanceOf(
      ConflictException,
    );
    value.status = 'PRONTA_PARA_ENTREGA';
    expect(await service.deliver(value.id, admin)).toMatchObject({
      status: 'ENTREGUE',
    });
    expect(value.historico).toEqual([
      expect.objectContaining({ evento: 'VEICULO_ENTREGUE' }),
    ]);
  });

  it('retries only compensated work under a new Saga ID and deadline', async () => {
    const { service, value } = setup();
    await expect(service.retry(value.id)).rejects.toBeInstanceOf(
      ConflictException,
    );
    value.sagaState = 'COMPENSATED';
    value.status = 'APROVADA';
    const previousId = value.sagaId;
    await service.retry(value.id);
    expect(value).toMatchObject({
      sagaState: 'PREPARING_BUDGET',
      failure: undefined,
    });
    expect(value.sagaId).not.toBe(previousId);
    expect(Date.parse(value.deadline!)).toBeGreaterThan(Date.now());
  });
});

describe('DistributedOrders complete human contracts', () => {
  afterEach(() => jest.restoreAllMocks());
  const stock = {
    filialId: 'filial-sp',
    peca: {
      id: 'oil',
      codigo: 'OL-01',
      nome: 'Óleo',
      descricao: 'Motor',
      ativo: true,
    },
  };
  const budget = {
    totalCents: 5500,
    version: 2,
    approved: false,
    items: [
      { description: 'Troca', quantity: 1, unitPriceCents: 3000 },
      {
        description: 'Material',
        quantity: 2,
        unitPriceCents: 1250,
        pecaId: 'oil',
        nome: 'Óleo',
        codigo: 'OL-01',
        filialId: 'filial-sp',
      },
    ],
    notasCliente: 'Entrega amanhã',
    notasInternas: 'Ajuste interno',
  };

  it('persists requested parts by authoritative identity and snapshots service names before registration', async () => {
    const { service, store } = setup();
    jest.spyOn(service, 'remote').mockResolvedValue(stock as never);
    const created = await service.open(
      {
        clienteId: 'cl-test',
        veiculoId: 've-test',
        pecasSolicitadas: [
          { pecaId: 'oil', quantidade: 1 },
          { pecaId: 'oil', quantidade: 2 },
        ],
        servicosSolicitados: [
          { servicoId: 'service-test', observacao: 'Ruído' },
        ],
      },
      admin,
    );
    expect(created.pecasSolicitadas).toEqual([
      {
        pecaId: 'oil',
        quantidade: 3,
        nome: 'Óleo',
        codigo: 'OL-01',
        descricao: 'Motor',
        filialId: 'filial-sp',
      },
    ]);
    expect(created.servicosSolicitados).toEqual([
      {
        servicoId: 'service-test',
        nomeServico: 'Revisão',
        observacao: 'Ruído',
      },
    ]);
    expect(store.create.mock.calls[0][0].pecasSolicitadas).toEqual(
      created.pecasSolicitadas,
    );
  });

  it.each([
    { ...stock, filialId: 'filial-rj' },
    { ...stock, peca: { ...stock.peca, ativo: false } },
    { ...stock, peca: { ...stock.peca, id: 'other' } },
  ])(
    'rejects invalid current material identity without writing an order',
    async (invalid) => {
      const { service, store, prisma } = setup();
      jest.spyOn(service, 'remote').mockResolvedValue(invalid as never);
      await expect(
        service.open(
          {
            clienteId: 'cl-test',
            veiculoId: 've-test',
            pecasSolicitadas: [{ pecaId: 'oil', quantidade: 1 }],
          },
          admin,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(store.create).not.toHaveBeenCalled();
      expect(prisma.cliente.create).not.toHaveBeenCalled();
    },
  );

  it('does not grant consultant inventory selection and rejects fractional requests or inactive services', async () => {
    const { service, store, prisma } = setup();
    const remote = jest.spyOn(service, 'remote');
    await expect(
      service.open(
        {
          clienteId: 'cl-test',
          veiculoId: 've-test',
          pecasSolicitadas: [{ pecaId: 'oil', quantidade: 1 }],
        },
        { sub: 'consultor', papel: Role.CONSULTOR_TECNICO },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.open(
        {
          clienteId: 'cl-test',
          veiculoId: 've-test',
          pecasSolicitadas: [{ pecaId: 'oil', quantidade: 1.5 }],
        },
        admin,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    prisma.servicoOficina.findUnique.mockResolvedValueOnce({
      id: 'inactive',
      nome: 'Inativo',
      ativo: false,
    });
    await expect(
      service.open(
        {
          clienteId: 'cl-test',
          veiculoId: 've-test',
          servicosSolicitados: [{ servicoId: 'inactive' }],
        },
        admin,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(store.create).not.toHaveBeenCalled();
    expect(remote).not.toHaveBeenCalled();
  });

  it('hydrates legacy human labels, retains ordered groups/notes and reads aggregate consumption from Production parts', async () => {
    const { service, value, prisma } = setup();
    value.servicosSolicitados = [{ servicoId: 'service-test' }];
    prisma.servicoOficina.findMany.mockResolvedValue([
      { id: 'service-test', nome: 'Revisão antiga' },
    ]);
    jest.spyOn(service, 'remote').mockImplementation(async (target) =>
      target === 'billing'
        ? {
            budget: {
              ...budget,
              groups: [
                { title: 'Mão de obra', items: [budget.items[0]] },
                { title: 'Peças', items: [budget.items[1]] },
              ],
            },
          }
        : {
            parts: [
              {
                pecaId: 'oil',
                quantity: 2,
                consumedQuantity: 1,
                codigo: 'OL-01',
                nome: 'Óleo',
              },
            ],
            consumptions: [{ wrongSource: true }],
          },
    );
    const result = await service.read(value.id, admin);
    expect(result).toMatchObject({
      clienteNome: 'João Silva',
      veiculoPlaca: 'ABC1D23',
      mecanicoNome: 'Mecânico',
      servicosSolicitados: [{ nomeServico: 'Revisão antiga' }],
    });
    expect(result.orcamento).toMatchObject({
      notasCliente: 'Entrega amanhã',
      notasInternas: 'Ajuste interno',
      grupos: [
        { titulo: 'Mão de obra', total: 30 },
        {
          titulo: 'Peças',
          total: 25,
          linhasServico: [
            { nome: 'Óleo', codigo: 'OL-01', filialId: 'filial-sp' },
          ],
        },
      ],
    });
    expect(result.consumosPeca).toEqual([
      {
        pecaId: 'oil',
        nome: 'Óleo',
        codigo: 'OL-01',
        filialId: 'filial-sp',
        quantidadeReservada: 2,
        quantidadeConsumida: 1,
        quantidadeRestante: 1,
      },
    ]);
    const customer = await service.read(value.id, client);
    expect(customer).not.toHaveProperty('consumosPeca');
    expect(customer.orcamento).not.toHaveProperty('notasInternas');
    expect(customer.orcamento?.notasCliente).toBe('Entrega amanhã');
  });

  it('finds an order outside page one by number or accent-insensitive human label after ownership filtering', async () => {
    const { service, store, value } = setup();
    store.list.mockResolvedValue(
      Array.from({ length: 25 }, (_, index) => ({
        ...value,
        id: `os-${index + 1}`,
        numero: index + 1,
        clienteNome: index === 24 ? 'Úrsula Especial' : 'João',
        veiculoPlaca: index === 24 ? 'XYZ9A99' : 'ABC1D23',
      })).concat([
        {
          ...value,
          id: 'unauthorized',
          numero: 26,
          clienteId: 'other',
          clienteNome: 'Úrsula Especial',
          veiculoPlaca: 'XYZ9A99',
        },
      ]),
    );
    for (const busca of ['#25', 'OS 25', 'ursula especial', 'xyz9a99']) {
      const result = await service.list(client, {
        busca,
        pagina: '1',
        porPagina: '20',
      });
      expect(result.meta.total).toBe(1);
      expect(result.data[0].numero).toBe(25);
    }
    expect((await service.list(client, { busca: 'os-25' })).meta.total).toBe(0);
    expect(
      (
        await service.list(admin, {
          busca: 'ursula especial',
          status: 'ENTREGUE',
        })
      ).meta.total,
    ).toBe(0);
  });

  it('limits shortage visibility without mutating durable data', async () => {
    const { service, value } = setup();
    value.faltasEstoque = [
      {
        pecaId: 'oil',
        nome: 'Óleo',
        filialId: 'filial-sp',
        quantidadeNecessaria: 3,
        quantidadeDisponivel: 1,
        quantidadeFaltante: 2,
        motivo: 'ESTOQUE_INSUFICIENTE',
      },
    ];
    jest.spyOn(service, 'remote').mockResolvedValue({});
    expect(
      (await service.read(value.id, admin)).faltasEstoque?.[0]
        .quantidadeDisponivel,
    ).toBe(1);
    expect(
      (
        await service.read(value.id, {
          sub: 'consultor',
          papel: Role.CONSULTOR_TECNICO,
        })
      ).faltasEstoque?.[0],
    ).not.toHaveProperty('quantidadeDisponivel');
    expect(await service.read(value.id, client)).not.toHaveProperty(
      'faltasEstoque',
    );
    expect((await service.list(client, {})).data[0]).not.toHaveProperty(
      'faltasEstoque',
    );
    expect(value.faltasEstoque[0].quantidadeDisponivel).toBe(1);
  });

  it('validates budget material in its order branch and replaces supplied display identity before forwarding', async () => {
    const { service } = setup();
    const remote = jest
      .spyOn(service, 'remote')
      .mockImplementation(async (target) =>
        target === 'production' ? (stock as never) : {},
      );
    const item = {
      ...budget.items[1],
      nome: 'Forged',
      codigo: 'WRONG',
      filialId: 'filial-rj',
    };
    await service.forward(
      'os-test',
      { sub: 'mech-test', papel: Role.MECANICO },
      'Bearer user',
      'billing',
      'budget',
      {
        items: [item],
        groups: [{ title: 'Material', items: [item] }],
        notasInternas: 'Preservada',
      },
      'PUT',
    );
    expect(remote).toHaveBeenCalledWith(
      'production',
      '/internal/inventory/oil?filialId=filial-sp',
    );
    expect(remote).toHaveBeenLastCalledWith(
      'billing',
      '/orders/os-test/budget',
      'PUT',
      {
        items: [budget.items[1]],
        groups: [{ title: 'Material', items: [budget.items[1]] }],
        notasInternas: 'Preservada',
      },
      'Bearer user',
    );
  });

  it('preserves a definitive stock rejection while discarding arbitrary remote fields', async () => {
    const { service } = setup();
    const saved = process.env.PRODUCTION_SERVICE_URL;
    process.env.PRODUCTION_SERVICE_URL = 'http://production';
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'QUANTITY_EXCEEDS_RESERVATION',
          definitive: true,
          pecaId: 'oil',
          filialId: 'filial-sp',
          quantidadeSolicitada: 2,
          quantidadeReservada: 2,
          quantidadeConsumida: 1,
          quantidadeRestante: 1,
          secret: 'internal',
        }),
        { status: 400 },
      ),
    );
    try {
      await service.remote('production', '/orders/os-test/consume');
      throw new Error('Expected rejection');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({
        code: 'QUANTITY_EXCEEDS_RESERVATION',
        definitive: true,
        quantidadeRestante: 1,
      });
      expect((error as BadRequestException).getResponse()).not.toHaveProperty(
        'secret',
      );
    } finally {
      if (saved === undefined) delete process.env.PRODUCTION_SERVICE_URL;
      else process.env.PRODUCTION_SERVICE_URL = saved;
    }
  });
});

describe('DistributedOrders administrative preparation reconciliation', () => {
  function intervention() {
    const value = fixture();
    value.status = 'APROVADA';
    value.sagaState = 'MANUAL_ATTENTION';
    value.totalCents = 17500;
    return setup(value);
  }

  it('persists recovery intent for the active Saga without changing approval or budget', async () => {
    const { service, value, deliveries } = intervention();
    const originalSaga = value.sagaId;
    const originalOrder = value.id;

    await expect(service.reconcile(value.id, originalSaga)).resolves.toBe(
      value,
    );

    expect(value).toMatchObject({
      id: originalOrder,
      sagaId: originalSaga,
      status: 'APROVADA',
      sagaState: 'COMPENSATING',
      totalCents: 17500,
      paymentConfirmed: false,
      reconciliation: {
        id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        phase: 'CANCELLING',
      },
    });
    expect(Date.parse(value.deadline!)).toBeGreaterThan(Date.now());
    expect(value.historico).toEqual([
      expect.objectContaining({
        evento: 'RECONCILIACAO_SOLICITADA',
        statusAnterior: 'APROVADA',
        statusNovo: 'APROVADA',
      }),
    ]);
    expect(deliveries).toEqual([
      {
        destination: 'PRODUCTION',
        message: expect.objectContaining({
          type: 'ReconcileExecutionReservation',
          osId: originalOrder,
          sagaId: originalSaga,
          filialId: 'filial-sp',
          payload: { reconciliationId: value.reconciliation!.id },
        }),
      },
    ]);
  });

  it.each([
    { expectedSagaId: '' },
    { expectedSagaId: 'previous-saga' },
    { status: 'RECEBIDA' },
    { status: 'EM_EXECUCAO' },
    { status: 'AGUARDANDO_PAGAMENTO' },
    { status: 'PRONTA_PARA_ENTREGA' },
    { status: 'ENTREGUE' },
    { sagaState: 'COMPENSATED' },
    { sagaState: 'PREPARING_BUDGET' },
    { sagaState: 'COMPLETED' },
    { paymentConfirmed: true },
  ])(
    'rejects unsafe or stale recovery without producing messages: %j',
    async (change) => {
      const { service, value, deliveries } = intervention();
      const { expectedSagaId = value.sagaId, ...patch } = change;
      Object.assign(value, patch);
      const before = structuredClone(value);

      await expect(
        service.reconcile(value.id, expectedSagaId),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(value).toEqual(before);
      expect(deliveries).toEqual([]);
    },
  );

  it('rejects a second request while recovery is pending without duplicating its outbox intent', async () => {
    const { service, value, deliveries } = intervention();
    const sagaId = value.sagaId;
    await service.reconcile(value.id, sagaId);
    const recovering = structuredClone(value);

    await expect(service.reconcile(value.id, sagaId)).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(value).toEqual(recovering);
    expect(value.historico).toHaveLength(1);
    expect(deliveries).toHaveLength(1);
  });

  it('clears an old recovery marker only when starting a new compensated attempt', async () => {
    const { service, value, deliveries } = intervention();
    value.sagaState = 'COMPENSATED';
    value.reconciliation = {
      id: 'previous-reconciliation',
      phase: 'RELEASING_BUDGET',
    };
    const previousSaga = value.sagaId;

    await service.retry(value.id);

    expect(value.reconciliation).toBeUndefined();
    expect(value.sagaId).not.toBe(previousSaga);
    expect(value.sagaState).toBe('PREPARING_BUDGET');
    expect(value.status).toBe('APROVADA');
    expect(deliveries).toEqual([
      {
        destination: 'BILLING',
        message: expect.objectContaining({
          type: 'PrepareApprovedBudget',
          sagaId: value.sagaId,
        }),
      },
    ]);
  });

  it.each([
    { status: 'EM_EXECUCAO' },
    { status: 'AGUARDANDO_PAGAMENTO' },
    { status: 'PRONTA_PARA_ENTREGA' },
    { status: 'ENTREGUE' },
    { status: 'APROVADA', paymentConfirmed: true },
  ])(
    'never retries physical or paid work even with a stale compensated marker: %j',
    async (patch) => {
      const { service, value, deliveries } = intervention();
      value.sagaState = 'COMPENSATED';
      Object.assign(value, patch);
      const before = structuredClone(value);

      await expect(service.retry(value.id)).rejects.toBeInstanceOf(
        ConflictException,
      );

      expect(value).toEqual(before);
      expect(deliveries).toEqual([]);
    },
  );
});

describe('DistributedOrders initial participant synchronization', () => {
  const saved = { ...process.env };
  beforeEach(() => {
    process.env.BILLING_SERVICE_URL = 'http://billing';
    process.env.PRODUCTION_SERVICE_URL = 'http://production';
  });
  afterEach(() => {
    process.env = { ...saved };
    jest.restoreAllMocks();
  });

  it('shows the committed order while initial participant registration is pending, without writing on GET', async () => {
    const { service, store } = setup();
    store.pendingRegistrations.mockResolvedValue(['billing', 'production']);
    const http = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);

    await expect(service.read('os-test', client)).resolves.toMatchObject({
      id: 'os-test',
      status: 'RECEBIDA',
      orcamento: null,
      diagnostico: null,
      paymentConfirmed: false,
      sincronizacaoPendente: ['billing', 'production'],
    });
    expect(http).toHaveBeenCalledTimes(2);
    for (const [, options] of http.mock.calls)
      expect(options?.method).toBe('GET');
    expect(store.create).not.toHaveBeenCalled();
    expect(store.mutate).not.toHaveBeenCalled();
  });

  it('captures pending registration before GET, then clears it once participant snapshots are available', async () => {
    const { service, store } = setup();
    store.pendingRegistrations.mockResolvedValue(['billing']);
    const http = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (url) => {
        expect(store.pendingRegistrations).toHaveBeenCalledWith('os-test');
        // The worker can acknowledge the registration after this request's
        // missing-snapshot response has already been produced.
        store.pendingRegistrations.mockResolvedValue([]);
        const billingRequest =
          typeof url === 'string' && url.includes('/billing/');
        return {
          ok: !billingRequest,
          status: billingRequest ? 404 : 200,
          json: async () => ({}),
        } as Response;
      });

    await expect(service.read('os-test', admin)).resolves.toMatchObject({
      sincronizacaoPendente: ['billing'],
    });
    http.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    } as Response);
    await expect(service.read('os-test', admin)).resolves.toMatchObject({
      sincronizacaoPendente: [],
    });
  });

  it('keeps registration pending until the outbox ACK even when remote snapshots already exist', async () => {
    const { service, store } = setup();
    store.pendingRegistrations.mockResolvedValue(['production', 'billing']);
    const http = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    } as Response);

    await expect(service.read('os-test', admin)).resolves.toMatchObject({
      sincronizacaoPendente: ['billing', 'production'],
    });
    await expect(
      service.forward(
        'os-test',
        admin,
        'Bearer test-token',
        'production',
        'assign',
        { mecanicoId: 'mech-test' },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(http).toHaveBeenCalledTimes(2);

    store.pendingRegistrations.mockResolvedValue([]);
    await expect(service.read('os-test', admin)).resolves.toMatchObject({
      sincronizacaoPendente: [],
    });
    await expect(
      service.forward(
        'os-test',
        admin,
        'Bearer test-token',
        'production',
        'assign',
        { mecanicoId: 'mech-test' },
      ),
    ).resolves.toEqual({});
    expect(http).toHaveBeenLastCalledWith(
      'http://production/api/v1/production/orders/os-test/assign',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('keeps missing snapshots as errors once registration has been acknowledged', async () => {
    const { service, store } = setup();
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);
    await expect(service.read('os-test', admin)).rejects.toBeInstanceOf(
      BadGatewayException,
    );
    expect(store.pendingRegistrations).toHaveBeenCalledWith('os-test');
  });

  it('does not hide a billing 404 because a different participant is still registering', async () => {
    const { service, store } = setup();
    store.pendingRegistrations.mockResolvedValue(['production']);
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);
    await expect(service.read('os-test', admin)).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it.each([
    [401, BadGatewayException],
    [403, ForbiddenException],
    [503, BadGatewayException],
  ])(
    'never hides upstream HTTP %i behind pending registration',
    async (status, error) => {
      const { service, store } = setup();
      store.pendingRegistrations.mockResolvedValue(['billing', 'production']);
      jest.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status,
      } as Response);
      await expect(service.read('os-test', admin)).rejects.toBeInstanceOf(
        error,
      );
    },
  );

  it.each([
    ['AGUARDANDO_APROVACAO', 'AWAITING_APPROVAL'],
    ['RECEBIDA', 'AWAITING_APPROVAL'],
    ['EM_DIAGNOSTICO', 'AWAITING_DIAGNOSIS'],
  ])(
    'does not use initial registration fallback for %s/%s',
    async (status, state) => {
      const { service, store, value } = setup();
      value.status = status;
      value.sagaState = state;
      store.pendingRegistrations.mockResolvedValue(['billing', 'production']);
      jest.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 404,
      } as Response);
      await expect(service.read('os-test', admin)).rejects.toBeInstanceOf(
        BadGatewayException,
      );
      expect(store.pendingRegistrations).not.toHaveBeenCalled();
    },
  );

  it('checks ownership before querying participant synchronization', async () => {
    const { service, store } = setup();
    await expect(
      service.read('os-test', { ...client, clienteId: 'another-client' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(store.pendingRegistrations).not.toHaveBeenCalled();
  });
});

describe('DistributedOrders initial command readiness', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each([[['billing']], [['production']], [['billing', 'production']]])(
    'rejects commands before all initial registrations are acknowledged: %j',
    async (pending) => {
      const { service, store } = setup();
      store.pendingRegistrations.mockResolvedValue(pending);
      const remote = jest.spyOn(service, 'remote').mockResolvedValue({});
      await expect(
        service.forward(
          'os-test',
          admin,
          'Bearer test-token',
          'production',
          'assign',
          {
            mecanicoId: 'mech-test',
          },
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(store.pendingRegistrations).toHaveBeenCalledWith('os-test');
      expect(remote).not.toHaveBeenCalled();
      expect(store.create).not.toHaveBeenCalled();
      expect(store.mutate).not.toHaveBeenCalled();
    },
  );

  it('forwards the command normally after both registrations are acknowledged', async () => {
    const { service, store } = setup();
    const remote = jest.spyOn(service, 'remote').mockResolvedValue({});
    await expect(
      service.forward(
        'os-test',
        admin,
        'Bearer test-token',
        'production',
        'assign',
        {
          mecanicoId: 'mech-test',
        },
      ),
    ).resolves.toEqual({});
    expect(store.pendingRegistrations).toHaveBeenCalledWith('os-test');
    expect(remote).toHaveBeenCalledWith(
      'production',
      '/orders/os-test/assign',
      'POST',
      { mecanicoId: 'mech-test' },
      'Bearer test-token',
    );
  });

  it('checks ownership before querying registration readiness or forwarding credentials', async () => {
    const { service, store } = setup();
    const remote = jest.spyOn(service, 'remote').mockResolvedValue({});
    await expect(
      service.forward(
        'os-test',
        { ...client, clienteId: 'other-client' },
        'Bearer test-token',
        'production',
        'assign',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(store.pendingRegistrations).not.toHaveBeenCalled();
    expect(remote).not.toHaveBeenCalled();
  });

  it.each([
    ['ATRIBUIDA', 'AWAITING_DIAGNOSIS'],
    ['RECEBIDA', 'AWAITING_APPROVAL'],
  ])(
    'does not block an advanced order because of an old registration intent: %s/%s',
    async (status, sagaState) => {
      const { service, store, value } = setup();
      value.status = status;
      value.sagaState = sagaState;
      store.pendingRegistrations.mockResolvedValue(['billing', 'production']);
      const remote = jest.spyOn(service, 'remote').mockResolvedValue({});
      await expect(
        service.forward(
          'os-test',
          admin,
          'Bearer test-token',
          'production',
          'diagnosis',
          {
            descricao: 'Diagnostico',
          },
        ),
      ).resolves.toEqual({});
      expect(store.pendingRegistrations).not.toHaveBeenCalled();
      expect(remote).toHaveBeenCalledTimes(1);
    },
  );

  it('preserves a genuine upstream failure after registration is acknowledged', async () => {
    const { service } = setup();
    const failure = new BadGatewayException('production indisponível (503)');
    jest.spyOn(service, 'remote').mockRejectedValue(failure);
    await expect(
      service.forward(
        'os-test',
        admin,
        'Bearer test-token',
        'production',
        'assign',
      ),
    ).rejects.toBe(failure);
  });
});

describe('DistributedOrders remote boundary', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
    jest.restoreAllMocks();
  });
  it('requires destination configuration', async () => {
    delete process.env.BILLING_SERVICE_URL;
    await expect(
      setup().service.remote('billing', '/orders'),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
  it('uses internal token for snapshots and forwards user credentials for commands', async () => {
    process.env.BILLING_SERVICE_URL = 'http://billing/';
    process.env.PRODUCTION_SERVICE_URL = 'http://production';
    process.env.AUTH_CLIENT_LOOKUP_TOKEN = 'internal-token';
    const http = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: { payment: { status: 'pending' } } }),
    } as Response);
    const { service } = setup();
    await expect(
      service.remote('billing', '/internal/orders/os-test'),
    ).resolves.toEqual({ payment: { status: 'pending' } });
    expect(http).toHaveBeenLastCalledWith(
      'http://billing/api/v1/billing/internal/orders/os-test',
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Internal-Token': 'internal-token',
        }),
      }),
    );
    await service.remote(
      'production',
      '/orders/os-test/start',
      'POST',
      { approved: true },
      'Bearer user-token',
    );
    expect(http).toHaveBeenLastCalledWith(
      'http://production/api/v1/production/orders/os-test/start',
      expect.objectContaining({
        body: JSON.stringify({ approved: true }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer user-token',
        },
      }),
    );
  });
  it.each([
    [400, BadRequestException],
    [404, BadGatewayException],
    [403, ForbiddenException],
    [409, ConflictException],
    [503, BadGatewayException],
  ])('maps HTTP %i to a useful boundary error', async (status, error) => {
    process.env.BILLING_SERVICE_URL = 'http://billing';
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status,
      json: async () => ({}),
    } as Response);
    await expect(
      setup().service.remote('billing', '/orders'),
    ).rejects.toBeInstanceOf(error);
  });
  it('accepts a plain response and omits an absent internal token', async () => {
    process.env.PRODUCTION_SERVICE_URL = 'http://production';
    delete process.env.AUTH_CLIENT_LOOKUP_TOKEN;
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ diagnosis: 'plain' }),
    } as Response);
    await expect(
      setup().service.remote('production', '/internal/orders/id'),
    ).resolves.toEqual({ diagnosis: 'plain' });
  });
});
