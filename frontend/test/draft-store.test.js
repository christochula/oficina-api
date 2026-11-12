import test from 'node:test';
import assert from 'node:assert/strict';
import { readDraft, saveDraft, clearDraft, clearDraftScope, captureForm, restoreForm } from '../src/core/draft-store.js';

function storage() {
  const entries = new Map();
  return { getItem: (key) => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value), removeItem: (key) => entries.delete(key), key: (index) => [...entries.keys()][index], get length() { return entries.size; } };
}

test('rascunhos mantêm filial e notas somente no usuário e papel de origem', () => {
  const local = storage(), a = { role: 'ADMINISTRADOR', subject: 'A' }, b = { role: 'ADMINISTRADOR', subject: 'B' };
  const value = { step: 3, values: { filialId: 'filial-rj', notasInternas: 'Nota privada' } };
  assert.equal(saveDraft(a, 'new-order', value, local), true);
  assert.deepEqual(readDraft(a, 'new-order', local), value);
  assert.equal(readDraft(b, 'new-order', local), null);
  assert.equal(readDraft({ ...a, role: 'CLIENTE' }, 'new-order', local), null);
  assert.equal(saveDraft({ role: a.role }, 'new-order', value, local), false);
});

test('sucesso descarta um rascunho e logout apaga apenas o contexto da conta', () => {
  const local = storage(), a = { role: 'MECANICO', subject: 'A' }, b = { ...a, subject: 'B' };
  saveDraft(a, 'budget:1', { total: 175 }, local); saveDraft(a, 'budget:2', {}, local); saveDraft(b, 'budget:1', {}, local);
  clearDraft(a, 'budget:1', local); assert.equal(readDraft(a, 'budget:1', local), null);
  local.setItem('oficina.resource-context.v1:MECANICO:A:estoque', '{}'); local.setItem('oficina.order-list-context.v1:MECANICO:A', '{}');
  clearDraftScope(a, local);
  assert.equal(readDraft(a, 'budget:2', local), null); assert.deepEqual(readDraft(b, 'budget:1', local), {}); assert.equal(local.length, 1);
});

test('rascunhos expirados, corrompidos ou incompatíveis são ignorados', () => {
  const local = storage(), scope = { role: 'ADMINISTRADOR', subject: 'A' };
  saveDraft(scope, 'new-order', {}, local); const key = local.key(0);
  for (const saved of [{ version: 1, updatedAt: Date.now() - 86_400_001, value: {} }, { version: 0, updatedAt: Date.now(), value: {} }]) {
    local.setItem(key, JSON.stringify(saved)); assert.equal(readDraft(scope, 'new-order', local), null); assert.equal(local.getItem(key), null);
  }
  local.setItem(key, '{broken'); assert.equal(readDraft(scope, 'new-order', local), null);
  const denied = { setItem() { throw Error('storage disabled'); }, getItem() { throw Error('storage disabled'); } };
  assert.equal(saveDraft(scope, 'new-order', {}, denied), false); assert.equal(readDraft(scope, 'new-order', denied), null);
});

test('captura restaura modos e campos sem armazenar senhas', () => {
  const form = { elements: [{ name: 'clientMode', type: 'radio', value: 'existing', checked: true }, { name: 'clientMode', type: 'radio', value: 'new', checked: false }, { name: 'filialId', type: 'select-one', value: 'filial-rj' }, { name: 'password', type: 'password', value: 'private' }] };
  assert.deepEqual(captureForm(form), { clientMode: 'existing', filialId: 'filial-rj' });
  restoreForm(form, { clientMode: 'new', filialId: 'filial-sp' });
  assert.equal(form.elements[0].checked, false); assert.equal(form.elements[1].checked, true); assert.equal(form.elements[2].value, 'filial-sp');
});
