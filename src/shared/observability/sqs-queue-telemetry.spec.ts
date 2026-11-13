import { GetQueueAttributesCommand, SQSClient } from '@aws-sdk/client-sqs';
import { SqsQueueTelemetry } from './sqs-queue-telemetry';
import { JsonLoggerService } from './json-logger.service';
import { TelemetryService } from './telemetry.service';

const base = 'https://sqs.us-east-1.amazonaws.com/000000000000';
const attributes = (visible = '0', inflight = '0', delayed = '0') => ({
  ApproximateNumberOfMessages: visible,
  ApproximateNumberOfMessagesNotVisible: inflight,
  ApproximateNumberOfMessagesDelayed: delayed,
});
const policy = (name = 'shared-dlq') =>
  JSON.stringify({
    deadLetterTargetArn: `arn:aws:sqs:us-east-1:000000000000:${name}`,
    maxReceiveCount: 3,
  });

describe('SqsQueueTelemetry read-only queue gauges', () => {
  const saved = { ...process.env };
  let send: jest.Mock;
  let destroy: jest.SpyInstance;
  const collectors: SqsQueueTelemetry[] = [];
  beforeEach(() => {
    jest.useFakeTimers();
    process.env.DD_METRICS_ENABLED = 'true';
    process.env.AWS_REGION = 'us-east-1';
    process.env.INBOX_QUEUE_URL = `${base}/os-inbox`;
    delete process.env.BILLING_QUEUE_URL;
    delete process.env.PRODUCTION_QUEUE_URL;
    delete process.env.AWS_ENDPOINT_URL;
    send = jest
      .spyOn(SQSClient.prototype, 'send')
      .mockImplementation(jest.fn()) as unknown as jest.Mock;
    send.mockResolvedValue({ Attributes: attributes() });
    destroy = jest
      .spyOn(SQSClient.prototype, 'destroy')
      .mockImplementation(() => undefined);
  });
  afterEach(() => {
    collectors.splice(0).forEach((collector) => collector.onModuleDestroy());
    process.env = { ...saved };
    jest.restoreAllMocks();
    jest.useRealTimers();
  });
  function setup() {
    const metrics = { gauge: jest.fn() };
    const logger = { warn: jest.fn() };
    const collector = new SqsQueueTelemetry(
      metrics as unknown as TelemetryService,
      logger as unknown as JsonLoggerService,
    );
    collectors.push(collector);
    return { collector, metrics, logger };
  }
  const settle = () => jest.advanceTimersByTimeAsync(0);

  it.each([undefined, 'false', 'TRUE', '1'])(
    'is inert without explicit true (%s)',
    async (flag) => {
      if (flag === undefined) delete process.env.DD_METRICS_ENABLED;
      else process.env.DD_METRICS_ENABLED = flag;
      const { collector, metrics } = setup();
      collector.onModuleInit();
      await collector.collect();
      expect(send).not.toHaveBeenCalled();
      expect(metrics.gauge).not.toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(0);
    },
  );

  it('reports source and same-account DLQ counts, including zero, every 30 seconds', async () => {
    send.mockImplementation((command: GetQueueAttributesCommand) =>
      Promise.resolve({
        Attributes: command.input.QueueUrl?.endsWith('/os-inbox')
          ? { ...attributes('3', '1', '2'), RedrivePolicy: policy() }
          : attributes('0', '0', '1'),
      }),
    );
    const { collector, metrics } = setup();
    collector.onModuleInit();
    collector.onModuleInit();
    await settle();
    expect(send.mock.calls.map(([command]) => command.input.QueueUrl)).toEqual([
      `${base}/os-inbox`,
      `${base}/shared-dlq`,
    ]);
    expect(
      send.mock.calls.every(
        ([command]) => command instanceof GetQueueAttributesCommand,
      ),
    ).toBe(true);
    expect(send.mock.calls[0][0].input.AttributeNames).toEqual([
      'ApproximateNumberOfMessages',
      'ApproximateNumberOfMessagesNotVisible',
      'ApproximateNumberOfMessagesDelayed',
      'RedrivePolicy',
    ]);
    expect(metrics.gauge.mock.calls).toEqual([
      [
        'oficina.messaging.queue.visible',
        3,
        { queue: 'os-inbox', role: 'inbox' },
      ],
      [
        'oficina.messaging.queue.inflight',
        1,
        { queue: 'os-inbox', role: 'inbox' },
      ],
      [
        'oficina.messaging.queue.delayed',
        2,
        { queue: 'os-inbox', role: 'inbox' },
      ],
      [
        'oficina.messaging.queue.visible',
        0,
        { queue: 'shared-dlq', role: 'dlq' },
      ],
      [
        'oficina.messaging.queue.inflight',
        0,
        { queue: 'shared-dlq', role: 'dlq' },
      ],
      [
        'oficina.messaging.queue.delayed',
        1,
        { queue: 'shared-dlq', role: 'dlq' },
      ],
    ]);
    await jest.advanceTimersByTimeAsync(29_999);
    expect(send).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(1);
    expect(send).toHaveBeenCalledTimes(4);
    expect(metrics.gauge).toHaveBeenCalledTimes(12);
  });

  it('collects three participants and reads a shared DLQ only once per cycle', async () => {
    process.env.BILLING_QUEUE_URL = `${base}/billing-inbox`;
    process.env.PRODUCTION_QUEUE_URL = `${base}/production-inbox`;
    send.mockResolvedValue({
      Attributes: { ...attributes(), RedrivePolicy: policy() },
    });
    const { collector, metrics } = setup();
    collector.onModuleInit();
    await settle();
    expect(send).toHaveBeenCalledTimes(4);
    expect(metrics.gauge).toHaveBeenCalledTimes(12);
    expect(
      metrics.gauge.mock.calls.filter(([, , tags]) => tags.role === 'dlq'),
    ).toHaveLength(3);
  });

  it.each([
    '{invalid-private-fixture',
    'null',
    '[]',
    '{}',
    '{"deadLetterTargetArn":123}',
    '{"deadLetterTargetArn":"arn:aws:sns:us-east-1:000000000000:dlq"}',
    '{"deadLetterTargetArn":"arn:aws:sqs:us-west-2:000000000000:dlq"}',
    '{"deadLetterTargetArn":"arn:aws:sqs:us-east-1:111111111111:dlq"}',
    '{"deadLetterTargetArn":"arn:aws-cn:sqs:us-east-1:000000000000:dlq"}',
    policy('../private'),
    policy('different-type.fifo'),
    policy('x'.repeat(81)),
  ])(
    'rejects malformed or foreign redrive metadata without leaking it (%#)',
    async (redrive) => {
      send.mockResolvedValue({
        Attributes: { ...attributes(), RedrivePolicy: redrive },
      });
      const { collector, metrics, logger } = setup();
      collector.onModuleInit();
      await settle();
      expect(send).toHaveBeenCalledTimes(1);
      expect(metrics.gauge).toHaveBeenCalledTimes(3);
      expect(logger.warn).toHaveBeenCalledWith(
        {
          event: 'sqs_queue_telemetry_failed',
          queue: 'os-inbox',
          reason: 'invalid_redrive_policy',
        },
        'SqsQueueTelemetry',
      );
      expect(JSON.stringify(logger.warn.mock.calls)).not.toMatch(
        /arn:|https:|private-fixture/,
      );
    },
  );

  it.each([
    'not-a-url',
    `${base}/`,
    `${base}/bad.name`,
    `${base}/os?private=fixture`,
    `${base}/os#private`,
    'http://sqs.us-east-1.amazonaws.com/000000000000/os',
    'https://private:fixture@sqs.us-east-1.amazonaws.com/000000000000/os',
    'https://sqs.us-west-2.amazonaws.com/000000000000/os',
    'https://sqs.us-east-1.amazonaws.com/not-an-account/os',
    'https://unexpected.example/000000000000/os',
  ])(
    'rejects untrusted queue configuration before any AWS call (%#)',
    async (url) => {
      process.env.INBOX_QUEUE_URL = url;
      const { collector, logger } = setup();
      collector.onModuleInit();
      await settle();
      expect(send).not.toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(0);
      expect(logger.warn).toHaveBeenCalledWith(
        {
          event: 'sqs_queue_telemetry_failed',
          queue: 'unknown',
          reason: 'invalid_queue_configuration',
        },
        'SqsQueueTelemetry',
      );
    },
  );

  it('permits explicit local endpoints while keeping same-account DLQ derivation', async () => {
    process.env.AWS_ENDPOINT_URL = 'http://localhost:9324';
    process.env.INBOX_QUEUE_URL = 'http://localhost:9324/000000000000/os-inbox';
    send.mockResolvedValue({
      Attributes: { ...attributes(), RedrivePolicy: policy() },
    });
    const { collector } = setup();
    collector.onModuleInit();
    await settle();
    expect(send.mock.calls.map(([command]) => command.input.QueueUrl)).toEqual([
      'http://localhost:9324/000000000000/os-inbox',
      'http://localhost:9324/000000000000/shared-dlq',
    ]);
  });

  it('does not guess a local DLQ account and deduplicates configured URLs', async () => {
    process.env.AWS_ENDPOINT_URL = 'http://localhost:9324';
    process.env.INBOX_QUEUE_URL = 'http://localhost:9324/queue/os-inbox';
    process.env.BILLING_QUEUE_URL = process.env.INBOX_QUEUE_URL;
    send.mockResolvedValue({
      Attributes: { ...attributes(), RedrivePolicy: policy() },
    });
    const { collector, metrics } = setup();
    collector.onModuleInit();
    await settle();
    expect(send).toHaveBeenCalledTimes(1);
    expect(metrics.gauge).toHaveBeenCalledTimes(3);
  });

  it.each([
    undefined,
    {},
    attributes('-1'),
    attributes('NaN'),
    attributes('9007199254740992'),
  ])(
    'does not fabricate zero gauges for missing or invalid counts (%#)',
    async (value) => {
      send.mockResolvedValue({ Attributes: value });
      const { collector, metrics, logger } = setup();
      collector.onModuleInit();
      await settle();
      expect(metrics.gauge).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'invalid_queue_attributes' }),
        'SqsQueueTelemetry',
      );
    },
  );

  it('isolates AWS failures and logs no raw SDK error, URL or credential', async () => {
    process.env.BILLING_QUEUE_URL = `${base}/billing-inbox`;
    send.mockRejectedValueOnce(
      new Error('Authorization=private-fixture https://private.example'),
    );
    const { collector, metrics, logger } = setup();
    collector.onModuleInit();
    await settle();
    expect(send).toHaveBeenCalledTimes(2);
    expect(metrics.gauge).toHaveBeenCalledTimes(3);
    expect(JSON.stringify(logger.warn.mock.calls)).not.toMatch(
      /private|https|Authorization/,
    );
  });

  it('skips overlapping cycles, aborts on destroy and discards a late response', async () => {
    let finish!: (value: unknown) => void;
    send.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const { collector, metrics, logger } = setup();
    collector.onModuleInit();
    await collector.collect();
    await jest.advanceTimersByTimeAsync(30_000);
    expect(send).toHaveBeenCalledTimes(1);
    collector.onModuleDestroy();
    expect(send.mock.calls[0][1].abortSignal.aborted).toBe(true);
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
    finish({ Attributes: attributes() });
    await settle();
    collector.onModuleInit();
    await collector.collect();
    expect(metrics.gauge).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('stays inert when no queue URL is configured', async () => {
    process.env.INBOX_QUEUE_URL = '   ';
    const { collector } = setup();
    collector.onModuleInit();
    await settle();
    expect(send).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });
});
