import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../shared/database/prisma.service';
import { command, Order } from './contracts';
import { OrderStore } from './store';

function order(): Order {
  return {
    id: 'os-test',
    numero: 0,
    filialId: 'filial-sp',
    clienteId: 'cl-test',
    veiculoId: 've-test',
    status: 'RECEBIDA',
    sagaId: 'saga-test',
    sagaState: 'AWAITING_DIAGNOSIS',
    paymentConfirmed: false,
    problemasRelatados: [],
    servicosSolicitados: [],
    criadoEm: '2026-11-04T12:00:00Z',
    atualizadoEm: '2026-11-04T12:00:00Z',
    historico: [],
  };
}
function setup() {
  const tx = {
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn().mockResolvedValue(1),
  };
  const prisma = {
    $queryRaw: jest.fn(),
    $transaction: jest.fn(
      async (run: (client: typeof tx) => Promise<unknown>) => run(tx),
    ),
  };
  return {
    store: new OrderStore(prisma as unknown as PrismaService),
    prisma,
    tx,
  };
}

describe('OrderStore transactional ownership', () => {
  it('creates an OS and its integration intents in one transaction', async () => {
    const { store, prisma, tx } = setup();
    tx.$queryRaw.mockResolvedValue([{ numero: 42 }]);
    const value = order();
    const message = command(value, 'RegisterOrder');
    await expect(
      store.create(value, [{ destination: 'REGISTER_BILLING', message }]),
    ).resolves.toMatchObject({ numero: 42 });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const update = tx.$executeRaw.mock.calls[0];
    expect(JSON.parse(update[1] as string)).toMatchObject({
      id: 'os-test',
      numero: 42,
    });
    const outbox = tx.$executeRaw.mock.calls[1];
    expect((outbox as unknown[]).slice(1)).toEqual([
      message.messageId,
      'REGISTER_BILLING',
      JSON.stringify(message),
    ]);
  });

  it('propagates an outbox failure so the OS transaction cannot commit alone', async () => {
    const { store, tx } = setup();
    tx.$queryRaw.mockResolvedValue([{ numero: 42 }]);
    tx.$executeRaw
      .mockResolvedValueOnce(1)
      .mockRejectedValueOnce(new Error('outbox unavailable'));
    const value = order();
    await expect(
      store.create(value, [
        {
          destination: 'BILLING',
          message: command(value, 'PrepareApprovedBudget'),
        },
      ]),
    ).rejects.toThrow('outbox unavailable');
  });

  it('returns stored documents and rejects an unknown OS', async () => {
    const { store, prisma } = setup();
    const value = order();
    prisma.$queryRaw
      .mockResolvedValueOnce([{ data: value }])
      .mockResolvedValueOnce([{ data: value }])
      .mockResolvedValueOnce([]);
    await expect(store.list()).resolves.toEqual([value]);
    await expect(store.get(value.id)).resolves.toEqual(value);
    await expect(store.get('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('deduplicates before applying any business transition or producing outbox work', async () => {
    const { store, tx } = setup();
    tx.$executeRaw.mockResolvedValueOnce(0);
    const change = jest.fn();
    await expect(
      store.mutate('os-test', change, 'already-seen'),
    ).resolves.toBeUndefined();
    expect(change).not.toHaveBeenCalled();
    expect(tx.$queryRaw).not.toHaveBeenCalled();
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('reports only unsent participant registrations scoped to the requested OS', async () => {
    const { store, prisma } = setup();
    prisma.$queryRaw.mockResolvedValueOnce([
      { destination: 'REGISTER_PRODUCTION' },
      { destination: 'REGISTER_BILLING' },
      { destination: 'REGISTER_BILLING' },
    ]);
    await expect(store.pendingRegistrations('os-test')).resolves.toEqual([
      'production',
      'billing',
    ]);
    const [query, ...parameters] = prisma.$queryRaw.mock.calls[0] as [
      TemplateStringsArray,
      ...unknown[],
    ];
    expect(query.join('?')).toContain('sent_at IS NULL');
    expect(query.join('?')).toContain("message->>'osId'=?");
    expect(query.join('?')).toContain(
      "destination IN ('REGISTER_BILLING','REGISTER_PRODUCTION')",
    );
    expect(parameters).toEqual(['os-test']);
    prisma.$queryRaw.mockResolvedValueOnce([]);
    await expect(store.pendingRegistrations('os-test')).resolves.toEqual([]);
  });

  it('locks the OS and atomically persists inbox, transition and outgoing command', async () => {
    const { store, tx } = setup();
    const value = order();
    tx.$queryRaw.mockResolvedValue([{ data: value }]);
    const message = command(value, 'ReserveExecution');
    await expect(
      store.mutate(
        value.id,
        (current) => {
          current.status = 'APROVADA';
          return [{ destination: 'PRODUCTION', message }];
        },
        'new-event',
      ),
    ).resolves.toMatchObject({ status: 'APROVADA' });
    expect(
      (tx.$queryRaw.mock.calls[0][0] as TemplateStringsArray).join('?'),
    ).toContain('FOR UPDATE');
    expect(tx.$executeRaw).toHaveBeenCalledTimes(3);
    expect(JSON.parse(tx.$executeRaw.mock.calls[1][1] as string)).toMatchObject(
      { status: 'APROVADA' },
    );
  });

  it('rolls back missing-order and rejected transitions without writing order/outbox', async () => {
    const { store, tx } = setup();
    tx.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ data: order() }]);
    await expect(store.mutate('missing', () => [])).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      store.mutate('os-test', () => {
        throw new Error('invalid state');
      }),
    ).rejects.toThrow('invalid state');
    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });
});
