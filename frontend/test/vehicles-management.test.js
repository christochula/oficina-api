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

test('listagem de veículos separa identificação e dados em colunas e cartões', async () => {
  const previousElement = globalThis.Element;
  globalThis.Element = FakeElement;

  const vehicle = {
    id: 'vhVEHICLE01',
    placa: 'ABC1D23',
    renavam: '12345678901',
    chassi: '9BWZZZ377VT004251',
    marca: 'Volkswagen',
    modelo: 'Gol',
    ano: 2022,
    cor: 'Prata',
    quilometragem: 62350,
    ativo: true,
  };
  const root = new FakeRoot();
  const calls = [];
  const mounted = mountResourcesView(root, 'veiculos', {
    role: 'ADMINISTRADOR',
    api: {
      async request(path, options) {
        calls.push({ path, options });
        return page([vehicle]);
      },
    },
  });

  try {
    await settle();

    assert.deepEqual(calls[0], {
      path: '/veiculos',
      options: {
        method: 'GET',
        body: undefined,
        query: { pagina: 1, porPagina: 20 },
      },
    });

    const tableMarkup = root.innerHTML.match(
      /<table class="resource-table responsive-data-view">([\s\S]*?)<\/table>/,
    )?.[1];
    assert.ok(tableMarkup, 'a tabela de veículos deve ser renderizada');

    const headingMarkup = tableMarkup.match(
      /<thead><tr>([\s\S]*?)<\/tr><\/thead>/,
    )?.[1];
    const headings = [...headingMarkup.matchAll(/<th scope="col">([\s\S]*?)<\/th>/g)]
      .map((match) => textContent(match[1]));
    assert.deepEqual(headings, [
      'Placa / ID',
      'Veículo',
      'Ano',
      'Cor',
      'KM',
      'Situação',
      'Ações',
    ]);

    const rowMarkup = tableMarkup.match(
      /<tbody><tr>([\s\S]*?)<\/tr><\/tbody>/,
    )?.[1];
    assert.ok(rowMarkup, 'a linha do veículo deve ser renderizada');
    const cells = [...rowMarkup.matchAll(/<(th|td)\b[^>]*>([\s\S]*?)<\/\1>/g)]
      .map((match) => ({
        markup: match[0],
        text: textContent(match[2]),
      }));

    assert.equal(cells.length, 7);
    assert.match(cells[0].markup, /class="resource-cell-stack"/);
    assert.match(cells[0].text, /ABC••23/);
    assert.match(cells[0].text, /ID:\s*vhVEHICLE01/);
    assert.equal(cells[1].text, 'Volkswagen Gol');
    assert.equal(cells[2].text, '2022');
    assert.equal(cells[3].text, 'Prata');
    assert.equal(cells[4].text, '62.350 km');
    assert.match(cells[5].text, /ativo/i);
    assert.match(cells[6].text, /Editar veículo/);
    assert.match(cells[6].text, /Desativar/);

    const cardsStart = root.innerHTML.indexOf(
      '<div class="resource-card-list"',
    );
    assert.notEqual(cardsStart, -1, 'o cartão móvel deve ser renderizado');
    const cardsMarkup = root.innerHTML.slice(cardsStart);
    assert.match(
      cardsMarkup,
      /<div>\s*<dt>Ano<\/dt>\s*<dd>2022<\/dd>\s*<\/div>/,
    );
    assert.match(
      cardsMarkup,
      /<div>\s*<dt>Cor<\/dt>\s*<dd>Prata<\/dd>\s*<\/div>/,
    );
    assert.match(
      cardsMarkup,
      /<div>\s*<dt>Quilometragem<\/dt>\s*<dd>62\.350 km<\/dd>\s*<\/div>/,
    );
    assert.doesNotMatch(cardsMarkup, /Ano e cor/);
  } finally {
    mounted.destroy();
    assert.equal(root.listenerCount(), 0);
    globalThis.Element = previousElement;
  }
});
