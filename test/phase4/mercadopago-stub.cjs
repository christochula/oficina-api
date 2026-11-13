// Local demonstration provider only. Uses no Mercado Pago account or real payment data.
const http = require('node:http');
const { randomUUID, createHmac } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const MAX_BODY_BYTES = 64 * 1024;
const MAX_STATE_BYTES = 8 * 1024 * 1024;
const emptySnapshot = () => ({ version: 1, preferences: [], payments: [], preferenceKeys: [], byPreferenceStatus: [], latest: [], delivered: [] });
function validateStateSnapshot(snapshot, publicBaseUrl = 'http://localhost:8088') {
  const fail = message => { throw new Error(`Snapshot inválido: ${message}.`); };
  const idValid = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,200}$/.test(value);
  const referenceValid = value => typeof value === 'string' && value.length > 0 && value.length <= 200;
  if (!snapshot || snapshot.version !== 1 || !['preferences', 'payments', 'preferenceKeys', 'byPreferenceStatus', 'latest', 'delivered'].every(key => Array.isArray(snapshot[key]))) fail('versão ou coleções ausentes');
  const preferences = new Map(); const payments = new Map();
  const result = emptySnapshot();
  for (const preference of snapshot.preferences) {
    if (!preference || !idValid(preference.id) || preferences.has(preference.id) || !referenceValid(preference.external_reference)) fail('identidade de preferência');
    let total;
    try { total = preferenceTotal(preference.items); } catch { fail('itens de preferência'); }
    if (preference.totalCents !== total || preference.metadata?.os_id !== undefined && (typeof preference.metadata.os_id !== 'string' || preference.metadata.os_id.length > 200)) fail('total ou OS da preferência');
    const checkout = `${publicBaseUrl}/checkout/${preference.id}`;
    if (preference.init_point !== undefined && preference.init_point !== checkout || preference.sandbox_init_point !== undefined && preference.sandbox_init_point !== checkout) fail('URL de checkout');
    const restored = { ...preference, init_point: checkout, sandbox_init_point: checkout };
    preferences.set(restored.id, restored); result.preferences.push(restored);
  }
  for (const payment of snapshot.payments) {
    if (!payment || !idValid(payment.id) || payments.has(payment.id) || !referenceValid(payment.external_reference) || payment.currency_id !== 'BRL' || !['approved', 'rejected', 'pending', 'cancelled'].includes(payment.status) || !Number.isFinite(payment.transaction_amount) || payment.transaction_amount <= 0 || !Number.isSafeInteger(Math.round(payment.transaction_amount * 100)) || Math.abs(Math.round(payment.transaction_amount * 100) / 100 - payment.transaction_amount) > 0.000001) fail('registro de pagamento');
    if (payment.preference_id !== undefined && !preferences.has(payment.preference_id)) fail('preferência do pagamento');
    payments.set(payment.id, payment); result.payments.push(payment);
  }
  function index(name, validate) {
    const keys = new Set();
    for (const pair of snapshot[name]) {
      if (!Array.isArray(pair) || pair.length !== 2 || typeof pair[0] !== 'string' || !pair[0] || pair[0].length > 500 || keys.has(pair[0]) || typeof pair[1] !== 'string' || !validate(pair[0], pair[1])) fail(`índice ${name}`);
      keys.add(pair[0]); result[name].push([...pair]);
    }
  }
  function matches(preferenceId, paymentId) {
    const preference = preferences.get(preferenceId); const payment = payments.get(paymentId);
    return preference && payment && payment.external_reference === preference.external_reference && Math.round(payment.transaction_amount * 100) === preference.totalCents && (payment.preference_id === undefined || payment.preference_id === preferenceId);
  }
  index('preferenceKeys', (_key, preferenceId) => preferences.has(preferenceId));
  index('byPreferenceStatus', (key, paymentId) => {
    const split = key.lastIndexOf(':'); const preferenceId = key.slice(0, split); const status = key.slice(split + 1);
    return ['approved', 'rejected'].includes(status) && payments.get(paymentId)?.status === status && matches(preferenceId, paymentId);
  });
  index('latest', (preferenceId, paymentId) => matches(preferenceId, paymentId));
  const statusIndex = new Map(result.byPreferenceStatus); const latestIndex = new Map(result.latest);
  for (const [key, paymentId] of statusIndex) {
    const preferenceId = key.slice(0, key.lastIndexOf(':'));
    const expectedLatest = statusIndex.get(`${preferenceId}:approved`) ?? paymentId;
    if (latestIndex.get(preferenceId) !== expectedLatest) fail('estado mais recente do pagamento');
  }
  for (const payment of payments.values()) {
    if (payment.preference_id && ['approved', 'rejected'].includes(payment.status) && statusIndex.get(`${payment.preference_id}:${payment.status}`) !== payment.id) fail('idempotência do pagamento');
  }
  for (const paymentId of snapshot.delivered) {
    if (typeof paymentId !== 'string' || !payments.has(paymentId) || result.delivered.includes(paymentId)) fail('confirmação de entrega');
    result.delivered.push(paymentId);
  }
  return result;
}
class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}
async function readBody(req) {
  const chunks = []; let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes <= MAX_BODY_BYTES) chunks.push(chunk);
    else chunks.length = 0;
  }
  if (bytes > MAX_BODY_BYTES) throw new HttpError(413, 'Corpo da requisição excede 64 KiB.');
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  const contentType = String(req.headers['content-type'] ?? '').split(';')[0].trim();
  if (contentType === 'application/x-www-form-urlencoded') return Object.fromEntries(new URLSearchParams(raw));
  if (contentType !== 'application/json') throw new HttpError(415, 'Use JSON ou formulário.');
  let body;
  try { body = JSON.parse(raw); } catch { throw new HttpError(400, 'JSON inválido.'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Informe um objeto JSON.');
  return body;
}
function json(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(value));
}
function preferenceTotal(items) {
  if (!Array.isArray(items) || !items.length || items.length > 100) throw new HttpError(400, 'Preferência precisa de 1 a 100 itens.');
  const cents = items.reduce((sum, item) => {
    if (!item || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || !Number.isFinite(item.unit_price) || item.unit_price < 0 || (item.currency_id && item.currency_id !== 'BRL')) throw new HttpError(400, 'Quantidade, valor ou moeda inválidos.');
    const amount = Math.round(item.unit_price * 100);
    if (!Number.isSafeInteger(amount) || Math.abs(amount / 100 - item.unit_price) > 0.000001) throw new HttpError(400, 'Valor deve ter no máximo dois decimais.');
    return sum + item.quantity * amount;
  }, 0);
  if (!Number.isSafeInteger(cents) || cents <= 0) throw new HttpError(400, 'Total inválido.');
  return cents;
}
function localOrigin(value, name) {
  const url = new URL(value);
  if (url.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(url.hostname) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error(`${name} deve ser uma origem HTTP local.`);
  return url.origin;
}
function portalReturn(preference, status, portalOrigin = 'http://localhost:5173') {
  let origin = portalOrigin;
  try {
    const target = new URL(preference.back_urls?.[status === 'rejected' ? 'failure' : 'success']);
    if (target.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(target.hostname) && target.port === new URL(portalOrigin).port && !target.username && !target.password) origin = target.origin;
  } catch { /* An untrusted return URL is replaced with the local portal. */ }
  const id = preference.metadata?.os_id;
  return `${origin}/#/ordens${typeof id === 'string' && id ? `/${encodeURIComponent(id)}` : ''}`;
}
function checkoutHtml(preference, current, delivered, failed = false, portalOrigin) {
  const title = current?.status === 'approved' ? 'Pagamento de demonstração aprovado' : current?.status === 'rejected' ? 'Pagamento de demonstração recusado' : 'Pagamento de demonstração';
  const status = failed
    ? 'Não foi possível enviar a confirmação ao Billing. O pagamento de demonstração foi preservado; tente enviar novamente, sem criar outro pagamento.'
    : delivered && current?.status === 'approved'
      ? 'Confirmação enviada ao Billing. Aguarde alguns instantes e volte à OS para acompanhar a liberação da entrega.'
      : current?.status === 'rejected'
        ? 'A OS permanece aguardando pagamento. Você pode aprovar uma nova tentativa nesta mesma preferência.'
        : 'Escolha o resultado para testar o fluxo local. Nenhum cartão ou conta bancária será utilizado.';
  const action = kind => `/checkout/${encodeURIComponent(preference.id)}/${kind}`;
  const approve = `<form method="post" action="${action('approve')}"><button type="submit">Aprovar pagamento de demonstração</button></form>`;
  const reject = `<form method="post" action="${action('reject')}"><button class="secondary" type="submit">Recusar pagamento de demonstração</button></form>`;
  const retry = failed ? `<form method="post" action="${action(current.status === 'approved' ? 'approve' : 'reject')}"><button type="submit">Reenviar confirmação ao Billing</button></form>` : '';
  const amount = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(preference.totalCents / 100);
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Demonstração local de pagamento</title><style>body{font:17px/1.6 system-ui,sans-serif;background:#eef2f6;color:#17324d;margin:0;padding:32px 16px}main{max-width:660px;margin:auto;background:white;padding:32px;border-radius:18px;box-shadow:0 8px 30px #17324d12}h1{line-height:1.25}strong.notice{display:block;background:#fff0c2;padding:12px;border-radius:8px}dl{display:grid;grid-template-columns:110px 1fr;gap:8px}dt{font-weight:bold}dd{margin:0;overflow-wrap:anywhere}.amount{font-size:30px;font-weight:bold}button{font:inherit;background:#1d4ed8;color:white;border:0;border-radius:8px;padding:12px 18px;cursor:pointer}.secondary{background:#7f1d1d}form{display:inline-block;margin:8px 8px 8px 0}a{color:#1d4ed8}p[role=alert]{background:#fff0c2;padding:12px}li{overflow-wrap:anywhere}</style></head><body><main><strong class="notice">Demonstração local / sem cobrança real</strong><h1>${escapeHtml(title)}</h1><dl><dt>OS</dt><dd>${escapeHtml(preference.metadata?.os_id ?? preference.external_reference)}</dd><dt>Referência</dt><dd>${escapeHtml(preference.external_reference)}</dd></dl><p class="amount">${escapeHtml(amount)}</p><ul>${preference.items.map(item => `<li>${escapeHtml(item.title ?? 'Serviço da oficina')} — ${escapeHtml(item.quantity)} unidade(s)</li>`).join('')}</ul><p${failed ? ' role="alert"' : ''}>${escapeHtml(status)}</p>${retry}${current?.status === 'approved' ? '' : approve + reject}<p><a href="${escapeHtml(portalReturn(preference, current?.status, portalOrigin))}">Voltar à OS no portal</a></p>${current ? `<small>ID do pagamento de demonstração: ${escapeHtml(current.id)}</small>` : ''}</main></body></html>`;
}

function createServer(options = {}) {
  const env = options.env ?? process.env;
  const httpFetch = options.fetch ?? globalThis.fetch;
  const publicBaseUrl = localOrigin(env.MP_PUBLIC_BASE_URL || 'http://localhost:8088', 'MP_PUBLIC_BASE_URL');
  const portalOrigin = localOrigin(env.MP_PORTAL_BASE_URL || 'http://localhost:5173', 'MP_PORTAL_BASE_URL');
  const webhook = new URL(env.BILLING_WEBHOOK_URL ?? 'http://billing:3001/api/v1/billing/webhooks/mercadopago');
  if (webhook.protocol !== 'http:' || !['billing', 'localhost', '127.0.0.1'].includes(webhook.hostname) || webhook.username || webhook.password) throw new Error('BILLING_WEBHOOK_URL deve apontar para o Billing local.');
  const webhookSecret = env.BILLING_WEBHOOK_SECRET ?? 'local-only-webhook-secret';
  const stateFile = env.DEMO_STATE_FILE ? path.resolve(env.DEMO_STATE_FILE) : undefined;
  let snapshot = emptySnapshot();
  if (stateFile) {
    fs.mkdirSync(path.dirname(stateFile), { recursive: true, mode: 0o700 });
    try {
      const stat = fs.lstatSync(stateFile);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_STATE_BYTES) throw new Error('Arquivo inválido');
      snapshot = validateStateSnapshot(JSON.parse(fs.readFileSync(stateFile, 'utf8')), publicBaseUrl);
    } catch (error) {
      if (error.code !== 'ENOENT') throw new Error('Não foi possível carregar DEMO_STATE_FILE: arquivo inválido ou ilegível; conteúdo preservado.');
    }
  }
  const preferences = new Map(snapshot.preferences.map(preference => [preference.id, preference]));
  const payments = new Map(snapshot.payments.map(payment => [payment.id, payment]));
  const byPreferenceStatus = new Map(snapshot.byPreferenceStatus.map(([key, id]) => [key, payments.get(id)]));
  const latest = new Map(snapshot.latest.map(([key, id]) => [key, payments.get(id)]));
  const delivered = new Set(snapshot.delivered); const deliveries = new Map();
  const preferenceKeys = new Map(snapshot.preferenceKeys);
  let writes = Promise.resolve(); let storageError;
  function persist() {
    if (!stateFile) return Promise.resolve();
    if (storageError) return Promise.reject(new HttpError(503, 'Estado local indisponível; corrija o armazenamento e reinicie o simulador.'));
    const body = JSON.stringify({ version: 1, preferences: [...preferences.values()], payments: [...payments.values()], preferenceKeys: [...preferenceKeys], byPreferenceStatus: [...byPreferenceStatus].map(([key, payment]) => [key, payment.id]), latest: [...latest].map(([key, payment]) => [key, payment.id]), delivered: [...delivered] });
    const pending = writes.then(async () => {
      if (storageError || Buffer.byteLength(body) > MAX_STATE_BYTES) throw new Error('Armazenamento local indisponível');
      const temporary = `${stateFile}.${process.pid}.${randomUUID()}.tmp`;
      try {
        const handle = await fs.promises.open(temporary, 'wx', 0o600);
        try { await handle.writeFile(body, 'utf8'); await handle.sync(); } finally { await handle.close(); }
        await fs.promises.rename(temporary, stateFile);
      } finally {
        await fs.promises.unlink(temporary).catch(() => {});
      }
    });
    writes = pending.catch(error => { storageError = error; });
    return pending.catch(() => { throw new HttpError(503, 'Não foi possível persistir o estado local. Nenhum sucesso será confirmado; verifique o armazenamento.'); });
  }

  async function notify(payment) {
    if (delivered.has(payment.id)) return true;
    if (deliveries.has(payment.id)) return deliveries.get(payment.id);
    const pending = (async () => {
      const requestId = randomUUID(); const stamp = String(Math.floor(Date.now() / 1000));
      const signature = createHmac('sha256', webhookSecret).update(`id:${payment.id.toLowerCase()};request-id:${requestId};ts:${stamp};`).digest('hex');
      const target = new URL(webhook); target.searchParams.set('data.id', payment.id);
      try {
        const result = await httpFetch(target, { method: 'POST', signal: AbortSignal.timeout(5000), headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId, 'X-Signature': `ts=${stamp},v1=${signature}` }, body: JSON.stringify({ type: 'payment', action: 'payment.updated', data: { id: payment.id } }) });
        if (!result.ok) return false;
        delivered.add(payment.id); await persist(); return true;
      } catch { return false; }
    })();
    deliveries.set(payment.id, pending);
    try { return await pending; } finally { deliveries.delete(payment.id); }
  }
  function render(res, preference, payment, failed = false) {
    res.writeHead(failed ? 502 : 200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': `default-src 'none'; style-src 'unsafe-inline'; form-action 'self' ${portalOrigin} ${portalOrigin.replace('localhost', '127.0.0.1')}; base-uri 'none'; frame-ancestors 'none'` });
    res.end(checkoutHtml(preference, payment, payment && delivered.has(payment.id), failed, portalOrigin));
  }
  const server = http.createServer(async (req, res) => {
    try {
      if (storageError) throw new HttpError(503, 'Estado local indisponível; corrija o armazenamento e reinicie o simulador.');
      const url = new URL(req.url, 'http://localhost');
      if (req.method === 'GET' && ['/', '/health'].includes(url.pathname)) return json(res, 200, { status: 'ok', mode: 'local-demo' });
      if (req.method === 'POST' && url.pathname === '/checkout/preferences') {
        const body = await readBody(req);
        if (typeof body.external_reference !== 'string' || !body.external_reference || body.external_reference.length > 200) throw new HttpError(400, 'Referência externa inválida.');
        const totalCents = preferenceTotal(body.items);
        if (body.metadata?.os_id !== undefined && (typeof body.metadata.os_id !== 'string' || body.metadata.os_id.length > 200)) throw new HttpError(400, 'OS inválida.');
        const key = req.headers['x-idempotency-key'];
        if (typeof key === 'string' && (!key || key.length > 200)) throw new HttpError(400, 'Chave idempotente inválida.');
        if (typeof key === 'string' && preferenceKeys.has(key)) {
          const existing = preferences.get(preferenceKeys.get(key));
          if (existing.external_reference !== body.external_reference || existing.totalCents !== totalCents) throw new HttpError(409, 'Chave idempotente usada para outra preferência.');
          return json(res, 200, existing);
        }
        const id = randomUUID(); const checkout = `${publicBaseUrl}/checkout/${id}`;
        const preference = { id, external_reference: body.external_reference, items: body.items, metadata: body.metadata ?? {}, back_urls: body.back_urls ?? {}, totalCents, init_point: checkout, sandbox_init_point: checkout };
        preferences.set(id, preference); if (typeof key === 'string') preferenceKeys.set(key, id);
        await persist();
        return json(res, 200, preference);
      }
      if (req.method === 'GET' && url.pathname === '/checkout/preferences/search') return json(res, 200, { elements: [...preferences.values()].filter(preference => preference.external_reference === url.searchParams.get('external_reference')) });
      if (req.method === 'GET' && url.pathname === '/v1/payments/search') return json(res, 200, { results: [...payments.values()].filter(payment => payment.external_reference === url.searchParams.get('external_reference')).reverse() });
      const preferenceMatch = /^\/checkout\/preferences\/([^/]+)$/.exec(url.pathname);
      if (req.method === 'GET' && preferenceMatch) {
        const preference = preferences.get(preferenceMatch[1]);
        if (!preference) throw new HttpError(404, 'Preferência não encontrada.');
        return json(res, 200, preference);
      }
      const paymentMatch = /^\/v1\/payments\/([^/]+)$/.exec(url.pathname);
      if (req.method === 'GET' && paymentMatch) {
        const payment = payments.get(paymentMatch[1]);
        if (!payment) throw new HttpError(404, 'Pagamento não encontrado.');
        return json(res, 200, payment);
      }
      // Existing BDD hook: creates a provider record, then support.cjs signs its webhook.
      if (req.method === 'POST' && url.pathname === '/test/payments') {
        const body = await readBody(req);
        if (typeof body.external_reference !== 'string' || !body.external_reference || body.external_reference.length > 200 || !Number.isFinite(body.transaction_amount) || body.transaction_amount <= 0 || !Number.isSafeInteger(Math.round(body.transaction_amount * 100)) || Math.abs(Math.round(body.transaction_amount * 100) / 100 - body.transaction_amount) > 0.000001 || (body.status && !['approved', 'rejected', 'pending', 'cancelled'].includes(body.status))) throw new HttpError(400, 'Pagamento de teste inválido.');
        const payment = { id: randomUUID(), currency_id: 'BRL', status: body.status ?? 'approved', external_reference: body.external_reference, transaction_amount: body.transaction_amount };
        payments.set(payment.id, payment); await persist(); return json(res, 200, payment);
      }
      const checkoutMatch = /^\/checkout\/([^/]+)(?:\/(approve|reject))?$/.exec(url.pathname);
      if (checkoutMatch && (req.method === 'GET' && !checkoutMatch[2] || req.method === 'POST' && checkoutMatch[2])) {
        const preference = preferences.get(checkoutMatch[1]);
        if (!preference) throw new HttpError(404, 'Preferência não encontrada.');
        if (req.method === 'GET') {
          const current = latest.get(preference.id);
          return render(res, preference, current, Boolean(current && ['approved', 'rejected'].includes(current.status) && !delivered.has(current.id)));
        }
        await readBody(req); // Never trust browser amounts, references or notification URLs.
        const requested = checkoutMatch[2] === 'approve' ? 'approved' : 'rejected';
        const approved = byPreferenceStatus.get(`${preference.id}:approved`);
        const key = `${preference.id}:${requested}`;
        let payment = approved ?? byPreferenceStatus.get(key);
        if (!payment) {
          payment = { id: randomUUID(), currency_id: 'BRL', status: requested, external_reference: preference.external_reference, transaction_amount: preference.totalCents / 100, preference_id: preference.id };
          byPreferenceStatus.set(key, payment); payments.set(payment.id, payment);
        }
        latest.set(preference.id, payment);
        await persist();
        const confirmed = await notify(payment);
        if (confirmed) {
          res.writeHead(303, { Location: portalReturn(preference, payment.status, portalOrigin), 'Cache-Control': 'no-store' });
          return res.end();
        }
        return render(res, preference, payment, !confirmed);
      }
      throw new HttpError(404, 'Endpoint não encontrado.');
    } catch (error) {
      json(res, error instanceof HttpError ? error.status : 500, { error: error instanceof HttpError ? error.message : 'Falha no simulador local.' });
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  return server;
}

module.exports = { createServer, validateStateSnapshot };
if (require.main === module) createServer().listen(8088, '0.0.0.0');
