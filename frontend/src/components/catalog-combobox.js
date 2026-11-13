import { domainId, escapeAttribute, escapeHtml, icon } from './ui-kit.js';

const catalog = Object.freeze({
  piece: { endpoint: '/estoque', label: 'Peça', placeholder: 'Busque por código, nome ou descrição', icon: 'inventory_2' },
  vehicle: { endpoint: '/veiculos', label: 'Veículo', placeholder: 'Busque por placa, marca ou modelo', icon: 'directions_car' },
  service: { endpoint: '/servicos-oficina', label: 'Serviço', placeholder: 'Busque por nome, categoria ou descrição', icon: 'build' },
});
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const safeId = value => String(value || 'catalog-combobox').replace(/[^a-zA-Z0-9_-]/g, '-');

export function catalogRecordId(kind, record) {
  return domainId(kind === 'piece' ? record?.peca?.id ?? record?.id : record?.id);
}

export function catalogSelectionLabel(kind, record) {
  if (!record) return '';
  if (kind === 'piece') {
    const piece = record.peca ?? record;
    return [piece.codigo, piece.nome, record.filialId].filter(Boolean).join(' · ');
  }
  if (kind === 'vehicle') return [record.placa, [record.marca, record.modelo].filter(Boolean).join(' '), record.ano].filter(Boolean).join(' · ');
  return [record.nome, record.categoria].filter(Boolean).join(' · ');
}

export function catalogOptionDetails(kind, record) {
  if (kind === 'piece') {
    const piece = record.peca ?? record;
    const price = Number(piece.precoVenda);
    return [piece.descricao, Number.isFinite(price) ? `Preço sugerido: ${money.format(price)}` : '',
      record.quantidadeDisponivel === undefined ? '' : Number(record.quantidadeDisponivel) > 0
        ? `${record.quantidadeDisponivel} disponíveis` : 'Sem saldo — a execução depende de reposição'];
  }
  return kind === 'vehicle' ? [record.cor] : [record.descricao];
}

export function renderCatalogComboboxField({ id = 'catalog-combobox', name = 'catalogId', kind = 'piece', label = catalog[kind]?.label ?? 'Item', required = true, selected = null, placeholder = catalog[kind]?.placeholder, hint = 'Pesquise em todo o catálogo. Use as setas e Enter para selecionar.' } = {}) {
  const base = safeId(id), value = catalogRecordId(kind, selected), text = catalogSelectionLabel(kind, selected);
  return `<div class="form-group client-combobox catalog-combobox" data-catalog-combobox data-catalog-kind="${escapeAttribute(kind)}" data-catalog-id="${base}">
    <label for="${base}-input">${escapeHtml(label)}${required ? ' <span aria-hidden="true">*</span>' : ''}</label>
    <div class="client-combobox__control">${icon(catalog[kind]?.icon ?? 'search', 'client-combobox__search-icon')}
      <input id="${base}-input" type="search" class="client-combobox__input" value="${escapeAttribute(text)}" placeholder="${escapeAttribute(placeholder ?? '')}" role="combobox" aria-autocomplete="list" aria-haspopup="listbox" aria-controls="${base}-listbox" aria-expanded="false" aria-required="${required}" aria-describedby="${base}-hint ${base}-status" autocomplete="off" spellcheck="false" data-catalog-input>
      <input type="hidden" name="${escapeAttribute(name)}" value="${escapeAttribute(value)}" data-catalog-value>
      <button type="button" class="icon-button client-combobox__clear" aria-label="Limpar seleção de ${escapeAttribute(label.toLocaleLowerCase('pt-BR'))}" data-catalog-clear${value ? '' : ' hidden'}>${icon('close')}</button>
    </div>
    <ul id="${base}-listbox" class="client-combobox__listbox" role="listbox" aria-label="Resultados de ${escapeAttribute(label.toLocaleLowerCase('pt-BR'))}" data-catalog-listbox hidden></ul>
    <p id="${base}-status" class="sr-only" aria-live="polite" aria-atomic="true" data-catalog-status></p>
    <p id="${base}-hint" class="field-hint">${escapeHtml(hint)}</p>
  </div>`;
}

export function mountCatalogCombobox(root, { api, kind, endpoint, getFilters = () => ({}), onSelect, onClear, onError, initialSelected = null, debounceMs = 250, pageSize = 20 } = {}) {
  const container = root?.matches?.('[data-catalog-combobox]') ? root : root?.querySelector?.('[data-catalog-combobox]');
  if (!container || typeof api?.request !== 'function') throw new TypeError('O seletor requer seu campo e um cliente de API.');
  kind ??= container.dataset.catalogKind;
  if (!catalog[kind]) throw new TypeError('Tipo de catálogo inválido.');
  endpoint ??= catalog[kind].endpoint;
  const input = container.querySelector('[data-catalog-input]'), value = container.querySelector('[data-catalog-value]');
  const list = container.querySelector('[data-catalog-listbox]'), status = container.querySelector('[data-catalog-status]'), clearButton = container.querySelector('[data-catalog-clear]');
  if (!input || !value || !list || !status || !clearButton) throw new TypeError('Campo de catálogo incompleto.');
  const documentRef = container.ownerDocument ?? globalThis.document, base = container.dataset.catalogId;
  let items = [], selected = null, active = -1, page = 1, totalPages = 1, query = '', timer, controller, sequence = 0, destroyed = false, busy = false;
  const listeners = [];
  const listen = (target, type, handler, options) => { target?.addEventListener?.(type, handler, options); listeners.push(() => target?.removeEventListener?.(type, handler, options)); };
  const announce = message => { status.textContent = message; };
  const expanded = open => { list.hidden = !open; input.setAttribute('aria-expanded', String(open)); if (!open) input.removeAttribute('aria-activedescendant'); };
  const cancel = () => { clearTimeout(timer); timer = null; sequence++; controller?.abort(); controller = null; busy = false; input.removeAttribute('aria-busy'); };
  const close = () => { cancel(); expanded(false); };
  const syncActive = () => {
    list.querySelectorAll('[data-catalog-option]').forEach((option, index) => { option.classList.toggle('is-active', active === index); });
    const option = list.querySelector(`[data-catalog-option="${active}"]`);
    if (option) { input.setAttribute('aria-activedescendant', option.id); option.scrollIntoView?.({ block: 'nearest' }); }
    else input.removeAttribute('aria-activedescendant');
  };
  const render = () => {
    active = -1;
    list.innerHTML = items.length ? items.map((record, index) => `<li id="${base}-option-${index}" class="client-combobox__option" role="option" aria-selected="${catalogRecordId(kind, record) === value.value}" data-catalog-option="${index}"><span class="client-combobox__identity"><strong>${escapeHtml(catalogSelectionLabel(kind, record))}</strong>${catalogOptionDetails(kind, record).filter(Boolean).map(detail => `<small>${escapeHtml(detail)}</small>`).join('')}</span>${icon('chevron_right', 'client-combobox__meta')}</li>`).join('') : '<li class="client-combobox__state" role="presentation">Nenhum resultado. Revise a busca; o cadastro existente pode estar inativo.</li>';
    if (page < totalPages) list.innerHTML += '<li role="presentation"><button type="button" class="interactive-button button-ghost" data-catalog-more>Carregar mais resultados</button></li>';
    expanded(true); syncActive(); announce(`${items.length} resultado(s) carregados${page < totalPages ? '; há mais resultados' : ''}. Use as setas e Enter.`);
  };
  const clearSelection = ({ preserveText = false, emit = true } = {}) => {
    const had = Boolean(value.value); selected = null; value.value = '';
    if (!preserveText) input.value = '';
    clearButton.hidden = !input.value;
    if (had && emit) onClear?.();
  };
  const setSelected = (record, { emit = true } = {}) => {
    if (!catalogRecordId(kind, record)) return;
    cancel(); selected = record; value.value = catalogRecordId(kind, record); input.value = catalogSelectionLabel(kind, record); clearButton.hidden = false; expanded(false);
    announce(`${input.value} selecionado.`); if (emit) onSelect?.(record);
  };
  const search = async (text = input.value, nextPage = 1) => {
    cancel(); if (destroyed) return;
    const requestId = sequence, abort = new AbortController(); controller = abort; busy = true;
    query = String(text ?? '').trim(); input.setAttribute('aria-busy', 'true');
    if (nextPage === 1) { items = []; list.innerHTML = '<li class="client-combobox__state" role="presentation">Buscando…</li>'; expanded(true); }
    try {
      const filters = getFilters() ?? {};
      const payload = await api.request(endpoint, { query: { ...filters, ativo: true, pagina: nextPage, porPagina: pageSize, ...(query ? { busca: query } : {}) }, signal: abort.signal });
      if (destroyed || requestId !== sequence) return;
      const records = Array.isArray(payload) ? payload : payload?.data ?? payload?.itens ?? [];
      const eligible = records.filter(record => catalogRecordId(kind, record) && (kind === 'piece' ? record.peca?.ativo ?? record.ativo : record.ativo) !== false && (!filters.filialId || kind !== 'piece' || record.filialId === filters.filialId));
      const seen = new Set(nextPage === 1 ? [] : items.map(record => catalogRecordId(kind, record)));
      items = [...(nextPage === 1 ? [] : items), ...eligible.filter(record => { const id = catalogRecordId(kind, record); if (seen.has(id)) return false; seen.add(id); return true; })];
      page = nextPage; totalPages = Number(payload?.meta?.totalPaginas ?? 1); render();
    } catch (error) {
      if (destroyed || requestId !== sequence || abort.signal.aborted) return;
      list.innerHTML = '<li class="client-combobox__state" role="presentation">Não foi possível buscar. <button type="button" class="interactive-button button-ghost" data-catalog-retry>Tentar novamente</button></li>';
      expanded(true); announce('Não foi possível buscar. Tente novamente.'); onError?.(error);
    } finally { if (requestId === sequence) { busy = false; input.removeAttribute('aria-busy'); controller = null; } }
  };
  const schedule = () => { cancel(); clearSelection({ preserveText: true }); items = []; active = -1; busy = true; list.innerHTML = '<li class="client-combobox__state" role="presentation">Buscando…</li>'; expanded(true); input.removeAttribute('aria-activedescendant'); timer = setTimeout(() => { void search(); }, debounceMs); };
  listen(input, 'input', schedule);
  listen(input, 'focus', () => { if (!value.value) void search(); });
  listen(input, 'keydown', event => {
    if (event.key === 'Escape' && !list.hidden) { event.preventDefault(); close(); return; }
    if (event.key === 'Enter') { event.preventDefault(); if (active >= 0 && items[active] && !busy) setSelected(items[active]); else if (!value.value) void search(); return; }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    if (['Home', 'End'].includes(event.key) && list.hidden) return;
    event.preventDefault(); if (list.hidden) { void search(value.value ? '' : input.value); return; }
    if (!items.length || busy) return;
    active = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : event.key === 'ArrowDown' ? (active + 1) % items.length : (active <= 0 ? items.length : active) - 1; syncActive();
  });
  listen(list, 'pointerdown', event => { if (event.target.closest?.('[data-catalog-option]')) event.preventDefault(); });
  listen(list, 'click', event => {
    const option = event.target.closest?.('[data-catalog-option]');
    if (option && !busy) { setSelected(items[Number(option.dataset.catalogOption)]); input.focus(); }
    else if (event.target.closest?.('[data-catalog-more]') && !busy) void search(query, page + 1);
    else if (event.target.closest?.('[data-catalog-retry]')) void search(query);
  });
  listen(clearButton, 'click', () => { cancel(); clearSelection(); input.focus(); void search(''); });
  listen(documentRef, 'pointerdown', event => { if (!container.contains(event.target)) close(); }, true);
  listen(container, 'focusout', () => { setTimeout(() => { if (!destroyed && !container.contains(documentRef.activeElement)) close(); }, 0); });
  if (initialSelected) setSelected(initialSelected, { emit: false });
  return {
    destroy() { if (destroyed) return; destroyed = true; close(); listeners.forEach(remove => remove()); },
    focus() { input.focus(); }, close,
    clear() { cancel(); clearSelection(); expanded(false); }, setSelected,
    refresh({ clearSelection: reset = true } = {}) { cancel(); if (reset) clearSelection(); items = []; expanded(false); },
    get selected() { return selected; }, get value() { return value.value; }, get selectedLabel() { return value.value ? input.value : ''; },
  };
}
