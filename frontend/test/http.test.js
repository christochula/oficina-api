import assert from 'node:assert/strict';
import test from 'node:test';
import { SESSION_KIND } from '../src/core/session.js';
import { API_ENDPOINTS } from '../src/api/endpoints.js';
import {
  ApiError,
  buildRequestUrl,
  createHttpClient,
  unwrapEnvelope,
} from '../src/api/http.js';

function jsonResponse(body, init = {}) {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json');
  return new Response(JSON.stringify(body), { ...init, headers });
}

test('URL builder mantém prefixo versionado e serializa filtros', () => {
  assert.equal(
    buildRequestUrl('/api/v1', '/clientes', {
      pagina: 2,
      status: ['ATIVO', 'INATIVO'],
      vazio: '',
    }),
    '/api/v1/clientes?pagina=2&status=ATIVO&status=INATIVO',
  );
});

test('envelopes simples e paginados são desempacotados', () => {
  assert.deepEqual(unwrapEnvelope({ data: { id: 'cli-1' } }), {
    id: 'cli-1',
  });
  assert.deepEqual(
    unwrapEnvelope({ data: [{ id: 'cli-1' }], meta: { total: 1 } }),
    { data: [{ id: 'cli-1' }], meta: { total: 1 } },
  );
});

test('cliente HTTP envia bearer/correlation e retorna data limpa', async () => {
  let captured;
  const client = createHttpClient({
    baseUrl: '/api/v1',
    getSession: () => ({ accessToken: 'access-token' }),
    fetchImpl: async (url, init) => {
      captured = { url, init };
      return jsonResponse(
        { data: { id: 'os-1' } },
        { headers: { 'x-correlation-id': 'corr-response' } },
      );
    },
  });

  const result = await client.get('/ordens-servico/os-1');

  assert.deepEqual(result, { id: 'os-1' });
  assert.equal(captured.url, '/api/v1/ordens-servico/os-1');
  assert.equal(captured.init.headers.get('Authorization'), 'Bearer access-token');
  assert.ok(captured.init.headers.get('X-Correlation-Id'));
  assert.equal(client.getLastCorrelationId(), 'corr-response');
});

test('401 de operador renova uma vez e repete a chamada', async () => {
  let session = {
    kind: SESSION_KIND.OPERATOR,
    accessToken: 'old-access',
    refreshToken: 'refresh',
  };
  const seenTokens = [];
  let refreshCount = 0;
  const client = createHttpClient({
    getSession: () => session,
    refreshSession: async () => {
      refreshCount += 1;
      session = { ...session, accessToken: 'new-access' };
      return session;
    },
    fetchImpl: async (_url, init) => {
      const token = init.headers.get('Authorization');
      seenTokens.push(token);
      if (token === 'Bearer old-access') {
        return jsonResponse({ mensagem: 'Token expirado' }, { status: 401 });
      }
      return jsonResponse({ data: { ok: true } });
    },
  });

  assert.deepEqual(await client.get('/protegido'), { ok: true });
  assert.equal(refreshCount, 1);
  assert.deepEqual(seenTokens, ['Bearer old-access', 'Bearer new-access']);
});

test('401 de cliente encerra sessão sem tentar refresh', async () => {
  let clearedReason = null;
  const client = createHttpClient({
    getSession: () => ({
      kind: SESSION_KIND.CLIENT,
      accessToken: 'client-access',
      refreshToken: null,
    }),
    clearSession: (reason) => {
      clearedReason = reason;
    },
    fetchImpl: async () =>
      jsonResponse(
        { mensagem: 'Acesso negado', correlationId: 'corr-client' },
        { status: 401 },
      ),
  });

  await assert.rejects(
    () => client.get('/protegido'),
    (error) =>
      error instanceof ApiError &&
      error.code === 'SESSION_EXPIRED' &&
      error.correlationId === 'corr-client',
  );
  assert.equal(clearedReason, 'expired');
});

test('erro padronizado preserva correlation id para suporte', async () => {
  const client = createHttpClient({
    fetchImpl: async () =>
      jsonResponse(
        {
          erro: 'NOT_FOUND',
          mensagem: 'Ordem não encontrada',
          correlationId: 'corr-404',
        },
        { status: 404 },
      ),
  });

  await assert.rejects(
    () => client.get('/ordens/ausente', { auth: false }),
    (error) =>
      error instanceof ApiError &&
      error.status === 404 &&
      error.code === 'NOT_FOUND' &&
      error.message === 'Ordem não encontrada' &&
      error.correlationId === 'corr-404',
  );
});

test('endpoints codificam identificadores vindos da interface', () => {
  assert.equal(
    API_ENDPOINTS.orders.byId('id com espaço'),
    '/ordens-servico/id%20com%20espa%C3%A7o',
  );
});
