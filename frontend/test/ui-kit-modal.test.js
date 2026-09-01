import assert from 'node:assert/strict';
import test from 'node:test';

import { openModal } from '../src/components/ui-kit.js';

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
