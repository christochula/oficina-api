import { formatDocument, formatPhone } from '../core/formatters.js';
import {
  domainId,
  escapeAttribute,
  escapeHtml,
  icon,
} from './ui-kit.js';

export const CLIENT_COMBOBOX_DEFAULTS = Object.freeze({
  debounceMs: 250,
  minChars: 2,
  pageSize: 10,
  endpoint: '/clientes',
});

function safeDomId(value, fallback = 'client-combobox') {
  const normalized = String(value ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-');
  return normalized || fallback;
}

export function normalizeClientSearchTerm(value) {
  return String(value ?? '').trim();
}

export function shouldSearchClients(
  value,
  minChars = CLIENT_COMBOBOX_DEFAULTS.minChars,
) {
  const term = normalizeClientSearchTerm(value);
  return term.length === 0 || term.length >= minChars;
}

export function buildClientSearchQuery(
  value,
  pageSize = CLIENT_COMBOBOX_DEFAULTS.pageSize,
) {
  const term = normalizeClientSearchTerm(value);
  return {
    pagina: 1,
    porPagina: pageSize,
    ativo: true,
    ...(term ? { busca: term } : {}),
  };
}

export function clientSelectionLabel(client) {
  if (!client) return '';
  const name = String(client.nome ?? '').trim() || 'Cliente sem nome';
  const document = formatClientDocument(client);
  return document ? `${name} · ${document}` : name;
}

function formatClientDocument(client) {
  const rawDocument = String(client?.numeroDoc ?? '').trim();
  if (/[a-z]/i.test(rawDocument)) return rawDocument.toUpperCase();
  return formatDocument(rawDocument, client?.tipoDoc);
}

function clientOptionDetails(client) {
  const id = domainId(client?.id);
  const document = formatClientDocument(client);
  const phone = formatPhone(client?.telefone) || String(client?.telefone ?? '').trim();
  return [
    id ? `ID: ${id}` : '',
    document ? `${client?.tipoDoc || 'Documento'} ${document}` : '',
    String(client?.email ?? '').trim(),
    phone,
  ].filter(Boolean);
}

export function normalizeClientResults(payload) {
  const data = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.itens)
        ? payload.itens
        : [];
  return data.filter((client) => client?.ativo !== false && domainId(client?.id));
}

export function moveClientActiveIndex(current, count, key) {
  if (!count) return -1;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  if (key === 'ArrowDown') return current < 0 || current >= count - 1 ? 0 : current + 1;
  if (key === 'ArrowUp') return current <= 0 ? count - 1 : current - 1;
  return current;
}

function optionDomId(baseId, index) {
  return `${safeDomId(baseId)}-option-${index}`;
}

export function renderClientComboboxOptions(
  clients,
  { baseId = 'client-combobox', activeIndex = -1, selectedId = '' } = {},
) {
  return clients
    .map((client, index) => {
      const id = domainId(client?.id);
      const active = index === activeIndex;
      const selected = Boolean(selectedId && selectedId === id);
      const name = String(client?.nome ?? '').trim() || 'Cliente sem nome';
      const details = clientOptionDetails(client);
      const initials = name
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part.charAt(0))
        .join('')
        .toUpperCase();
      return `<li id="${escapeAttribute(optionDomId(baseId, index))}" class="client-combobox__option${active ? ' is-active' : ''}${selected ? ' is-selected' : ''}" role="option" aria-selected="${String(selected)}" aria-posinset="${index + 1}" aria-setsize="${clients.length}" data-client-option data-client-index="${index}">
        <span class="client-combobox__avatar" aria-hidden="true">${escapeHtml(initials || 'C')}</span>
        <span class="client-combobox__identity"><strong>${escapeHtml(name)}</strong>${details.map((detail) => `<small>${escapeHtml(detail)}</small>`).join('')}</span>
        ${icon(selected ? 'check_circle' : 'chevron_right', 'client-combobox__meta')}
      </li>`;
    })
    .join('');
}

export function renderClientComboboxField({
  id = 'client-combobox',
  name = 'clienteId',
  label = 'Cliente',
  placeholder = 'Busque por nome, CPF/CNPJ, e-mail ou telefone',
  hint = 'Digite ao menos 2 caracteres. Com o campo vazio, os primeiros 10 clientes ativos serão exibidos.',
  required = true,
  selectedClient = null,
} = {}) {
  const baseId = safeDomId(id);
  const inputId = `${baseId}-input`;
  const listboxId = `${baseId}-listbox`;
  const hintId = `${baseId}-hint`;
  const statusId = `${baseId}-status`;
  const selectedId = domainId(selectedClient?.id);
  const selectedLabel = clientSelectionLabel(selectedClient);

  return `<div class="form-group client-combobox" data-client-combobox data-client-combobox-id="${escapeAttribute(baseId)}">
    <label for="${escapeAttribute(inputId)}">${escapeHtml(label)}${required ? ' <span aria-hidden="true">*</span>' : ''}</label>
    <div class="client-combobox__control" data-client-combobox-control>
      ${icon('search', 'client-combobox__search-icon')}
      <input id="${escapeAttribute(inputId)}" class="client-combobox__input" type="search" value="${escapeAttribute(selectedLabel)}" placeholder="${escapeAttribute(placeholder)}" autocomplete="off" spellcheck="false" role="combobox" aria-autocomplete="list" aria-haspopup="listbox" aria-controls="${escapeAttribute(listboxId)}" aria-expanded="false" aria-activedescendant="" aria-describedby="${escapeAttribute(`${hintId} ${statusId}`)}" aria-required="${String(required)}" data-client-combobox-input>
      <input type="hidden" name="${escapeAttribute(name)}" value="${escapeAttribute(selectedId)}" data-client-combobox-value>
      <button class="icon-button client-combobox__clear" type="button" aria-label="Limpar cliente selecionado" title="Limpar cliente selecionado" data-client-combobox-clear${selectedId ? '' : ' hidden'}>${icon('close')}</button>
    </div>
    <ul id="${escapeAttribute(listboxId)}" class="client-combobox__listbox" role="listbox" aria-label="Resultados da busca de clientes" data-client-combobox-listbox hidden></ul>
    <p id="${escapeAttribute(statusId)}" class="client-combobox__status sr-only" aria-live="polite" aria-atomic="true" data-client-combobox-status>${selectedId ? escapeHtml(`${selectedLabel} selecionado.`) : 'Nenhum cliente selecionado.'}</p>
    <p id="${escapeAttribute(hintId)}" class="field-hint client-combobox__hint">${escapeHtml(hint)}</p>
  </div>`;
}

function errorMessage(error) {
  const message = error?.message ?? error?.mensagem;
  if (Array.isArray(message)) return message.join(' ');
  return message || 'Não foi possível buscar clientes. Tente novamente.';
}

function isAbortedRequest(error, signal) {
  return (
    signal?.aborted ||
    error?.name === 'AbortError' ||
    error?.code === 'REQUEST_ABORTED'
  );
}

export function mountClientCombobox(
  root,
  {
    api,
    onError,
    onSelect,
    onClear,
    initialSelectedClient = null,
    debounceMs = CLIENT_COMBOBOX_DEFAULTS.debounceMs,
    minChars = CLIENT_COMBOBOX_DEFAULTS.minChars,
    pageSize = CLIENT_COMBOBOX_DEFAULTS.pageSize,
    endpoint = CLIENT_COMBOBOX_DEFAULTS.endpoint,
  } = {},
) {
  const container = root?.matches?.('[data-client-combobox]')
    ? root
    : root?.querySelector?.('[data-client-combobox]');
  if (!container) throw new TypeError('O elemento raiz do combobox de clientes não foi encontrado.');
  if (typeof api?.request !== 'function') {
    throw new TypeError('O combobox de clientes requer um cliente de API com request().');
  }

  const input = container.querySelector('[data-client-combobox-input]');
  const hiddenInput = container.querySelector('[data-client-combobox-value]');
  const listbox = container.querySelector('[data-client-combobox-listbox]');
  const status = container.querySelector('[data-client-combobox-status]');
  const clearButton = container.querySelector('[data-client-combobox-clear]');
  if (!input || !hiddenInput || !listbox || !status || !clearButton) {
    throw new TypeError('O markup do combobox de clientes está incompleto.');
  }

  const baseId = container.dataset.clientComboboxId || 'client-combobox';
  const documentRef = container.ownerDocument ?? globalThis.document;
  const listeners = [];
  let clients = [];
  let activeIndex = -1;
  let selectedClient = null;
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
    const options = [...listbox.querySelectorAll('[data-client-option]')];
    options.forEach((option, index) => {
      const active = index === activeIndex;
      option.classList.toggle('is-active', active);
      option.setAttribute('aria-selected', String(active));
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
    clients = [];
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
    if (!clients.length) {
      renderState(
        'empty',
        query
          ? `Nenhum cliente encontrado para “${query}”.`
          : 'Nenhum cliente ativo disponível.',
      );
      return;
    }
    activeIndex = -1;
    listbox.innerHTML = renderClientComboboxOptions(clients, {
      baseId,
      activeIndex,
      selectedId: hiddenInput.value,
    });
    setExpanded(true);
    announce(
      `${clients.length} cliente${clients.length === 1 ? '' : 's'} encontrado${clients.length === 1 ? '' : 's'}. Use as setas para navegar e Enter para selecionar.`,
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
    const query = normalizeClientSearchTerm(rawQuery);
    if (destroyed || !shouldSearchClients(query, minChars)) return;
    if (debounceTimer !== null) globalThis.clearTimeout(debounceTimer);
    debounceTimer = null;
    requestController?.abort();
    const controller = new AbortController();
    requestController = controller;
    const sequence = ++requestSequence;
    renderState('loading', 'Buscando clientes…');

    try {
      const payload = await api.request(endpoint, {
        query: buildClientSearchQuery(query, pageSize),
        signal: controller.signal,
      });
      if (destroyed || sequence !== requestSequence) return;
      clients = normalizeClientResults(payload);
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
      const message = errorMessage(error);
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
    selectedClient = null;
    hiddenInput.value = '';
    if (!preserveText) input.value = '';
    clearButton.hidden = !preserveText || !input.value;
    if (hadSelection && emit) onClear?.();
  };

  const selectClient = (client, { emit = true } = {}) => {
    const id = domainId(client?.id);
    if (!id) return;
    cancelPendingSearch();
    selectedClient = client;
    hiddenInput.value = id;
    input.value = clientSelectionLabel(client);
    clearButton.hidden = false;
    closePanel();
    announce(`${input.value} selecionado.`);
    if (emit) onSelect?.(client);
  };

  const openCurrentOrSearch = () => {
    if (selectedClient || hiddenInput.value) return;
    const query = normalizeClientSearchTerm(input.value);
    if (!shouldSearchClients(query, minChars)) {
      renderState('idle', `Digite pelo menos ${minChars} caracteres para buscar.`);
      return;
    }
    if (lastCompletedQuery === query && clients.length) {
      renderResults(query);
      return;
    }
    scheduleSearch(query, true);
  };

  const handleInput = () => {
    const previousLabel = selectedClient
      ? clientSelectionLabel(selectedClient)
      : hiddenInput.value
        ? input.defaultValue
        : '';
    if (hiddenInput.value && input.value !== previousLabel) {
      clearSelection({ preserveText: true });
    }
    clearButton.hidden = !input.value;
    const query = normalizeClientSearchTerm(input.value);
    if (!shouldSearchClients(query, minChars)) {
      cancelPendingSearch();
      lastCompletedQuery = null;
      renderState('idle', `Digite pelo menos ${minChars} caracteres para buscar.`);
      return;
    }
    cancelPendingSearch();
    if (query.length > 0) {
      renderState('loading', 'Buscando clientes...');
    }
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
      if (activeIndex >= 0 && clients[activeIndex]) {
        selectClient(clients[activeIndex]);
      } else {
        openCurrentOrSearch();
      }
      return;
    }

    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    if (['Home', 'End'].includes(event.key) && input.getAttribute('aria-expanded') !== 'true') {
      return;
    }
    event.preventDefault();
    if (input.getAttribute('aria-expanded') !== 'true' || !clients.length) {
      openCurrentOrSearch();
      return;
    }
    setActiveIndex(moveClientActiveIndex(activeIndex, clients.length, event.key));
  };

  const handleOptionClick = (event) => {
    const option = event.target.closest?.('[data-client-option]');
    if (!option) return;
    const index = Number(option.dataset.clientIndex);
    if (clients[index]) selectClient(clients[index]);
  };

  const handleOptionPointerDown = (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    const option = event.target.closest?.('[data-client-option]');
    if (!option) return;

    // Keep the search input focused until click performs the selection. Without
    // this guard, focusout can close the list while the pointer is still down,
    // removing the option before the browser dispatches click.
    event.preventDefault();
  };

  const handleOptionHover = (event) => {
    const option = event.target.closest?.('[data-client-option]');
    if (!option) return;
    const index = Number(option.dataset.clientIndex);
    if (Number.isInteger(index) && index !== activeIndex) {
      setActiveIndex(index, { scroll: false });
    }
  };

  const handleClear = () => {
    cancelPendingSearch();
    clearSelection();
    announce('Seleção de cliente removida.');
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

  if (initialSelectedClient) selectClient(initialSelectedClient, { emit: false });

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
      announce('Seleção de cliente removida.');
    },
    setSelected(client) {
      selectClient(client);
    },
    get selected() {
      return selectedClient;
    },
    get value() {
      return hiddenInput.value;
    },
    get selectedLabel() {
      return hiddenInput.value
        ? clientSelectionLabel(selectedClient) || input.value
        : '';
    },
  };
}
