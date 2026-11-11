import { Global, Module } from '@nestjs/common';
import { JsonLoggerService } from './json-logger.service';
import { TelemetryService } from './telemetry.service';
import { SqsQueueTelemetry } from './sqs-queue-telemetry';

@Global()
@Module({
  providers: [JsonLoggerService, TelemetryService, SqsQueueTelemetry],
  exports: [JsonLoggerService, TelemetryService],
})
export class ObservabilityModule {}
