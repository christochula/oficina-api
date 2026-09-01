import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configurarAplicacao } from './shared/http/configurar-aplicacao';
import { JsonLoggerService } from './shared/observability/json-logger.service';

// Função de bootstrap — inicializa a aplicação NestJS com todas as configurações globais
async function bootstrap() {
  const bootstrapLogger = new JsonLoggerService();
  const app = await NestFactory.create(AppModule, { logger: bootstrapLogger });
  configurarAplicacao(app, bootstrapLogger);

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
