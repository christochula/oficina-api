import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/shared/database/prisma.service';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configurarAplicacao } from '../src/shared/http/configurar-aplicacao';
import { startPostgres, stopPostgres, getDatabaseUrl } from './testcontainers-setup';
import { execSync } from 'child_process';

jest.setTimeout(120000);

describe('AppModule (e2e com Testcontainers)', () => {
  let app: INestApplication<App>;
  let prismaService: PrismaService | undefined;

  beforeAll(async () => {
    // Iniciar container PostgreSQL
    await startPostgres();

    // Configurar DATABASE_URL antes de criar o módulo
    process.env.DATABASE_URL = getDatabaseUrl();

    // Compilar módulo
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configurarAplicacao(app);
    await app.init();

    // Obter PrismaService e executar migrações
    prismaService = moduleFixture.get<PrismaService>(PrismaService);
    await prismaService.$connect();

    // Executar migrações do Prisma
    try {
      execSync('npx prisma migrate deploy', {
        env: { ...process.env, DATABASE_URL: getDatabaseUrl() },
        stdio: 'pipe',
      });
    } catch (error) {
      // Migrações podem já estar aplicadas
    }

    // Executar seed do admin
    try {
      execSync('npx ts-node prisma/seed.ts', {
        env: { ...process.env, DATABASE_URL: getDatabaseUrl() },
        stdio: 'pipe',
      });
    } catch (error) {
      // Seed pode já ter sido executado
    }
  });

  afterAll(async () => {
    if (prismaService) {
      await prismaService.$disconnect();
    }

    if (app) {
      await app.close();
    }

    // Parar container
    await stopPostgres();
  });

  it('bloqueia acesso sem JWT em rota protegida', () => {
    return request(app.getHttpServer())
      .get('/api/v1/ordens-servico')
      .expect(401);
  });

  it('retorna Swagger documentation', () => {
    return request(app.getHttpServer())
      .get('/api/docs')
      .expect(200)
      .expect((res) => {
        expect(res.text).toContain('swagger');
      });
  });

  it('permite login com credenciais válidas', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@oficina.com',
        senha: 'Admin@123',
      })
      .expect(200);

    expect(res.body.data).toHaveProperty('accessToken');
    expect(res.body.data).toHaveProperty('refreshToken');
  });

  it('retorna 401 com credenciais inválidas', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@oficina.com',
        senha: 'senhaincorreta',
      })
      .expect(401);
  });
});
