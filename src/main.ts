import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { ServerResponse } from 'node:http';
import { join } from 'node:path';
import { AppModule } from './app.module';
import { configurarAplicacao } from './shared/http/configurar-aplicacao';
import { JsonLoggerService } from './shared/observability/json-logger.service';

// Função de bootstrap — inicializa a aplicação NestJS com todas as configurações globais
async function bootstrap() {
  const bootstrapLogger = new JsonLoggerService();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: bootstrapLogger,
  });
  configurarAplicacao(app, bootstrapLogger);

  app.useStaticAssets(
    process.env.FRONTEND_DIST_PATH ?? join(process.cwd(), 'public'),
    {
      index: 'index.html',
      maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
      setHeaders: (response: ServerResponse, filePath: string) => {
        if (filePath.endsWith('index.html')) {
          response.setHeader('Cache-Control', 'no-cache');
        }
      },
    },
  );

  const porta = process.env.PORT ?? 3000;
  await app.listen(porta);
  bootstrapLogger.log(
    {
      event: 'application_started',
      port: Number(porta),
      swagger_path: '/api/docs',
    },
    'Bootstrap',
  );
}

bootstrap().catch((error: unknown) => {
  const logger = new JsonLoggerService();
  const err = error instanceof Error ? error : new Error(String(error));
  logger.error(err.message, err.stack, 'Bootstrap');
  process.exitCode = 1;
});
