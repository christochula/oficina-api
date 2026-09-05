import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MECHANIC_COMBOBOX_DEFAULTS,
  buildMechanicSearchQuery,
  mechanicSelectionLabel,
  mountMechanicCombobox,
  normalizeMechanicResults,
  renderMechanicComboboxField,
  renderMechanicComboboxOptions,
  shouldSearchMechanics,
} from '../src/components/mechanic-combobox.js';

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
    listenerCount(type) {
      return (listeners.get(type) ?? []).length;
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
    '[data-mechanic-combobox-input]': input,
    '[data-mechanic-combobox-value]': hiddenInput,
    '[data-mechanic-combobox-listbox]': listbox,
    '[data-mechanic-combobox-status]': status,
    '[data-mechanic-combobox-clear]': clearButton,
  };
  const descendants = new Set(Object.values(elements));
  const container = fakeEventTarget({
    dataset: { mechanicComboboxId: 'order-mechanic' },
    ownerDocument: documentRef,
    matches: (selector) => selector === '[data-mechanic-combobox]',
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

const mechanics = [
  {
    id: { valor: 'us01MECANICO' },
    nome: 'Carlos Henrique Souza',
    email: 'carlos.souza@oficina.test',
    papel: 'MECANICO',
    ativo: true,
  },
  {
    id: 'us02MECANICO',
    nome: 'Fernanda Lima',
    email: 'fernanda.lima@oficina.test',
    papel: 'MECANICO',
    ativo: true,
  },
];

test('renderiza busca acessível e mantém somente o ID selecionado no campo oculto', () => {
  const html = renderMechanicComboboxField({
    id: 'order-mechanic',
    selectedMechanic: mechanics[0],
  });

  assert.match(html, /data-mechanic-combobox/);
  assert.match(html, /role="combobox"/);
  assert.match(html, /aria-autocomplete="list"/);
  assert.match(html, /aria-controls="order-mechanic-listbox"/);
  assert.match(html, /role="listbox"/);
  assert.match(html, /type="hidden" name="mechanicId" value="us01MECANICO"/);
  assert.doesNotMatch(html, /name="mechanicId"[^>]+type="search"/);
  assert.match(html, /Carlos Henrique Souza · carlos.souza@oficina.test/);
});

test('busca vazia lista dez ativos e termo válido usa o contrato paginado', () => {
  assert.equal(MECHANIC_COMBOBOX_DEFAULTS.endpoint, '/usuarios/mecanicos');
  assert.equal(MECHANIC_COMBOBOX_DEFAULTS.debounceMs, 250);
  assert.equal(shouldSearchMechanics(''), true);
  assert.equal(shouldSearchMechanics('c'), false);
  assert.equal(shouldSearchMechanics(' ca '), true);
  assert.deepEqual(buildMechanicSearchQuery(' Carlos ', 10), {
    pagina: 1,
    porPagina: 10,
    ativo: true,
    busca: 'Carlos',
  });
  assert.deepEqual(buildMechanicSearchQuery('', 10), {
    pagina: 1,
    porPagina: 10,
    ativo: true,
  });
});

test('normalização é fail-closed e descarta inativos, outros papéis e papel ausente', () => {
  const normalized = normalizeMechanicResults({
    data: [
      ...mechanics,
      { ...mechanics[0], id: 'usINATIVO', ativo: false },
      { ...mechanics[0], id: 'usADMIN', papel: 'ADMINISTRADOR' },
      { ...mechanics[0], id: 'usSEM_PAPEL', papel: undefined },
      { ...mechanics[0], id: null },
    ],
  });

  assert.deepEqual(normalized, mechanics);
  assert.deepEqual(normalizeMechanicResults({ itens: mechanics }), mechanics);
  assert.deepEqual(normalizeMechanicResults(null), []);
});

test('opções exibem nome, e-mail e ID em linhas seguras separadas', () => {
  const malicious = {
    ...mechanics[0],
    id: 'us03<unsafe>-IDENTIFICADOR-LONGO',
    nome: '<script>alert(1)</script>',
  };
  const html = renderMechanicComboboxOptions([mechanics[0], malicious], {
    baseId: 'order-mechanic',
    activeIndex: 1,
    selectedId: 'us01MECANICO',
  });

  assert.match(html, /id="order-mechanic-option-1"/);
  assert.match(html, /class="client-combobox__option is-active"/);
  assert.match(html, /class="client-combobox__option is-selected"/);
  const identity = html.match(
    /<span class="client-combobox__identity"><strong>Carlos Henrique Souza<\/strong>([\s\S]*?)<\/span>/,
  )?.[1];
  assert.ok(identity);
  assert.deepEqual(
    [...identity.matchAll(/<small>(.*?)<\/small>/g)].map((match) => match[1]),
    ['carlos.souza@oficina.test', 'ID: us01MECANICO'],
  );
  assert.doesNotMatch(identity, / · /);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /<small>ID: us03&lt;unsa…-LONGO<\/small>/);
});

test('rótulo selecionado usa nome e e-mail, nunca o texto livre da busca', () => {
  assert.equal(
    mechanicSelectionLabel(mechanics[0]),
    'Carlos Henrique Souza · carlos.souza@oficina.test',
  );
  assert.equal(mechanicSelectionLabel(null), '');
});

test('seleção por teclado grava ID e editar o texto limpa imediatamente o valor', async () => {
  const { container, hiddenInput, input, listbox } = fakeComboboxDom();
  const selected = [];
  let clearCount = 0;
  const calls = [];
  const api = {
    request: async (path, options) => {
      calls.push({ path, options });
      if (options.query.busca === 'Carlos') return { data: [mechanics[0]] };
      throw new Error('Busca temporariamente indisponível');
    },
  };
  const combobox = mountMechanicCombobox(container, {
    api,
    debounceMs: 0,
    onSelect: (mechanic) => selected.push(mechanic),
    onClear: () => {
      clearCount += 1;
    },
  });

  try {
    input.value = 'Carlos';
    input.dispatch('input');
    await settleTimers();
    assert.match(listbox.innerHTML, /Carlos Henrique Souza/);
    assert.equal(calls[0].path, '/usuarios/mecanicos');
    assert.deepEqual(calls[0].options.query, {
      pagina: 1,
      porPagina: 10,
      ativo: true,
      busca: 'Carlos',
    });

    input.dispatch('keydown', { key: 'ArrowDown' });
    input.dispatch('keydown', { key: 'Enter' });
    assert.equal(hiddenInput.value, 'us01MECANICO');
    assert.deepEqual(selected, [mechanics[0]]);

    input.value = 'Fernanda';
    input.dispatch('input');
    assert.equal(hiddenInput.value, '');
    assert.equal(clearCount, 1);
    assert.match(listbox.innerHTML, /Buscando mecânicos/);

    input.dispatch('keydown', { key: 'ArrowDown' });
    input.dispatch('keydown', { key: 'Enter' });
    assert.equal(hiddenInput.value, '');

    await settleTimers();
    assert.match(listbox.innerHTML, /Busca temporariamente indisponível/);
    input.dispatch('keydown', { key: 'ArrowDown' });
    input.dispatch('keydown', { key: 'Enter' });
    assert.equal(hiddenInput.value, '');
    assert.deepEqual(selected, [mechanics[0]]);
  } finally {
    combobox.destroy();
    await settleTimers();
  }
});

test('pointerdown em resultado preserva a lista até o click selecionar o mecânico', async () => {
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
    request: async () => ({ data: [mechanics[0]] }),
  };
  const combobox = mountMechanicCombobox(container, {
    api,
    debounceMs: 0,
    onSelect: (mechanic) => selected.push(mechanic),
  });

  try {
    input.focus();
    input.value = 'Carlos';
    input.dispatch('input');
    await settleTimers();
    assert.equal(listbox.hidden, false);

    const option = {
      dataset: { mechanicIndex: '0' },
      closest: (selector) =>
        selector === '[data-mechanic-option]' ? option : null,
    };
    const optionText = {
      closest: (selector) =>
        selector === '[data-mechanic-option]' ? option : null,
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

    // Capturing listener sees the option as internal; the delegated listener
    // then prevents the input blur that used to close the list before click.
    documentRef.dispatch('pointerdown', pointerEvent);
    listbox.dispatch('pointerdown', pointerEvent);
    assert.equal(defaultPrevented, true);
    assert.equal(documentRef.activeElement, input);
    assert.equal(listbox.hidden, false);

    listbox.dispatch('click', { target: optionText });
    assert.equal(hiddenInput.value, 'us01MECANICO');
    assert.equal(input.value, mechanicSelectionLabel(mechanics[0]));
    assert.equal(listbox.hidden, true);
    assert.deepEqual(selected, [mechanics[0]]);
  } finally {
    combobox.destroy();
  }
});

test('destroy remove listener global e aborta uma busca pendente', async () => {
  const { container, documentRef, input } = fakeComboboxDom();
  let pendingSignal;
  let abortCount = 0;
  const api = {
    request: async (_path, { signal }) =>
      new Promise((_resolve, reject) => {
        pendingSignal = signal;
        signal.addEventListener(
          'abort',
          () => {
            abortCount += 1;
            const error = new Error('Requisição cancelada');
            error.name = 'AbortError';
            reject(error);
          },
          { once: true },
        );
      }),
  };
  const combobox = mountMechanicCombobox(container, {
    api,
    debounceMs: 0,
  });

  assert.equal(documentRef.listenerCount('pointerdown'), 1);
  input.value = 'Carlos';
  input.dispatch('input');
  await settleTimers();
  assert.ok(pendingSignal);
  assert.equal(pendingSignal.aborted, false);

  combobox.destroy();
  await Promise.resolve();

  assert.equal(pendingSignal.aborted, true);
  assert.equal(abortCount, 1);
  assert.equal(documentRef.listenerCount('pointerdown'), 0);
});
