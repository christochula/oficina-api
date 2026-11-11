import tracer from 'dd-trace';

const valid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{2}-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/.test(value);

/** Persist a portable parent before a request/worker span ends. Tracing is optional. */
export function captureTraceparent(incoming?: string): string | undefined {
  try {
    const span = tracer.scope().active();
    if (span) {
      const carrier: Record<string, string> = {};
      tracer.inject(span.context(), 'http_headers', carrier);
      if (valid(carrier.traceparent)) return carrier.traceparent;
    }
  } catch {
    /* Telemetry must not prevent a business transaction. */
  }
  return valid(incoming) ? incoming : undefined;
}

interface TraceableMessage {
  messageId: string;
  type: string;
  osId: string;
  sagaId: string;
  correlationId: string;
  traceparent?: string;
}

/** Restore a durable parent before the SDK creates its SQS producer span. */
export async function traceOutbox<T extends TraceableMessage>(
  name: string,
  message: T,
  publish: (outgoing: T) => Promise<void>,
  transport: 'http' | 'aws_sqs' = 'aws_sqs',
): Promise<void> {
  let parent: ReturnType<typeof tracer.extract> = null;
  try {
    if (message.traceparent)
      parent = tracer.extract('http_headers', {
        traceparent: message.traceparent,
      });
  } catch {
    // An absent/invalid tracing context must not discard durable work.
  }
  await tracer.trace(
    name,
    {
      childOf: parent || undefined,
      resource: message.type,
      tags: {
        'span.kind': transport === 'http' ? 'client' : 'producer',
        ...(transport === 'aws_sqs' ? { 'messaging.system': 'aws_sqs' } : {}),
        'messaging.message_id': message.messageId,
        'message.type': message.type,
        'saga.id': message.sagaId,
        'os.id': message.osId,
        'correlation.id': message.correlationId,
      },
    },
    async () =>
      publish({
        ...message,
        traceparent: captureTraceparent(message.traceparent),
      }),
  );
}
