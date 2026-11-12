const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createHmac } = require('node:crypto');
const { mkdtemp, readFile, writeFile, mkdir, readdir, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { createServer, validateStateSnapshot } = require('./mercadopago-stub.cjs');

async function listen(server) {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${server.address().port}`;
}
async function close(server) {
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}
async function harness(t, options = {}) {
  const state = { calls: [], failWebhook: false };
  let providerUrl;
  const callback = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      const id = url.searchParams.get('data.id');
      let raw = ''; for await (const chunk of req) raw += chunk;
      const body = JSON.parse(raw);
      const parts = Object.fromEntries(req.headers['x-signature'].split(',').map(part => part.split('=')));
      const expected = createHmac('sha256', 'local-only-webhook-secret')
        .update(`id:${id.toLowerCase()};request-id:${req.headers['x-request-id']};ts:${parts.ts};`).digest('hex');
      const paymentResponse = await fetch(`${providerUrl}/v1/payments/${id}`);
      state.calls.push({ id, body, signature: parts.v1, expected, timestamp: Number(parts.ts), paymentStatus: paymentResponse.status, payment: await paymentResponse.json() });
      res.writeHead(state.failWebhook ? 503 : 204); res.end();
    } catch {
      res.writeHead(500); res.end();
    }
  });
  const callbackUrl = await listen(callback);
  const makeProvider = () => createServer({ env: { ...options.env, BILLING_WEBHOOK_URL: `${callbackUrl}/hook` } });
  let provider = makeProvider();
  providerUrl = await listen(provider);
  t.after(async () => { await close(provider); await close(callback); });
  const request = (path, options = {}) => fetch(providerUrl + path, { redirect: 'manual', ...options });
  const post = (path, body = {}, extra = {}) => request(path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...extra }, body: JSON.stringify(body) });
  async function preference(overrides = {}, headers = {}) {
    const response = await post('/checkout/preferences', {
      external_reference: 'os-demo:1',
      items: [{ id: 'os-demo', title: 'Alinhamento', quantity: 2, unit_price: 75.5, currency_id: 'BRL' }],
      metadata: { os_id: 'os-demo' },
      back_urls: { success: 'http://localhost:5173/#/ordens', failure: 'http://localhost:5173/#/ordens' },
      ...overrides,
    }, headers);
    assert.equal(response.status, 200, await response.clone().text());
    return response.json();
  }
  async function restart() { await close(provider); provider = makeProvider(); providerUrl = await listen(provider); }
  return { state, request, post, preference, restart };
}

async function temporaryState(t) {
  const directory = await mkdtemp(path.join(tmpdir(), 'oficina-provider-state-'));
  t.after(async () => {
    const target = path.resolve(directory); const parent = path.resolve(tmpdir());
    assert.equal(path.dirname(target), parent);
    assert.ok(path.basename(target).startsWith('oficina-provider-state-'));
    await rm(target, { recursive: true, force: true });
  });
  return { directory, file: path.join(directory, 'state.json') };
}

test('checkout mostra contexto e valor reais da preferência, com aviso local e botões acessíveis', async t => {
  const h = await harness(t); const pref = await h.preference();
  const response = await h.request(`/checkout/${pref.id}`); const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /Demonstração local \/ sem cobrança real/);
  assert.match(html, /os-demo/); assert.match(html, /151,00/);
  assert.match(html, /Aprovar pagamento de demonstração/);
  assert.match(html, /Recusar pagamento de demonstração/);
  assert.match(html, /http:\/\/localhost:5173\/#\/ordens\/os-demo/);
  const formAction = response.headers.get('content-security-policy').split(';').map(rule => rule.trim()).find(rule => rule.startsWith('form-action'));
  assert.equal(formAction, "form-action 'self' http://localhost:5173 http://127.0.0.1:5173");
});

test('aprovação usa total e referência armazenados, assina webhook e é idempotente', async t => {
  const h = await harness(t); const pref = await h.preference({ notification_url: 'http://169.254.169.254/latest/meta-data/' });
  const response = await h.post(`/checkout/${pref.id}/approve`, { transaction_amount: 0.01, external_reference: 'forged', notification_url: 'http://attacker.invalid' });
  assert.equal(response.status, 303); assert.equal(response.headers.get('location'), 'http://localhost:5173/#/ordens/os-demo');
  assert.equal(h.state.calls.length, 1);
  const call = h.state.calls[0];
  assert.equal(call.signature, call.expected); assert.ok(Math.abs(call.timestamp - Date.now() / 1000) < 5);
  assert.deepEqual(call.body, { type: 'payment', action: 'payment.updated', data: { id: call.id } });
  assert.equal(call.paymentStatus, 200);
  assert.equal(call.payment.transaction_amount, 151); assert.equal(call.payment.external_reference, 'os-demo:1'); assert.equal(call.payment.currency_id, 'BRL'); assert.equal(call.payment.status, 'approved');
  await Promise.all([h.post(`/checkout/${pref.id}/approve`), h.post(`/checkout/${pref.id}/approve`)]);
  assert.equal(h.state.calls.length, 1);
  const search = await h.request('/v1/payments/search?external_reference=os-demo%3A1');
  assert.equal((await search.json()).results.length, 1);
});

test('recusa mantém resultado recusado e permite aprovação posterior na mesma preferência', async t => {
  const h = await harness(t); const pref = await h.preference();
  const rejected = await h.request(`/checkout/${pref.id}/reject`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'transaction_amount=1&external_reference=wrong' });
  assert.equal(rejected.status, 303); assert.equal(h.state.calls[0].payment.status, 'rejected');
  const html = await (await h.request(`/checkout/${pref.id}`)).text();
  assert.match(html, /A OS permanece aguardando pagamento/);
  assert.match(html, /Aprovar pagamento de demonstração/);
  await h.post(`/checkout/${pref.id}/reject`); assert.equal(h.state.calls.length, 1);
  await h.post(`/checkout/${pref.id}/approve`);
  assert.equal(h.state.calls.length, 2); assert.equal(h.state.calls[1].payment.status, 'approved');
  assert.notEqual(h.state.calls[0].id, h.state.calls[1].id);
  await h.post(`/checkout/${pref.id}/reject`); // Approved provider records cannot be downgraded.
  assert.equal(h.state.calls.length, 2);
  const records = await (await h.request('/v1/payments/search?external_reference=os-demo%3A1')).json();
  assert.deepEqual(records.results.map(payment => payment.status), ['approved', 'rejected']);
});

test('falha de webhook apresenta recuperação e reenvia mesmo pagamento sem novo ID', async t => {
  const h = await harness(t); const pref = await h.preference(); h.state.failWebhook = true;
  const failed = await h.post(`/checkout/${pref.id}/approve`);
  assert.equal(failed.status, 502); const html = await failed.text();
  assert.match(html, /O pagamento de demonstração foi preservado/);
  assert.match(html, /Reenviar confirmação ao Billing/);
  const firstId = h.state.calls[0].id;
  h.state.failWebhook = false;
  const retried = await h.post(`/checkout/${pref.id}/approve`);
  assert.equal(retried.status, 303); assert.equal(h.state.calls[1].id, firstId);
  assert.equal((await (await h.request('/v1/payments/search?external_reference=os-demo%3A1')).json()).results.length, 1);
});

test('aprovações simultâneas compartilham criação e envio de webhook', async t => {
  const h = await harness(t); const pref = await h.preference();
  const responses = await Promise.all([h.post(`/checkout/${pref.id}/approve`), h.post(`/checkout/${pref.id}/approve`)]);
  assert.ok(responses.every(response => response.status === 303));
  assert.equal(h.state.calls.length, 1);
});

test('escapa títulos e identificadores e restringe retorno ao portal local', async t => {
  const h = await harness(t);
  const pref = await h.preference({
    external_reference: '<script>alert(1)</script>', metadata: { os_id: '"><img src=x onerror=alert(1)>' },
    items: [{ title: '<script>bad()</script>', quantity: 1, unit_price: 10 }],
    back_urls: { success: 'https://attacker.invalid/steal', failure: 'javascript:alert(1)' },
  });
  const html = await (await h.request(`/checkout/${pref.id}`)).text();
  assert.doesNotMatch(html, /<script>|<img/); assert.match(html, /&lt;script&gt;/);
  const result = await h.post(`/checkout/${pref.id}/approve`);
  const destination = new URL(result.headers.get('location'));
  assert.equal(destination.origin, 'http://localhost:5173'); assert.match(destination.hash, /#\/ordens\/%22%3E%3Cimg/);
  const local = await h.preference({ external_reference: 'os-second:1', metadata: { os_id: 'os-second' }, back_urls: { success: 'http://127.0.0.1:5173/path' } });
  const localResult = await h.post(`/checkout/${local.id}/approve`);
  assert.equal(localResult.headers.get('location'), 'http://127.0.0.1:5173/#/ordens/os-second');
});

test('preserva REST dos testes BDD, busca preferência e deduplica chave de criação', async t => {
  const h = await harness(t); const pref = await h.preference({}, { 'X-Idempotency-Key': 'same-attempt' });
  const repeat = await h.preference({}, { 'X-Idempotency-Key': 'same-attempt' }); assert.equal(repeat.id, pref.id);
  assert.equal((await (await h.request(`/checkout/preferences/${pref.id}`)).json()).id, pref.id);
  assert.equal((await (await h.request('/checkout/preferences/search?external_reference=os-demo%3A1')).json()).elements.length, 1);
  const payment = await (await h.post('/test/payments', { external_reference: 'os-demo:1', transaction_amount: 151 })).json();
  assert.equal(payment.status, 'approved');
  assert.equal((await (await h.request(`/v1/payments/${payment.id}`)).json()).transaction_amount, 151);
  assert.equal(h.state.calls.length, 0); // BDD signs and sends its own notification.
  const changed = await h.post('/checkout/preferences', { external_reference: 'other', items: [{ quantity: 1, unit_price: 1 }] }, { 'X-Idempotency-Key': 'same-attempt' });
  assert.equal(changed.status, 409);
});

test('valida bodies, limites, referências, valores e endpoints inexistentes sem derrubar servidor', async t => {
  const h = await harness(t);
  for (const path of ['/unknown', '/checkout/not-found', '/checkout/preferences/not-found', '/v1/payments/not-found']) assert.equal((await h.request(path)).status, 404);
  assert.equal((await h.post('/checkout/not-found/approve')).status, 404);
  assert.equal((await h.request('/checkout/preferences', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' })).status, 400);
  assert.equal((await h.request('/checkout/preferences', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'not-json' })).status, 415);
  assert.equal((await h.request('/checkout/preferences', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'x'.repeat(65536) }) })).status, 413);
  for (const body of [null, [], {}, { external_reference: 'os:1', items: [] }, { external_reference: 'os:1', items: [{ quantity: 1, unit_price: -1 }] }, { external_reference: 'os:1', items: [{ quantity: 1, unit_price: 1.001 }] }]) assert.equal((await h.post('/checkout/preferences', body)).status, 400);
  assert.equal((await h.post('/test/payments', { external_reference: 'os:1', transaction_amount: 0 })).status, 400);
  assert.equal((await h.request('/health')).status, 200);
});

test('não escuta durante importação e recusa destino de webhook externo na configuração', () => {
  assert.equal(typeof createServer, 'function');
  assert.throws(() => createServer({ env: { BILLING_WEBHOOK_URL: 'http://169.254.169.254/metadata' } }), /Billing local/);
});

test('portas isoladas preservam checkout, retorno e persistência, sem aceitar destinos externos', async t => {
  const {file}=await temporaryState(t);
  const env={MP_PUBLIC_BASE_URL:'http://localhost:8188',MP_PORTAL_BASE_URL:'http://localhost:5273',DEMO_STATE_FILE:file};
  const h=await harness(t,{env});
  const pref=await h.preference({back_urls:{success:'http://localhost:5273/#/ordens'}});
  assert.equal(pref.init_point,`http://localhost:8188/checkout/${pref.id}`);
  const html=await h.request(`/checkout/${pref.id}`);assert.match(await html.text(),/http:\/\/localhost:5273\/#\/ordens\/os-demo/);
  assert.match(html.headers.get('content-security-policy'),/localhost:5273/);
  await h.restart();
  const restored=await (await h.request(`/checkout/preferences/${pref.id}`)).json();assert.equal(restored.init_point,pref.init_point);
  const approved=await h.post(`/checkout/${pref.id}/approve`);assert.equal(approved.headers.get('location'),'http://localhost:5273/#/ordens/os-demo');
  for(const name of ['MP_PUBLIC_BASE_URL','MP_PORTAL_BASE_URL']) for(const value of ['https://example.com','http://localhost:8188/other','http://name:pass@localhost:8188']) assert.throws(()=>createServer({env:{[name]:value}}),/origem HTTP local/);
});

test('estado opt-in persiste preferência, pagamento, idempotência e ACK após reiniciar servidor', async t => {
  const disk = await temporaryState(t);
  const h = await harness(t, { env: { DEMO_STATE_FILE: disk.file } });
  const pref = await h.preference({}, { 'X-Idempotency-Key': 'durable-attempt' });
  assert.equal((await h.post(`/checkout/${pref.id}/reject`)).status, 303);
  await h.restart();
  assert.equal((await h.request(`/checkout/${pref.id}`)).status, 200);
  const repeat = await h.preference({}, { 'X-Idempotency-Key': 'durable-attempt' });
  assert.equal(repeat.id, pref.id);
  await h.post(`/checkout/${pref.id}/reject`); assert.equal(h.state.calls.length, 1);
  await h.post(`/checkout/${pref.id}/approve`);
  const approvedId = h.state.calls.at(-1).id;
  await h.restart();
  const approved = await (await h.request(`/v1/payments/${approvedId}`)).json();
  assert.equal(approved.id, approvedId); assert.equal(approved.status, 'approved');
  assert.equal(approved.transaction_amount, 151);
  await h.post(`/checkout/${pref.id}/approve`); await h.post(`/checkout/${pref.id}/reject`);
  assert.equal(h.state.calls.length, 2);
  const snapshot = validateStateSnapshot(JSON.parse(await readFile(disk.file, 'utf8')));
  assert.equal(snapshot.preferences.length, 1); assert.equal(snapshot.payments.length, 2);
  assert.ok(snapshot.delivered.includes(approvedId));
  assert.deepEqual((await readdir(disk.directory)).sort(), ['state.json']);
});

test('reinício depois de webhook falho oferece recuperação e mantém ID na repetição', async t => {
  const disk = await temporaryState(t);
  const h = await harness(t, { env: { DEMO_STATE_FILE: disk.file } });
  const pref = await h.preference(); h.state.failWebhook = true;
  assert.equal((await h.post(`/checkout/${pref.id}/approve`)).status, 502);
  const id = h.state.calls[0].id;
  await h.restart();
  const recoveredPage = await h.request(`/checkout/${pref.id}`);
  assert.equal(recoveredPage.status, 502); assert.match(await recoveredPage.text(), /Reenviar confirmação ao Billing/);
  h.state.failWebhook = false;
  assert.equal((await h.post(`/checkout/${pref.id}/approve`)).status, 303);
  assert.equal(h.state.calls[1].id, id);
  assert.equal((await (await h.request('/v1/payments/search?external_reference=os-demo%3A1')).json()).results.length, 1);
});

test('escritas simultâneas serializadas preservam todos os snapshots válidos no reinício', async t => {
  const disk = await temporaryState(t);
  const h = await harness(t, { env: { DEMO_STATE_FILE: disk.file } });
  const preferences = await Promise.all(Array.from({ length: 20 }, (_, index) => h.preference({ external_reference: `os-${index}:1`, metadata: { os_id: `os-${index}` } })));
  const payment = await (await h.post('/test/payments', { external_reference: 'os-0:1', transaction_amount: 151 })).json();
  await h.restart();
  for (const pref of preferences) assert.equal((await h.request(`/checkout/preferences/${pref.id}`)).status, 200);
  assert.equal((await h.request(`/v1/payments/${payment.id}`)).status, 200);
  const saved = validateStateSnapshot(JSON.parse(await readFile(disk.file, 'utf8')));
  assert.equal(saved.preferences.length, 20); assert.equal(saved.payments.length, 1);
});

test('arquivo corrupto ou índices inconsistentes bloqueiam startup sem sobrescrever conteúdo', async t => {
  const disk = await temporaryState(t);
  const broken = '{do not overwrite this invalid snapshot';
  await writeFile(disk.file, broken);
  assert.throws(() => createServer({ env: { DEMO_STATE_FILE: disk.file } }), /arquivo inválido ou ilegível/);
  assert.equal(await readFile(disk.file, 'utf8'), broken);
  const blank = { version: 1, preferences: [], payments: [], preferenceKeys: [], byPreferenceStatus: [], latest: [], delivered: [] };
  for (const invalid of [{ ...blank, version: 2 }, { ...blank, preferenceKeys: [['key', 'missing']] }, { ...blank, delivered: ['missing'] }, { ...blank, preferences: [{ id: 'bad', external_reference: 'os:1', totalCents: 999, items: [{ quantity: 1, unit_price: 1 }] }] }]) {
    await writeFile(disk.file, JSON.stringify(invalid));
    assert.throws(() => createServer({ env: { DEMO_STATE_FILE: disk.file } }), /arquivo inválido ou ilegível/);
    assert.deepEqual(JSON.parse(await readFile(disk.file, 'utf8')), invalid);
  }
});

test('falha de persistência não confirma operação e deixa health indisponível até reparo', async t => {
  const disk = await temporaryState(t);
  const h = await harness(t, { env: { DEMO_STATE_FILE: disk.file } });
  await mkdir(disk.file); // Atomic replacement must fail; never replace a directory with state.
  const response = await h.post('/checkout/preferences', { external_reference: 'os-fail:1', items: [{ quantity: 1, unit_price: 10 }] });
  assert.equal(response.status, 503);
  assert.equal((await h.request('/health')).status, 503);
  assert.equal(h.state.calls.length, 0);
  assert.deepEqual((await readdir(disk.directory)).sort(), ['state.json']);
});
