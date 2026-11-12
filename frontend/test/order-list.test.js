import assert from 'node:assert/strict';
import test from 'node:test';
import { mountOrdersListView, renderOrderRows } from '../src/views/order-list.js';
import { ROLES } from '../src/core/permissions.js';
function target(properties = {}) { const events = new Map(); return { ...properties, addEventListener: (k, f) => events.set(k, f), removeEventListener: k => events.delete(k), emit(k, event = {}) { events.get(k)?.(event); }, focus() {} }; }
const settle = () => new Promise(resolve => setTimeout(resolve, 5));
const response = (number = 1, page = 1) => ({ data: [{ id: 'os-technical', numero: number, clienteNome: 'Ana', veiculoPlaca: 'UXA0105', veiculoMarca: 'Fiat', veiculoModelo: 'Uno', filialId: 'filial-sp', status: 'RECEBIDA' }], meta: { pagina: page, porPagina: 20, total: 45, totalPaginas: 3 } });
function harness(api, options = {}) {
  const search = target({ value: '' }), status = target({ value: '' }), branch = target({ value: '' }), result = { innerHTML: '' }, win = target({ scrollY: 0, scrollTo(options) { assert.equal(options.behavior, 'instant'); this.scrollY = options.top; } });
  const fields = { '#orders-result': result, '#order-search': search, '#order-status-filter': status, '#order-branch-filter': branch }, root = target({ ownerDocument: { defaultView: win }, querySelector: k => fields[k] });
  return { close: mountOrdersListView(root, { role: ROLES.ADMIN, api, debounceMs: 0, ...options }), root, win, search, status, branch, result };
}
test('busca global passa #número, status e filial; rótulos não usam UUID', async () => {
  const calls = [], h = harness({ async request(path, options) { calls.push({ path, ...options }); return response(); } }); await settle(); h.search.value = '#1'; h.status.value = 'RECEBIDA'; h.branch.value = 'filial-sp'; h.status.emit('change'); await settle();
  assert.deepEqual(calls.at(-1).query, { pagina: 1, porPagina: 20, busca: '#1', status: 'RECEBIDA', filialId: 'filial-sp' }); assert.match(h.result.innerHTML, /Ana/); assert.match(h.result.innerHTML, /UXA0105/); assert.doesNotMatch(h.result.innerHTML.replace(/href="[^"]*"/g, ''), /os-technical/); h.close();
});
test('resposta obsoleta é ignorada após nova pesquisa e escopo segue perfil', async () => {
  let finish; const calls = [], h = harness({ request(path, options) { calls.push({ path, ...options }); return options.query.busca === 'antigo' ? new Promise(resolve => { finish = resolve; }) : Promise.resolve(response(options.query.busca ? 2 : 1)); } }, { role: ROLES.MECHANIC }); await settle(); h.search.value = 'antigo'; h.search.emit('input'); await settle(); h.search.value = 'atual'; h.search.emit('input'); await settle(); finish(response(99)); await settle(); assert.equal(calls[0].path, '/ordens-servico/mecanico/minhas-ordens'); assert.equal(calls[1].signal.aborted, true); assert.match(h.result.innerHTML, /#2/); assert.doesNotMatch(h.result.innerHTML, /#99/); h.close();
});
test('retorno conserva página, consulta e scroll sem compartilhar entre usuários', async () => {
  const values = new Map(), storage = { getItem: k => values.get(k), setItem: (k, v) => values.set(k, v) }, calls = [], api = { async request(path, options) { calls.push({ path, ...options }); return response(1, options.query.pagina); } };
  let h = harness(api, { role: ROLES.CLIENT, subject: 'a', storage }); await settle(); h.search.value = 'UXA0105'; h.search.emit('input'); await settle(); h.root.emit('click', { target: { closest: () => ({ dataset: { action: 'orders-page:next' } }) } }); await settle(); h.win.scrollY = 360; h.win.emit('scroll'); h.close();
  h = harness(api, { role: ROLES.CLIENT, subject: 'b', storage }); await settle(); assert.equal(h.search.value, ''); h.close();
  h = harness(api, { role: ROLES.CLIENT, subject: 'a', storage }); await settle(); assert.equal(calls.at(-1).path, '/ordens-servico/minhas/lista'); assert.equal(calls.at(-1).query.pagina, 2); assert.equal(h.search.value, 'UXA0105'); assert.equal(h.win.scrollY, 360); h.close();
});
test('registro antigo sem placa não inventa identidade', () => { const html = renderOrderRows([{ id: 'os-private', numero: 1, veiculoId: 've-private', status: 'RECEBIDA' }], ROLES.ADMIN); assert.match(html, /Placa não disponível/); assert.doesNotMatch(html, /ve-private/); });
