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
import { Order } from './contracts';
import { OrderStore } from './store';
import { DistributedOrders } from './service';

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
  const store = {
    get: jest.fn().mockResolvedValue(value),
    list: jest.fn().mockResolvedValue([value]),
    pendingRegistrations: jest.fn().mockResolvedValue([]),
    create: jest.fn(async (created: Order) => created),
    mutate: jest.fn(
      async (_id: string, change: (current: Order) => unknown) => {
        change(value);
        return value;
      },
    ),
  };
  const prisma = {
    cliente: {
      findUnique: jest.fn().mockResolvedValue({ id: 'cl-test', ativo: true }),
      create: jest.fn().mockResolvedValue({ id: 'new-client' }),
    },
    veiculo: {
      findUnique: jest.fn().mockResolvedValue({ id: 've-test', ativo: true }),
      create: jest.fn().mockResolvedValue({ id: 'new-vehicle' }),
    },
  };
  return {
    service: new DistributedOrders(
      store as unknown as OrderStore,
      prisma as unknown as PrismaService,
    ),
    store,
    prisma,
    value,
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
    const { service, store } = setup();
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
    expect(store.create.mock.calls[0][1]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ destination: 'REGISTER_BILLING' }),
        expect.objectContaining({ destination: 'REGISTER_PRODUCTION' }),
      ]),
    );
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
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue({ ok: false, status } as Response);
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
