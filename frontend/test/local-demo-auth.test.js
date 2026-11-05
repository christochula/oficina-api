import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHmac } from 'node:crypto';
import { once } from 'node:events';
import { createServer, request } from 'node:http';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { localDemoAuthPlugin } from '../dev/local-demo-auth.mjs';

const SECRET = 'local-only-access-secret-32-bytes-minimum';
const INTERNAL = 'local-only-internal-token-32-bytes-minimum';
const CPF = '52998224725';

async function listen(server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return `http://127.0.0.1:${server.address().port}`;
}

async function close(server) {
  server.closeAllConnections();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

function send(url, { path = '/auth/token', method = 'POST', body = { cpf: CPF }, raw, headers = {}, chunked = false } = {}) {
  const serialized = raw ?? JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const outgoing = request(new URL(path, url), {
      method,
      headers: {
        'content-type': 'application/json',
        ...(!chunked ? { 'content-length': Buffer.byteLength(serialized) } : {}),
        ...headers,
      },
    }, (incoming) => {
      let result = '';
      incoming.setEncoding('utf8');
      incoming.on('data', (part) => { result += part; });
      incoming.on('end', () => resolve({ status: incoming.statusCode, headers: incoming.headers, body: JSON.parse(result) }));
      incoming.on('error', reject);
    });
    outgoing.on('error', reject);
    if (chunked) { outgoing.write(serialized.slice(0, 2500)); outgoing.end(serialized.slice(2500)); }
    else outgoing.end(serialized);
  });
}

async function harness(t, { lookup, env = { LOCAL_DEMO_MODE: 'true' }, pluginOptions = {}, command = 'serve', isPreview = false } = {}) {
  const lookups = [];
  const api = createServer(async (req, res) => {
    const chunks = [];
    for await (const part of req) chunks.push(part);
    const captured = { path: req.url, method: req.method, headers: req.headers, body: JSON.parse(Buffer.concat(chunks).toString('utf8')) };
    lookups.push(captured);
    const reply = lookup ? await lookup(captured) : { status: 200, body: { data: { id: 'cl-real-customer', nome: 'Demo', email: 'demo@example.test', ativo: true } } };
    if (res.destroyed) return;
    res.writeHead(reply.status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(reply.body));
  });
  const apiUrl = await listen(api);
  const config = { command, isPreview, server: { host: '0.0.0.0', allowedHosts: true, cors: true, port: 0 } };
  const plugin = localDemoAuthPlugin({ env, apiTarget: apiUrl, ...pluginOptions });
  plugin.configResolved(config);
  let middleware;
  plugin.configureServer({ config, middlewares: { use: (handler) => { middleware = handler; } } });
  const downstream = [];
  const server = createServer((req, res) => {
    const next = () => { downstream.push(req.url); res.writeHead(202, { 'content-type': 'application/json' }); res.end(JSON.stringify({ proxied: true })); };
    if (middleware) middleware(req, res, next);
    else next();
  });
  const url = await listen(server);
  t.after(async () => { await close(server); await close(api); });
  return { url, apiUrl, config, plugin, lookups, downstream };
}

function decodeAndVerify(token, secret = SECRET) {
  const [header, payload, signature] = token.split('.');
  assert.deepEqual(JSON.parse(Buffer.from(header, 'base64url')), { alg: 'HS256', typ: 'JWT' });
  assert.equal(signature, createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url'));
  return JSON.parse(Buffer.from(payload, 'base64url'));
}

test('demo auth is explicit opt-in and never applies to build or preview', async (t) => {
  for (const value of [undefined, 'false', 'TRUE', '1']) {
    const plugin = localDemoAuthPlugin({ env: { LOCAL_DEMO_MODE: value } });
    assert.equal(plugin.apply({}, { command: 'serve' }), false);
  }
  const plugin = localDemoAuthPlugin({ env: { LOCAL_DEMO_MODE: 'true' }, apiTarget: 'https://cloud.example.test' });
  assert.equal(plugin.apply({}, { command: 'serve', isPreview: false }), true);
  assert.equal(plugin.apply({}, { command: 'build' }), false);
  assert.equal(plugin.apply({}, { command: 'serve', isPreview: true }), false);
  const html = '<body><div id="app"></div></body>';
  plugin.configResolved({ command: 'build', server: {} });
  assert.equal(plugin.transformIndexHtml(html, {}), html);
  const disabled = await harness(t, { env: {} });
  assert.deepEqual((await send(disabled.url)).body, { proxied: true });
  assert.equal(disabled.lookups.length, 0);
  const preview = await harness(t, { isPreview: true });
  assert.equal((await send(preview.url)).status, 202);
  assert.equal(preview.lookups.length, 0);
});

test('only active OS identities receive an owner-bound signed JWT after a real authenticated HTTP lookup', async (t) => {
  const local = await harness(t);
  assert.equal(local.config.server.host, '127.0.0.1');
  assert.equal(local.config.server.cors, false);
  assert.deepEqual(local.config.server.allowedHosts, ['localhost', '127.0.0.1']);
  const result = await send(local.url, { body: { cpf: '529.982.247-25' }, headers: { origin: local.url } });
  assert.equal(result.status, 200);
  assert.equal(result.headers['cache-control'], 'no-store');
  assert.equal(result.body.token_type, 'Bearer');
  assert.equal(result.body.expires_in, 3600);
  assert.equal(result.body.scope, 'orders:read orders:write');
  const claims = decodeAndVerify(result.body.access_token);
  assert.equal(claims.iss, 'oficina-auth-serverless'); assert.equal(claims.aud, 'oficina-api');
  assert.equal(claims.sub, 'cl-real-customer'); assert.equal(claims.client_id, claims.sub);
  assert.equal(claims.role, 'CLIENTE'); assert.equal(claims.papel, 'CLIENTE'); assert.equal(claims.token_use, 'client');
  assert.deepEqual(claims.scopes, ['orders:read', 'orders:write']);
  assert.equal(claims.exp - claims.iat, 3600);
  assert.match(claims.jti, /^[0-9a-f-]{36}$/);
  assert.equal(JSON.stringify(claims).includes(CPF), false);
  assert.equal(local.lookups.length, 1);
  assert.equal(local.lookups[0].path, '/api/v1/internal/auth/cliente');
  assert.equal(local.lookups[0].method, 'POST');
  assert.equal(local.lookups[0].headers['x-internal-token'], INTERNAL);
  assert.deepEqual(local.lookups[0].body, { cpf: CPF });
});

test('every sign-in rechecks the OS and creates a new credential; plain identity responses also work', async (t) => {
  let customerId = 'customer-first';
  const local = await harness(t, { lookup: () => ({ status: 200, body: { id: customerId, ativo: true } }) });
  const first = decodeAndVerify((await send(local.url)).body.access_token);
  customerId = 'customer-second';
  const second = decodeAndVerify((await send(local.url)).body.access_token);
  assert.equal(first.sub, 'customer-first'); assert.equal(second.sub, 'customer-second');
  assert.notEqual(first.jti, second.jti); assert.equal(local.lookups.length, 2);
});

test('invalid or missing CPF never calls the OS and has one generic denial', async (t) => {
  const local = await harness(t);
  for (const body of [{}, { cpf: 123 }, { cpf: '' }, { cpf: '11111111111' }, { cpf: '52998224726' }, [], null]) {
    const result = await send(local.url, { body });
    assert.equal(result.status, 401); assert.deepEqual(result.body, { message: 'Não foi possível autenticar.' });
  }
  const malformed = await send(local.url, { raw: '{bad-json' });
  assert.equal(malformed.status, 401);
  assert.equal(local.lookups.length, 0);
});

test('missing, inactive and denied customers are indistinguishable', async (t) => {
  for (const reply of [
    { status: 401, body: { message: 'private identity information' } },
    { status: 404, body: {} },
    { status: 200, body: { data: { id: 'inactive', ativo: false } } },
  ]) {
    const local = await harness(t, { lookup: () => reply });
    const result = await send(local.url);
    assert.equal(result.status, 401); assert.deepEqual(result.body, { message: 'Não foi possível autenticar.' });
    assert.equal(local.lookups.length, 1);
  }
});

test('OS failures, bad responses and timeout return a generic 503 without a token', async (t) => {
  for (const reply of [
    { status: 500, body: { error: 'private-upstream-detail' } },
    { status: 200, body: { data: null } },
    { status: 200, body: { id: 'one', ativo: 'true' } },
  ]) {
    const local = await harness(t, { lookup: () => reply });
    const result = await send(local.url);
    assert.equal(result.status, 503); assert.deepEqual(result.body, { message: 'Autenticação local indisponível.' });
    assert.equal(JSON.stringify(result.body).includes('private-upstream-detail'), false);
  }
  const slow = await harness(t, { lookup: async () => { await delay(100); return { status: 200, body: { id: 'late', ativo: true } }; }, pluginOptions: { timeoutMs: 25 } });
  assert.equal((await send(slow.url)).status, 503);
});

test('local auth leaves ordinary API routes and other auth paths to the proxy', async (t) => {
  const local = await harness(t);
  for (const path of ['/api/v1/auth/login', '/api/v1/ordens-servico', '/auth/other', '/assets/app.js']) {
    assert.equal((await send(local.url, { path })).status, 202);
  }
  assert.deepEqual(local.downstream, ['/api/v1/auth/login', '/api/v1/ordens-servico', '/auth/other', '/assets/app.js']);
  assert.equal(local.lookups.length, 0);
  assert.equal((await send(local.url, { method: 'GET' })).status, 405);
});

test('external Host, wrong listener port and cross-origin requests cannot mint credentials', async (t) => {
  const local = await harness(t);
  const port = new URL(local.url).port;
  for (const headers of [
    { host: `evil.example:${port}` }, { host: `localhost.evil.example:${port}` },
    { host: 'localhost:1' }, { origin: 'https://evil.example' }, { origin: 'null' },
    { origin: 'http://localhost:1' }, { 'sec-fetch-site': 'cross-site' },
  ]) assert.equal((await send(local.url, { headers })).status, 403);
  assert.equal(local.lookups.length, 0);
  assert.equal((await send(local.url, { headers: { host: `localhost:${port}`, origin: `http://localhost:${port}` } })).status, 200);
});

test('cloud, protocol tricks, credentials and paths are rejected before starting demo auth', () => {
  for (const apiTarget of [
    'https://api.example.test', 'http://api.example.test', 'https://localhost:3000', 'http://127.0.0.1.evil.test:3000',
    'http://127.0.0.1:3000/api', 'http://user:secret@127.0.0.1:3000', 'http://127.0.0.1:3000?x=1',
    'http://2130706433:3000', 'http://127.1:3000',
  ]) {
    const plugin = localDemoAuthPlugin({ env: { LOCAL_DEMO_MODE: 'true' }, apiTarget });
    assert.throws(() => plugin.configResolved({ command: 'serve', server: {} }), /requires an HTTP localhost/);
  }
});

test('declared and streamed oversized bodies are rejected before lookup', async (t) => {
  const local = await harness(t);
  const raw = JSON.stringify({ cpf: CPF, padding: 'x'.repeat(5000) });
  assert.equal((await send(local.url, { raw })).status, 413);
  assert.equal((await send(local.url, { raw, chunked: true })).status, 413);
  assert.equal((await send(local.url, { headers: { 'content-type': 'text/plain' } })).status, 401);
  assert.equal(local.lookups.length, 0);
});

test('local key overrides remain in Node and the demo notice is never rendered for build or preview', async (t) => {
  const secret = 'test-node-only-key-with-more-than-32-bytes';
  const internal = 'test-node-only-lookup-token-more-than-32-bytes';
  const local = await harness(t, { env: { LOCAL_DEMO_MODE: 'true', LOCAL_DEMO_JWT_SECRET: secret, LOCAL_DEMO_INTERNAL_TOKEN: internal } });
  decodeAndVerify((await send(local.url)).body.access_token, secret);
  assert.equal(local.lookups[0].headers['x-internal-token'], internal);
  const html = '<body><div id="app"></div></body>';
  const transformed = local.plugin.transformIndexHtml(html, { server: {} });
  assert.equal(transformed.tags[0].children, 'Demonstração local: sem cobranças reais');
  assert.equal(JSON.stringify(transformed).includes(secret), false);
  assert.equal(JSON.stringify(transformed).includes(internal), false);
  assert.equal(local.plugin.transformIndexHtml(html, {}), html);
  const weak = localDemoAuthPlugin({ env: { LOCAL_DEMO_MODE: 'true', LOCAL_DEMO_JWT_SECRET: 'short' } });
  assert.throws(() => weak.configResolved({ command: 'serve', server: {} }), /32 bytes/);
});
