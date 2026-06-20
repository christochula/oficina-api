import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ExcecaoHttpFilter } from './filtros/excecao-http.filter';
import { RespostaInterceptor } from './interceptors/resposta.interceptor';

export function configurarAplicacao(app: INestApplication): void {
  const servidorHttp = app.getHttpAdapter().getInstance();

  if (typeof servidorHttp.disable === 'function') {
    servidorHttp.disable('x-powered-by');
  }

  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.use((req, res, next) => {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:",
    );

    next();
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

  app.useGlobalFilters(new ExcecaoHttpFilter());
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