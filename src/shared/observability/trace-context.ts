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
