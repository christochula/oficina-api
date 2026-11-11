import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { GetQueueAttributesCommand, SQSClient } from '@aws-sdk/client-sqs';
import { JsonLoggerService } from './json-logger.service';
import { TelemetryService } from './telemetry.service';

interface QueueReference {
  url: string;
  name: string;
  region: string;
  partition: string;
  account?: string;
}

const validName = (name: string) =>
  name.length <= 80 && /^[A-Za-z0-9_-]+(?:\.fifo)?$/.test(name);

/** Read-only, opt-in queue gauges; never receives or deletes messages. */
@Injectable()
export class SqsQueueTelemetry implements OnModuleInit, OnModuleDestroy {
  private client?: SQSClient;
  private timer?: ReturnType<typeof setInterval>;
  private readonly shutdown = new AbortController();
  private queues: QueueReference[] = [];
  private collecting = false;
  private stopped = false;
  private region = 'us-east-1';
  private endpoint?: string;

  constructor(
    private readonly telemetry: TelemetryService,
    private readonly logger: JsonLoggerService,
  ) {}

  onModuleInit(): void {
    if (
      process.env.DD_METRICS_ENABLED !== 'true' ||
      this.client ||
      this.stopped
    )
      return;
    this.region = process.env.AWS_REGION || 'us-east-1';
    this.endpoint = process.env.AWS_ENDPOINT_URL;
    for (const value of new Set([
      process.env.INBOX_QUEUE_URL,
      process.env.BILLING_QUEUE_URL,
      process.env.PRODUCTION_QUEUE_URL,
    ])) {
      if (!value?.trim()) continue;
      const queue = this.queueReference(value.trim());
      if (queue) this.queues.push(queue);
      else this.warn('unknown', 'invalid_queue_configuration');
    }
    if (!this.queues.length) return;
    this.client = new SQSClient({
      region: this.region,
      endpoint: this.endpoint,
      maxAttempts: 2,
    });
    void this.collect();
    this.timer = setInterval(() => void this.collect(), 30_000);
    this.timer.unref();
  }

  async collect(): Promise<void> {
    if (!this.client || this.stopped || this.collecting) return;
    this.collecting = true;
    const seen = new Set<string>();
    try {
      for (const queue of this.queues) {
        if (this.stopped) break;
        const attributes = await this.sample(queue, 'inbox', seen);
        if (!attributes?.RedrivePolicy || this.stopped) continue;
        const dlq = this.deadLetterQueue(queue, attributes.RedrivePolicy);
        if (dlq) await this.sample(dlq, 'dlq', seen);
        else this.warn(queue.name, 'invalid_redrive_policy');
      }
    } finally {
      this.collecting = false;
    }
  }

  onModuleDestroy(): void {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.shutdown.abort();
    this.client?.destroy();
    this.client = undefined;
  }

  private async sample(
    queue: QueueReference,
    role: 'inbox' | 'dlq',
    seen: Set<string>,
  ): Promise<Record<string, string> | undefined> {
    const key = `${role}:${queue.url}`;
    if (seen.has(key) || this.stopped) return;
    seen.add(key);
    try {
      const { Attributes } = await this.client!.send(
        new GetQueueAttributesCommand({
          QueueUrl: queue.url,
          AttributeNames: [
            'ApproximateNumberOfMessages',
            'ApproximateNumberOfMessagesNotVisible',
            'ApproximateNumberOfMessagesDelayed',
            ...(role === 'inbox' ? (['RedrivePolicy'] as const) : []),
          ],
        }),
        {
          abortSignal: AbortSignal.any([
            this.shutdown.signal,
            AbortSignal.timeout(10_000),
          ]),
        },
      );
      if (this.stopped) return;
      const counts = [
        Attributes?.ApproximateNumberOfMessages,
        Attributes?.ApproximateNumberOfMessagesNotVisible,
        Attributes?.ApproximateNumberOfMessagesDelayed,
      ];
      if (
        counts.every(
          (value) =>
            typeof value === 'string' &&
            /^\d+$/.test(value) &&
            Number.isSafeInteger(Number(value)),
        )
      ) {
        const tags = { queue: queue.name, role };
        ['visible', 'inflight', 'delayed'].forEach((name, index) =>
          this.telemetry.gauge(
            `oficina.messaging.queue.${name}`,
            Number(counts[index]),
            tags,
          ),
        );
      } else this.warn(queue.name, 'invalid_queue_attributes');
      return Attributes;
    } catch {
      if (!this.stopped) this.warn(queue.name, 'queue_attributes_unavailable');
      return;
    }
  }

  private queueReference(value: string): QueueReference | null {
    try {
      const url = new URL(value);
      if (url.username || url.password || url.search || url.hash) return null;
      const parts = url.pathname.split('/').filter(Boolean);
      const name = parts.at(-1) ?? '';
      if (!validName(name)) return null;
      const aws = /^sqs\.([a-z0-9-]+)\.amazonaws\.com(\.cn)?$/.exec(
        url.hostname,
      );
      if (aws) {
        if (
          url.protocol !== 'https:' ||
          url.port ||
          aws[1] !== this.region ||
          parts.length !== 2 ||
          !/^\d{12}$/.test(parts[0])
        )
          return null;
        return {
          url: url.href,
          name,
          region: aws[1],
          account: parts[0],
          partition: aws[2]
            ? 'aws-cn'
            : aws[1].startsWith('us-gov-')
              ? 'aws-us-gov'
              : 'aws',
        };
      }
      // Local endpoints are explicit; a URL without an account can report inbox
      // counts, but cannot safely derive a DLQ URL from another account's ARN.
      if (
        !this.endpoint ||
        !['http:', 'https:'].includes(url.protocol) ||
        url.origin !== new URL(this.endpoint).origin
      )
        return null;
      return {
        url: url.href,
        name,
        region: this.region,
        partition: 'aws',
        account:
          parts.length === 2 && /^\d{12}$/.test(parts[0])
            ? parts[0]
            : undefined,
      };
    } catch {
      return null;
    }
  }

  private deadLetterQueue(
    source: QueueReference,
    policy: string,
  ): QueueReference | null {
    try {
      const decoded: unknown = JSON.parse(policy);
      if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded))
        return null;
      const arn = (decoded as Record<string, unknown>).deadLetterTargetArn;
      if (typeof arn !== 'string') return null;
      const match =
        /^arn:(aws|aws-cn|aws-us-gov):sqs:([a-z0-9-]+):(\d{12}):(.+)$/.exec(
          arn,
        );
      if (
        !match ||
        !source.account ||
        match[1] !== source.partition ||
        match[2] !== source.region ||
        match[3] !== source.account ||
        !validName(match[4]) ||
        source.name.endsWith('.fifo') !== match[4].endsWith('.fifo')
      )
        return null;
      const url = new URL(source.url);
      url.pathname = `/${source.account}/${match[4]}`;
      return { ...source, name: match[4], url: url.href };
    } catch {
      return null;
    }
  }

  private warn(queue: string, reason: string): void {
    try {
      this.logger.warn(
        { event: 'sqs_queue_telemetry_failed', queue, reason },
        SqsQueueTelemetry.name,
      );
    } catch {
      // Observability must not interrupt a business operation or lifecycle hook.
    }
  }
}
