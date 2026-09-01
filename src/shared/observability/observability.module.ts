import { Global, Module } from '@nestjs/common';
import { JsonLoggerService } from './json-logger.service';
import { TelemetryService } from './telemetry.service';

@Global()
@Module({
  providers: [JsonLoggerService, TelemetryService],
  exports: [JsonLoggerService, TelemetryService],
})
export class ObservabilityModule {}
