import 'reflect-metadata';
import { UnauthorizedException } from '@nestjs/common';
import { PAPEIS_KEY } from '../auth/decorators/papeis.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { PrismaService } from '../shared/database/prisma.service';
import { PapelUsuario as Role } from '../usuario/domain/papel-usuario.enum';
import { GerarOrcamentoDto } from '../ordem-servico/interfaces/http/v1/dtos/gerar-orcamento.dto';
import {
  DistributedOrdersController,
  ClientLookupController,
} from './controller';
import { DistributedOrders } from './service';

const user: JwtPayload = { sub: 'user-test', papel: Role.ADMINISTRADOR };
const token = 'Bearer test-user-token';
describe('DistributedOrders HTTP facade', () => {
  const service = {
    open: jest.fn(),
    list: jest.fn(),
    read: jest.fn(),
    forward: jest.fn(),
    deliver: jest.fn(),
    retry: jest.fn(),
  };
  const controller = new DistributedOrdersController(
    service as unknown as DistributedOrders,
  );
  beforeEach(() => jest.clearAllMocks());

  it('keeps role restrictions on sensitive actions', () => {
    expect(
      Reflect.getMetadata(
        PAPEIS_KEY,
        Object.getOwnPropertyDescriptor(
          DistributedOrdersController.prototype,
          'open',
        )!.value as object,
      ),
    ).toEqual([Role.ADMINISTRADOR, Role.CONSULTOR_TECNICO]);
    expect(
      Reflect.getMetadata(
        PAPEIS_KEY,
        Object.getOwnPropertyDescriptor(
          DistributedOrdersController.prototype,
          'approve',
        )!.value as object,
      ),
    ).toEqual([Role.CLIENTE]);
    expect(
      Reflect.getMetadata(
        PAPEIS_KEY,
        Object.getOwnPropertyDescriptor(
          DistributedOrdersController.prototype,
          'checkout',
        )!.value as object,
      ),
    ).toEqual([Role.CLIENTE]);
    expect(
      Reflect.getMetadata(
        PAPEIS_KEY,
        Object.getOwnPropertyDescriptor(
          DistributedOrdersController.prototype,
          'diagnosis',
        )!.value as object,
      ),
    ).toEqual([Role.MECANICO]);
    expect(
      Reflect.getMetadata(
        PAPEIS_KEY,
        Object.getOwnPropertyDescriptor(
          DistributedOrdersController.prototype,
          'deliver',
        )!.value as object,
      ),
    ).toEqual([Role.ADMINISTRADOR, Role.CONSULTOR_TECNICO]);
  });

  it('preserves the existing list/read aliases with the caller identity', () => {
    const query = { status: 'RECEBIDA' };
    void controller.open({ clienteId: 'cl', veiculoId: 've' }, user);
    expect(service.open).toHaveBeenCalledWith(
      { clienteId: 'cl', veiculoId: 've' },
      user,
    );
    void controller.list(user, query);
    void controller.queue(user, query);
    void controller.mine(user, query);
    void controller.mechanic(user, query);
    expect(service.list).toHaveBeenCalledTimes(4);
    expect(service.list).toHaveBeenLastCalledWith(user, query);
    void controller.read('os', user);
    void controller.clientRead('os', user);
    void controller.mechanicRead('os', user);
    expect(service.read).toHaveBeenCalledTimes(3);
    expect(service.read).toHaveBeenLastCalledWith('os', user);
  });

  it('routes production commands to their owner with the original authorization', () => {
    void controller.assign('os', 'mech', user, token);
    void controller.diagnosis('os', { descricao: 'Freios' }, user, token);
    void controller.start('os', user, token);
    void controller.consume(
      'os',
      { pecaId: 'oil', quantidade: 2 },
      user,
      token,
    );
    void controller.complete('os', user, token);
    expect(service.forward.mock.calls).toEqual([
      ['os', user, token, 'production', 'assign', { mecanicoId: 'mech' }],
      ['os', user, token, 'production', 'diagnosis', { descricao: 'Freios' }],
      ['os', user, token, 'production', 'start'],
      [
        'os',
        user,
        token,
        'production',
        'consume',
        { pecaId: 'oil', quantidade: 2 },
      ],
      ['os', user, token, 'production', 'complete'],
    ]);
  });

  it('converts legacy grouped prices from reais into integer cents without losing quantity or material ID', () => {
    void controller.budget(
      'os',
      {
        grupos: [
          {
            titulo: 'Service',
            linhas: [
              {
                descricao: 'Oil',
                quantidade: 2,
                valorUnitario: 10.29,
                pecaId: 'oil',
              },
              { descricao: 'Labor', quantidade: 1, valorUnitario: 20.01 },
            ],
          },
        ],
      } as GerarOrcamentoDto,
      user,
      token,
    );
    expect(service.forward).toHaveBeenLastCalledWith(
      'os',
      user,
      token,
      'billing',
      'budget',
      {
        items: [
          {
            description: 'Oil',
            quantity: 2,
            unitPriceCents: 1029,
            pecaId: 'oil',
          },
          { description: 'Labor', quantity: 1, unitPriceCents: 2001 },
        ],
      },
      'PUT',
    );
    void controller.budget('os', {} as GerarOrcamentoDto, user, token);
    expect(service.forward).toHaveBeenLastCalledWith(
      'os',
      user,
      token,
      'billing',
      'budget',
      { items: [] },
      'PUT',
    );
    void controller.budget(
      'os',
      { grupos: [{ titulo: 'Empty' }] } as GerarOrcamentoDto,
      user,
      token,
    );
    expect(service.forward).toHaveBeenLastCalledWith(
      'os',
      user,
      token,
      'billing',
      'budget',
      { items: [] },
      'PUT',
    );
  });

  it('keeps approval, rejection, checkout and delivery as separate owner actions', () => {
    void controller.approve('os', user, token);
    void controller.reject('os', user, token);
    void controller.checkout('os', user, token);
    expect(service.forward.mock.calls).toEqual([
      ['os', user, token, 'billing', 'approve'],
      ['os', user, token, 'billing', 'reject'],
      ['os', user, token, 'billing', 'checkout'],
    ]);
    void controller.deliver('os', user);
    void controller.retry('os');
    expect(service.deliver).toHaveBeenCalledWith('os', user);
    expect(service.retry).toHaveBeenCalledWith('os');
  });
});

describe('ClientLookupController internal boundary', () => {
  const saved = { ...process.env };
  const expected = 'secure-internal-token-with-more-than-32-bytes';
  const db = { cliente: { findUnique: jest.fn() } };
  const controller = new ClientLookupController(db as unknown as PrismaService);
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.AUTH_CLIENT_LOOKUP_TOKEN = expected;
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it.each(['', 'short', 'x'.repeat(expected.length)])(
    'rejects invalid internal credential before querying clients',
    async (received) => {
      await expect(
        controller.lookup(received, { cpf: '52998224725' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(db.cliente.findUnique).not.toHaveBeenCalled();
    },
  );
  it('rejects a weak configured token and malformed document', async () => {
    process.env.AUTH_CLIENT_LOOKUP_TOKEN = 'short';
    await expect(
      controller.lookup('short', { cpf: '52998224725' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    process.env.AUTH_CLIENT_LOOKUP_TOKEN = expected;
    await expect(
      controller.lookup(expected, { cpf: '' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(db.cliente.findUnique).not.toHaveBeenCalled();
  });
  it.each([null, { id: 'inactive', ativo: false }])(
    'keeps missing/inactive customers indistinguishable',
    async (identity) => {
      db.cliente.findUnique.mockResolvedValue(identity);
      await expect(
        controller.lookup(expected, { cpf: '52998224725' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    },
  );
  it('normalizes CPF and returns only the selected customer identity', async () => {
    const identity = {
      id: 'cl-test',
      nome: 'Demo',
      email: 'demo@example.test',
      ativo: true,
    };
    db.cliente.findUnique.mockResolvedValue(identity);
    await expect(
      controller.lookup(expected, { cpf: '529.982.247-25' }),
    ).resolves.toEqual(identity);
    expect(db.cliente.findUnique).toHaveBeenCalledWith({
      where: { numeroDoc: '52998224725' },
      select: { id: true, nome: true, email: true, ativo: true },
    });
  });
});
