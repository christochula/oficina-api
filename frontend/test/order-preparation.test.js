import assert from 'node:assert/strict';
import test from 'node:test';
import { mountOrderDetailView } from '../src/views/orders.js';
import { ROLES } from '../src/core/permissions.js';

const SAGA_ID = '00000000-0000-4000-8000-000000000004';
const order = (preparacao, overrides = {}) => ({
  id: 'os_preparation', numero: 4, status: 'APROVADA', preparacao, sagaId: SAGA_ID, historico: [], ...overrides,
});

async function harness(role, respond) {
  const target = { innerHTML: '', isConnected: true };
  const listeners = new Map();
  const requests = [];
  const notifications = [];
  const root = {
    querySelector: () => target,
    addEventListener: (name, listener) => listeners.set(name, listener),
    removeEventListener: (name) => listeners.delete(name),
  };
  const dispose = await mountOrderDetailView(root, {
    id: 'os_preparation', role,
    api: { async request(path, options) { requests.push({ path, options }); return respond(requests.length, path, options); } },
    navigate() {}, notify(value) { notifications.push(value); },
  });
  return {
    target, requests, notifications, dispose,
    async click(action) {
      const trigger = { dataset: { action }, matches: () => false, closest() { return this; } };
      await listeners.get('click')({ target: trigger });
    },
    async refresh() { await this.click('order:retry'); },
  };
}

for (const role of Object.values(ROLES)) {
  test(`preparação que exige intervenção não oferece espera, retry ou execução para ${role}`, async (t) => {
    const h = await harness(role, () => order('MANUAL_ATTENTION'));
    t.after(h.dispose);
    assert.match(h.target.innerHTML, /Preparação exige intervenção/);
    assert.match(h.target.innerHTML, /precisa reconciliar a preparação/);
    assert.match(h.target.innerHTML, /orçamento aprovado foi preservado/);
    assert.doesNotMatch(h.target.innerHTML, /Preparando execução|Atualizar andamento/);
    assert.doesNotMatch(h.target.innerHTML, /data-action="order:(?:retry|saga-retry|start)"/);
    if (role === ROLES.ADMIN) assert.match(h.target.innerHTML, /data-action="order:saga-reconcile"/);
    else {
      assert.doesNotMatch(h.target.innerHTML, /data-action="order:saga-reconcile"/);
      await h.click('order:saga-reconcile');
    }
    assert.equal(h.requests.length, 1);
  });
}

test('atualização de preparação pendente para intervenção interrompe a indicação de espera', async (t) => {
  const h = await harness(ROLES.ADMIN, (count) => order(count === 1 ? 'RESERVING_EXECUTION' : 'MANUAL_ATTENTION'));
  t.after(h.dispose);
  assert.match(h.target.innerHTML, /Preparando execução/);
  assert.match(h.target.innerHTML, /data-action="order:retry"/);
  await h.refresh();
  assert.match(h.target.innerHTML, /Preparação exige intervenção/);
  assert.doesNotMatch(h.target.innerHTML, /Preparando execução|data-action="order:retry"/);
  assert.equal(h.requests.length, 2);
  assert.ok(h.requests.every(({ options }) => options === undefined));
});

function confirmationHarness(t) {
  const previousDocument = globalThis.document;
  const controls = new Map();
  const listeners = new Map();
  for (const name of ['modal-cancel', 'modal-confirm']) {
    const handlers = new Map();
    controls.set(name, {
      addEventListener(event, listener) { handlers.set(event, listener); },
      click() { handlers.get('click')?.(); },
    });
  }
  const modalRoot = {
    innerHTML: '', classList: { add() {}, remove() {} },
    querySelector(selector) {
      if (selector === '[data-modal-panel]') return { querySelectorAll: () => [] };
      return controls.get(selector.match(/data-action="([^"]+)"/)?.[1]) ?? null;
    },
    querySelectorAll: () => [],
    addEventListener(event, listener) { listeners.set(event, listener); },
    removeEventListener(event) { listeners.delete(event); },
  };
  globalThis.document = {
    activeElement: null,
    body: { classList: { add() {}, remove() {} } },
    querySelector: (selector) => selector === '#modal-root' ? modalRoot : null,
  };
  t.after(() => { globalThis.document = previousDocument; });
  return {
    root: modalRoot,
    confirm: () => controls.get('modal-confirm').click(),
    cancel: () => controls.get('modal-cancel').click(),
    escape: () => listeners.get('keydown')?.({ key: 'Escape', defaultPrevented: false }),
  };
}

test('reconciliação confirmada envia a Saga atual uma vez e apresenta a compensação pendente', async (t) => {
  const modal = confirmationHarness(t);
  const pending = order('COMPENSATING', { reconciliation: { id: 'reconcile-test', phase: 'CANCELLING' } });
  const h = await harness(ROLES.ADMIN, (count) => count === 1 ? order('MANUAL_ATTENTION') : pending);
  t.after(h.dispose);
  const action = h.click('order:saga-reconcile');
  assert.match(modal.root.innerHTML, /Reconciliar a preparação\?/);
  assert.match(modal.root.innerHTML, /antes do início do reparo/);
  assert.match(modal.root.innerHTML, /ordem e o orçamento aprovado serão preservados/);
  assert.match(modal.root.innerHTML, /não repõe o estoque/);
  await h.click('order:saga-reconcile');
  assert.equal(h.requests.length, 1);
  modal.confirm();
  await action;
  assert.equal(h.requests.length, 3);
  assert.deepEqual(h.requests[1], {
    path: '/ordens-servico/os_preparation/saga/reconcile',
    options: { method: 'POST', body: { expectedSagaId: SAGA_ID } },
  });
  assert.equal(h.requests[2].options, undefined);
  assert.match(h.target.innerHTML, /Reconciliando preparação/);
  assert.doesNotMatch(h.target.innerHTML, /data-action="order:(?:saga-reconcile|saga-retry|start)"/);
  assert.equal(h.notifications[0].title, 'Reconciliação solicitada');
  await h.click('order:saga-reconcile');
  assert.equal(h.requests.length, 3);
});

test('cancelar a confirmação não solicita reconciliação', async (t) => {
  const modal = confirmationHarness(t);
  const h = await harness(ROLES.ADMIN, () => order('MANUAL_ATTENTION'));
  t.after(h.dispose);
  const action = h.click('order:saga-reconcile');
  modal.cancel();
  await action;
  assert.equal(h.requests.length, 1);
  assert.equal(h.notifications.length, 0);
  assert.match(h.target.innerHTML, /data-action="order:saga-reconcile"/);
});

test('fechar a confirmação com Escape cancela e permite abrir outra confirmação', async (t) => {
  const modal = confirmationHarness(t);
  const h = await harness(ROLES.ADMIN, () => order('MANUAL_ATTENTION'));
  t.after(h.dispose);
  const first = h.click('order:saga-reconcile');
  modal.escape();
  await first;
  assert.equal(h.requests.length, 1);
  const second = h.click('order:saga-reconcile');
  assert.match(modal.root.innerHTML, /Reconciliar a preparação\?/);
  modal.cancel();
  await second;
  assert.equal(h.requests.length, 1);
});

test('Saga ausente ou inválida não oferece nem executa reconciliação', async (t) => {
  for (const sagaId of [undefined, '', 'not-a-saga']) {
    const h = await harness(ROLES.ADMIN, () => order('MANUAL_ATTENTION', { sagaId }));
    t.after(h.dispose);
    assert.doesNotMatch(h.target.innerHTML, /data-action="order:saga-reconcile"/);
    await h.click('order:saga-reconcile');
    assert.equal(h.requests.length, 1);
  }
});

test('compensação permite nova tentativa pela equipe e conclusão libera somente o mecânico', async (t) => {
  const admin = await harness(ROLES.ADMIN, () => order('COMPENSATED'));
  const mechanic = await harness(ROLES.MECHANIC, () => order('COMPENSATED'));
  const ready = await harness(ROLES.MECHANIC, () => order('COMPLETED'));
  t.after(() => { admin.dispose(); mechanic.dispose(); ready.dispose(); });
  assert.match(admin.target.innerHTML, /Preparação cancelada/);
  assert.match(admin.target.innerHTML, /data-action="order:saga-retry"/);
  assert.doesNotMatch(admin.target.innerHTML, /data-action="order:start"/);
  assert.doesNotMatch(mechanic.target.innerHTML, /data-action="order:(?:start|saga-retry)"/);
  assert.match(ready.target.innerHTML, /data-action="order:start"/);
  assert.doesNotMatch(ready.target.innerHTML, /Preparando execução|Preparação exige intervenção/);
});

test('iniciar execução aceita acompanha projeção atrasada e bloqueia repetição até confirmação', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1000 });
  const modal = confirmationHarness(t);
  const h = await harness(ROLES.MECHANIC, (count) => count < 4
    ? order('COMPLETED') : order('EXECUTING', { status: 'EM_EXECUCAO' }));
  t.after(h.dispose);
  const action = h.click('order:start');
  modal.confirm();
  await action;
  assert.equal(h.requests.length, 3);
  assert.match(h.target.innerHTML, /Orçamento aprovado/);
  await h.click('order:start');
  assert.equal(h.requests.length, 3);
  t.mock.timers.tick(1000);
  for (let i = 0; i < 5; i++) await Promise.resolve();
  assert.equal(h.requests.length, 4);
  assert.match(h.target.innerHTML, /Consumir peça/);
  assert.equal(h.requests.filter(({ options }) => options?.method === 'PATCH').length, 1);
});
