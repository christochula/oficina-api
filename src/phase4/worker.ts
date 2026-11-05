import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';
import { PrismaService } from '../shared/database/prisma.service';
import { command, Message } from './contracts';
import { OrderStore } from './store';
import { transition } from './saga';
import { DistributedOrders } from './service';
import { TelemetryService } from '../shared/observability/telemetry.service';
import tracer from 'dd-trace';
import { captureTraceparent } from '../shared/observability/trace-context';

@Injectable()
export class SagaWorker implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setTimeout>;
  private stopped = false;
  private readonly logger = new Logger('SagaWorker');
  private readonly sqs = new SQSClient({
    region: process.env.AWS_REGION || 'us-east-1',
    endpoint: process.env.AWS_ENDPOINT_URL,
  });
  constructor(
    private readonly db: PrismaService,
    private readonly store: OrderStore,
    private readonly orders: DistributedOrders,
    private readonly telemetry: TelemetryService,
  ) {}
  onModuleInit() {
    if (process.env.SAGA_WORKER_ENABLED !== 'false') void this.loop();
  }
  onModuleDestroy() {
    this.stopped = true;
    clearTimeout(this.timer);
    this.sqs.destroy();
  }
  async loop() {
    try {
      await this.tick();
    } catch {
      this.logger.error('saga_worker_failed');
    }
    if (!this.stopped) this.timer = setTimeout(() => void this.loop(), 1000);
  }
  async tick() {
    // Row lock/lease keeps multiple replicas from publishing the same work concurrently.
    await this.db.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<
          {
            id: string;
            destination: string;
            message: Message;
            attempts: number;
          }[]
        >`
        SELECT id,destination,message,attempts FROM phase4_outbox WHERE sent_at IS NULL AND available_at<=now()
        ORDER BY available_at FOR UPDATE SKIP LOCKED LIMIT 10`;
        for (const row of rows) {
          try {
            if (row.destination.startsWith('REGISTER_')) {
              await this.orders.remote(
                row.destination === 'REGISTER_BILLING'
                  ? 'billing'
                  : 'production',
                '/internal/orders',
                'POST',
                row.message.payload,
              );
            } else {
              const queue = process.env[`${row.destination}_QUEUE_URL`];
              if (!queue) throw new Error('Fila não configurada');
              await this.sqs.send(
                new SendMessageCommand({
                  QueueUrl: queue,
                  MessageBody: JSON.stringify(row.message),
                  ...(queue.endsWith('.fifo')
                    ? {
                        MessageGroupId: row.message.osId,
                        MessageDeduplicationId: row.message.messageId,
                      }
                    : {}),
                }),
              );
            }
            await tx.$executeRaw`UPDATE phase4_outbox SET sent_at=now(),last_error=NULL WHERE id=${row.id}`;
          } catch {
            const delay = Math.min(300, 2 ** Math.min(row.attempts + 1, 8));
            await tx.$executeRaw`UPDATE phase4_outbox SET attempts=attempts+1,available_at=now()+${delay}*interval '1 second',last_error='Delivery failed; inspect service/queue' WHERE id=${row.id}`;
            this.logger.warn(
              JSON.stringify({
                event: 'outbox_retry',
                messageId: row.id,
                osId: row.message.osId,
                sagaId: row.message.sagaId,
                correlationId: row.message.correlationId,
              }),
            );
          }
        }
      },
      { timeout: 120000 },
    );
    const queue = process.env.INBOX_QUEUE_URL;
    if (queue) {
      const batch = await this.sqs.send(
        new ReceiveMessageCommand({
          QueueUrl: queue,
          MaxNumberOfMessages: 10,
          WaitTimeSeconds: 1,
          VisibilityTimeout: 60,
        }),
      );
      for (const item of batch.Messages || []) {
        try {
          const event = JSON.parse(item.Body || '{}') as Message;
          if (
            !event.messageId ||
            !event.osId ||
            !event.filialId ||
            event.version !== 1
          )
            throw new Error('Envelope inválido');
          const parent = event.traceparent
            ? tracer.extract('http_headers', { traceparent: event.traceparent })
            : null;
          await tracer.trace(
            'oficina.saga.transition',
            {
              childOf: parent || undefined,
              tags: {
                'saga.id': event.sagaId,
                'os.id': event.osId,
                'correlation.id': event.correlationId,
                'message.type': event.type,
              },
            },
            async () => {
              const result = await this.store.mutate(
                event.osId,
                (order) => {
                  order.traceparent =
                    captureTraceparent(event.traceparent) || order.traceparent;
                  return transition(order, event);
                },
                event.messageId,
              );
              if (result)
                this.telemetry.sagaTransition(event.type, result.sagaState);
              this.telemetry.messageProcessed();
              this.logger.log(
                JSON.stringify({
                  event: 'saga_event',
                  type: event.type,
                  osId: event.osId,
                  sagaId: event.sagaId,
                  correlationId: event.correlationId,
                }),
              );
            },
          );
          await this.sqs.send(
            new DeleteMessageCommand({
              QueueUrl: queue,
              ReceiptHandle: item.ReceiptHandle,
            }),
          );
        } catch {
          this.telemetry.messageProcessed(true);
          this.logger.error(
            'saga_event_failed; message retained for retry/DLQ',
          );
        }
      }
    }
    const ages: Record<string, number> = {
      PREPARING_BUDGET: 0,
      RESERVING_EXECUTION: 0,
      CONFIRMING_EXECUTION: 0,
      COMPENSATING: 0,
    };
    for (const order of await this.store.list()) {
      if (order.deadline && order.sagaState in ages)
        ages[order.sagaState] = Math.max(
          ages[order.sagaState],
          (Date.now() - Date.parse(order.atualizadoEm)) / 1000,
        );
      if (order.deadline && Date.parse(order.deadline) < Date.now()) {
        await this.store.mutate(order.id, (current) =>
          current.deadline && Date.parse(current.deadline) < Date.now()
            ? transition(current, command(current, 'StepTimedOut'))
            : [],
        );
      }
    }
    for (const [step, age] of Object.entries(ages))
      this.telemetry.sagaPendingAge(age, step);
  }
}
