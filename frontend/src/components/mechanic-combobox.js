import {
  domainId,
  escapeAttribute,
  escapeHtml,
  icon,
  initials,
} from './ui-kit.js';
import { moveClientActiveIndex } from './client-combobox.js';

export const MECHANIC_COMBOBOX_DEFAULTS = Object.freeze({
  debounceMs: 250,
  minChars: 2,
  pageSize: 10,
  endpoint: '/usuarios/mecanicos',
});

function safeDomId(value, fallback = 'mechanic-combobox') {
  const normalized = String(value ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-');
  return normalized || fallback;
}

function compactId(value) {
  const id = domainId(value);
  if (id.length <= 18) return id;
  return `${id.slice(0, 9)}…${id.slice(-6)}`;
}

export function normalizeMechanicSearchTerm(value) {
  return String(value ?? '').trim();
}

export function shouldSearchMechanics(
  value,
  minChars = MECHANIC_COMBOBOX_DEFAULTS.minChars,
) {
  const term = normalizeMechanicSearchTerm(value);
  return term.length === 0 || term.length >= minChars;
}

export function buildMechanicSearchQuery(
  value,
  pageSize = MECHANIC_COMBOBOX_DEFAULTS.pageSize,
) {
  const term = normalizeMechanicSearchTerm(value);
  return {
    pagina: 1,
    porPagina: pageSize,
    ativo: true,
    ...(term ? { busca: term } : {}),
  };
}

export function mechanicSelectionLabel(mechanic) {
  if (!mechanic) return '';
  const name = String(mechanic.nome ?? '').trim() || 'Mecânico sem nome';
  const email = String(mechanic.email ?? '').trim();
  return email ? `${name} · ${email}` : name;
}

export function normalizeMechanicResults(payload) {
  const data = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.itens)
        ? payload.itens
        : [];

  return data.filter((mechanic) => {
    const role = String(mechanic?.papel ?? '').toUpperCase();
    return (
      mechanic?.ativo !== false &&
      domainId(mechanic?.id) &&
      role === 'MECANICO'
    );
  });
}

function mechanicOptionDetails(mechanic) {
  const email = String(mechanic?.email ?? '').trim();
  const id = compactId(mechanic?.id);
  return [email, id ? `ID ${id}` : ''].filter(Boolean);
}

function optionDomId(baseId, index) {
  return `${safeDomId(baseId)}-option-${index}`;
}

export function renderMechanicComboboxOptions(
  mechanics,
  { baseId = 'mechanic-combobox', activeIndex = -1, selectedId = '' } = {},
) {
  return mechanics
    .map((mechanic, index) => {
      const id = domainId(mechanic?.id);
      const active = index === activeIndex;
      const selected = Boolean(selectedId && selectedId === id);
      const name = String(mechanic?.nome ?? '').trim() || 'Mecânico sem nome';
      const details = mechanicOptionDetails(mechanic).join(' · ');

      return `<li id="${escapeAttribute(optionDomId(baseId, index))}" class="client-combobox__option${active ? ' is-active' : ''}${selected ? ' is-selected' : ''}" role="option" aria-selected="${String(selected)}" aria-posinset="${index + 1}" aria-setsize="${mechanics.length}" data-mechanic-option data-mechanic-index="${index}">
        <span class="client-combobox__avatar mechanic-combobox__avatar" aria-hidden="true">${escapeHtml(initials(name))}</span>
        <span class="client-combobox__identity"><strong>${escapeHtml(name)}</strong>${details ? `<small>${escapeHtml(details)}</small>` : ''}</span>
        ${icon(selected ? 'check_circle' : 'chevron_right', 'client-combobox__meta')}
      </li>`;
    })
    .join('');
}

export function renderMechanicComboboxField({
  id = 'mechanic-combobox',
  name = 'mechanicId',
  label = 'Mecânico',
  placeholder = 'Busque por nome, e-mail ou ID',
  hint = 'Digite ao menos 2 caracteres. Com o campo vazio, os primeiros 10 mecânicos ativos serão exibidos.',
  required = true,
  selectedMechanic = null,
} = {}) {
  const baseId = safeDomId(id);
  const inputId = `${baseId}-input`;
  const listboxId = `${baseId}-listbox`;
  const hintId = `${baseId}-hint`;
  const statusId = `${baseId}-status`;
  const selectedId = domainId(selectedMechanic?.id);
  const selectedLabel = mechanicSelectionLabel(selectedMechanic);

  return `<div class="form-group client-combobox mechanic-combobox" data-mechanic-combobox data-mechanic-combobox-id="${escapeAttribute(baseId)}">
    <label for="${escapeAttribute(inputId)}">${escapeHtml(label)}${required ? ' <span aria-hidden="true">*</span>' : ''}</label>
    <div class="client-combobox__control" data-mechanic-combobox-control>
      ${icon('engineering', 'client-combobox__search-icon')}
      <input id="${escapeAttribute(inputId)}" class="client-combobox__input" type="search" value="${escapeAttribute(selectedLabel)}" placeholder="${escapeAttribute(placeholder)}" autocomplete="off" spellcheck="false" role="combobox" aria-autocomplete="list" aria-haspopup="listbox" aria-controls="${escapeAttribute(listboxId)}" aria-expanded="false" aria-activedescendant="" aria-describedby="${escapeAttribute(`${hintId} ${statusId}`)}" aria-required="${String(required)}" data-mechanic-combobox-input>
      <input type="hidden" name="${escapeAttribute(name)}" value="${escapeAttribute(selectedId)}" data-mechanic-combobox-value>
      <button class="icon-button client-combobox__clear" type="button" aria-label="Limpar mecânico selecionado" title="Limpar mecânico selecionado" data-mechanic-combobox-clear${selectedId ? '' : ' hidden'}>${icon('close')}</button>
    </div>
    <ul id="${escapeAttribute(listboxId)}" class="client-combobox__listbox" role="listbox" aria-label="Resultados da busca de mecânicos" data-mechanic-combobox-listbox hidden></ul>
    <p id="${escapeAttribute(statusId)}" class="client-combobox__status sr-only" aria-live="polite" aria-atomic="true" data-mechanic-combobox-status>${selectedId ? escapeHtml(`${selectedLabel} selecionado.`) : 'Nenhum mecânico selecionado.'}</p>
    <p id="${escapeAttribute(hintId)}" class="field-hint client-combobox__hint">${escapeHtml(hint)}</p>
  </div>`;
}

function searchErrorMessage(error) {
  const message = error?.message ?? error?.mensagem;
  if (Array.isArray(message)) return message.join(' ');
  return message || 'Não foi possível buscar mecânicos. Tente novamente.';
}

function isAbortedRequest(error, signal) {
  return (
    signal?.aborted ||
    error?.name === 'AbortError' ||
    error?.code === 'REQUEST_ABORTED'
  );
}

export function mountMechanicCombobox(
  root,
  {
    api,
    onError,
    onSelect,
    onClear,
    initialSelectedMechanic = null,
    debounceMs = MECHANIC_COMBOBOX_DEFAULTS.debounceMs,
    minChars = MECHANIC_COMBOBOX_DEFAULTS.minChars,
    pageSize = MECHANIC_COMBOBOX_DEFAULTS.pageSize,
    endpoint = MECHANIC_COMBOBOX_DEFAULTS.endpoint,
  } = {},
) {
  const container = root?.matches?.('[data-mechanic-combobox]')
    ? root
    : root?.querySelector?.('[data-mechanic-combobox]');
  if (!container) {
    throw new TypeError('O elemento raiz do combobox de mecânicos não foi encontrado.');
  }
  if (typeof api?.request !== 'function') {
    throw new TypeError('O combobox de mecânicos requer um cliente de API com request().');
  }

  const input = container.querySelector('[data-mechanic-combobox-input]');
  const hiddenInput = container.querySelector('[data-mechanic-combobox-value]');
  const listbox = container.querySelector('[data-mechanic-combobox-listbox]');
  const status = container.querySelector('[data-mechanic-combobox-status]');
  const clearButton = container.querySelector('[data-mechanic-combobox-clear]');
  if (!input || !hiddenInput || !listbox || !status || !clearButton) {
    throw new TypeError('O markup do combobox de mecânicos está incompleto.');
  }

  const baseId = container.dataset.mechanicComboboxId || 'mechanic-combobox';
  const documentRef = container.ownerDocument ?? globalThis.document;
  const listeners = [];
  let mechanics = [];
  let activeIndex = -1;
  let selectedMechanic = null;
  let lastCompletedQuery = null;
  let debounceTimer = null;
  let requestController = null;
  let requestSequence = 0;
  let destroyed = false;

  const listen = (target, type, listener, options) => {
    target?.addEventListener?.(type, listener, options);
    listeners.push({ target, type, listener, options });
  };

  const announce = (message) => {
    status.textContent = message;
  };

  const setExpanded = (expanded) => {
    input.setAttribute('aria-expanded', String(expanded));
    listbox.hidden = !expanded;
    if (!expanded) {
      activeIndex = -1;
      input.setAttribute('aria-activedescendant', '');
    }
  };

  const closePanel = () => setExpanded(false);

  const syncActiveOption = ({ scroll = true } = {}) => {
    const options = [...listbox.querySelectorAll('[data-mechanic-option]')];
    options.forEach((option, index) => {
      option.classList.toggle('is-active', index === activeIndex);
      const mechanicId = domainId(mechanics[index]?.id);
      option.setAttribute('aria-selected', String(mechanicId === hiddenInput.value));
    });
    const activeOption = options[activeIndex];
    input.setAttribute('aria-activedescendant', activeOption?.id ?? '');
    if (scroll) activeOption?.scrollIntoView?.({ block: 'nearest' });
  };

  const setActiveIndex = (index, options) => {
    activeIndex = index;
    syncActiveOption(options);
  };

  const renderState = (kind, message) => {
    mechanics = [];
    activeIndex = -1;
    const loading = kind === 'loading';
    input.toggleAttribute('aria-busy', loading);
    listbox.innerHTML = `<li class="client-combobox__state client-combobox__state--${escapeAttribute(kind)}" role="presentation">${loading ? icon('progress_activity', 'client-combobox__spinner') : icon(kind === 'error' ? 'error' : kind === 'empty' ? 'search_off' : 'info')}<span>${escapeHtml(message)}</span></li>`;
    input.setAttribute('aria-activedescendant', '');
    setExpanded(true);
    announce(message);
  };

  const renderResults = (query) => {
    input.removeAttribute('aria-busy');
    if (!mechanics.length) {
      renderState(
        'empty',
        query
          ? `Nenhum mecânico encontrado para “${query}”.`
          : 'Nenhum mecânico ativo disponível.',
      );
      return;
    }
    activeIndex = -1;
    listbox.innerHTML = renderMechanicComboboxOptions(mechanics, {
      baseId,
      activeIndex,
      selectedId: hiddenInput.value,
    });
    setExpanded(true);
    announce(
      `${mechanics.length} mecânico${mechanics.length === 1 ? '' : 's'} encontrado${mechanics.length === 1 ? '' : 's'}. Use as setas para navegar e Enter para selecionar.`,
    );
  };

  const cancelPendingSearch = () => {
    if (debounceTimer !== null) globalThis.clearTimeout(debounceTimer);
    debounceTimer = null;
    requestSequence += 1;
    requestController?.abort();
    requestController = null;
    input.removeAttribute('aria-busy');
  };

  const runSearch = async (rawQuery) => {
    const query = normalizeMechanicSearchTerm(rawQuery);
    if (destroyed || !shouldSearchMechanics(query, minChars)) return;
    if (debounceTimer !== null) globalThis.clearTimeout(debounceTimer);
    debounceTimer = null;
    requestController?.abort();
    const controller = new AbortController();
    requestController = controller;
    const sequence = ++requestSequence;
    renderState('loading', 'Buscando mecânicos…');

    try {
      const payload = await api.request(endpoint, {
        query: buildMechanicSearchQuery(query, pageSize),
        signal: controller.signal,
      });
      if (destroyed || sequence !== requestSequence) return;
      mechanics = normalizeMechanicResults(payload);
      lastCompletedQuery = query;
      renderResults(query);
    } catch (error) {
      if (
        destroyed ||
        sequence !== requestSequence ||
        isAbortedRequest(error, controller.signal)
      ) {
        return;
      }
      const message = searchErrorMessage(error);
      renderState('error', message);
      onError?.(error);
    } finally {
      if (sequence === requestSequence) requestController = null;
    }
  };

  const scheduleSearch = (query, immediate = false) => {
    if (debounceTimer !== null) globalThis.clearTimeout(debounceTimer);
    debounceTimer = null;
    if (immediate) {
      void runSearch(query);
      return;
    }
    debounceTimer = globalThis.setTimeout(() => {
      debounceTimer = null;
      void runSearch(query);
    }, debounceMs);
  };

  const clearSelection = ({ preserveText = false, emit = true } = {}) => {
    const hadSelection = Boolean(hiddenInput.value);
    selectedMechanic = null;
    hiddenInput.value = '';
    if (!preserveText) input.value = '';
    clearButton.hidden = !preserveText || !input.value;
    if (hadSelection && emit) onClear?.();
  };

  const selectMechanic = (mechanic, { emit = true } = {}) => {
    const id = domainId(mechanic?.id);
    if (!id) return;
    cancelPendingSearch();
    selectedMechanic = mechanic;
    hiddenInput.value = id;
    input.value = mechanicSelectionLabel(mechanic);
    clearButton.hidden = false;
    closePanel();
    announce(`${input.value} selecionado.`);
    if (emit) onSelect?.(mechanic);
  };

  const openCurrentOrSearch = () => {
    if (selectedMechanic || hiddenInput.value) return;
    const query = normalizeMechanicSearchTerm(input.value);
    if (!shouldSearchMechanics(query, minChars)) {
      renderState('idle', `Digite pelo menos ${minChars} caracteres para buscar.`);
      return;
    }
    if (lastCompletedQuery === query && mechanics.length) {
      renderResults(query);
      return;
    }
    scheduleSearch(query, true);
  };

  const handleInput = () => {
    const previousLabel = selectedMechanic
      ? mechanicSelectionLabel(selectedMechanic)
      : hiddenInput.value
        ? input.defaultValue
        : '';
    if (hiddenInput.value && input.value !== previousLabel) {
      clearSelection({ preserveText: true });
    }
    clearButton.hidden = !input.value;
    const query = normalizeMechanicSearchTerm(input.value);
    if (!shouldSearchMechanics(query, minChars)) {
      cancelPendingSearch();
      lastCompletedQuery = null;
      renderState('idle', `Digite pelo menos ${minChars} caracteres para buscar.`);
      return;
    }
    cancelPendingSearch();
    if (query.length > 0) renderState('loading', 'Buscando mecânicos…');
    scheduleSearch(query, query.length === 0);
  };

  const handleKeydown = (event) => {
    if (event.key === 'Escape') {
      if (input.getAttribute('aria-expanded') === 'true') {
        event.preventDefault();
        cancelPendingSearch();
        closePanel();
      }
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      if (activeIndex >= 0 && mechanics[activeIndex]) {
        selectMechanic(mechanics[activeIndex]);
      } else {
        openCurrentOrSearch();
      }
      return;
    }

    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    if (
      ['Home', 'End'].includes(event.key) &&
      input.getAttribute('aria-expanded') !== 'true'
    ) {
      return;
    }
    event.preventDefault();
    if (input.getAttribute('aria-expanded') !== 'true' || !mechanics.length) {
      openCurrentOrSearch();
      return;
    }
    setActiveIndex(moveClientActiveIndex(activeIndex, mechanics.length, event.key));
  };

  const handleOptionClick = (event) => {
    const option = event.target.closest?.('[data-mechanic-option]');
    if (!option) return;
    const index = Number(option.dataset.mechanicIndex);
    if (mechanics[index]) selectMechanic(mechanics[index]);
  };

  const handleOptionPointerDown = (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    const option = event.target.closest?.('[data-mechanic-option]');
    if (!option) return;

    // Keep the search input focused until click performs the selection. Without
    // this guard, focusout can close the list while the pointer is still down,
    // removing the option before the browser dispatches click.
    event.preventDefault();
  };

  const handleOptionHover = (event) => {
    const option = event.target.closest?.('[data-mechanic-option]');
    if (!option) return;
    const index = Number(option.dataset.mechanicIndex);
    if (Number.isInteger(index) && index !== activeIndex) {
      setActiveIndex(index, { scroll: false });
    }
  };

  const handleClear = () => {
    cancelPendingSearch();
    clearSelection();
    announce('Seleção de mecânico removida.');
    input.focus();
    scheduleSearch('', true);
  };

  const handleOutsidePointer = (event) => {
    if (container.contains(event.target)) return;
    cancelPendingSearch();
    closePanel();
  };

  const handleFocusOut = (event) => {
    if (event.relatedTarget && container.contains(event.relatedTarget)) return;
    globalThis.setTimeout(() => {
      if (destroyed || container.contains(documentRef.activeElement)) return;
      closePanel();
    }, 0);
  };

  listen(input, 'focus', openCurrentOrSearch);
  listen(input, 'input', handleInput);
  listen(input, 'keydown', handleKeydown);
  listen(listbox, 'pointerdown', handleOptionPointerDown);
  listen(listbox, 'click', handleOptionClick);
  listen(listbox, 'pointerover', handleOptionHover);
  listen(clearButton, 'click', handleClear);
  listen(container, 'focusout', handleFocusOut);
  listen(documentRef, 'pointerdown', handleOutsidePointer, true);

  if (initialSelectedMechanic) {
    selectMechanic(initialSelectedMechanic, { emit: false });
  }

  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelPendingSearch();
      closePanel();
      listeners.forEach(({ target, type, listener, options }) =>
        target?.removeEventListener?.(type, listener, options),
      );
      listeners.length = 0;
    },
    focus() {
      input.focus();
    },
    close() {
      cancelPendingSearch();
      closePanel();
    },
    clear() {
      cancelPendingSearch();
      clearSelection();
      closePanel();
      announce('Seleção de mecânico removida.');
    },
    setSelected(mechanic) {
      selectMechanic(mechanic);
    },
    get selected() {
      return selectedMechanic;
    },
    get value() {
      return hiddenInput.value;
    },
    get selectedLabel() {
      return hiddenInput.value
        ? mechanicSelectionLabel(selectedMechanic) || input.value
        : '';
    },
  };
}
