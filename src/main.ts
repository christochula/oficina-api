import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configurarAplicacao } from './shared/http/configurar-aplicacao';

// Função de bootstrap — inicializa a aplicação NestJS com todas as configurações globais
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configurarAplicacao(app);

  const porta = process.env.PORT ?? 3000;
  await app.listen(porta);
  console.log(`Aplicação rodando em http://localhost:${porta}/api`);
  console.log(`Swagger disponível em http://localhost:${porta}/api/docs`);
}

bootstrap();
