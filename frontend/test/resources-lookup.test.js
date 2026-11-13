import assert from 'node:assert/strict';
import test from 'node:test';
import { mountResourcesView } from '../src/views/resources.js';
class ElementStub {}
class Root extends ElementStub {
  innerHTML = ''; results = { innerHTML: '' }; listeners = new Map();
  addEventListener(k, f) { this.listeners.set(k, f); } removeEventListener(k) { this.listeners.delete(k); }
  querySelector(k) { return k === '[data-resource-results]' ? this.results : null; } contains() { return true; }
}
const settle = () => new Promise(resolve => setTimeout(resolve, 5));
const page = (name = 'Filtro de óleo', pagina = 1) => ({ data: [{ filialId: 'filial-sp', peca: { id: 'pc-internal', nome: name, codigo: 'FLT-50', descricao: 'Motor 1.6', ativo: true }, quantidadeDisponivel: 0 }], meta: { pagina, porPagina: 20, total: 45, totalPaginas: 3 } });
async function harness(api, options = {}) {
  const previous = { Element: globalThis.Element, FormData: globalThis.FormData }; globalThis.Element = ElementStub;
  globalThis.FormData = class { constructor(form) { this.values = form.values; } get(k) { return this.values[k] ?? ''; } };
  const root = new Root(), events = new Map(), win = { scrollY: 0, location: { hash: '#/estoque' }, addEventListener: (k, f) => events.set(k, f), removeEventListener: k => events.delete(k), scrollTo(options) { assert.equal(options.behavior, 'instant'); this.scrollY = options.top; } };
  root.ownerDocument = { defaultView: win }; const mounted = mountResourcesView(root, 'estoque', { role: 'ADMINISTRADOR', api, ...options }); await settle();
  return { root, win,
    async search(value) { root.listeners.get('input')({ target: { value, matches: k => k === '[data-search-input]' } }); root.listeners.get('submit')({ preventDefault() {}, target: { values: { query: value }, matches: k => k === '[data-resource-search-form]' } }); await settle(); },
    async filter(name, value) { root.listeners.get('change')({ target: { name, value, matches: k => k === '[data-resource-filter]' } }); await settle(); },
    async next() { root.listeners.get('click')({ target: { closest: () => ({ dataset: { action: 'page', page: '2' } }) } }); await settle(); },
    scroll(y) { win.scrollY = y; events.get('scroll')?.(); },
    close() { mounted.destroy(); globalThis.Element = previous.Element; globalThis.FormData = previous.FormData; },
  };
}
test('nome/código busca global; filial e situação filtram no servidor, termo nunca vira caminho', async () => {
  const calls = [], h = await harness({ async request(path, options) { calls.push({ path, options }); return page(calls.length === 1 ? 'Junta' : 'Filtro fora da página'); } });
  try { await h.search('Filtro'); assert.equal(calls.length, 2); assert.match(h.root.results.innerHTML, /Filtro fora da página/); assert.match(h.root.results.innerHTML, /1 de 45 resultado/); await h.search('pc../../usuarios?ativo=true'); await h.filter('filialId', 'filial-sp'); await h.filter('ativo', 'false'); assert.ok(calls.every(c => c.path === '/estoque')); assert.deepEqual(calls.at(-1).options.query, { pagina: 1, porPagina: 20, busca: 'pc../../usuarios?ativo=true', filialId: 'filial-sp', ativo: false }); } finally { h.close(); }
});
test('resposta cancelada antiga não substitui consulta atual', async () => {
  let old; const calls = [], h = await harness({ request(_path, options) { calls.push(options); if (options.query.busca === 'Antigo') return new Promise(resolve => { old = resolve; }); return Promise.resolve(page(options.query.busca || 'Inicial')); } });
  try { await h.search('Antigo'); await h.search('Atual'); old(page('Obsoleta')); await settle(); assert.equal(calls[1].signal.aborted, true); assert.match(h.root.results.innerHTML, /Atual/); assert.doesNotMatch(h.root.results.innerHTML, /Obsoleta/); } finally { h.close(); }
});

test('trocar filtro mantém os campos montados para continuar digitando a busca', async () => {
  const calls = [], h = await harness({ async request(_path, options) { calls.push(options.query); return page('Resposta filtrada'); } });
  try {
    const mountedToolbar = h.root.innerHTML;
    await h.filter('filialId', 'filial-sp');
    assert.equal(h.root.innerHTML, mountedToolbar, 'alterar a filial não deve remover o campo que recebe foco em seguida');
    assert.match(h.root.results.innerHTML, /Resposta filtrada/);
    h.root.listeners.get('input')({ target: { value: 'óleo', matches: key => key === '[data-search-input]' } });
    await h.filter('ativo', 'true');
    assert.deepEqual(calls.at(-1), { pagina: 1, porPagina: 20, busca: 'óleo', filialId: 'filial-sp', ativo: true });
    assert.equal(h.root.innerHTML, mountedToolbar);
  } finally { h.close(); }
});
test('retorno restaura busca, filial, página e scroll isolados por usuário', async () => {
  const values = new Map(), storage = { getItem: k => values.get(k), setItem: (k, v) => values.set(k, v) }, calls = [], api = { async request(_path, options) { calls.push(options.query); return page('Filtro', options.query.pagina); } };
  let h = await harness(api, { storage, subject: 'a' }); await h.search('Filtro'); await h.filter('filialId', 'filial-sp'); await h.next(); h.scroll(480); h.close();
  h = await harness(api, { storage, subject: 'b' }); assert.deepEqual(calls.at(-1), { pagina: 1, porPagina: 20 }); h.close();
  h = await harness(api, { storage, subject: 'a' }); assert.deepEqual(calls.at(-1), { pagina: 2, porPagina: 20, busca: 'Filtro', filialId: 'filial-sp' }); assert.equal(h.win.scrollY, 480); assert.match(h.root.innerHTML, /Motor 1.6/); assert.match(h.root.innerHTML, /<details class="resource-record-id"><summary>Referência para suporte/); h.close();
});
