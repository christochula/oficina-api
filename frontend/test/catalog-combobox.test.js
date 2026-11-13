import assert from 'node:assert/strict';
import test from 'node:test';
import { catalogRecordId, catalogSelectionLabel, mountCatalogCombobox, renderCatalogComboboxField } from '../src/components/catalog-combobox.js';

function target(values = {}) {
  const handlers = new Map(), attributes = new Map();
  return { ...values,
    addEventListener(type, fn) { const list = handlers.get(type) ?? []; list.push(fn); handlers.set(type, list); },
    removeEventListener(type, fn) { handlers.set(type, (handlers.get(type) ?? []).filter(item => item !== fn)); },
    dispatch(type, event = {}) { (handlers.get(type) ?? []).forEach(fn => fn({ target: this, preventDefault() {}, ...event })); },
    setAttribute(k, v) { attributes.set(k, String(v)); }, getAttribute(k) { return attributes.get(k); }, removeAttribute(k) { attributes.delete(k); },
  };
}
function dom(kind = 'piece') {
  const doc = target({ activeElement: null });
  const input = target({ value: '', focus() { doc.activeElement = this; } });
  const value = { value: '' }, status = {}, clear = target();
  const list = target({ hidden: true, innerHTML: '', querySelectorAll: () => [], querySelector: () => null });
  const fields = { '[data-catalog-input]': input, '[data-catalog-value]': value, '[data-catalog-listbox]': list, '[data-catalog-status]': status, '[data-catalog-clear]': clear };
  const root = target({ ownerDocument: doc, dataset: { catalogKind: kind, catalogId: 'test' }, matches: selector => selector === '[data-catalog-combobox]', querySelector: selector => fields[selector], contains: element => Object.values(fields).includes(element) });
  return { root, input, value, list, clear };
}
const settle = () => new Promise(resolve => setTimeout(resolve, 5));
const piece = { peca: { id: 'pc-internal', codigo: 'FLT-50', nome: 'Filtro de óleo', descricao: 'Motor 1.6', precoVenda: 50, ativo: true }, filialId: 'filial-sp', quantidadeDisponivel: 0 };

test('rótulos usam código/nome/filial, placa/modelo ou nome/categoria; UUID fica no hidden', () => {
  const html = renderCatalogComboboxField({ id: 'piece-1', name: 'pecaId', selected: piece });
  assert.equal(catalogRecordId('piece', piece), 'pc-internal');
  assert.equal(catalogSelectionLabel('piece', piece), 'FLT-50 · Filtro de óleo · filial-sp');
  assert.equal(catalogSelectionLabel('vehicle', { id: 've-internal', placa: 'UXA0105', marca: 'Fiat', modelo: 'Uno', ano: 2020 }), 'UXA0105 · Fiat Uno · 2020');
  assert.equal(catalogSelectionLabel('service', { nome: 'Revisão', categoria: 'Preventiva' }), 'Revisão · Preventiva');
  assert.match(html, /type="hidden" name="pecaId" value="pc-internal"/);
  assert.doesNotMatch(html.replace(/<input type="hidden"[^>]+>/g, ''), /pc-internal/);
});

test('seleção remota preserva preço e filial; saldo zero continua selecionável e inativo não', async () => {
  const d = dom(), calls = [], selected = [];
  const box = mountCatalogCombobox(d.root, { debounceMs: 0, getFilters: () => ({ filialId: 'filial-sp' }), onSelect: record => selected.push(record), api: { async request(endpoint, options) {
    calls.push({ endpoint, options });
    return { data: [piece, { ...piece, filialId: 'filial-rj', peca: { ...piece.peca, id: 'wrong-branch' } }, { ...piece, peca: { ...piece.peca, id: 'inactive', ativo: false } }] };
  } } });
  d.input.value = 'óleo'; d.input.dispatch('input'); await settle();
  assert.deepEqual(calls[0].options.query, { filialId: 'filial-sp', ativo: true, pagina: 1, porPagina: 20, busca: 'óleo' });
  assert.match(d.list.innerHTML, /Motor 1.6/); assert.match(d.list.innerHTML, /Sem saldo/); assert.doesNotMatch(d.list.innerHTML, /wrong-branch|inactive/);
  d.input.dispatch('keydown', { key: 'ArrowDown' }); d.input.dispatch('keydown', { key: 'Enter' });
  assert.equal(box.value, 'pc-internal'); assert.equal(selected[0].peca.precoVenda, 50); assert.equal(d.list.hidden, true);
  d.input.value = 'novo'; d.input.dispatch('input'); assert.equal(box.value, '');
  d.input.dispatch('keydown', { key: 'Enter' }); assert.equal(box.value, ''); box.destroy();
});

test('resposta antiga não substitui busca atual ou seleção, cancelamento ocorre no request', async () => {
  const d = dom('service'); let finishOld; const signals = [];
  const box = mountCatalogCombobox(d.root, { debounceMs: 0, api: { request(_path, { query, signal }) {
    signals.push(signal);
    if (query.busca === 'antigo') return new Promise(resolve => { finishOld = resolve; });
    return Promise.resolve({ data: [{ id: 'sv-new', nome: 'Atual', ativo: true }] });
  } } });
  d.input.value = 'antigo'; d.input.dispatch('input'); await settle();
  d.input.value = 'atual'; d.input.dispatch('input'); await settle();
  assert.equal(signals[0].aborted, true);
  d.input.dispatch('keydown', { key: 'ArrowDown' }); d.input.dispatch('keydown', { key: 'Enter' });
  finishOld({ data: [{ id: 'sv-old', nome: 'Antigo' }] }); await settle();
  assert.equal(box.value, 'sv-new'); assert.equal(d.input.value, 'Atual'); assert.equal(d.list.hidden, true); box.destroy();
});

test('carregar mais mantém páginas e permite escolher item posterior; troca de contexto invalida seleção', async () => {
  const d = dom('vehicle'), pages = []; let clears = 0;
  const box = mountCatalogCombobox(d.root, { onClear: () => clears++, api: { async request(_path, { query }) {
    pages.push(query.pagina); return { data: [{ id: `ve-${query.pagina}`, placa: query.pagina === 1 ? 'UXA0001' : 'UXA0105', ativo: true }], meta: { totalPaginas: 2 } };
  } } });
  d.input.dispatch('focus'); await settle();
  d.list.dispatch('click', { target: { closest: selector => selector === '[data-catalog-more]' ? {} : null } }); await settle();
  assert.deepEqual(pages, [1, 2]); assert.match(d.list.innerHTML, /UXA0105/);
  d.input.dispatch('keydown', { key: 'End' }); d.input.dispatch('keydown', { key: 'Enter' }); assert.equal(box.value, 've-2');
  box.refresh(); assert.equal(box.value, ''); assert.equal(clears, 1); box.destroy();
});

test('erro oferece retry e Escape cancela busca sem fechar modal ancestral', async () => {
  const d = dom(), box = mountCatalogCombobox(d.root, { api: { async request() { throw new Error('offline'); } } });
  d.input.dispatch('focus'); await settle(); assert.match(d.list.innerHTML, /Tentar novamente/);
  let prevented = false; d.input.dispatch('keydown', { key: 'Escape', preventDefault() { prevented = true; } });
  assert.equal(prevented, true); assert.equal(d.list.hidden, true); box.destroy();
});
