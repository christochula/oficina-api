import assert from 'node:assert/strict';
import test from 'node:test';

import {
  mountResourcesView,
  renderResourcesView,
} from '../src/views/resources.js';
import { API_ENDPOINTS } from '../src/api/endpoints.js';

class FakeElement {}

class FakeRoot extends FakeElement {
  constructor() {
    super();
    this.innerHTML = '';
    this.listeners = new Map();
    this.results = { innerHTML: '' };
  }

  addEventListener(type, listener) {
    const current = this.listeners.get(type) ?? [];
    current.push(listener);
    this.listeners.set(type, current);
  }

  removeEventListener(type, listener) {
    this.listeners.set(
      type,
      (this.listeners.get(type) ?? []).filter(
        (candidate) => candidate !== listener,
      ),
    );
  }

  dispatch(type, event = {}) {
    const payload = {
      preventDefault() {},
      ...event,
    };
    for (const listener of this.listeners.get(type) ?? []) listener(payload);
  }

  querySelector(selector) {
    if (selector === '[data-resource-results]') return this.results;
    return null;
  }

  contains() {
    return true;
  }

  listenerCount() {
    return [...this.listeners.values()].reduce(
      (total, listeners) => total + listeners.length,
      0,
    );
  }
}

class FakeFormData {
  constructor(form) {
    this.values = form.values ?? {};
  }

  get(name) {
    return this.values[name] ?? null;
  }
}

const users = [
  {
    id: 'usCURRENT',
    nome: 'Matheus Chula',
    email: 'matheus@oficina.test',
    papel: 'ADMINISTRADOR',
    ativo: true,
    criadoEm: '2026-08-01T10:00:00.000Z',
  },
  {
    id: 'usMECHANIC',
    nome: 'Ana Souza',
    email: 'ana.souza@oficina.test',
    papel: 'MECANICO',
    ativo: true,
    criadoEm: '2026-08-02T10:00:00.000Z',
  },
  {
    id: 'usINACTIVE',
    nome: 'Carlos Lima',
    email: 'carlos.lima@oficina.test',
    papel: 'CONSULTOR_TECNICO',
    ativo: false,
    criadoEm: '2026-08-03T10:00:00.000Z',
  },
];

function page(data = users, meta = {}) {
  return {
    data,
    meta: {
      pagina: 1,
      porPagina: 20,
      total: data.length,
      totalPaginas: data.length ? 1 : 0,
      ...meta,
    },
  };
}

function actionTarget(action, itemId) {
  const target = {
    dataset: { action, ...(itemId ? { itemId } : {}) },
    closest() {
      return target;
    },
  };
  return target;
}

function formTarget(selector, values, mode) {
  return {
    values,
    dataset: mode ? { formMode: mode } : {},
    matches(candidate) {
      return candidate === selector;
    },
    reportValidity() {
      return true;
    },
  };
}

async function settle(ms = 10) {
  await new Promise((resolve) => setTimeout(resolve, ms));
  await Promise.resolve();
}

function installDomGlobals() {
  const previous = {
    Element: globalThis.Element,
    FormData: globalThis.FormData,
  };
  globalThis.Element = FakeElement;
  globalThis.FormData = FakeFormData;
  return () => {
    globalThis.Element = previous.Element;
    globalThis.FormData = previous.FormData;
  };
}

test('gestão de usuários expõe pesquisa global, filtros e carregamento', () => {
  const html = renderResourcesView('usuarios', {
    role: 'ADMINISTRADOR',
    subject: 'usCURRENT',
  });

  assert.match(html, /Buscar usuários/);
  assert.match(html, /Nome, e-mail ou ID do usuário/);
  assert.match(html, /name="papel"/);
  assert.match(html, /name="ativo"/);
  assert.match(html, /data-user-filter/);
  assert.match(html, /data-action="clear-filters"/);
  assert.match(html, /aria-busy="true"/);
  assert.doesNotMatch(html, /Consulta individual/);
  assert.equal(API_ENDPOINTS.users.update('us A'), '/usuarios/us%20A');
  assert.equal(API_ENDPOINTS.users.activate('us A'), '/usuarios/us%20A/ativar');
  assert.equal(
    API_ENDPOINTS.users.deactivate('us A'),
    '/usuarios/us%20A/desativar',
  );
});

test('lista usuários, protege a conta atual e executa edição e desativação', async () => {
  const restore = installDomGlobals();
  const root = new FakeRoot();
  const calls = [];
  const notifications = [];
  const api = {
    async request(path, options) {
      calls.push({ path, options });
      if (options.method === 'PATCH') return users[1];
      return page(users);
    },
  };

  const mounted = mountResourcesView(root, 'usuarios', {
    role: 'ADMINISTRADOR',
    subject: 'usCURRENT',
    api,
    notify: (message, options) => notifications.push({ message, options }),
  });

  try {
    await settle();
    assert.deepEqual(calls[0], {
      path: '/usuarios',
      options: {
        method: 'GET',
        body: undefined,
        query: { pagina: 1, porPagina: 20 },
      },
    });
    assert.match(root.innerHTML, /Matheus Chula/);
    assert.match(root.innerHTML, /Ana Souza/);
    assert.match(root.innerHTML, /Sua conta/);
    assert.doesNotMatch(
      root.innerHTML,
      /data-action="toggle" data-item-id="usCURRENT"/,
    );
    assert.match(
      root.innerHTML,
      /data-action="toggle" data-item-id="usMECHANIC"/,
    );
    assert.match(root.innerHTML, /aria-label="Editar usuário: Ana Souza"/);
    assert.match(root.innerHTML, /aria-label="Ativar Carlos Lima"/);

    root.dispatch('click', { target: actionTarget('create') });
    assert.match(root.innerHTML, /Novo usuário/);
    assert.match(root.innerHTML, /name="senha"/);
    assert.match(root.innerHTML, /maxlength="72"/);
    assert.doesNotMatch(root.innerHTML, /value="CLIENTE"/);

    root.dispatch('click', {
      target: actionTarget('edit', 'usMECHANIC'),
    });
    assert.match(root.innerHTML, /Editar usuário/);
    assert.match(root.innerHTML, /value="Ana Souza"/);
    assert.match(root.innerHTML, /Nova senha/);
    assert.match(root.innerHTML, /minlength="6"/);
    assert.match(root.innerHTML, /maxlength="72"/);

    root.dispatch('submit', {
      target: formTarget(
        '[data-resource-form]',
        {
          nome: 'Ana Souza Lima',
          email: 'ANA.SOUZA@OFICINA.TEST',
          papel: 'MECANICO',
          senha: '',
        },
        'edit',
      ),
    });
    await settle();

    const update = calls.find(
      (call) =>
        call.path === '/usuarios/usMECHANIC' &&
        call.options.method === 'PATCH',
    );
    assert.deepEqual(update?.options.body, {
      nome: 'Ana Souza Lima',
    });

    root.dispatch('click', {
      target: actionTarget('toggle', 'usMECHANIC'),
    });
    assert.match(root.innerHTML, /Desativar usuário/);
    assert.match(root.innerHTML, /O acesso ao sistema será bloqueado/);
    assert.match(root.innerHTML, /type="submit"/);

    root.dispatch('submit', {
      target: formTarget('[data-resource-form]', {}, 'toggle'),
    });
    await settle();
    assert.ok(
      calls.some(
        (call) =>
          call.path === '/usuarios/usMECHANIC/desativar' &&
          call.options.method === 'PATCH' &&
          call.options.body === undefined,
      ),
    );
    assert.ok(
      notifications.some(({ message }) =>
        message.includes('desativado com sucesso'),
      ),
    );

    root.dispatch('click', {
      target: actionTarget('toggle', 'usINACTIVE'),
    });
    assert.match(root.innerHTML, /Ativar usuário/);
    assert.match(root.innerHTML, /O acesso ao sistema será restaurado/);
    root.dispatch('submit', {
      target: formTarget('[data-resource-form]', {}, 'toggle'),
    });
    await settle();
    assert.ok(
      calls.some(
        (call) =>
          call.path === '/usuarios/usINACTIVE/ativar' &&
          call.options.method === 'PATCH' &&
          call.options.body === undefined,
      ),
    );
  } finally {
    mounted.destroy();
    assert.equal(root.listenerCount(), 0);
    restore();
  }
});

test('busca dinâmica usa debounce, filtros server-side e ignora respostas antigas', async () => {
  const restore = installDomGlobals();
  const root = new FakeRoot();
  const calls = [];
  let resolveInitial;
  const api = {
    request(path, options) {
      calls.push({ path, options });
      if (calls.length === 1) {
        return new Promise((resolve) => {
          resolveInitial = resolve;
        });
      }
      return Promise.resolve(page([users[1]]));
    },
  };
  const mounted = mountResourcesView(root, 'usuarios', {
    role: 'ADMINISTRADOR',
    subject: 'usCURRENT',
    api,
  });

  try {
    root.dispatch('input', {
      target: {
        value: 'Ana',
        matches: (selector) => selector === '[data-search-input]',
      },
    });
    resolveInitial(page(users));
    await settle(330);

    assert.equal(calls.length, 2);
    assert.deepEqual(calls[1].options.query, {
      pagina: 1,
      porPagina: 20,
      busca: 'Ana',
    });
    assert.match(root.results.innerHTML, /Ana Souza/);
    assert.doesNotMatch(root.results.innerHTML, /Matheus Chula/);

    root.dispatch('change', {
      target: {
        name: 'papel',
        value: 'MECANICO',
        matches: (selector) => selector === '[data-user-filter]',
      },
    });
    await settle();
    assert.deepEqual(calls.at(-1).options.query, {
      pagina: 1,
      porPagina: 20,
      busca: 'Ana',
      papel: 'MECANICO',
    });

    root.dispatch('submit', {
      target: formTarget('[data-resource-search-form]', {
        query: 'Ana',
        papel: 'MECANICO',
        ativo: 'false',
      }),
    });
    await settle();
    assert.deepEqual(calls.at(-1).options.query, {
      pagina: 1,
      porPagina: 20,
      busca: 'Ana',
      papel: 'MECANICO',
      ativo: false,
    });
  } finally {
    mounted.destroy();
    restore();
  }
});

test('listagem de usuários apresenta estados vazio e erro', async () => {
  const restore = installDomGlobals();
  try {
    const emptyRoot = new FakeRoot();
    const empty = mountResourcesView(emptyRoot, 'usuarios', {
      role: 'ADMINISTRADOR',
      api: { request: async () => page([]) },
    });
    await settle();
    assert.match(emptyRoot.innerHTML, /Nenhum usuário encontrado/);
    empty.destroy();

    const errorRoot = new FakeRoot();
    const failed = mountResourcesView(errorRoot, 'usuarios', {
      role: 'ADMINISTRADOR',
      api: {
        request: async () => {
          throw new Error('Falha simulada');
        },
      },
    });
    await settle();
    assert.match(errorRoot.innerHTML, /Não foi possível carregar os dados/);
    assert.match(errorRoot.innerHTML, /Falha simulada/);
    failed.destroy();
  } finally {
    restore();
  }
});

test('após mutação recarrega a última página válida quando a atual fica vazia', async () => {
  const restore = installDomGlobals();
  const root = new FakeRoot();
  const calls = [];
  let mutated = false;
  const api = {
    async request(path, options) {
      calls.push({ path, options });
      if (options.method === 'PATCH') {
        mutated = true;
        return users[1];
      }
      const requestedPage = Number(options.query.pagina);
      if (!mutated) {
        return requestedPage === 2
          ? page([users[1]], {
              pagina: 2,
              total: 21,
              totalPaginas: 2,
            })
          : page(users, {
              pagina: 1,
              total: 21,
              totalPaginas: 2,
            });
      }
      return requestedPage === 2
        ? page([], { pagina: 2, total: 1, totalPaginas: 1 })
        : page([users[0]], { pagina: 1, total: 1, totalPaginas: 1 });
    },
  };
  const mounted = mountResourcesView(root, 'usuarios', {
    role: 'ADMINISTRADOR',
    subject: 'usCURRENT',
    api,
  });

  try {
    await settle();
    const pageButton = actionTarget('page');
    pageButton.dataset.page = '2';
    root.dispatch('click', { target: pageButton });
    await settle();
    assert.match(root.innerHTML, /Página <strong>2<\/strong> de <strong>2/);

    root.dispatch('click', {
      target: actionTarget('toggle', 'usMECHANIC'),
    });
    root.dispatch('submit', {
      target: formTarget('[data-resource-form]', {}, 'toggle'),
    });
    await settle(30);

    const postMutationPages = calls
      .filter(
        (call) => call.path === '/usuarios' && call.options.method === 'GET',
      )
      .slice(-2)
      .map((call) => call.options.query.pagina);
    assert.deepEqual(postMutationPages, [2, 1]);
    assert.match(root.innerHTML, /Matheus Chula/);
  } finally {
    mounted.destroy();
    restore();
  }
});
