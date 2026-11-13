// One-time recovery of the local simulator from the owning services' APIs.
// Does not write Billing/OS data, create a charge or send a webhook.
const fs = require('node:fs');
const path = require('node:path');
const destination = path.resolve(__dirname, '../.tmp/mercadopago-demo/state.json');
const internal = 'local-only-internal-token-32-bytes-minimum';
const urls = { os: 'http://localhost:3000', billing: 'http://localhost:3001', provider: 'http://localhost:8088' };

async function request(service, resource, { token, body, allowMissing = false } = {}) {
  const response = await fetch(urls[service] + resource, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(service === 'billing' ? { 'X-Internal-Token': internal } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(10000), redirect: 'error',
  });
  if (allowMissing && response.status === 404) return null;
  if (!response.ok) throw new Error(`${service}: HTTP ${response.status}. Recuperação interrompida; os bancos não foram alterados.`);
  return response.json();
}
const data = value => value.data ?? value;

async function collect() {
  const auth = data(await request('os', '/api/v1/auth/login', { body: { email: 'admin@oficina.com', senha: 'Local-only-admin-password-2026' } }));
  const snapshot = { version: 1, preferences: [], payments: [], preferenceKeys: [], byPreferenceStatus: [], latest: [], delivered: [] };
  const paymentMap = new Map();
  const statusMap = new Map();
  const latestMap = new Map();
  const delivered = new Set();
  const summary = [];
  for (let pagina = 1; ; pagina++) {
    const page = await request('os', `/api/v1/ordens-servico?porPagina=100&pagina=${pagina}`, { token: auth.accessToken });
    if (!Array.isArray(page.data)) throw new Error('Formato inesperado na listagem local de OS.');
    for (const order of page.data) {
      const bill = data(await request('billing', `/api/v1/billing/internal/orders/${encodeURIComponent(order.id)}`));
      const payment = bill.payment;
      if (!payment?.preferenceId || !payment.checkoutUrl) continue;
      const expectedUrl = `http://localhost:8088/checkout/${payment.preferenceId}`;
      if (payment.checkoutUrl !== expectedUrl) throw new Error('Checkout externo encontrado. Este script aceita somente o simulador local.');
      if (!bill.repairCompleted || !bill.budget?.approved || payment.externalReference !== `${bill.osId}:${bill.budget.version}` || payment.amountCents !== bill.budget.totalCents) throw new Error('Cobrança divergente do orçamento aprovado; nenhum arquivo foi gravado.');
      let preference = await request('provider', `/checkout/preferences/${encodeURIComponent(payment.preferenceId)}`, { allowMissing: true });
      const recovered = !preference;
      preference ??= {
        id: payment.preferenceId, external_reference: payment.externalReference,
        items: [{ id: bill.osId, title: `Reparo OS ${bill.osId}`, quantity: 1, currency_id: 'BRL', unit_price: payment.amountCents / 100 }],
        metadata: { os_id: bill.osId, filial_id: bill.filialId, budget_version: bill.budget.version },
        back_urls: { success: 'http://localhost:5173/#/ordens', pending: 'http://localhost:5173/#/ordens', failure: 'http://localhost:5173/#/ordens' },
        totalCents: payment.amountCents, init_point: expectedUrl, sandbox_init_point: expectedUrl,
      };
      if (preference.id !== payment.preferenceId || preference.external_reference !== payment.externalReference || preference.totalCents !== payment.amountCents) throw new Error('Preferência divergente da cobrança. Recuperação interrompida.');
      for (const [key, expected] of Object.entries({ os_id: bill.osId, filial_id: bill.filialId, budget_version: bill.budget.version })) {
        if (preference.metadata?.[key] !== undefined && preference.metadata[key] !== expected) throw new Error('Metadados da preferência divergem do Billing. Recuperação interrompida.');
      }
      snapshot.preferences.push(preference);
      snapshot.preferenceKeys.push([payment.key, preference.id]);
      const found = await request('provider', `/v1/payments/search?external_reference=${encodeURIComponent(payment.externalReference)}`);
      if (!Array.isArray(found.results)) throw new Error('Formato inesperado na consulta ao simulador.');
      const payments = [...found.results].reverse(); // Keep provider insertion order.
      const recordedStatus = { APPROVED: 'approved', REJECTED: 'rejected' }[payment.status];
      if (recordedStatus && payment.paymentId && !payments.some(item => String(item.id) === String(payment.paymentId))) {
        payments.push({ id: String(payment.paymentId), status: recordedStatus, currency_id: 'BRL', external_reference: payment.externalReference, transaction_amount: payment.amountCents / 100, preference_id: preference.id });
      }
      for (const item of payments) {
        if (item.external_reference !== payment.externalReference || item.currency_id !== 'BRL' || Math.round(item.transaction_amount * 100) !== payment.amountCents) throw new Error('Pagamento divergente da cobrança. Recuperação interrompida.');
        paymentMap.set(String(item.id), item);
        if (['approved', 'rejected'].includes(item.status)) statusMap.set(`${preference.id}:${item.status}`, String(item.id));
        latestMap.set(preference.id, String(item.id));
        if (String(item.id) === String(payment.paymentId) && item.status === recordedStatus) delivered.add(String(item.id));
      }
      const approved = statusMap.get(`${preference.id}:approved`);
      if (approved) latestMap.set(preference.id, approved);
      summary.push({ numero: order.numero, preferenceId: preference.id, restored: recovered, paymentStatus: payment.status });
    }
    if (page.data.length < 100) break;
  }
  snapshot.payments = [...paymentMap.values()];
  snapshot.byPreferenceStatus = [...statusMap];
  snapshot.latest = [...latestMap];
  snapshot.delivered = [...delivered];
  return { snapshot, summary };
}

async function main() {
  if (fs.existsSync(destination)) throw new Error('O estado persistente já existe. Recuperação inicial não sobrescreve dados do simulador.');
  const { snapshot, summary } = await collect();
  const { validateStateSnapshot } = require('../test/phase4/mercadopago-stub.cjs');
  validateStateSnapshot(snapshot);
  if (process.argv.includes('--write')) {
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, `${JSON.stringify(snapshot, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  }
  console.log(JSON.stringify({ mode: process.argv.includes('--write') ? 'saved' : 'dry-run', preferences: snapshot.preferences.length, payments: snapshot.payments.length, summary }, null, 2));
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { collect };
