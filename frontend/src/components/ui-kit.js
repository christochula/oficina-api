export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function escapeAttribute(value) {
  return escapeHtml(value).replaceAll('`', '&#096;');
}

export function icon(name, className = '') {
  return `<span class="material-symbols-rounded ${escapeAttribute(className)}" aria-hidden="true">${escapeHtml(name)}</span>`;
}

export function domainId(value) {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (value && typeof value === 'object') {
    return String(value.valor ?? value.value ?? value.id ?? '');
  }
  return '';
}

export function initials(name = '') {
  return String(name).trim().split(/\s+/).slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '').join('') || 'AG';
}

export function button({
  label,
  iconName,
  variant = 'secondary',
  type = 'button',
  action,
  href,
  disabled = false,
  className = '',
  ariaLabel,
  attributes = '',
}) {
  const content = `${iconName ? icon(iconName, 'button-icon') : ''}<span>${escapeHtml(label)}</span>`;
  const classes = `interactive-button button-${variant} ${className}`.trim();
  const common = `class="${escapeAttribute(classes)}"${ariaLabel ? ` aria-label="${escapeAttribute(ariaLabel)}"` : ''}${disabled ? ' disabled aria-disabled="true"' : ''}${action ? ` data-action="${escapeAttribute(action)}"` : ''} ${attributes}`;
  if (href && !disabled) return `<a href="${escapeAttribute(href)}" ${common}>${content}</a>`;
  return `<button type="${escapeAttribute(type)}" ${common}>${content}</button>`;
}

export function statusBadge(status, meta = {}) {
  const normalized = String(status || 'DESCONHECIDO').toUpperCase();
  const label = meta.label ?? normalized.replaceAll('_', ' ').toLowerCase();
  const iconName = meta.icon ?? 'circle';
  return `<span class="status-badge status-${escapeAttribute(normalized.toLowerCase().replaceAll('_', '-'))}" title="Status: ${escapeAttribute(label)}">${icon(iconName)}<span>${escapeHtml(label)}</span></span>`;
}

export function statePanel({
  kind = 'empty',
  title,
  description,
  iconName,
  actionLabel,
  action = 'retry',
  correlationId,
}) {
  const icons = {
    empty: 'inventory_2', filtered: 'filter_alt_off', error: 'cloud_off',
    forbidden: 'lock', notFound: 'search_off', offline: 'signal_disconnected', success: 'check_circle',
  };
  return `<section class="state-panel state-${escapeAttribute(kind)}" role="${kind === 'error' ? 'alert' : 'status'}">
    <div class="state-icon">${icon(iconName ?? icons[kind] ?? 'info')}</div>
    <h2>${escapeHtml(title)}</h2>
    <p>${escapeHtml(description)}</p>
    ${correlationId ? `<p class="correlation-id">Código de suporte: <code>${escapeHtml(correlationId)}</code></p>` : ''}
    ${actionLabel ? button({ label: actionLabel, iconName: 'refresh', variant: 'secondary', action }) : ''}
  </section>`;
}

export function skeleton({ rows = 5, cards = 0, label = 'Carregando conteúdo' } = {}) {
  const cardsHtml = Array.from({ length: cards }, () => '<div class="skeleton skeleton-card"></div>').join('');
  const rowsHtml = Array.from({ length: rows }, (_, index) => `<div class="skeleton skeleton-row" style="--skeleton-index:${index}"></div>`).join('');
  return `<div class="skeleton-stack" role="status" aria-live="polite" aria-label="${escapeAttribute(label)}"><span class="sr-only">${escapeHtml(label)}</span>${cardsHtml}${rowsHtml}</div>`;
}

export function fieldError(id, message) {
  return message ? `<p class="field-error" id="${escapeAttribute(id)}-error" role="alert">${icon('error')} ${escapeHtml(message)}</p>` : '';
}

export function pagination(meta = {}, actionPrefix = 'page') {
  const page = Number(meta.pagina ?? 1);
  const totalPages = Math.max(1, Number(meta.totalPaginas ?? 1));
  const total = Number(meta.total ?? 0);
  return `<nav class="pagination" aria-label="Paginação">
    ${button({ label: 'Anterior', iconName: 'chevron_left', variant: 'ghost', action: `${actionPrefix}:previous`, disabled: page <= 1 })}
    <span aria-live="polite">Página <strong>${page}</strong> de ${totalPages} <small>(${total} registros)</small></span>
    ${button({ label: 'Próxima', iconName: 'chevron_right', variant: 'ghost', action: `${actionPrefix}:next`, disabled: page >= totalPages, className: 'icon-end' })}
  </nav>`;
}

export function setButtonBusy(element, busy, busyLabel = 'Processando…') {
  if (!(element instanceof HTMLElement)) return;
  if (busy) {
    element.dataset.originalHtml = element.innerHTML;
    element.style.minWidth = `${element.getBoundingClientRect().width}px`;
    element.setAttribute('aria-busy', 'true');
    if ('disabled' in element) element.disabled = true;
    element.innerHTML = `${icon('progress_activity', 'spin')}<span>${escapeHtml(busyLabel)}</span>`;
  } else {
    element.removeAttribute('aria-busy');
    if ('disabled' in element) element.disabled = false;
    if (element.dataset.originalHtml) element.innerHTML = element.dataset.originalHtml;
    element.style.minWidth = '';
    delete element.dataset.originalHtml;
  }
}

let toastSequence = 0;

export function showToast({ title, message = '', kind = 'success', duration = 5000 }) {
  const stack = document.querySelector('#toast-stack');
  if (!stack) return;
  const id = `toast-${++toastSequence}`;
  const symbols = { success: 'check_circle', error: 'error', warning: 'warning', info: 'info' };
  const element = document.createElement('article');
  element.className = `toast toast-${kind}`;
  element.id = id;
  element.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  element.innerHTML = `<div class="toast-icon">${icon(symbols[kind] ?? 'info')}</div><div><strong>${escapeHtml(title)}</strong>${message ? `<p>${escapeHtml(message)}</p>` : ''}</div><button class="icon-button" type="button" data-dismiss-toast aria-label="Fechar aviso">${icon('close')}</button>`;
  stack.append(element);
  requestAnimationFrame(() => element.classList.add('is-visible'));
  const close = () => {
    element.classList.remove('is-visible');
    globalThis.setTimeout(() => element.remove(), 220);
  };
  element.querySelector('[data-dismiss-toast]')?.addEventListener('click', close);
  if (duration > 0) globalThis.setTimeout(close, duration);
}

export function openModal({ title, content, actions = '', size = 'medium', destructive = false }) {
  const root = document.querySelector('#modal-root');
  if (!root) return null;
  const activeBefore = document.activeElement;
  root.innerHTML = `<div class="modal-backdrop" data-modal-close>
    <section class="modal modal-${escapeAttribute(size)}${destructive ? ' modal-destructive' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title" data-modal-panel>
      <header class="modal-header"><div><p class="eyebrow">AutoGestão Pro</p><h2 id="modal-title">${escapeHtml(title)}</h2></div><button class="icon-button" type="button" data-modal-close aria-label="Fechar janela">${icon('close')}</button></header>
      <div class="modal-body">${content}</div>
      ${actions ? `<footer class="modal-actions">${actions}</footer>` : ''}
    </section>
  </div>`;
  root.classList.add('is-open');
  document.body.classList.add('modal-open');
  const panel = root.querySelector('[data-modal-panel]');
  const closeListeners = new Set();
  let closed = false;
  const focusables = () => [...panel.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')];
  const close = () => {
    if (closed) return;
    closed = true;
    root.removeEventListener('keydown', handleKeydown);
    root.classList.remove('is-open');
    root.innerHTML = '';
    document.body.classList.remove('modal-open');
    activeBefore?.focus?.();
    closeListeners.forEach((listener) => listener());
    closeListeners.clear();
  };
  function handleKeydown(event) {
    if (event.key === 'Escape' && !event.defaultPrevented) close();
    if (event.key !== 'Tab') return;
    const items = focusables();
    if (!items.length) return;
    const first = items[0];
    const last = items.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  }
  root.addEventListener('keydown', handleKeydown);
  root.querySelectorAll('[data-modal-close]').forEach((item) => item.addEventListener('click', (event) => {
    if (event.target.closest('[data-modal-panel]') && !event.target.closest('button[data-modal-close]')) return;
    close();
  }));
  focusables()[0]?.focus();
  return {
    root,
    panel,
    close,
    onClose(listener) {
      if (typeof listener !== 'function') return () => {};
      if (closed) {
        listener();
        return () => {};
      }
      closeListeners.add(listener);
      return () => closeListeners.delete(listener);
    },
  };
}

export function confirmAction({ title, message, confirmLabel, tone = 'danger', detail = '' }) {
  return new Promise((resolve) => {
    const modal = openModal({
      title,
      destructive: tone === 'danger',
      content: `<div class="confirmation-copy">${icon(tone === 'danger' ? 'warning' : 'help')}<div><p>${escapeHtml(message)}</p>${detail ? `<small>${escapeHtml(detail)}</small>` : ''}</div></div>`,
      actions: `${button({ label: 'Cancelar', variant: 'ghost', action: 'modal-cancel' })}${button({ label: confirmLabel, iconName: tone === 'danger' ? 'warning' : 'check', variant: tone === 'danger' ? 'danger' : 'primary', action: 'modal-confirm' })}`,
    });
    if (!modal) return resolve(false);
    modal.root.querySelector('[data-action="modal-cancel"]')?.addEventListener('click', () => { modal.close(); resolve(false); });
    modal.root.querySelector('[data-action="modal-confirm"]')?.addEventListener('click', () => { modal.close(); resolve(true); });
  });
}

export function installRipple(root = document) {
  root.addEventListener('pointerdown', (event) => {
    if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const target = event.target.closest('.interactive-button:not([disabled]), .interactive-card[href], button.nav-item');
    if (!target) return;
    const bounds = target.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'click-ripple';
    ripple.style.left = `${event.clientX - bounds.left}px`;
    ripple.style.top = `${event.clientY - bounds.top}px`;
    target.append(ripple);
    ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
  });
}

export function installTabs(root = document) {
  root.addEventListener('keydown', (event) => {
    const tab = event.target.closest('[role="tab"]');
    if (!tab || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const tabs = [...tab.closest('[role="tablist"]').querySelectorAll('[role="tab"]:not([disabled])')];
    const current = tabs.indexOf(tab);
    let next = current;
    if (event.key === 'ArrowRight') next = (current + 1) % tabs.length;
    if (event.key === 'ArrowLeft') next = (current - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    event.preventDefault();
    tabs[next]?.focus(); tabs[next]?.click();
  });
}
