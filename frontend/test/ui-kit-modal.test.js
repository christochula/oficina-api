import assert from 'node:assert/strict';
import test from 'node:test';

import { confirmAction, openModal } from '../src/components/ui-kit.js';

function classList() {
  const values = new Set();
  return {
    add: (...names) => names.forEach((name) => values.add(name)),
    remove: (...names) => names.forEach((name) => values.delete(name)),
    contains: (name) => values.has(name),
  };
}

test('openModal executa onClose uma vez e remove o listener de teclado', () => {
  const listeners = new Map();
  let restoredFocus = 0;
  let initialFocus = 0;
  const focusable = {
    focus() {
      initialFocus += 1;
    },
  };
  const panel = {
    querySelectorAll: () => [focusable],
  };
  const root = {
    innerHTML: '',
    classList: classList(),
    querySelector: (selector) =>
      selector === '[data-modal-panel]' ? panel : null,
    querySelectorAll: () => [],
    addEventListener(type, listener) {
      const current = listeners.get(type) ?? [];
      current.push(listener);
      listeners.set(type, current);
    },
    removeEventListener(type, listener) {
      listeners.set(
        type,
        (listeners.get(type) ?? []).filter((candidate) => candidate !== listener),
      );
    },
  };
  const originalDocument = globalThis.document;
  globalThis.document = {
    activeElement: {
      focus() {
        restoredFocus += 1;
      },
    },
    body: { classList: classList() },
    querySelector: (selector) => (selector === '#modal-root' ? root : null),
  };

  try {
    const modal = openModal({ title: 'Teste', content: '<p>Conteúdo</p>' });
    let closeCount = 0;
    modal.onClose(() => {
      closeCount += 1;
    });

    assert.equal(initialFocus, 1);
    assert.equal(listeners.get('keydown').length, 1);
    listeners.get('keydown')[0]({ key: 'Escape', defaultPrevented: true });
    assert.equal(closeCount, 0);
    assert.equal(listeners.get('keydown').length, 1);
    listeners.get('keydown')[0]({ key: 'Escape' });

    assert.equal(closeCount, 1);
    assert.equal(restoredFocus, 1);
    assert.equal(listeners.get('keydown').length, 0);

    modal.close();
    assert.equal(closeCount, 1);
    modal.onClose(() => {
      closeCount += 1;
    });
    assert.equal(closeCount, 2);
  } finally {
    globalThis.document = originalDocument;
  }
});

test('confirmação encerra com Escape, X, Cancelar e confirma uma única decisão', async () => {
  for (const action of ['Escape', 'close', 'cancel', 'confirm']) {
    const listeners = new Map();
    const buttons = new Map(['close', 'cancel', 'confirm'].map((name) => [name, {
      listeners: new Map(),
      addEventListener(type, callback) { this.listeners.set(type, callback); },
      focus() {},
    }]));
    const root = {
      innerHTML: '', classList: classList(),
      querySelector(selector) {
        if (selector === '[data-modal-panel]') return { querySelectorAll: () => [...buttons.values()] };
        if (selector === '[data-action="modal-cancel"]') return buttons.get('cancel');
        if (selector === '[data-action="modal-confirm"]') return buttons.get('confirm');
        return null;
      },
      querySelectorAll: () => [buttons.get('close')],
      addEventListener(type, callback) { listeners.set(type, callback); },
      removeEventListener(type) { listeners.delete(type); },
    };
    const originalDocument = globalThis.document;
    globalThis.document = { activeElement: { focus() {} }, body: { classList: classList() }, querySelector: () => root };
    try {
      const result = confirmAction({ title: 'Confirmar operação', message: 'Confirme os dados.', confirmLabel: 'Confirmar' });
      if (action === 'Escape') listeners.get('keydown')({ key: 'Escape' });
      else if (action === 'close') buttons.get('close').listeners.get('click')({ target: { closest: () => null } });
      else {
        const callback = buttons.get(action).listeners.get('click');
        callback();
        callback();
      }
      assert.equal(await result, action === 'confirm', action);
      assert.equal(listeners.has('keydown'), false);
      assert.equal(root.classList.contains('is-open'), false);
    } finally { globalThis.document = originalDocument; }
  }
});

test('modal recupera Tab e Escape quando o foco cai fora do painel e devolve à ação atual', () => {
  const originalDocument = globalThis.document;
  const listeners = new Map(); let focusTarget;
  const first = { focus() { focusTarget = 'first'; } }, last = { focus() { focusTarget = 'last'; } };
  const panel = { querySelectorAll: () => [first, last], contains: (element) => element === first || element === last };
  const returnTarget = { focus() { focusTarget = 'current-action'; } };
  const root = { innerHTML: '', classList: classList(), querySelector: () => panel, querySelectorAll: () => [] };
  const doc = {
    activeElement: { isConnected: false, dataset: { action: 'order:consume' } }, body: { classList: classList() },
    querySelector: (selector) => selector === '#modal-root' ? root : returnTarget,
    addEventListener: (type, listener) => listeners.set(type, listener), removeEventListener: (type) => listeners.delete(type),
  };
  globalThis.document = doc;
  try {
    openModal({ title: 'Consumo', content: '' }); doc.activeElement = doc.body;
    let prevented = false;
    listeners.get('keydown')({ key: 'Tab', preventDefault() { prevented = true; } });
    assert.equal(prevented, true); assert.equal(focusTarget, 'first');
    listeners.get('keydown')({ key: 'Tab', shiftKey: true, preventDefault() {} }); assert.equal(focusTarget, 'last');
    listeners.get('keydown')({ key: 'Escape' }); assert.equal(focusTarget, 'current-action'); assert.equal(listeners.size, 0);
  } finally { globalThis.document = originalDocument; }
});
