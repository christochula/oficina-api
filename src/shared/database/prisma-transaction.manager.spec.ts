import { Prisma } from '@prisma/client';
import { PrismaTransactionManager } from './prisma-transaction.manager';

describe('PrismaTransactionManager', () => {
  const tx = { $queryRaw: jest.fn().mockResolvedValue([]) };
  const prisma = { $transaction: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    );
  });

  it('executa callback com isolamento Serializable', async () => {
    const manager = new PrismaTransactionManager(prisma as any);
    await expect(
      manager.executarSerializavel(async () => 'resultado'),
    ).resolves.toBe('resultado');

    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  });

  it('repete a transação quando Prisma retorna P2034', async () => {
    prisma.$transaction
      .mockRejectedValueOnce({ code: 'P2034' })
      .mockRejectedValueOnce({ code: 'P2034' });
    const manager = new PrismaTransactionManager(prisma as any);

    await expect(manager.executarSerializavel(async () => 'ok')).resolves.toBe(
      'ok',
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
  });

  it('não repete erros que não são conflitos de serialização', async () => {
    prisma.$transaction.mockRejectedValueOnce({ code: 'P2002' });
    const manager = new PrismaTransactionManager(prisma as any);

    await expect(
      manager.executarSerializavel(async () => 'ok'),
    ).rejects.toEqual({ code: 'P2002' });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('adquire advisory lock usando o cliente transacional', async () => {
    const manager = new PrismaTransactionManager(prisma as any);

    await manager.executarSerializavel(async () => {
      await manager.bloquear('oficina:usuario:us_01');
    });

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    const query = tx.$queryRaw.mock.calls[0][0] as Prisma.Sql;
    expect(query.sql).toContain(
      'pg_advisory_xact_lock(hashtext(?))::text AS lock_result',
    );
  });

  it('rejeita advisory lock fora de transação', async () => {
    const manager = new PrismaTransactionManager(prisma as any);
    await expect(manager.bloquear('chave')).rejects.toThrow(
      'fora de uma transação',
    );
  });
});
