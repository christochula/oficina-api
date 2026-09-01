import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { StatsD, Tags } from 'hot-shots';
import { JsonLoggerService } from './json-logger.service';

@Injectable()
export class TelemetryService implements OnModuleDestroy {
  private readonly client: StatsD;

  constructor(private readonly logger: JsonLoggerService) {
    this.client = new StatsD({
      host: process.env.DD_AGENT_HOST ?? '127.0.0.1',
      port: Number(process.env.DD_DOGSTATSD_PORT ?? 8125),
      prefix: '',
      protocol: 'udp',
      mock:
        process.env.NODE_ENV === 'test' ||
        process.env.DD_METRICS_ENABLED === 'false',
      globalTags: {
        env: process.env.DD_ENV ?? process.env.NODE_ENV ?? 'local',
        service: process.env.DD_SERVICE ?? 'oficina-api',
        version:
          process.env.DD_VERSION ?? process.env.npm_package_version ?? 'dev',
      },
      errorHandler: (error) =>
        this.logger.warn(
          { event: 'dogstatsd_delivery_failed', error: error.message },
          TelemetryService.name,
        ),
    });
  }

  apiRequest(durationMs: number, method: string, statusCode: number): void {
    this.distribution('oficina.api.request.duration_ms', durationMs, {
      method: method.toUpperCase(),
      status_code: String(statusCode),
    });
  }

  serviceOrderCreated(): void {
    this.increment('oficina.service_orders.created');
  }

  serviceOrderTransition(status: string): void {
    this.increment('oficina.service_orders.status_transition', {
      status: status.toLowerCase(),
    });
  }

  serviceOrderStatusDuration(status: string, durationMs: number): void {
    const dashboardStatus = this.dashboardStatus(status);
    if (!dashboardStatus) return;
    this.distribution('oficina.service_orders.status_duration_ms', durationMs, {
      status: dashboardStatus,
    });
  }

  serviceOrderProcessingFailure(operation: string): void {
    this.increment('oficina.service_orders.processing_errors', { operation });
  }

  integrationError(integration: string): void {
    this.increment('oficina.integrations.errors', { integration });
  }

  async onModuleDestroy(): Promise<void> {
    await new Promise<void>((resolve) => this.client.close(() => resolve()));
  }

  private increment(metric: string, tags: Tags = {}): void {
    this.client.increment(metric, 1, 1, tags);
  }

  private distribution(metric: string, value: number, tags: Tags = {}): void {
    this.client.distribution(metric, value, 1, tags);
  }

  private dashboardStatus(status: string): string | null {
    const mapping: Record<string, string> = {
      EM_DIAGNOSTICO: 'diagnostico',
      EM_EXECUCAO: 'execucao',
      FINALIZADA: 'finalizacao',
    };
    return mapping[status] ?? null;
  }
}
