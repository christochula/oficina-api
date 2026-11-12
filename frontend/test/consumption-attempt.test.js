import assert from 'node:assert/strict';
import test from 'node:test';
import { beginConsumption, finishConsumption, pendingConsumption } from '../src/core/consumption-attempt.js';

test('mesma tentativa retém a chave; outra operação só começa após confirmação', () => {
  const original = beginConsumption('os-receipt-1', { pecaId: 'pc-1', quantidade: 1 });
  assert.match(original.operationId, /^[a-f0-9-]{36}$/);
  assert.deepEqual(beginConsumption('os-receipt-1', { pecaId: 'pc-1', quantidade: 1 }), original);
  assert.throws(() => beginConsumption('os-receipt-1', { pecaId: 'pc-1', quantidade: 2 }), /consumo pendente/);
  assert.throws(() => beginConsumption('os-receipt-1', { pecaId: 'pc-2', quantidade: 1 }), /consumo pendente/);
  finishConsumption('os-receipt-1', 'old-operation');
  assert.deepEqual(pendingConsumption('os-receipt-1'), original);
  finishConsumption('os-receipt-1', original.operationId);
  assert.equal(pendingConsumption('os-receipt-1'), null);
  const next = beginConsumption('os-receipt-1', { pecaId: 'pc-1', quantidade: 1 });
  assert.notEqual(next.operationId, original.operationId);
  finishConsumption('os-receipt-1', next.operationId);
});

test('fechar a tela e recarregar preserva somente peça, quantidade e ID da operação pendente', async (t) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  const values = new Map();
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: {
    getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key),
  } });
  t.after(() => previous ? Object.defineProperty(globalThis, 'sessionStorage', previous) : delete globalThis.sessionStorage);
  const original = beginConsumption('os-reload', { pecaId: 'pc-test', quantidade: 1 });
  const reloaded = await import('../src/core/consumption-attempt.js?reload-test');
  assert.deepEqual(reloaded.pendingConsumption('os-reload'), original);
  assert.deepEqual(reloaded.beginConsumption('os-reload', { pecaId: 'pc-test', quantidade: 1 }), original);
  assert.deepEqual(Object.keys(JSON.parse([...values.values()][0])).sort(), ['operationId', 'pecaId', 'quantidade']);
  reloaded.finishConsumption('os-reload', original.operationId);
  finishConsumption('os-reload', original.operationId);
  assert.equal(values.size, 0);
});

test('storage indisponível preserva a identificação em memória durante a sessão', (t) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, get() { throw new Error('Storage blocked'); } });
  t.after(() => previous ? Object.defineProperty(globalThis, 'sessionStorage', previous) : delete globalThis.sessionStorage);
  const original = beginConsumption('os-no-storage', { pecaId: 'pc-test', quantidade: 1 });
  assert.deepEqual(pendingConsumption('os-no-storage'), original);
  finishConsumption('os-no-storage', original.operationId);
  assert.equal(pendingConsumption('os-no-storage'), null);
});
