import assert from 'node:assert/strict';
import test from 'node:test';
import { mountOrderDetailView } from '../src/views/orders.js';
import { ROLES } from '../src/core/permissions.js';

const initialOrder = (pending = ['billing', 'production']) => ({
  id: 'os_pending', numero: 1, status: 'RECEBIDA', historico: [],
  sincronizacaoPendente: pending,
});

async function harness(respond) {
  const target = { innerHTML: '', isConnected: true };
  const listeners = new Map();
  const requests = [];
  const root = {
    querySelector: () => target,
    addEventListener: (name, listener) => listeners.set(name, listener),
    removeEventListener: (name, listener) => {
      if (listeners.get(name) === listener) listeners.delete(name);
    },
  };
  const dispose = await mountOrderDetailView(root, {
    id: 'os_pending', role: ROLES.ADMIN,
    api: { async request(path, options) { requests.push({ path, options }); return respond(requests.length); } },
    navigate() {}, notify() {},
  });
  return {
    target, requests, dispose,
    async click(action) {
      const trigger = { dataset: { action }, matches: () => false, closest() { return this; } };
      await listeners.get('click')?.({ target: trigger });
    },
    listenerCount: () => listeners.size,
  };
}

async function tick(t, milliseconds = 1_000) {
  t.mock.timers.tick(milliseconds);
  await Promise.resolve();
  await Promise.resolve();
}

test('inscrições pendentes bloqueiam atribuição até ambos serviços confirmarem', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1_000 });
  const snapshots = [initialOrder(), initialOrder(['billing']), initialOrder([])];
  const h = await harness((count) => snapshots[Math.min(count - 1, 2)]);
  t.after(h.dispose);
  assert.match(h.target.innerHTML, /Preparando atendimento/);
  assert.match(h.target.innerHTML, /Atualizar andamento/);
  assert.doesNotMatch(h.target.innerHTML, /data-action="order:assign"/);
  await h.click('order:assign');
  assert.equal(h.requests.length, 1);
  await tick(t);
  assert.match(h.target.innerHTML, /Preparando atendimento/);
  assert.doesNotMatch(h.target.innerHTML, /data-action="order:assign"/);
  await tick(t);
  assert.match(h.target.innerHTML, /Atribua um mecânico/);
  assert.match(h.target.innerHTML, /data-action="order:assign"/);
  assert.ok(h.requests.every(({ path, options }) => path === '/ordens-servico/os_pending' && options === undefined));
  await tick(t, 10_000);
  assert.equal(h.requests.length, 3);
});

test('poll de inscrições termina em 60 segundos e mantém atualização manual disponível', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1_000 });
  const h = await harness(() => initialOrder());
  t.after(h.dispose);
  for (let i = 0; i < 60; i += 1) await tick(t);
  assert.equal(h.requests.length, 61);
  await tick(t, 60_000);
  assert.equal(h.requests.length, 61);
  assert.match(h.target.innerHTML, /Atualizar andamento/);
  await h.click('order:retry');
  assert.equal(h.requests.length, 62);
  await tick(t);
  assert.equal(h.requests.length, 63);
});

test('cleanup da rota cancela timer/listener e ignora resposta GET já em voo', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1_000 });
  let finish;
  const pending = new Promise((resolve) => { finish = resolve; });
  const h = await harness((count) => count === 1 ? initialOrder() : pending);
  await tick(t);
  assert.equal(h.requests.length, 2);
  const before = h.target.innerHTML;
  h.dispose();
  finish(initialOrder([]));
  await Promise.resolve();
  await Promise.resolve();
  await tick(t, 60_000);
  assert.equal(h.requests.length, 2);
  assert.equal(h.listenerCount(), 0);
  assert.equal(h.target.innerHTML, before);
});

test('DOM desmontado antes do próximo poll não emite outra requisição', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1_000 });
  const h = await harness(() => initialOrder());
  t.after(h.dispose);
  h.target.isConnected = false;
  await tick(t);
  assert.equal(h.requests.length, 1);
});

test('falha do GET continua visível e interrompe poll automático', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1_000 });
  const h = await harness((count) => {
    if (count > 1) throw Object.assign(new Error('Serviço temporariamente indisponível'), { status: 500 });
    return initialOrder();
  });
  t.after(h.dispose);
  await tick(t);
  assert.match(h.target.innerHTML, /Não foi possível abrir a ordem/);
  assert.match(h.target.innerHTML, /Serviço temporariamente indisponível/);
  await tick(t, 60_000);
  assert.equal(h.requests.length, 2);
});
