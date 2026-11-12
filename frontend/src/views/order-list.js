import { ROLES } from '../core/permissions.js';
import { getOrderStatusMeta } from '../core/order-status.js';
import { formatDateTime, formatOrderNumber } from '../core/formatters.js';
import { button, domainId, escapeAttribute, escapeHtml, icon, pagination, skeleton, statePanel, statusBadge } from '../components/ui-kit.js';
import { pageHeader } from '../components/shell.js';
import { apiErrorMessage, extractPage } from '../services/domain-api.js';

const internal = new Set([ROLES.ADMIN, ROLES.CONSULTANT]);
const statuses = ['RECEBIDA', 'ATRIBUIDA', 'EM_DIAGNOSTICO', 'AGUARDANDO_APROVACAO', 'APROVADA', 'EM_EXECUCAO', 'AGUARDANDO_PAGAMENTO', 'PRONTA_PARA_ENTREGA', 'ENTREGUE', 'CANCELADA'];
function listPath(role) {
  return role === ROLES.CLIENT ? '/ordens-servico/minhas/lista' : role === ROLES.MECHANIC ? '/ordens-servico/mecanico/minhas-ordens' : '/ordens-servico';
}

export function renderOrdersListView({ role }) {
  return `${pageHeader({ eyebrow: role === ROLES.CLIENT ? 'Portal do cliente' : 'Operação da oficina', title: internal.has(role) ? 'Ordens de serviço' : 'Minhas ordens', description: role === ROLES.CLIENT ? 'Acompanhe seu veículo e revise os orçamentos.' : 'Localize o atendimento por número, placa ou nome do cliente.', actions: internal.has(role) ? button({ label: 'Nova ordem', iconName: 'add', variant: 'primary', href: '#/ordens/nova' }) : '' })}
    ${internal.has(role) ? '<aside class="scope-notice" role="note"><span class="material-symbols-rounded" aria-hidden="true">info</span><p><strong>Escopo da fila:</strong> acompanhe preparação, execução, pagamento e entrega de cada atendimento.</p></aside>' : ''}
    <section class="data-card orders-list-card" aria-labelledby="orders-list-title"><div class="data-card-toolbar"><div><p class="eyebrow">Atendimentos</p><h2 id="orders-list-title">Ordens disponíveis</h2></div>
      <div class="filter-bar">
        <label class="search-field"><span class="sr-only">Buscar ordens</span>${icon('search')}<input type="search" id="order-search" maxlength="120" placeholder="Número da OS, placa ou cliente" autocomplete="off"></label>
        <label><span class="sr-only">Filtrar por status</span><select id="order-status-filter"><option value="">Todos os status</option>${statuses.map(status => `<option value="${status}">${escapeHtml(getOrderStatusMeta(status)?.label ?? status)}</option>`).join('')}</select></label>
        <label><span class="sr-only">Filtrar ordens por filial</span><input type="search" id="order-branch-filter" placeholder="Todas as filiais" list="order-branches" maxlength="120"><datalist id="order-branches"><option value="filial-sp">São Paulo</option><option value="filial-rj">Rio de Janeiro</option></datalist></label>
        ${button({ label: 'Limpar filtros', variant: 'ghost', action: 'orders:clear-filters' })}
      </div></div><p class="field-hint">A busca consulta todas as ordens permitidas ao seu perfil. Digite #1 ou 1 para localizar exatamente a ordem 1.</p>
      <div id="orders-result">${skeleton({ rows: 6, label: 'Carregando ordens de serviço' })}</div>
    </section>`;
}

export function renderOrderRows(orders, role, filtered = false) {
  if (!orders.length) return statePanel({ kind: filtered ? 'filtered' : 'empty', title: filtered ? 'Nenhuma ordem corresponde aos filtros' : 'Nenhuma ordem nesta fila', description: filtered ? 'Altere a busca, a filial ou o status. A consulta considera toda a base permitida ao seu perfil.' : 'Quando houver uma ordem disponível para seu perfil, ela aparecerá aqui.', actionLabel: filtered ? 'Limpar filtros' : undefined, action: 'orders:clear-filters' });
  return `<div class="responsive-table-wrapper"><table class="responsive-table"><caption class="sr-only">Ordens de serviço encontradas</caption><thead><tr><th>Ordem / Cliente</th><th>Status</th><th>Veículo / Filial</th><th>Atualizada</th><th><span class="sr-only">Ação</span></th></tr></thead><tbody>${orders.map(order => {
    const id = domainId(order.id), pending = role === ROLES.CLIENT && order.status === 'AGUARDANDO_APROVACAO';
    const vehicle = [order.veiculoMarca, order.veiculoModelo].filter(Boolean).join(' ');
    return `<tr><td data-label="Ordem / Cliente"><a class="table-primary-link" href="#/ordens/${escapeAttribute(id)}"><strong>${escapeHtml(formatOrderNumber(order.numero))}</strong><small>${escapeHtml(order.clienteNome || 'Cliente do atendimento')}</small></a></td>
      <td data-label="Status">${statusBadge(order.status, getOrderStatusMeta(order.status) ?? {})}</td>
      <td data-label="Veículo / Filial"><span class="resource-cell-stack"><strong>${escapeHtml(order.veiculoPlaca || 'Placa não disponível')}</strong>${vehicle ? `<small>${escapeHtml(vehicle)}</small>` : ''}<small>Filial: ${escapeHtml(order.filialId || 'Não informada')}</small>${order.mecanicoNome ? `<small>Mecânico: ${escapeHtml(order.mecanicoNome)}</small>` : ''}</span></td>
      <td data-label="Atualizada"><time datetime="${escapeAttribute(order.atualizadoEm ?? '')}">${escapeHtml(formatDateTime(order.atualizadoEm))}</time></td>
      <td data-label="Ação" class="table-actions"><a class="interactive-button button-${pending ? 'primary' : 'ghost'} button-small" href="#/ordens/${escapeAttribute(id)}">${icon(pending ? 'task_alt' : 'arrow_forward')}<span>${pending ? 'Analisar' : 'Abrir'}</span></a></td></tr>`;
  }).join('')}</tbody></table></div>`;
}

export function mountOrdersListView(root, { role, subject, api, storage, debounceMs = 250 } = {}) {
  const result = root.querySelector('#orders-result'), search = root.querySelector('#order-search'), status = root.querySelector('#order-status-filter'), branch = root.querySelector('#order-branch-filter');
  if (!result || !search || !status || !branch) throw new TypeError('Lista de ordens incompleta.');
  const windowRef = root.ownerDocument?.defaultView ?? globalThis;
  const key = subject ? `oficina.order-list-context.v1:${role}:${subject}` : '';
  try { storage ??= globalThis.sessionStorage; } catch { /* Session storage is optional. */ }
  let state = { page: 1, search: '', status: '', branch: '', scrollY: 0 }, meta = {}, timer, controller, sequence = 0, disposed = false, restoringScroll = true;
  try {
    const saved = key && JSON.parse(storage?.getItem(key) || 'null');
    if (saved) state = { page: Math.max(1, Number(saved.page) || 1), search: String(saved.search ?? '').slice(0, 120), status: statuses.includes(saved.status) ? saved.status : '', branch: String(saved.branch ?? '').slice(0, 120), scrollY: Math.max(0, Number(saved.scrollY) || 0) };
  } catch { /* Ignore malformed state. */ }
  search.value = state.search; status.value = state.status; branch.value = state.branch;
  const save = () => { if (!key) return; try { storage?.setItem(key, JSON.stringify(state)); } catch { /* Keep current interaction usable. */ } };
  const load = async () => {
    clearTimeout(timer); controller?.abort(); controller = new AbortController(); const signal = controller.signal, requestId = ++sequence;
    result.innerHTML = skeleton({ rows: 6, label: 'Atualizando ordens de serviço' });
    save();
    try {
      const payload = await api.request(listPath(role), { query: { pagina: state.page, porPagina: 20, ...(state.search.trim() ? { busca: state.search.trim() } : {}), ...(state.status ? { status: state.status } : {}), ...(state.branch.trim() ? { filialId: state.branch.trim() } : {}) }, signal });
      if (disposed || requestId !== sequence) return;
      const parsed = extractPage(payload); meta = parsed.meta;
      const lastPage = Math.max(1, Number(meta.totalPaginas) || 1);
      if (state.page > lastPage) { state.page = lastPage; return await load(); }
      result.innerHTML = `<p class="field-hint" role="status">${parsed.data.length} de ${Number(meta.total ?? parsed.data.length)} ordem(ns) encontrada(s).</p>${renderOrderRows(parsed.data, role, Boolean(state.search || state.status || state.branch))}${parsed.data.length ? pagination(meta, 'orders-page') : ''}`;
      save(); if (restoringScroll) { windowRef.scrollTo?.({ top: state.scrollY, left: 0, behavior: 'instant' }); restoringScroll = false; }
    } catch (error) {
      if (disposed || requestId !== sequence || signal.aborted) return;
      result.innerHTML = statePanel({ kind: 'error', title: 'Não foi possível carregar as ordens', description: apiErrorMessage(error), actionLabel: 'Tentar novamente', action: 'orders:retry', correlationId: error?.correlationId });
    }
  };
  const filtersChanged = (immediate = false) => {
    clearTimeout(timer); controller?.abort(); sequence++;
    state.search = search.value; state.status = status.value; state.branch = branch.value; state.page = 1; state.scrollY = 0; save();
    result.innerHTML = skeleton({ rows: 6, label: 'Buscando ordens de serviço' });
    if (immediate) void load(); else timer = setTimeout(() => { void load(); }, debounceMs);
  };
  const onInput = () => filtersChanged();
  const onChange = () => filtersChanged(true);
  const onKey = event => { if (event.key === 'Enter') { event.preventDefault(); filtersChanged(true); } };
  const onClick = event => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'orders:retry') void load();
    if (action === 'orders:clear-filters') { search.value = ''; status.value = ''; branch.value = ''; filtersChanged(true); search.focus(); }
    if (action === 'orders-page:previous' && state.page > 1) { state.page--; state.scrollY = 0; void load(); }
    if (action === 'orders-page:next' && state.page < Number(meta.totalPaginas ?? 1)) { state.page++; state.scrollY = 0; void load(); }
  };
  const onScroll = () => { if (restoringScroll) return; state.scrollY = Number(windowRef.scrollY) || 0; save(); };
  search.addEventListener('input', onInput); branch.addEventListener('input', onInput); status.addEventListener('change', onChange); search.addEventListener('keydown', onKey); branch.addEventListener('keydown', onKey); root.addEventListener('click', onClick); windowRef.addEventListener?.('scroll', onScroll, { passive: true });
  void load();
  return function destroy() {
    if (disposed) return; state.scrollY = Number(windowRef.scrollY) || state.scrollY; save(); disposed = true; sequence++; clearTimeout(timer); controller?.abort();
    search.removeEventListener('input', onInput); branch.removeEventListener('input', onInput); status.removeEventListener('change', onChange); search.removeEventListener('keydown', onKey); branch.removeEventListener('keydown', onKey); root.removeEventListener('click', onClick); windowRef.removeEventListener?.('scroll', onScroll);
  };
}
