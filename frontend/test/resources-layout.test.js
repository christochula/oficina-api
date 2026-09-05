import assert from 'node:assert/strict';
import test from 'node:test';

import { mountResourcesView } from '../src/views/resources.js';

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

const fixtures = Object.freeze({
  clientes: {
    id: 'clCLIENTE001',
    nome: 'Mariana Souza',
    tipoDoc: 'CPF',
    numeroDoc: '12345678901',
    email: 'mariana.souza@example.com',
    telefone: '11987654321',
    ativo: true,
  },
  estoque: {
    peca: {
      id: 'pcFILTRO001',
      codigo: 'FLT-001',
      nome: 'Filtro de óleo',
      precoVenda: 49.9,
      ativo: true,
    },
    quantidadeDisponivel: 7,
    quantidadeMinima: 3,
  },
  catalogo: {
    id: 'svALINHA001',
    nome: 'Alinhamento de direção',
    categoria: 'Suspensão',
    descricao: 'Alinhamento computadorizado dos eixos.',
    ativo: true,
  },
  usuarios: {
    id: 'usADMIN001',
    nome: 'Ana Lima',
    email: 'ana.lima@example.com',
    papel: 'ADMINISTRADOR',
    criadoEm: '2026-08-20T12:00:00.000Z',
    ativo: true,
  },
});

function page(data) {
  return {
    data,
    meta: {
      pagina: 1,
      porPagina: 20,
      total: data.length,
      totalPaginas: data.length ? 1 : 0,
    },
  };
}

async function settle(ms = 10) {
  await new Promise((resolve) => setTimeout(resolve, ms));
  await Promise.resolve();
}

function textContent(markup) {
  return markup.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function tableContent(markup) {
  const table = markup.match(
    /<table class="resource-table responsive-data-view">([\s\S]*?)<\/table>/,
  )?.[1];
  assert.ok(table, 'a tabela de resultados deve ser renderizada');

  const headingMarkup = table.match(
    /<thead><tr>([\s\S]*?)<\/tr><\/thead>/,
  )?.[1];
  assert.ok(headingMarkup, 'o cabeçalho da tabela deve ser renderizado');

  const rowMarkup = table.match(/<tbody><tr>([\s\S]*?)<\/tr><\/tbody>/)?.[1];
  assert.ok(rowMarkup, 'a linha de dados deve ser renderizada');

  return {
    markup: table,
    headings: [
      ...headingMarkup.matchAll(/<th scope="col">([\s\S]*?)<\/th>/g),
    ].map((match) => textContent(match[1])),
    cells: [
      ...rowMarkup.matchAll(/<(th|td)\b[^>]*>([\s\S]*?)<\/\1>/g),
    ].map((match) => ({
      markup: match[0],
      text: textContent(match[2]),
    })),
  };
}

async function renderLoadedResource(route, role, item) {
  const previousElement = globalThis.Element;
  globalThis.Element = FakeElement;
  const root = new FakeRoot();
  const mounted = mountResourcesView(root, route, {
    role,
    api: {
      async request() {
        return page([item]);
      },
    },
  });

  try {
    await settle();
    return root.innerHTML;
  } finally {
    mounted.destroy();
    assert.equal(root.listenerCount(), 0);
    globalThis.Element = previousElement;
  }
}

test('resumo preserva a contagem sem informar ordenação da API', async () => {
  const markup = await renderLoadedResource(
    'clientes',
    'ADMINISTRADOR',
    fixtures.clientes,
  );

  assert.match(
    markup,
    /<div class=\x22resource-results__summary\x22 role=\x22status\x22 aria-live=\x22polite\x22>\s*<span>1 de 1 resultado\(s\)<\/span>/,
  );
  assert.doesNotMatch(markup, /Ordenação fornecida pela API/);
});

test('consultas separam identidades e dados compostos em linhas visuais', async () => {
  const client = tableContent(
    await renderLoadedResource(
      'clientes',
      'ADMINISTRADOR',
      fixtures.clientes,
    ),
  );
  assert.match(client.cells[0].markup, /class="resource-cell-stack"/);
  assert.match(client.cells[0].text, /Mariana Souza/);
  assert.match(client.cells[0].text, /ID:\s*clCLIENTE001/);
  assert.match(client.cells[1].markup, /class="resource-cell-stack"/);
  assert.match(client.cells[1].text, /CPF/);
  assert.match(client.cells[2].markup, /class="resource-cell-stack"/);

  const stock = tableContent(
    await renderLoadedResource('estoque', 'ADMINISTRADOR', fixtures.estoque),
  );
  assert.match(stock.cells[0].markup, /class="resource-cell-stack"/);
  assert.match(stock.cells[0].text, /Filtro de óleo/);
  assert.match(stock.cells[0].text, /ID:\s*pcFILTRO001/);
  assert.match(stock.cells[1].markup, /class="resource-cell-stack"/);
  assert.match(stock.cells[1].text, /^7 Mínimo:\s*3$/);

  const catalog = tableContent(
    await renderLoadedResource(
      'catalogo',
      'ADMINISTRADOR',
      fixtures.catalogo,
    ),
  );
  assert.match(catalog.cells[0].markup, /class="resource-cell-stack"/);
  assert.match(catalog.cells[0].text, /Alinhamento de direção/);
  assert.match(catalog.cells[0].text, /ID:\s*svALINHA001/);

  const users = tableContent(
    await renderLoadedResource(
      'usuarios',
      'ADMINISTRADOR',
      fixtures.usuarios,
    ),
  );
  assert.match(users.cells[0].markup, /class="resource-cell-stack"/);
  assert.match(users.cells[0].text, /Ana Lima/);
  assert.match(users.cells[0].text, /ID:\s*usADMIN001/);
  assert.match(users.cells[1].markup, /class="resource-cell-stack"/);
});

test('perfis somente leitura não recebem coluna nem controles de ações', async () => {
  const cases = [
    {
      route: 'estoque',
      role: 'MECANICO',
      item: fixtures.estoque,
    },
    {
      route: 'catalogo',
      role: 'CONSULTOR_TECNICO',
      item: fixtures.catalogo,
    },
  ];

  for (const scenario of cases) {
    const table = tableContent(
      await renderLoadedResource(
        scenario.route,
        scenario.role,
        scenario.item,
      ),
    );

    assert.ok(!table.headings.includes('Ações'));
    assert.equal(table.cells.length, table.headings.length);
    assert.doesNotMatch(table.markup, /class="resource-actions"/);
    assert.doesNotMatch(table.markup, /data-action="(?:entry|edit|toggle)"/);
  }
});

test('administrador mantém coluna e botões de ações nas consultas', async () => {
  for (const [route, item] of Object.entries(fixtures)) {
    const table = tableContent(
      await renderLoadedResource(route, 'ADMINISTRADOR', item),
    );

    assert.equal(table.headings.at(-1), 'Ações');
    assert.equal(table.cells.length, table.headings.length);
    assert.match(table.cells.at(-1).markup, /class="resource-actions"/);
    assert.match(table.cells.at(-1).markup, /data-action="edit"/);
    assert.match(table.cells.at(-1).markup, /data-action="toggle"/);
  }

  const stock = tableContent(
    await renderLoadedResource('estoque', 'ADMINISTRADOR', fixtures.estoque),
  );
  assert.match(stock.cells.at(-1).markup, /data-action="entry"/);
});
