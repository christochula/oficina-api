import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CLIENT_COMBOBOX_DEFAULTS,
  buildClientSearchQuery,
  clientSelectionLabel,
  mountClientCombobox,
  moveClientActiveIndex,
  normalizeClientResults,
  renderClientComboboxField,
  renderClientComboboxOptions,
  shouldSearchClients,
} from '../src/components/client-combobox.js';

function fakeEventTarget(initial = {}) {
  const listeners = new Map();
  const attributes = new Map();
  return {
    ...initial,
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
    dispatch(type, event = {}) {
      const payload = {
        target: this,
        preventDefault() {},
        ...event,
      };
      for (const listener of listeners.get(type) ?? []) listener(payload);
    },
    setAttribute(name, value) {
      attributes.set(name, String(value));
    },
    getAttribute(name) {
      return attributes.get(name) ?? null;
    },
    removeAttribute(name) {
      attributes.delete(name);
    },
    toggleAttribute(name, force) {
      if (force) attributes.set(name, '');
      else attributes.delete(name);
    },
  };
}

function fakeComboboxDom() {
  const documentRef = fakeEventTarget({ activeElement: null });
  const input = fakeEventTarget({
    value: '',
    defaultValue: '',
    focus() {
      documentRef.activeElement = this;
    },
  });
  const hiddenInput = { value: '' };
  const listbox = fakeEventTarget({
    hidden: true,
    innerHTML: '',
    querySelectorAll: () => [],
  });
  const status = { textContent: '' };
  const clearButton = fakeEventTarget({ hidden: true });
  const elements = {
    '[data-client-combobox-input]': input,
    '[data-client-combobox-value]': hiddenInput,
    '[data-client-combobox-listbox]': listbox,
    '[data-client-combobox-status]': status,
    '[data-client-combobox-clear]': clearButton,
  };
  const descendants = new Set(Object.values(elements));
  const container = fakeEventTarget({
    dataset: { clientComboboxId: 'order-client' },
    ownerDocument: documentRef,
    matches: (selector) => selector === '[data-client-combobox]',
    querySelector: (selector) => elements[selector] ?? null,
    contains: (element) => descendants.has(element),
  });
  return {
    container,
    documentRef,
    hiddenInput,
    input,
    listbox,
    registerDescendant: (element) => descendants.add(element),
  };
}

async function settleTimers() {
  await new Promise((resolve) => setTimeout(resolve, 5));
  await Promise.resolve();
}

const clients = [
  {
    id: { valor: 'cl01TESTE' },
    tipoDoc: 'CPF',
    numeroDoc: '52998224725',
    nome: 'Maria Silva',
    email: 'maria@example.com',
    telefone: '11999999999',
    ativo: true,
  },
  {
    id: 'cl02TESTE',
    tipoDoc: 'CNPJ',
    numeroDoc: '11222333000181',
    nome: 'Oficina Exemplo Ltda.',
    email: 'contato@example.com',
    telefone: '1133334444',
    ativo: true,
  },
];

test('renderiza contrato acessível e mantém clienteId em campo oculto', () => {
  const html = renderClientComboboxField({
    id: 'order-client',
    selectedClient: clients[0],
  });

  assert.match(html, /class="form-group client-combobox"/);
  assert.match(html, /role="combobox"/);
  assert.match(html, /aria-autocomplete="list"/);
  assert.match(html, /aria-controls="order-client-listbox"/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /role="listbox"/);
  assert.match(html, /name="clienteId" value="cl01TESTE"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /Maria Silva · 529\.982\.247-25/);
});

test('escapa conteúdo configurável no markup', () => {
  const html = renderClientComboboxField({
    label: '<img src=x onerror=alert(1)>',
    placeholder: '" autofocus onfocus="alert(1)',
  });

  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html, /placeholder="" autofocus/);
  assert.match(html, /&quot; autofocus onfocus=&quot;alert\(1\)/);
});

test('busca vazia traz dez ativos e termos curtos aguardam mais caracteres', () => {
  assert.equal(CLIENT_COMBOBOX_DEFAULTS.debounceMs, 250);
  assert.equal(shouldSearchClients(''), true);
  assert.equal(shouldSearchClients('m'), false);
  assert.equal(shouldSearchClients(' ma '), true);
  assert.deepEqual(buildClientSearchQuery(' Maria ', 10), {
    pagina: 1,
    porPagina: 10,
    ativo: true,
    busca: 'Maria',
  });
  assert.deepEqual(buildClientSearchQuery('', 10), {
    pagina: 1,
    porPagina: 10,
    ativo: true,
  });
});

test('normaliza envelopes e remove clientes inativos ou sem ID', () => {
  const normalized = normalizeClientResults({
    data: [
      ...clients,
      { ...clients[0], id: 'clINATIVO', ativo: false },
      { ...clients[0], id: null },
    ],
  });

  assert.deepEqual(normalized, clients);
  assert.deepEqual(normalizeClientResults({ itens: clients }), clients);
  assert.deepEqual(normalizeClientResults(null), []);
});

test('renderiza opções seguras com documento e contato para desambiguação', () => {
  const malicious = {
    ...clients[0],
    id: 'cl03TESTE',
    nome: '<script>alert(1)</script>',
  };
  const html = renderClientComboboxOptions([clients[0], malicious], {
    baseId: 'order-client',
    activeIndex: 1,
    selectedId: 'cl01TESTE',
  });

  assert.match(html, /id="order-client-option-1"/);
  assert.match(html, /class="client-combobox__option is-active"/);
  assert.match(html, /class="client-combobox__option is-selected"/);
  assert.match(html, /CPF 529\.982\.247-25 · maria@example\.com · \(11\) 99999-9999/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

test('navegação do listbox percorre, retorna e atende Home/End', () => {
  assert.equal(moveClientActiveIndex(-1, 3, 'ArrowDown'), 0);
  assert.equal(moveClientActiveIndex(2, 3, 'ArrowDown'), 0);
  assert.equal(moveClientActiveIndex(-1, 3, 'ArrowUp'), 2);
  assert.equal(moveClientActiveIndex(0, 3, 'ArrowUp'), 2);
  assert.equal(moveClientActiveIndex(1, 3, 'Home'), 0);
  assert.equal(moveClientActiveIndex(1, 3, 'End'), 2);
  assert.equal(moveClientActiveIndex(1, 0, 'ArrowDown'), -1);
});

test('rótulo selecionado usa nome e documento formatado', () => {
  assert.equal(clientSelectionLabel(clients[0]), 'Maria Silva · 529.982.247-25');
  assert.equal(
    clientSelectionLabel(clients[1]),
    'Oficina Exemplo Ltda. · 11.222.333/0001-81',
  );
  assert.equal(clientSelectionLabel(null), '');
});

test('pointerdown em resultado preserva a lista até o click selecionar o cliente', async () => {
  const {
    container,
    documentRef,
    hiddenInput,
    input,
    listbox,
    registerDescendant,
  } = fakeComboboxDom();
  const selected = [];
  const api = {
    request: async () => ({ data: [clients[0]] }),
  };
  const combobox = mountClientCombobox(container, {
    api,
    debounceMs: 0,
    onSelect: (client) => selected.push(client),
  });

  try {
    input.focus();
    input.value = 'Maria';
    input.dispatch('input');
    await settleTimers();
    assert.equal(listbox.hidden, false);

    const option = {
      dataset: { clientIndex: '0' },
      closest: (selector) =>
        selector === '[data-client-option]' ? option : null,
    };
    const optionText = {
      closest: (selector) =>
        selector === '[data-client-option]' ? option : null,
    };
    registerDescendant(option);
    registerDescendant(optionText);

    let defaultPrevented = false;
    const pointerEvent = {
      button: 0,
      target: optionText,
      preventDefault() {
        defaultPrevented = true;
      },
    };

    documentRef.dispatch('pointerdown', pointerEvent);
    listbox.dispatch('pointerdown', pointerEvent);
    assert.equal(defaultPrevented, true);
    assert.equal(documentRef.activeElement, input);
    assert.equal(listbox.hidden, false);

    listbox.dispatch('click', { target: optionText });
    assert.equal(hiddenInput.value, 'cl01TESTE');
    assert.equal(input.value, clientSelectionLabel(clients[0]));
    assert.equal(listbox.hidden, true);
    assert.deepEqual(selected, [clients[0]]);
  } finally {
    combobox.destroy();
  }
});

test('resultado anterior não pode ser selecionado durante nova busca ou após erro', async () => {
  const { container, hiddenInput, input, listbox } = fakeComboboxDom();
  const selected = [];
  const api = {
    request: async (_path, { query }) => {
      if (query.busca === 'Maria') return { data: [clients[0]] };
      throw new Error('Busca temporariamente indisponível');
    },
  };
  const combobox = mountClientCombobox(container, {
    api,
    debounceMs: 0,
    onSelect: (client) => selected.push(client),
  });

  try {
    input.value = 'Maria';
    input.dispatch('input');
    await settleTimers();
    assert.match(listbox.innerHTML, /Maria Silva/);

    input.value = 'João';
    input.dispatch('input');
    assert.match(listbox.innerHTML, /Buscando clientes/);
    input.dispatch('keydown', { key: 'ArrowDown' });
    input.dispatch('keydown', { key: 'Enter' });
    assert.equal(hiddenInput.value, '');
    assert.deepEqual(selected, []);

    await settleTimers();
    assert.match(listbox.innerHTML, /Busca temporariamente indisponível/);
    input.dispatch('keydown', { key: 'ArrowDown' });
    input.dispatch('keydown', { key: 'Enter' });
    assert.equal(hiddenInput.value, '');
    assert.deepEqual(selected, []);
  } finally {
    combobox.destroy();
    await settleTimers();
  }
});
