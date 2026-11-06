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

test('operador renova antes do Gateway receber o access token expirado', async () => {
  let session = {
    kind: SESSION_KIND.OPERATOR,
    accessToken: 'expired-access',
    refreshToken: 'valid-refresh',
    accessExpiresAt: Date.now() - 60_000,
    refreshExpiresAt: Date.now() + 600_000,
  };
  const events = [];
  const client = createHttpClient({
    getSession: () => session,
    refreshSession: async () => {
      events.push('refresh');
      session = { ...session, accessToken: 'renewed-access', accessExpiresAt: Date.now() + 900_000 };
      return session;
    },
    fetchImpl: async (_url, init) => {
      const token = init.headers.get('Authorization');
      events.push(token);
      return token === 'Bearer expired-access'
        ? jsonResponse({ message: 'Forbidden' }, { status: 403 })
        : jsonResponse({ data: { ok: true } });
    },
  });

  assert.deepEqual(await client.get('/clientes'), { ok: true });
  assert.deepEqual(events, ['refresh', 'Bearer renewed-access']);
});

test('requisições concorrentes perto da expiração compartilham uma renovação', async () => {
  let session = {
    kind: SESSION_KIND.OPERATOR,
    accessToken: 'expiring-access',
    refreshToken: 'valid-refresh',
    accessExpiresAt: Date.now() + 10_000,
  };
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  let refreshCount = 0;
  const seenTokens = [];
  const client = createHttpClient({
    getSession: () => session,
    refreshSession: async () => {
      refreshCount += 1;
      await pending;
      session = { ...session, accessToken: 'renewed-access', accessExpiresAt: Date.now() + 900_000 };
      return session;
    },
    fetchImpl: async (_url, init) => {
      seenTokens.push(init.headers.get('Authorization'));
      return jsonResponse({ data: { ok: true } });
    },
  });

  const requests = [client.get('/clientes'), client.get('/veiculos')];
  await Promise.resolve();
  assert.equal(refreshCount, 1);
  assert.equal(seenTokens.length, 0);
  release();
  await Promise.all(requests);
  await client.get('/servicos-oficina');
  assert.equal(refreshCount, 1);
  assert.deepEqual(seenTokens, Array(3).fill('Bearer renewed-access'));
});

test('cliente expirado encerra sessão antes de enviar request e nunca usa refresh', async () => {
  const events = [];
  const client = createHttpClient({
    getSession: () => ({ kind: SESSION_KIND.CLIENT, accessToken: 'client-access', accessExpiresAt: Date.now() - 1 }),
    refreshSession: async () => { events.push('unexpected-refresh'); },
    fetchImpl: async () => { events.push('unexpected-fetch'); },
    clearSession: (reason) => events.push(`clear:${reason}`),
    onUnauthorized: (error) => events.push(error.code),
  });

  await assert.rejects(client.get('/minhas', { correlationId: 'expired-client' }),
    (error) => error.code === 'SESSION_EXPIRED' && error.status === 401 && error.correlationId === 'expired-client');
  assert.deepEqual(events, ['clear:expired', 'SESSION_EXPIRED']);
});

test('falha ou resposta incompleta na renovação antecipada limpa a sessão', async (t) => {
  for (const outcome of ['rejected', 'missing-token']) {
    await t.test(outcome, async () => {
      const events = [];
      const client = createHttpClient({
        getSession: () => ({ kind: SESSION_KIND.OPERATOR, accessToken: 'expired', refreshToken: 'refresh', accessExpiresAt: Date.now() - 1 }),
        refreshSession: async () => { events.push('refresh'); if (outcome === 'rejected') throw new Error('refresh denied'); return {}; },
        fetchImpl: async () => { events.push('unexpected-fetch'); },
        clearSession: (reason) => events.push(`clear:${reason}`),
        onUnauthorized: (error) => events.push(error.code),
      });
      await assert.rejects(client.get('/clientes'), (error) => error.code === 'SESSION_EXPIRED');
      assert.deepEqual(events, ['refresh', 'clear:expired', 'SESSION_EXPIRED']);
    });
  }
});

test('refresh token vencido não é enviado na renovação antecipada', async () => {
  const events = [];
  const client = createHttpClient({
    getSession: () => ({ kind: SESSION_KIND.OPERATOR, accessToken: 'expired', refreshToken: 'expired-refresh', accessExpiresAt: Date.now() - 1, refreshExpiresAt: Date.now() - 1 }),
    refreshSession: async () => { events.push('unexpected-refresh'); },
    fetchImpl: async () => { events.push('unexpected-fetch'); },
    clearSession: (reason) => events.push(`clear:${reason}`),
  });
  await assert.rejects(client.get('/clientes'), (error) => error.code === 'SESSION_EXPIRED');
  assert.deepEqual(events, ['clear:expired']);
});

test('tokens explícitos, auth false e retry desativado preservam a chamada original', async (t) => {
  for (const [label, options, expected] of [
    ['token explícito', { token: 'explicit-token' }, 'Bearer explicit-token'],
    ['header explícito', { headers: { Authorization: 'Bearer header-token' } }, 'Bearer header-token'],
    ['público', { auth: false }, null],
    ['retry desativado', { retryOnUnauthorized: false }, 'Bearer stored-token'],
  ]) {
    await t.test(label, async () => {
      let seen;
      let refreshCount = 0;
      const client = createHttpClient({
        getSession: () => ({ kind: SESSION_KIND.OPERATOR, accessToken: 'stored-token', refreshToken: 'refresh', accessExpiresAt: Date.now() - 1 }),
        refreshSession: async () => { refreshCount += 1; },
        fetchImpl: async (_url, init) => { seen = init.headers.get('Authorization'); return jsonResponse({ ok: true }); },
      });
      await client.get('/route', options);
      assert.equal(seen, expected);
      assert.equal(refreshCount, 0);
    });
  }
});

test('403 de autorização permanece 403 e não dispara refresh reativo', async (t) => {
  for (const expiration of [undefined, Date.now() + 900_000, Date.now() + 10_000]) {
    await t.test(String(expiration), async () => {
      let refreshCount = 0;
      let fetchCount = 0;
      let clearCount = 0;
      const client = createHttpClient({
        getSession: () => ({ kind: SESSION_KIND.OPERATOR, accessToken: 'access', refreshToken: 'refresh', accessExpiresAt: expiration }),
        refreshSession: async () => { refreshCount += 1; return { accessToken: 'renewed' }; },
        clearSession: () => { clearCount += 1; },
        fetchImpl: async () => { fetchCount += 1; return jsonResponse({ mensagem: 'Papel sem permissão' }, { status: 403 }); },
      });
      await assert.rejects(client.get('/admin'), (error) => error.status === 403 && error.code !== 'SESSION_EXPIRED');
      assert.equal(refreshCount, expiration && expiration < Date.now() + 30_000 ? 1 : 0);
      assert.equal(fetchCount, 1);
      assert.equal(clearCount, 0);
    });
  }
});
