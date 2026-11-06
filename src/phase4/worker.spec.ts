import { Logger } from '@nestjs/common';
import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';
import { PrismaService } from '../shared/database/prisma.service';
import { TelemetryService } from '../shared/observability/telemetry.service';
import { command, Order } from './contracts';
import { OrderStore } from './store';
import { DistributedOrders } from './service';
import { SagaWorker } from './worker';

function fixture(): Order {
  return {
    id: 'os-test',
    numero: 1,
    filialId: 'filial-sp',
    clienteId: 'cl-test',
    veiculoId: 've-test',
    status: 'AGUARDANDO_APROVACAO',
    sagaId: 'saga-test',
    sagaState: 'AWAITING_APPROVAL',
    paymentConfirmed: false,
    problemasRelatados: [],
    servicosSolicitados: [],
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
    historico: [],
  };
}
function setup() {
  const value = fixture();
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    $executeRaw: jest.fn().mockResolvedValue(1),
  };
  const db = {
    $transaction: jest.fn(async (run: (client: typeof tx) => unknown) =>
      run(tx),
    ),
  };
  const store = {
    list: jest.fn().mockResolvedValue([]),
    mutate: jest.fn(async (_id: string, change: (order: Order) => unknown) => {
      change(value);
      return value;
    }),
  };
  const orders = { remote: jest.fn().mockResolvedValue({}) };
  const telemetry = {
    sagaTransition: jest.fn(),
    messageProcessed: jest.fn(),
    sagaPendingAge: jest.fn(),
  };
  const worker = new SagaWorker(
    db as unknown as PrismaService,
    store as unknown as OrderStore,
    orders as unknown as DistributedOrders,
    telemetry as unknown as TelemetryService,
  );
  return { worker, tx, db, store, orders, telemetry, value };
}
describe('SagaWorker durable messaging and retries', () => {
  const saved = { ...process.env };
  let send: jest.Mock;
  beforeEach(() => {
    delete process.env.INBOX_QUEUE_URL;
    delete process.env.BILLING_QUEUE_URL;
    delete process.env.PRODUCTION_QUEUE_URL;
    send = jest
      .spyOn(SQSClient.prototype, 'send')
      .mockImplementation(jest.fn()) as unknown as jest.Mock;
    jest
      .spyOn(SQSClient.prototype, 'destroy')
      .mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });
  afterEach(() => {
    process.env = { ...saved };
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('publishes FIFO commands under the OS group and stable outbox deduplication ID', async () => {
    const { worker, tx, value } = setup();
    const message = command(value, 'ReserveExecution');
    process.env.PRODUCTION_QUEUE_URL = 'https://sqs.test/production.fifo';
    tx.$queryRaw.mockResolvedValue([
      { id: 'outbox-id', destination: 'PRODUCTION', attempts: 0, message },
    ]);
    send.mockResolvedValue({});
    await worker.tick();
    expect(send.mock.calls[0][0]).toBeInstanceOf(SendMessageCommand);
    expect((send.mock.calls[0][0] as SendMessageCommand).input).toMatchObject({
      QueueUrl: process.env.PRODUCTION_QUEUE_URL,
      MessageGroupId: value.id,
      MessageDeduplicationId: message.messageId,
      MessageBody: JSON.stringify(message),
    });
    expect(
      (tx.$executeRaw.mock.calls[0][0] as TemplateStringsArray).join('?'),
    ).toContain('sent_at=now()');
    worker.onModuleDestroy();
  });

  it('registers remote snapshots through authenticated owner APIs before marking delivery sent', async () => {
    const { worker, tx, orders, value } = setup();
    const message = command(value, 'RegisterOrder', {
      clienteId: value.clienteId,
    });
    tx.$queryRaw.mockResolvedValue([
      { id: 'billing', destination: 'REGISTER_BILLING', attempts: 0, message },
      {
        id: 'production',
        destination: 'REGISTER_PRODUCTION',
        attempts: 0,
        message,
      },
    ]);
    await worker.tick();
    expect(orders.remote.mock.calls).toEqual([
      ['billing', '/internal/orders', 'POST', message.payload],
      ['production', '/internal/orders', 'POST', message.payload],
    ]);
    expect(send).not.toHaveBeenCalled();
    expect(tx.$executeRaw).toHaveBeenCalledTimes(2);
    worker.onModuleDestroy();
  });

  it('retains failed delivery in the outbox with bounded backoff and continues the batch', async () => {
    const { worker, tx, value } = setup();
    process.env.BILLING_QUEUE_URL = 'https://sqs.test/billing';
    const message = command(value, 'PrepareApprovedBudget');
    tx.$queryRaw.mockResolvedValue([
      {
        id: 'missing-config',
        destination: 'PRODUCTION',
        attempts: 1000,
        message,
      },
      { id: 'retry', destination: 'BILLING', attempts: 0, message },
      { id: 'success', destination: 'BILLING', attempts: 0, message },
    ]);
    send
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce({});
    await worker.tick();
    expect((tx.$executeRaw.mock.calls[0] as unknown[]).slice(1)).toEqual([
      256,
      'missing-config',
    ]);
    expect((tx.$executeRaw.mock.calls[1] as unknown[]).slice(1)).toEqual([
      2,
      'retry',
    ]);
    expect(
      (tx.$executeRaw.mock.calls[2][0] as TemplateStringsArray).join('?'),
    ).toContain('sent_at=now()');
    expect(
      (send.mock.calls[1][0] as SendMessageCommand).input.MessageGroupId,
    ).toBeUndefined();
    worker.onModuleDestroy();
  });

  it('acknowledges only after the inbox transition commits and treats redelivery as success', async () => {
    const { worker, store, telemetry, value } = setup();
    process.env.INBOX_QUEUE_URL = 'https://sqs.test/os-events';
    const event = command(value, 'BudgetApproved');
    send
      .mockResolvedValueOnce({
        Messages: [{ Body: JSON.stringify(event), ReceiptHandle: 'receipt' }],
      })
      .mockResolvedValueOnce({});
    await worker.tick();
    expect(send.mock.calls[0][0]).toBeInstanceOf(ReceiveMessageCommand);
    expect(store.mutate).toHaveBeenCalledWith(
      value.id,
      expect.any(Function),
      event.messageId,
    );
    expect(value.sagaState).toBe('PREPARING_BUDGET');
    expect(telemetry.sagaTransition).toHaveBeenCalledWith(
      'BudgetApproved',
      'PREPARING_BUDGET',
    );
    expect(send.mock.calls[1][0]).toBeInstanceOf(DeleteMessageCommand);
    expect(
      (send.mock.calls[1][0] as DeleteMessageCommand).input.ReceiptHandle,
    ).toBe('receipt');
    store.mutate.mockResolvedValueOnce(undefined);
    send
      .mockResolvedValueOnce({
        Messages: [{ Body: JSON.stringify(event), ReceiptHandle: 'duplicate' }],
      })
      .mockResolvedValueOnce({});
    await worker.tick();
    expect(telemetry.sagaTransition).toHaveBeenCalledTimes(1);
    expect(telemetry.messageProcessed).toHaveBeenCalledTimes(2);
    worker.onModuleDestroy();
  });

  it.each([
    undefined,
    '{invalid',
    JSON.stringify({ messageId: 'invalid', version: 2 }),
  ])('does not delete malformed events, allowing retry/DLQ', async (body) => {
    const { worker, store, telemetry } = setup();
    process.env.INBOX_QUEUE_URL = 'https://sqs.test/os-events';
    send.mockResolvedValue({
      Messages: [{ Body: body, ReceiptHandle: 'bad' }],
    });
    await worker.tick();
    expect(store.mutate).not.toHaveBeenCalled();
    expect(telemetry.messageProcessed).toHaveBeenCalledWith(true);
    expect(send).toHaveBeenCalledTimes(1);
    worker.onModuleDestroy();
  });

  it('leaves business transition failures unacknowledged', async () => {
    const { worker, store, telemetry, value } = setup();
    process.env.INBOX_QUEUE_URL = 'https://sqs.test/os-events';
    store.mutate.mockRejectedValueOnce(new Error('transaction rolled back'));
    send.mockResolvedValue({
      Messages: [
        {
          Body: JSON.stringify(command(value, 'BudgetApproved')),
          ReceiptHandle: 'failed',
        },
      ],
    });
    await worker.tick();
    expect(send).toHaveBeenCalledTimes(1);
    expect(telemetry.messageProcessed).toHaveBeenCalledWith(true);
    worker.onModuleDestroy();
  });

  it('handles empty receives and turns expired automatic work into compensation', async () => {
    const { worker, store, value } = setup();
    process.env.INBOX_QUEUE_URL = 'https://sqs.test/os-events';
    value.sagaState = 'PREPARING_BUDGET';
    value.status = 'APROVADA';
    value.deadline = new Date(Date.now() - 1000).toISOString();
    store.list.mockResolvedValue([
      value,
      { ...fixture(), id: 'waiting-human', deadline: undefined },
      {
        ...fixture(),
        id: 'future',
        deadline: new Date(Date.now() + 60000).toISOString(),
      },
    ]);
    send.mockResolvedValue({});
    await worker.tick();
    expect(value.sagaState).toBe('COMPENSATING');
    expect(store.mutate).toHaveBeenCalledTimes(1);
    worker.onModuleDestroy();
  });

  it('rechecks timeout under the lock when a parallel worker has already cleared it', async () => {
    const { worker, store, value } = setup();
    store.list.mockResolvedValue([
      { ...value, deadline: new Date(Date.now() - 1000).toISOString() },
    ]);
    value.deadline = undefined;
    await worker.tick();
    expect(value.sagaState).toBe('AWAITING_APPROVAL');
    worker.onModuleDestroy();
  });

  it('starts only when enabled and stops rescheduling on module destruction', async () => {
    jest.useFakeTimers();
    const { worker } = setup();
    const tick = jest
      .spyOn(worker, 'tick')
      .mockRejectedValueOnce(new Error('retryable'))
      .mockResolvedValue(undefined);
    process.env.SAGA_WORKER_ENABLED = 'false';
    worker.onModuleInit();
    expect(tick).not.toHaveBeenCalled();
    process.env.SAGA_WORKER_ENABLED = 'true';
    worker.onModuleInit();
    await Promise.resolve();
    await Promise.resolve();
    expect(tick).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1000);
    expect(tick).toHaveBeenCalledTimes(2);
    worker.onModuleDestroy();
    await jest.advanceTimersByTimeAsync(5000);
    expect(tick).toHaveBeenCalledTimes(2);
  });
});
