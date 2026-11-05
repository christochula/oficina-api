import { ArgumentsHost, ExecutionContext, HttpException } from '@nestjs/common';
import { of, firstValueFrom } from 'rxjs';
import { Request } from 'express';
import { PrismaService } from '../database/prisma.service';
import { JsonLoggerService } from '../observability/json-logger.service';
import { requestContext } from '../observability/request-context';
import { ExcecaoHttpFilter } from './filtros/excecao-http.filter';
import { RespostaInterceptor } from './interceptors/resposta.interceptor';
import { JwtRefreshStrategy } from '../../auth/strategies/jwt-refresh.strategy';
import { JwtPayload } from '../../auth/strategies/jwt.strategy';
import { PapelUsuario as Role } from '../../usuario/domain/papel-usuario.enum';

describe('error and response boundaries', () => {
  it.each([
    ['plain failure', 422, 'plain failure'],
    [{ message: 'specific failure' }, 400, 'specific failure'],
    [{ message: ['field one', 'field two'] }, 400, ['field one', 'field two']],
    [{ code: 'custom' }, 499, 'Http Exception'],
  ])(
    'preserves safe HTTP exception messages %p',
    (response, status, message) => {
      const json = jest.fn();
      const reply = { status: jest.fn().mockReturnValue({ json }) };
      const host = {
        switchToHttp: () => ({
          getResponse: () => reply,
          getRequest: () => ({ method: 'GET', path: '/api/v1/orders/one' }),
        }),
      } as unknown as ArgumentsHost;
      const logger = { warn: jest.fn(), error: jest.fn() };
      requestContext.run({ correlationId: 'request-filter' }, () =>
        new ExcecaoHttpFilter(logger as unknown as JsonLoggerService).catch(
          new HttpException(response, status),
          host,
        ),
      );
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: status,
          mensagem: message,
          correlationId: 'request-filter',
          ...(status === 499 ? { erro: 'ERRO' } : {}),
        }),
      );
      expect(logger.warn).toHaveBeenCalled();
    },
  );
  it('keeps non-Error unexpected throws generic', () => {
    const json = jest.fn();
    const reply = { status: jest.fn().mockReturnValue({ json }) };
    const host = {
      switchToHttp: () => ({
        getResponse: () => reply,
        getRequest: () => ({ method: 'POST', path: '/api/orders' }),
      }),
    } as unknown as ArgumentsHost;
    const logger = { warn: jest.fn(), error: jest.fn() };
    new ExcecaoHttpFilter(logger as unknown as JsonLoggerService).catch(
      'internal-secret',
      host,
    );
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        mensagem: 'Erro interno do servidor',
      }),
    );
    expect(JSON.stringify(json.mock.calls)).not.toContain('internal-secret');
  });
  it.each([null, 'ok', 7, ['one'], { data: ['one'] }])(
    'envelopes an unpaginated result %p exactly once',
    async (value) => {
      const interceptor = new RespostaInterceptor();
      await expect(
        firstValueFrom(
          interceptor.intercept({} as ExecutionContext, {
            handle: () => of(value),
          }),
        ),
      ).resolves.toEqual({ data: value });
    },
  );
  it('owns Prisma lifecycle cleanup without opening a database in unit tests', async () => {
    const client = {
      $connect: jest.fn().mockResolvedValue(undefined),
      $disconnect: jest.fn().mockResolvedValue(undefined),
    };
    await PrismaService.prototype.onModuleInit.call(client);
    await PrismaService.prototype.onModuleDestroy.call(client);
    expect(client.$connect).toHaveBeenCalledTimes(1);
    expect(client.$disconnect).toHaveBeenCalledTimes(1);
  });
  it('handles an absent refresh header defensively in the verified-payload callback', () => {
    const strategy = new JwtRefreshStrategy();
    const payload: JwtPayload = { sub: 'admin', papel: Role.ADMINISTRADOR };
    expect(
      strategy.validate(
        { get: () => undefined } as unknown as Request,
        payload,
      ),
    ).toEqual({ ...payload, refreshToken: '' });
  });
});
