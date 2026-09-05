import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { ExcecaoHttpFilter } from './filtros/excecao-http.filter';
import { RespostaInterceptor } from './interceptors/resposta.interceptor';
import { JsonLoggerService } from '../observability/json-logger.service';
import { requestContext } from '../observability/request-context';
import { TelemetryService } from '../observability/telemetry.service';
import { sanitizeHttpPath } from './sanitize-http-path';

export function configurarAplicacao(
  app: INestApplication,
  logger: JsonLoggerService = new JsonLoggerService(),
): void {
  const servidorHttp = app.getHttpAdapter().getInstance() as {
    disable?: (setting: string) => void;
  };
  const telemetry = app.get(TelemetryService);

  if (typeof servidorHttp.disable === 'function') {
    servidorHttp.disable('x-powered-by');
  }

  const connectSrc = ["'self'", process.env.CSP_CONNECT_SRC?.trim()]
    .filter(Boolean)
    .join(' ');
  const contentSecurityPolicy = [
    "default-src 'self'",
    `connect-src ${connectSrc}`,
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
  ].join('; ');

  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Correlation-Id',
      'Traceparent',
      'Tracestate',
    ],
    exposedHeaders: ['X-Correlation-Id'],
  });

  app.use((req: Request, res: Response, next: NextFunction) => {
    const startedAt = process.hrtime.bigint();
    const candidate = req.header('x-correlation-id');
    const correlationId =
      candidate && /^[A-Za-z0-9._:-]{1,128}$/.test(candidate)
        ? candidate
        : randomUUID();

    res.setHeader('X-Correlation-Id', correlationId);
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains',
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', contentSecurityPolicy);

    requestContext.run({ correlationId }, () => {
      res.once('finish', () => {
        const durationMs =
          Number(process.hrtime.bigint() - startedAt) / 1_000_000;
        const route = sanitizeHttpPath(req.path);

        logger.log(
          {
            event: 'http_request_completed',
            method: req.method,
            path: route,
            status_code: res.statusCode,
            duration_ms: Number(durationMs.toFixed(2)),
          },
          'HttpRequest',
        );
        telemetry.apiRequest(durationMs, req.method, res.statusCode);

        if (res.statusCode >= 500 && req.path.includes('/ordens-servico')) {
          telemetry.serviceOrderProcessingFailure('http_request');
        }
        if (
          res.statusCode >= 400 &&
          (req.path.includes('/webhook') || req.path.includes('/integracoes'))
        ) {
          telemetry.integrationError('http');
        }
      });

      next();
    });
  });

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new ExcecaoHttpFilter(logger));
  app.useGlobalInterceptors(new RespostaInterceptor());

  const configSwagger = new DocumentBuilder()
    .setTitle('Oficina API')
    .setDescription('API de gestão de oficina mecânica')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const documentoV1 = SwaggerModule.createDocument(app, configSwagger);
  SwaggerModule.setup('api/docs', app, documentoV1);
}
