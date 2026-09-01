import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createRuntimeConfig,
  joinUrl,
} from '../src/core/config.js';
import {
  decodeJwtPayload,
  getJwtExpiration,
  isTokenExpired,
} from '../src/core/jwt.js';
import { ROLES } from '../src/core/permissions.js';
import {
  createClientSession,
  createMemoryStorage,
  createOperatorSession,
  createSessionStore,
  SESSION_KIND,
} from '../src/core/session.js';

function jwt(payload) {
  const encode = (value) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`;
}

test('runtime config normaliza URLs e limita timeout', () => {
  const config = createRuntimeConfig({
    VITE_API_BASE_URL: 'https://api.example.test/api/v1/',
    VITE_CLIENT_AUTH_BASE_URL: 'https://auth.example.test/',
    VITE_REQUEST_TIMEOUT_MS: '90000',
  });

  assert.equal(config.apiBaseUrl, 'https://api.example.test/api/v1');
  assert.equal(config.clientAuthBaseUrl, 'https://auth.example.test');
  assert.equal(config.requestTimeoutMs, 60_000);
  assert.equal(joinUrl(config.apiBaseUrl, '/clientes'), 'https://api.example.test/api/v1/clientes');
});

test('JWT é decodificado apenas como informação de UI', () => {
  const token = jwt({ sub: 'usr-1', role: ROLES.MECHANIC, exp: 2_000 });

  assert.deepEqual(decodeJwtPayload(token), {
    sub: 'usr-1',
    role: ROLES.MECHANIC,
    exp: 2_000,
  });
  assert.equal(getJwtExpiration(token), 2_000_000);
  assert.equal(isTokenExpired(token, 0, 1_999_999), false);
  assert.equal(isTokenExpired(token, 0, 2_000_000), true);
  assert.equal(decodeJwtPayload('inválido'), null);
});

test('sessão de equipe persiste par access/refresh e identidade mínima', () => {
  const now = 1_000_000;
  const tokens = {
    accessToken: jwt({
      sub: 'usr-2',
      email: 'mecanico@example.test',
      role: ROLES.MECHANIC,
      exp: 2_000,
    }),
    refreshToken: jwt({ sub: 'usr-2', role: ROLES.MECHANIC, exp: 4_000 }),
  };
  const session = createOperatorSession(tokens, now);

  assert.equal(session.kind, SESSION_KIND.OPERATOR);
  assert.equal(session.role, ROLES.MECHANIC);
  assert.equal(session.subject, 'usr-2');
  assert.equal(session.accessExpiresAt, 2_000_000);
  assert.equal(session.refreshExpiresAt, 4_000_000);
});

test('sessão de cliente nunca persiste CPF nem refresh token', () => {
  const tokenResponse = {
    access_token: jwt({
      sub: 'cli-1',
      client_id: 'cli-1',
      role: ROLES.CLIENT,
      token_use: 'client',
    }),
    token_type: 'Bearer',
    expires_in: 300,
    scope: 'orders:read orders:write',
  };
  const session = createClientSession(tokenResponse, 1_000);

  assert.equal(session.kind, SESSION_KIND.CLIENT);
  assert.equal(session.role, ROLES.CLIENT);
  assert.equal(session.clientId, 'cli-1');
  assert.equal(session.refreshToken, null);
  assert.equal(session.accessExpiresAt, 301_000);
  assert.equal(JSON.stringify(session).includes('cpf'), false);
});

test('session store remove sessão de cliente expirada e notifica motivo', () => {
  const storage = createMemoryStorage();
  const store = createSessionStore({ storage });
  const events = [];
  store.subscribe((event) => events.push(event));
  store.setClient({
    access_token: jwt({ sub: 'cli-2', role: ROLES.CLIENT, exp: 1 }),
    expires_in: 1,
  });

  assert.equal(store.get(), null);
  assert.equal(events.at(-1).type, 'cleared');
  assert.equal(events.at(-1).reason, 'expired');
});
