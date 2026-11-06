import assert from 'node:assert/strict';
import test from 'node:test';
import { mountOrderDetailView } from '../src/views/orders.js';
import { ROLES } from '../src/core/permissions.js';

function eventTarget(properties = {}) {
  const listeners = new Map();
  return {
    ...properties,
    addEventListener(name, listener) {
      const current = listeners.get(name) ?? [];
      listeners.set(name, [...current, listener]);
    },
    removeEventListener(name, listener) {
      listeners.set(name, (listeners.get(name) ?? []).filter(item => item !== listener));
    },
    async dispatch(name, event = {}) {
      for (const listener of listeners.get(name) ?? []) await listener({ preventDefault() {}, ...event });
    },
  };
}

function actionTarget(action) {
  return {
    dataset: { action },
    matches: () => false,
    closest() { return this; },
  };
}

async function budgetHarness() {
  const previous = { document: globalThis.document, FormData: globalThis.FormData };
  const classList = { add() {}, remove() {} };
  const lines = { children: [], append(row) { this.children.push(row); } };
  const form = eventTarget({
    values: { groupTitle: 'Revisao', notasCliente: 'Conferir alinhamento' },
    querySelectorAll(selector) {
      if (selector === 'fieldset[data-line]') return lines.children;
      // Both the editor and its nested remove control carry data-line in the DOM.
      if (selector === '[data-line]') return lines.children.flatMap(row => [row, row.removeButton]);
      return [];
    },
    querySelector: () => ({ textContent: '', hidden: true }),
  });
  const panel = { querySelectorAll: () => [] };
  const modalRoot = eventTarget({
    innerHTML: '',
    classList,
    querySelector(selector) {
      return { '[data-modal-panel]': panel, '#budget-lines': lines, '#budget-form': form }[selector] ?? null;
    },
    querySelectorAll: () => [],
  });
  globalThis.document = {
    activeElement: null,
    body: { classList },
    querySelector: selector => selector === '#modal-root' ? modalRoot : null,
    createElement(tag) {
      assert.equal(tag, 'fieldset');
      const row = {
        dataset: {}, className: '', innerHTML: '',
        remove() { lines.children.splice(lines.children.indexOf(row), 1); },
      };
      row.removeButton = {
        dataset: { action: 'budget:remove-line' },
        closest(selector) {
          if (selector === 'fieldset[data-line]') return row;
          return this;
        },
        remove() { row.buttonRemoved = true; },
      };
      return row;
    },
  };
  globalThis.FormData = class {
    constructor(element) { this.values = element.values; }
    get(name) { return this.values[name] ?? null; }
  };
  const order = { id: 'os_budget', numero: 1, status: 'EM_DIAGNOSTICO', historico: [] };
  const requests = [];
  const root = eventTarget({ querySelector: () => ({ innerHTML: '' }) });
  try {
    await mountOrderDetailView(root, {
      id: order.id,
      role: ROLES.MECHANIC,
      api: { async request(path, options) { if (options) requests.push({ path, ...options }); return order; } },
      navigate() {}, notify() {},
    });
    await root.dispatch('click', { target: actionTarget('order:budget') });
  } catch (error) {
    globalThis.document = previous.document; globalThis.FormData = previous.FormData;
    throw error;
  }
  return {
    form, lines, modalRoot, requests,
    setItem(key, overrides = {}) {
      Object.assign(form.values, {
        [`type-${key}`]: 'SERVICO', [`description-${key}`]: 'Alinhamento',
        [`quantity-${key}`]: '2', [`price-${key}`]: '75.50', [`piece-${key}`]: '',
        ...overrides,
      });
    },
    restore() { globalThis.document = previous.document; globalThis.FormData = previous.FormData; },
  };
}

test('gerar orçamento envia um único item por editor, sem duplicar quantidade ou total', async () => {
  const harness = await budgetHarness();
  try {
    assert.equal(harness.lines.children.length, 1);
    assert.match(harness.lines.children[0].innerHTML, /data-action="budget:remove-line"[^>]*data-line="1"/);
    harness.setItem('1');
    await harness.form.dispatch('submit');
    assert.equal(harness.requests.length, 1);
    assert.equal(harness.requests[0].path, '/ordens-servico/os_budget/orcamento');
    assert.equal(harness.requests[0].method, 'PATCH');
    const items = harness.requests[0].body.grupos[0].linhas;
    assert.deepEqual(items, [{ tipo: 'SERVICO', descricao: 'Alinhamento', quantidade: 2, valorUnitario: 75.5 }]);
    assert.equal(items.reduce((total, item) => total + item.quantidade * item.valorUnitario, 0), 151);
  } finally { harness.restore(); }
});

test('remover item pelo botão remove o editor inteiro e preserva pelo menos uma linha', async () => {
  const harness = await budgetHarness();
  try {
    harness.setItem('1');
    await harness.modalRoot.dispatch('click', { target: actionTarget('budget:add-line') });
    harness.setItem('2', { 'type-2': 'MATERIAL', 'description-2': 'Filtro', 'piece-2': 'pc_filter', 'quantity-2': '1', 'price-2': '30' });
    const first = harness.lines.children[0];
    await harness.modalRoot.dispatch('click', { target: first.removeButton });
    assert.equal(harness.lines.children.length, 1);
    assert.equal(harness.lines.children[0].dataset.line, '2');
    assert.equal(first.buttonRemoved, undefined);
    await harness.modalRoot.dispatch('click', { target: harness.lines.children[0].removeButton });
    assert.equal(harness.lines.children.length, 1);
    await harness.form.dispatch('submit');
    assert.deepEqual(harness.requests[0].body.grupos[0].linhas, [
      { tipo: 'MATERIAL', descricao: 'Filtro', quantidade: 1, valorUnitario: 30, pecaId: 'pc_filter' },
    ]);
  } finally { harness.restore(); }
});
