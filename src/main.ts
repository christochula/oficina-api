import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ExcecaoHttpFilter } from './shared/http/filtros/excecao-http.filter';
import { RespostaInterceptor } from './shared/http/interceptors/resposta.interceptor';

// Função de bootstrap — inicializa a aplicação NestJS com todas as configurações globais
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS — origem configurável por variável de ambiente
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Prefixo global e versionamento por URI (/api/v1/...)
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI });

  // Validação global de DTOs — whitelist remove campos não declarados no DTO,
  // forbidNonWhitelisted rejeita a requisição se houver campos extras (proteção contra injeção),
  // transform converte automaticamente os tipos (ex: string query param para number)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Filtro e interceptor globais — padronizam formato de erro e envelope de resposta
  app.useGlobalFilters(new ExcecaoHttpFilter());
  app.useGlobalInterceptors(new RespostaInterceptor());

  // Swagger — documento v1
  const configSwagger = new DocumentBuilder()
    .setTitle('Oficina API')
    .setDescription('API de gestão de oficina mecânica')
    .setVersion('1.0')
    .addBearerAuth() // habilita o campo de token JWT na interface do Swagger
    .build();

  const documentoV1 = SwaggerModule.createDocument(app, configSwagger);
  SwaggerModule.setup('api/docs', app, documentoV1); // disponível em /api/docs

  const porta = process.env.PORT ?? 3000;
  await app.listen(porta);
  console.log(`Aplicação rodando em http://localhost:${porta}/api`);
  console.log(`Swagger disponível em http://localhost:${porta}/api/docs`);
}

bootstrap();
