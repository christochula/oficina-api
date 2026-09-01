import { Injectable, LoggerService } from '@nestjs/common';
import tracer from 'dd-trace';
import { requestContext } from './request-context';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

@Injectable()
export class JsonLoggerService implements LoggerService {
  log(message: unknown, context?: string): void {
    this.write('info', message, context);
  }

  error(message: unknown, trace?: string, context?: string): void {
    this.write('error', message, context, trace);
  }

  warn(message: unknown, context?: string): void {
    this.write('warn', message, context);
  }

  debug(message: unknown, context?: string): void {
    this.write('debug', message, context);
  }

  verbose(message: unknown, context?: string): void {
    this.write('debug', message, context);
  }

  private write(
    level: LogLevel,
    message: unknown,
    context?: string,
    stack?: string,
  ): void {
    const activeSpan = tracer.scope().active();
    const spanContext = activeSpan?.context();
    const request = requestContext.getStore();

    const entry: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level,
      message: this.serializeMessage(message),
      service: process.env.DD_SERVICE ?? 'oficina-api',
      env: process.env.DD_ENV ?? process.env.NODE_ENV ?? 'local',
      version:
        process.env.DD_VERSION ?? process.env.npm_package_version ?? 'dev',
    };

    if (context) entry.context = context;
    if (request?.correlationId) entry.correlation_id = request.correlationId;
    if (spanContext) {
      entry['dd.trace_id'] = spanContext.toTraceId();
      entry['dd.span_id'] = spanContext.toSpanId();
    }
    if (stack) entry.stack = stack;

    const line = `${JSON.stringify(entry)}\n`;
    if (level === 'error' || level === 'warn') process.stderr.write(line);
    else process.stdout.write(line);
  }

  private serializeMessage(message: unknown): unknown {
    if (message instanceof Error) return message.message;
    if (typeof message === 'bigint') return message.toString();
    return message;
  }
}
