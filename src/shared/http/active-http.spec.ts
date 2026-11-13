import 'reflect-metadata';
import {
  BadRequestException,
  Controller,
  Get,
  INestApplication,
  UseGuards,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { sign } from 'jsonwebtoken';
import { PrismaService } from '../database/prisma.service';
import { HealthController } from '../../health/health.controller';
import { AuthController } from '../../auth/interfaces/http/v1/auth.controller';
import { AuthService } from '../../auth/auth.service';
import { JwtStrategy, JwtPayload } from '../../auth/strategies/jwt.strategy';
import { JwtRefreshStrategy } from '../../auth/strategies/jwt-refresh.strategy';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PapeisGuard } from '../../auth/guards/papeis.guard';
import { Papeis } from '../../auth/decorators/papeis.decorator';
import { UsuarioAtual } from '../../auth/decorators/usuario-atual.decorator';
import { JWT_AUDIENCE, JWT_ISSUER, jwtSecret } from '../../auth/jwt-config';
import { PapelUsuario as Role } from '../../usuario/domain/papel-usuario.enum';
import { USUARIO_REPOSITORY } from '../../usuario/domain/usuario.repository';
import { CLIENTE_REPOSITORY } from '../../cliente/domain/cliente.repository';
import { JsonLoggerService } from '../observability/json-logger.service';
import { TelemetryService } from '../observability/telemetry.service';
import { configurarAplicacao } from './configurar-aplicacao';

@Controller({ path: 'runtime-test', version: '1' })
@UseGuards(JwtAuthGuard, PapeisGuard)
class ProtectedRuntimeController {
  @Get('private')
  @Papeis(Role.ADMINISTRADOR)
  privateRoute(@UsuarioAtual() user: JwtPayload) {
    return { id: user.sub };
  }
  @Get('paginated')
  paginated() {
    return { data: [{ id: 'one' }], meta: { total: 1 } };
  }
  @Get('ordens-servico/failure')
  failure() {
    throw new Error('private-database-secret');
  }
  @Get('webhook/failure')
  webhook() {
    throw new BadRequestException('Invalid notification');
  }
}

describe('active HTTP bootstrap, sessions, health and response contracts', () => {
  let app: INestApplication;
  const db = { $queryRaw: jest.fn().mockResolvedValue(1) };
  const auth = {
    login: jest
      .fn()
      .mockResolvedValue({ accessToken: 'access', refreshToken: 'refresh' }),
    refreshTokens: jest.fn().mockResolvedValue({
      accessToken: 'rotated',
      refreshToken: 'rotated-refresh',
    }),
    logout: jest.fn().mockResolvedValue(undefined),
  };
  const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const metrics = {
    apiRequest: jest.fn(),
    integrationError: jest.fn(),
    serviceOrderProcessingFailure: jest.fn(),
  };
  const users = {
    buscarPorId: jest.fn(async (id: { valor: string }) =>
      id.valor === 'missing'
        ? null
        : {
            id,
            ativo: id.valor !== 'inactive',
            email: 'operator@example.test',
            papel: id.valor === 'mechanic' ? Role.MECANICO : Role.ADMINISTRADOR,
          },
    ),
  };
  const clients = {
    buscarPorId: jest.fn(async (id: { valor: string }) => ({
      id,
      ativo: true,
      email: 'client@example.test',
    })),
  };
  function access(subject = 'admin', role: Role = Role.ADMINISTRADOR) {
    return sign(
      { role, papel: role, token_use: 'operator', scopes: ['oficina:read'] },
      jwtSecret('JWT_SECRET'),
      { subject, issuer: JWT_ISSUER, audience: JWT_AUDIENCE, expiresIn: '5m' },
    );
  }
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
      controllers: [
        AuthController,
        HealthController,
        ProtectedRuntimeController,
      ],
      providers: [
        JwtStrategy,
        JwtRefreshStrategy,
        PapeisGuard,
        { provide: AuthService, useValue: auth },
        { provide: PrismaService, useValue: db },
        { provide: USUARIO_REPOSITORY, useValue: users },
        { provide: CLIENTE_REPOSITORY, useValue: clients },
        { provide: TelemetryService, useValue: metrics },
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
    configurarAplicacao(app, logger as unknown as JsonLoggerService);
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => jest.clearAllMocks());

  it('validates login input and keeps the success response envelope', async () => {
    const invalid = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'invalid', senha: 'secret', extra: 'disallowed' })
      .expect(400);
    expect(Array.isArray(invalid.body.mensagem)).toBe(true);
    expect(auth.login).not.toHaveBeenCalled();
    const success = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'operator@example.test', senha: 'valid-password' })
      .set('X-Correlation-Id', 'request-login')
      .expect(200);
    expect(success.body).toEqual({
      data: { accessToken: 'access', refreshToken: 'refresh' },
    });
    expect(success.headers['x-correlation-id']).toBe('request-login');
    expect(success.headers['x-powered-by']).toBeUndefined();
    expect(success.headers['x-frame-options']).toBe('DENY');
    expect(success.headers['content-security-policy']).toContain(
      "default-src 'self'",
    );
    expect(metrics.apiRequest).toHaveBeenCalledWith(
      expect.any(Number),
      'POST',
      200,
    );
  });
  it('verifies JWT signature, expiration and live account state before protected actions', async () => {
    await request(app.getHttpServer()).post('/api/v1/auth/logout').expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', 'Bearer invalid')
      .expect(401);
    const expired = sign(
      { papel: Role.ADMINISTRADOR },
      jwtSecret('JWT_SECRET'),
      {
        subject: 'admin',
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        expiresIn: -1,
      },
    );
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${expired}`)
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${access('inactive')}`)
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${access('missing')}`)
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${access()}`)
      .expect(204);
    expect(auth.logout).toHaveBeenCalledWith('admin');
  });
  it('uses a distinct refresh strategy and passes the original credential to rotation', async () => {
    const refresh = sign(
      { papel: Role.ADMINISTRADOR },
      jwtSecret('JWT_REFRESH_SECRET'),
      {
        subject: 'admin',
        issuer: JWT_ISSUER,
        audience: `${JWT_AUDIENCE}:refresh`,
        expiresIn: '1h',
      },
    );
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Authorization', `Bearer ${access()}`)
      .expect(401);
    const result = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Authorization', `Bearer ${refresh}`)
      .expect(200);
    expect(result.body.data.accessToken).toBe('rotated');
    expect(auth.refreshTokens).toHaveBeenCalledWith('admin', refresh);
  });
  it('enforces role restrictions after authentication and preserves paginated envelopes', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/runtime-test/private')
      .set('Authorization', `Bearer ${access('mechanic', Role.MECANICO)}`)
      .expect(403);
    const allowed = await request(app.getHttpServer())
      .get('/api/v1/runtime-test/private')
      .set('Authorization', `Bearer ${access()}`)
      .expect(200);
    expect(allowed.body).toEqual({ data: { id: 'admin' } });
    const page = await request(app.getHttpServer())
      .get('/api/v1/runtime-test/paginated')
      .set('Authorization', `Bearer ${access()}`)
      .expect(200);
    expect(page.body).toEqual({ data: [{ id: 'one' }], meta: { total: 1 } });
  });
  it('keeps liveness independent of the database and fails readiness on connection errors', async () => {
    await request(app.getHttpServer()).get('/api/health/live').expect(200);
    expect(db.$queryRaw).not.toHaveBeenCalled();
    await request(app.getHttpServer())
      .get('/api/health/ready')
      .expect(200, { data: { status: 'ok', database: 'up' } });
    db.$queryRaw.mockRejectedValueOnce(new Error('private-database-secret'));
    const failed = await request(app.getHttpServer())
      .get('/api/health/ready')
      .expect(503);
    expect(JSON.stringify(failed.body)).not.toContain(
      'private-database-secret',
    );
    expect(logger.error).toHaveBeenCalled();
  });
  it('returns generic unexpected failures and records OS/integration failures without leaking internals', async () => {
    const failure = await request(app.getHttpServer())
      .get('/api/v1/runtime-test/ordens-servico/failure')
      .set('Authorization', `Bearer ${access()}`)
      .set('X-Correlation-Id', 'bad correlation space')
      .expect(500);
    expect(JSON.stringify(failure.body)).not.toContain(
      'private-database-secret',
    );
    expect(failure.body.correlationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(metrics.serviceOrderProcessingFailure).toHaveBeenCalledWith(
      'http_request',
    );
    await request(app.getHttpServer())
      .get('/api/v1/runtime-test/webhook/failure')
      .set('Authorization', `Bearer ${access()}`)
      .expect(400);
    expect(metrics.integrationError).toHaveBeenCalledWith('http');
    expect(logger.warn).toHaveBeenCalled();
  });
  it('publishes generated Swagger from the same active controllers', async () => {
    const result = await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);
    expect(result.body.paths).toHaveProperty('/api/v1/auth/login');
    expect(result.body.paths).toHaveProperty('/api/health/ready');
  });
});
