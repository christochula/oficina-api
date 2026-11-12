import assert from 'node:assert/strict';
import test from 'node:test';
import { mountOrderDetailView, validBudgetLines } from '../src/views/orders.js';
import { canRetryPreparation, checkoutDestination, expectedStatusAfterAction, orderFollowupPolicy, orderTransitionObserved } from '../src/core/order-followup.js';
import { clearReturnRoute, rememberReturnRoute, safeReturnRoute, takeReturnRoute } from '../src/core/return-route.js';

function order(preparacao = 'RESERVING_EXECUTION', overrides = {}) {
  return { id: 'os-followup', numero: 9, status: 'APROVADA', preparacao, sagaId: 'same-saga', historico: [], ...overrides };
}

async function mount(t, respond, role = 'ADMINISTRADOR') {
  const sync = { innerHTML: '', classList: { toggle() {} } };
  const target = { innerHTML: '', isConnected: true, querySelector: (s) => s === '#order-sync-state' ? sync : null, querySelectorAll: () => [] };
  const listeners = new Map();
  const requests = [];
  const root = { querySelector: () => target, addEventListener: (n, f) => listeners.set(n, f), removeEventListener: (n) => listeners.delete(n) };
  const dispose = await mountOrderDetailView(root, { id: 'os-followup', role,
    api: { async request(path, options) { requests.push({ path, options }); return respond(requests.length, options); } }, navigate() {}, notify() {},
  });
  t.after(dispose);
  return { target, sync, requests, dispose, click: (action) => listeners.get('click')({ target: { closest: () => ({ dataset: { action }, matches: () => false }) } }) };
}
async function tick(t, ms) { t.mock.timers.tick(ms); for (let i = 0; i < 6; i++) await Promise.resolve(); }

test('preparação consulta apenas GET até compensar, sem perder a aprovação nem repetir comandos', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1000 });
  const h = await mount(t, (n) => order(n < 3 ? 'RESERVING_EXECUTION' : 'COMPENSATED'));
  await tick(t, 2000); await tick(t, 2000);
  assert.match(h.target.innerHTML, /Preparação cancelada/);
  assert.match(h.target.innerHTML, /disponibilidade das peças nesta filial/);
  await tick(t, 120000);
  assert.equal(h.requests.length, 3);
  assert.ok(h.requests.every((r) => r.options === undefined));
});

test('pagamento aprovado é refletido automaticamente e interrompe as consultas', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1000 });
  const h = await mount(t, (n) => order('AWAITING_PAYMENT', { status: n === 1 ? 'AGUARDANDO_PAGAMENTO' : 'PRONTA_PARA_ENTREGA', paymentConfirmed: n > 1 }));
  assert.doesNotMatch(h.target.innerHTML, /data-action="order:deliver"/);
  await tick(t, 5000);
  assert.match(h.target.innerHTML, /data-action="order:deliver"/);
  await tick(t, 120000);
  assert.equal(h.requests.length, 2);
});

test('cliente aguarda checkout pronto sem POST prematuro e polling libera o pagamento', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1000 });
  const states = [undefined, { status: 'CREATING' }, { status: 'UNKNOWN' }, { status: 'PENDING', checkoutUrl: 'http://localhost:8188/checkout/ready' }];
  const h = await mount(t, (n) => order('AWAITING_PAYMENT', { status: 'AGUARDANDO_PAGAMENTO', pagamento: states[Math.min(n - 1, states.length - 1)] }), 'CLIENTE');
  for (let index = 0; index < 3; index += 1) {
    assert.match(h.target.innerHTML, /Preparando pagamento/);
    assert.doesNotMatch(h.target.innerHTML, /data-action="order:pay"/);
    await h.click('order:pay');
    assert.equal(h.requests.filter((request) => request.options?.method === 'POST').length, 0);
    await tick(t, 5000);
  }
  assert.match(h.target.innerHTML, /data-action="order:pay"/);
  assert.equal(h.requests.length, 4);
});

test('espera humana não expira a OS e o acompanhamento pausa após dois minutos', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1000 });
  const h = await mount(t, () => order('AWAITING_PAYMENT', { status: 'AGUARDANDO_PAGAMENTO' }));
  for (let i = 0; i < 24; i++) await tick(t, 5000);
  assert.match(h.sync.innerHTML, /Atualização automática pausada/);
  const count = h.requests.length;
  await tick(t, 120000);
  assert.equal(h.requests.length, count);
  assert.match(h.target.innerHTML, /aguardando pagamento/);
  assert.ok(h.requests.every((r) => r.options === undefined));
});

test('falha transitória mantém a OS, bloqueia mutação e atualização manual recupera', async (t) => {
  const h = await mount(t, (n) => { if (n === 2) throw new Error('Sem conexão'); return order('COMPENSATED'); });
  await h.click('order:retry');
  assert.match(h.target.innerHTML, /Preparação cancelada/);
  assert.match(h.sync.innerHTML, /Sem conexão/);
  await h.click('order:saga-retry');
  assert.equal(h.requests.length, 2);
  await h.click('order:retry');
  await h.click('order:saga-retry');
  assert.equal(h.requests.filter((r) => r.options?.method === 'POST').length, 1);
});

test('cliques simultâneos no retry geram uma única solicitação', async (t) => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const h = await mount(t, async (n, options) => options ? gate : order('COMPENSATED'));
  const first = h.click('order:saga-retry');
  await h.click('order:saga-retry');
  assert.equal(h.requests.filter((r) => r.options).length, 1);
  release({}); await first;
});

test('resposta GET anterior à desmontagem não atualiza nem agenda polling', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1000 });
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const h = await mount(t, (n) => n === 1 ? order() : gate);
  const original = h.target.innerHTML;
  await tick(t, 2000); h.dispose(); release(order('COMPENSATED'));
  await tick(t, 120000);
  assert.equal(h.target.innerHTML, original);
  assert.equal(h.requests.length, 2);
});

test('intervenção, execução física e estados finais nunca acionam retry automático', () => {
  for (const state of ['COMPENSATED', 'MANUAL_ATTENTION']) assert.equal(orderFollowupPolicy(order(state)), null);
  for (const status of ['ENTREGUE', 'CANCELADA']) {
    assert.equal(orderFollowupPolicy(order('COMPENSATED', { status })), null);
    assert.equal(canRetryPreparation(order('COMPENSATED', { status }), 'ADMINISTRADOR'), false);
  }
  assert.equal(canRetryPreparation(order('COMPENSATED', { paymentConfirmed: true }), 'ADMINISTRADOR'), false);
  assert.equal(canRetryPreparation(order('COMPENSATED'), 'CLIENTE'), false);
  assert.equal(canRetryPreparation(order('COMPLETED', { status: 'EM_EXECUCAO' }), 'ADMINISTRADOR'), false);
  assert.equal(orderFollowupPolicy(order('COMPLETED')).interval, 5000);
  assert.equal(orderFollowupPolicy(order('EXECUTING', { status: 'EM_EXECUCAO' })).interval, 5000);
});

test('ações aceitas aguardam a projeção de status sem depender de atualização manual', () => {
  for (const [action, status] of Object.entries({ 'atribuir/mec-1': 'ATRIBUIDA', diagnostico: 'EM_DIAGNOSTICO', orcamento: 'AGUARDANDO_APROVACAO', aprovar: 'APROVADA', rejeitar: 'CANCELADA', 'iniciar-execucao': 'EM_EXECUCAO', finalizar: 'AGUARDANDO_PAGAMENTO', entregar: 'ENTREGUE' })) {
    assert.ok(expectedStatusAfterAction(`/ordens-servico/os-id/${action}`).includes(status));
  }
  assert.equal(expectedStatusAfterAction('/ordens-servico/os-id/consumo-peca'), null);
});

test('outro perfil pode avançar além da etapa esperada entre consultas sem bloquear a tela', () => {
  assert.equal(orderTransitionObserved('EM_DIAGNOSTICO', ['ATRIBUIDA']), true);
  assert.equal(orderTransitionObserved('PRONTA_PARA_ENTREGA', ['AGUARDANDO_PAGAMENTO']), true);
  assert.equal(orderTransitionObserved('CANCELADA', ['AGUARDANDO_APROVACAO']), true);
  assert.equal(orderTransitionObserved('EM_EXECUCAO', ['EM_EXECUCAO']), true);
  assert.equal(orderTransitionObserved('APROVADA', ['EM_EXECUCAO']), false);
  assert.equal(orderTransitionObserved('ENTREGUE', ['CANCELADA']), false);
  assert.equal(orderTransitionObserved('DESCONHECIDO', ['ATRIBUIDA']), false);
  assert.equal(orderTransitionObserved('EM_EXECUCAO', null), false);
});

test('finalização reconhece a confirmação legada e os estados distribuídos sem antecipar a execução', () => {
  const expected = expectedStatusAfterAction('/ordens-servico/os-id/finalizar');
  for (const status of ['FINALIZADA', 'AGUARDANDO_PAGAMENTO', 'PRONTA_PARA_ENTREGA', 'ENTREGUE']) {
    assert.equal(orderTransitionObserved(status, expected), true);
  }
  assert.equal(orderTransitionObserved('EM_EXECUCAO', expected), false);
});

test('checkout aceita somente HTTPS ou HTTP local, sem credenciais ou protocolos executáveis', () => {
  assert.equal(checkoutDestination('https://www.mercadopago.com.br/checkout/test'), 'https://www.mercadopago.com.br/checkout/test');
  assert.equal(checkoutDestination('http://localhost:8188/checkout/1'), 'http://localhost:8188/checkout/1');
  for (const url of ['javascript://localhost/alert(1)', 'ftp://localhost/a', 'http://example.com/pay', 'https://user:pass@example.com', 'data:text/html,a']) assert.throws(() => checkoutDestination(url));
});

test('orçamento rejeita quantidades fracionadas e total zero antes do envio', () => {
  const line = { descricao: 'Filtro', quantidade: 1, valorUnitario: 50, tipo: 'MATERIAL', pecaId: 'pc-1' };
  assert.equal(Boolean(validBudgetLines([line])), true);
  for (const change of [{ quantidade: 0.5 }, { quantidade: NaN }, { valorUnitario: Infinity }, { valorUnitario: 0 }, { pecaId: '' }]) assert.equal(Boolean(validBudgetLines([{ ...line, ...change }])), false);
});

test('retorno ao login preserva somente rota interna válida e é consumido uma vez', () => {
  const data = new Map();
  const storage = { getItem: (key) => data.get(key), setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) };
  rememberReturnRoute('/ordens/os-123', storage);
  assert.equal(takeReturnRoute('/inicio', storage), '/ordens/os-123');
  assert.equal(takeReturnRoute('/inicio', storage), '/inicio');
  assert.equal(safeReturnRoute('/ordens/nova'), '/ordens/nova');
  for (const value of ['//evil.com', 'https://evil.com', '/login', '/ordens/1?token=secret', '/ordens/%2F%2Fevil.com']) assert.equal(safeReturnRoute(value), null);
  rememberReturnRoute('/ordens/os-456', storage); clearReturnRoute(storage);
  assert.equal(takeReturnRoute('/inicio', storage), '/inicio');
});
