import { Buffer } from 'node:buffer';
import { createHmac, randomUUID } from 'node:crypto';
import process from 'node:process';
import { clearTimeout, setTimeout } from 'node:timers';
import { URL } from 'node:url';

const LOCAL_ACCESS_SECRET = 'local-only-access-secret-32-bytes-minimum';
const LOCAL_INTERNAL_TOKEN = 'local-only-internal-token-32-bytes-minimum';
const SCOPES = ['orders:read', 'orders:write'];
const UNAUTHORIZED = 'Não foi possível autenticar.';

function isActiveDev(config) {
  return config.command === 'serve' && !config.isPreview;
}

function localApiUrl(target) {
  if (typeof target !== 'string' || !/^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d{1,5})?\/?$/i.test(target)) {
    throw new Error('LOCAL_DEMO_MODE requires an HTTP localhost or 127.0.0.1 API target.');
  }
  const url = new URL(target);
  return new URL('/api/v1/internal/auth/cliente', url).href;
}

function validCpf(value) {
  if (typeof value !== 'string') return false;
  const cpf = value.replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = (base, weight) => {
    const total = [...base].reduce((sum, current, index) => sum + Number(current) * (weight - index), 0);
    const remainder = (total * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  const first = digit(cpf.slice(0, 9), 10);
  return cpf.endsWith(`${first}${digit(`${cpf.slice(0, 9)}${first}`, 11)}`);
}

function isLocalRequest(request, serverConfig) {
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(request.socket?.remoteAddress)) return false;
  const host = request.headers.host;
  if (typeof host !== 'string' || !/^(?:localhost|127\.0\.0\.1)(?::\d{1,5})?$/i.test(host)) return false;
  const scheme = serverConfig.https ? 'https:' : 'http:';
  let expected;
  try { expected = new URL(`${scheme}//${host}`); } catch { return false; }
  const port = Number(expected.port || (scheme === 'https:' ? 443 : 80));
  if (port !== Number(request.socket.localPort || serverConfig.port)) return false;
  if (request.headers['sec-fetch-site'] === 'cross-site') return false;
  const origin = request.headers.origin;
  return origin === undefined || (typeof origin === 'string' && origin === expected.origin);
}

function respond(response, status, body) {
  if (response.destroyed || response.writableEnded) return;
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    pragma: 'no-cache',
  });
  response.end(JSON.stringify(body));
}

function readBody(request, limit, timeoutMs) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    let completed = false;
    const finish = (error, value) => {
      if (completed) return;
      completed = true;
      clearTimeout(timer);
      request.off('data', onData);
      request.off('end', onEnd);
      request.off('aborted', onAborted);
      if (error) { request.resume(); reject(error); }
      else resolve(value);
    };
    const onData = (chunk) => {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += bytes.length;
      if (size > limit) finish({ status: 413 });
      else chunks.push(bytes);
    };
    const onEnd = () => {
      try { finish(null, JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { finish({ status: 401 }); }
    };
    const onAborted = () => finish({ status: 401 });
    const timer = setTimeout(() => finish({ status: 503 }), timeoutMs);
    timer.unref?.();
    request.on('data', onData);
    request.once('end', onEnd);
    request.once('aborted', onAborted);
    // Keep an error listener through the request lifetime, including disconnects.
    request.once('error', () => finish({ status: 401 }));
    const declaredSize = request.headers['content-length'];
    if (declaredSize !== undefined && (!/^\d+$/.test(declaredSize) || Number(declaredSize) > limit)) {
      finish({ status: 413 });
    }
  });
}

function signClientToken(customerId, secret, now) {
  const issuedAt = Math.floor(now() / 1000);
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const payload = encode({
    iss: 'oficina-auth-serverless', aud: 'oficina-api',
    sub: customerId, client_id: customerId, role: 'CLIENTE', papel: 'CLIENTE',
    token_use: 'client', scopes: SCOPES, iat: issuedAt, exp: issuedAt + 3600,
    jti: randomUUID(),
  });
  const input = `${header}.${payload}`;
  return `${input}.${createHmac('sha256', secret).update(input).digest('base64url')}`;
}

/** Opt-in Node-only auth adapter. Nothing from this module is imported by src/. */
export function localDemoAuthPlugin({
  env = process.env,
  apiTarget = env.VITE_DEV_API_TARGET || 'http://localhost:3000',
  fetchImpl = globalThis.fetch,
  now = Date.now,
  timeoutMs = 5000,
  maxBodyBytes = 4096,
} = {}) {
  const enabled = env.LOCAL_DEMO_MODE === 'true';
  let settings;
  return {
    name: 'oficina-local-demo-auth',
    enforce: 'pre',
    apply: (_config, context) => enabled && isActiveDev(context),
    configResolved(config) {
      if (!enabled || !isActiveDev(config)) return;
      const jwtSecret = env.LOCAL_DEMO_JWT_SECRET || LOCAL_ACCESS_SECRET;
      const internalToken = env.LOCAL_DEMO_INTERNAL_TOKEN || LOCAL_INTERNAL_TOKEN;
      if (Buffer.byteLength(jwtSecret, 'utf8') < 32 || Buffer.byteLength(internalToken, 'utf8') < 32) {
        throw new Error('Local demo authentication secrets must have at least 32 bytes.');
      }
      settings = { lookupUrl: localApiUrl(apiTarget), jwtSecret, internalToken, port: config.server.port };
      // Resolved config also overrides a CLI --host 0.0.0.0 before Vite binds.
      config.server.host = '127.0.0.1';
      config.server.allowedHosts = ['localhost', '127.0.0.1'];
      config.server.cors = false;
    },
    configureServer(server) {
      if (!settings || !enabled || !isActiveDev(server.config)) return;
      server.middlewares.use((request, response, next) => {
        if (request.url?.split('?')[0] !== '/auth/token') { next(); return; }
        if (!isLocalRequest(request, server.config.server)) {
          respond(response, 403, { message: 'Acesso local negado.' }); return;
        }
        if (request.method !== 'POST') {
          respond(response, 405, { message: 'Método não permitido.' }); return;
        }
        if (!/^application\/json(?:\s*;|$)/i.test(request.headers['content-type'] || '')) {
          respond(response, 401, { message: UNAUTHORIZED }); return;
        }
        void (async () => {
          const body = await readBody(request, maxBodyBytes, timeoutMs);
          if (!body || Array.isArray(body) || !validCpf(body.cpf)) {
            respond(response, 401, { message: UNAUTHORIZED }); return;
          }
          const lookup = await fetchImpl(settings.lookupUrl, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-internal-token': settings.internalToken },
            body: JSON.stringify({ cpf: body.cpf.replace(/\D/g, '') }),
            signal: globalThis.AbortSignal.timeout(timeoutMs),
            redirect: 'error',
          });
          if (lookup.status === 401 || lookup.status === 404) {
            respond(response, 401, { message: UNAUTHORIZED }); return;
          }
          if (!lookup.ok) throw new Error('Lookup unavailable');
          const result = await lookup.json();
          const customer = result?.data ?? result;
          if (!customer || typeof customer.id !== 'string' || !customer.id || typeof customer.ativo !== 'boolean') {
            throw new Error('Invalid lookup response');
          }
          if (!customer.ativo) { respond(response, 401, { message: UNAUTHORIZED }); return; }
          respond(response, 200, {
            access_token: signClientToken(customer.id, settings.jwtSecret, now),
            token_type: 'Bearer', expires_in: 3600, scope: SCOPES.join(' '),
          });
        })().catch((error) => {
          const status = [401, 413].includes(error?.status) ? error.status : 503;
          respond(response, status, { message: status === 503 ? 'Autenticação local indisponível.' : UNAUTHORIZED });
        });
      });
    },
    transformIndexHtml(html, context) {
      if (!settings || !enabled || !context.server) return html;
      const port = Number(context.server.config?.server?.port ?? settings.port);
      const notice = port === 5273
        ? 'Ensaio Fase 4 · localhost:5273 · Use os acessos LOCAL do roteiro. Sem cobranças reais.'
        : port === 5173
          ? 'Demonstração anterior · localhost:5173 · Base e acessos separados do ensaio. Sem cobranças reais.'
          : 'Demonstração local: sem cobranças reais';
      return { html, tags: [{
        tag: 'div',
        attrs: { role: 'status', 'data-local-demo': '', style: 'padding:10px 16px;background:#fff4ce;color:#513c06;text-align:center;font:600 14px system-ui' },
        children: notice,
        injectTo: 'body-prepend',
      }] };
    },
  };
}
