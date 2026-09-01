import { ROLES } from '../core/permissions.js';
import { button, escapeAttribute, escapeHtml, icon, initials } from './ui-kit.js';

export const SIDEBAR_PREFERENCE_KEY = 'autogestao.ui.sidebar-collapsed';

function browserStorage() {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readSidebarCollapsed(storage = browserStorage()) {
  try {
    return storage?.getItem(SIDEBAR_PREFERENCE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function writeSidebarCollapsed(collapsed, storage = browserStorage()) {
  try {
    storage?.setItem(SIDEBAR_PREFERENCE_KEY, String(Boolean(collapsed)));
  } catch {
    // A preferência visual não deve bloquear a navegação quando o storage falhar.
  }
}

const NAVIGATION = {
  [ROLES.ADMIN]: [
    { label: 'Visão geral', icon: 'space_dashboard', path: '/inicio' },
    { label: 'Ordens de serviço', icon: 'assignment', path: '/ordens' },
    { label: 'Clientes', icon: 'group', path: '/clientes' },
    { label: 'Veículos', icon: 'directions_car', path: '/veiculos' },
    { label: 'Estoque', icon: 'inventory_2', path: '/estoque' },
    { label: 'Catálogo', icon: 'home_repair_service', path: '/catalogo' },
    { label: 'Usuários', icon: 'manage_accounts', path: '/usuarios' },
    { label: 'Relatórios', icon: 'monitoring', path: '/relatorios' },
  ],
  [ROLES.CONSULTANT]: [
    { label: 'Visão geral', icon: 'space_dashboard', path: '/inicio' },
    { label: 'Ordens de serviço', icon: 'assignment', path: '/ordens' },
    { label: 'Clientes', icon: 'group', path: '/clientes' },
    { label: 'Veículos', icon: 'directions_car', path: '/veiculos' },
    { label: 'Catálogo', icon: 'home_repair_service', path: '/catalogo' },
    { label: 'Relatórios', icon: 'monitoring', path: '/relatorios' },
  ],
  [ROLES.MECHANIC]: [
    { label: 'Meu trabalho', icon: 'space_dashboard', path: '/meu-trabalho' },
    { label: 'Minhas ordens', icon: 'assignment', path: '/ordens' },
    { label: 'Estoque', icon: 'inventory_2', path: '/estoque' },
    { label: 'Catálogo', icon: 'home_repair_service', path: '/catalogo' },
  ],
  [ROLES.CLIENT]: [
    { label: 'Início', icon: 'home', path: '/inicio' },
    { label: 'Minhas ordens', icon: 'assignment', path: '/ordens' },
  ],
};

const ROLE_LABELS = {
  [ROLES.ADMIN]: 'Administrador',
  [ROLES.CONSULTANT]: 'Consultor técnico',
  [ROLES.MECHANIC]: 'Mecânico',
  [ROLES.CLIENT]: 'Cliente',
};

function isActive(path, itemPath) {
  if (itemPath === '/inicio') return path === itemPath;
  return path === itemPath || path.startsWith(`${itemPath}/`);
}

function brand() {
  return `<a class="brand" href="#/inicio" aria-label="AutoGestão Pro — página inicial">
    <span class="brand-mark" aria-hidden="true">${icon('speed')}</span>
    <span class="brand-copy"><strong>AutoGestão</strong><small>PRO</small></span>
  </a>`;
}

function navMarkup(role, path, mobile = false) {
  const items = NAVIGATION[role] ?? [];
  return items.map((item) => {
    const active = isActive(path, item.path);
    return `<a class="nav-item${active ? ' nav-item-active' : ''}" href="#${item.path}"${active ? ' aria-current="page"' : ''} aria-label="${escapeAttribute(item.label)}" title="${escapeAttribute(item.label)}">
      ${icon(item.icon, 'nav-icon')}<span>${escapeHtml(item.label)}</span>${active && !mobile ? '<i aria-hidden="true"></i>' : ''}
    </a>`;
  }).join('');
}

export function pageHeader({ eyebrow, title, description, actions = '', backHref = '' }) {
  return `<header class="page-header">
    <div class="page-title-group">
      ${backHref ? `<a class="back-link" href="#${escapeAttribute(backHref)}">${icon('arrow_back')}<span>Voltar</span></a>` : ''}
      ${eyebrow ? `<p class="eyebrow">${escapeHtml(eyebrow)}</p>` : ''}
      <h1>${escapeHtml(title)}</h1>
      ${description ? `<p class="page-description">${escapeHtml(description)}</p>` : ''}
    </div>
    ${actions ? `<div class="page-actions">${actions}</div>` : ''}
  </header>`;
}

export function renderAppShell({
  role,
  path,
  user = {},
  content,
  connection = 'online',
  sidebarCollapsed = false,
}) {
  const displayName = user.name ?? user.nome ?? user.email ?? ROLE_LABELS[role] ?? 'Usuário';
  const roleLabel = ROLE_LABELS[role] ?? role ?? 'Acesso restrito';
  const client = role === ROLES.CLIENT;
  const collapseLabel = sidebarCollapsed ? 'Expandir menu' : 'Recolher menu';
  const collapseIcon = sidebarCollapsed ? 'left_panel_open' : 'left_panel_close';
  return `<a class="skip-link" href="#main-content">Ir para o conteúdo principal</a>
    <div class="app-shell${client ? ' app-shell-client' : ''}${sidebarCollapsed ? ' sidebar-collapsed' : ''}">
      <aside class="sidebar" id="app-sidebar" aria-label="Navegação principal">
        <div class="sidebar-brand">
          ${brand()}
          <div class="sidebar-controls">
            <button class="icon-button sidebar-collapse" type="button" data-action="toggle-sidebar-size" aria-label="${collapseLabel}" title="${collapseLabel}" aria-controls="app-sidebar" aria-expanded="${String(!sidebarCollapsed)}">${icon(collapseIcon)}</button>
            <button class="icon-button sidebar-close" type="button" data-action="close-drawer" aria-label="Fechar menu" title="Fechar menu" aria-controls="app-sidebar">${icon('close')}</button>
          </div>
        </div>
        <nav class="sidebar-nav">${navMarkup(role, path)}</nav>
        <div class="sidebar-footer">
          <div class="user-card" aria-label="${escapeAttribute(`${displayName}, ${roleLabel}`)}" title="${escapeAttribute(`${displayName} — ${roleLabel}`)}"><span class="avatar">${escapeHtml(initials(displayName))}</span><span class="user-copy"><strong>${escapeHtml(displayName)}</strong><small>${escapeHtml(roleLabel)}</small></span></div>
          <button class="nav-item nav-logout" type="button" data-action="logout" aria-label="Sair" title="Sair">${icon('logout', 'nav-icon')}<span>Sair</span></button>
        </div>
      </aside>
      <div class="drawer-backdrop" data-action="close-drawer" aria-hidden="true"></div>
      <div class="app-main-column">
        <header class="topbar">
          <button class="icon-button menu-button" type="button" data-action="open-drawer" aria-label="Abrir menu" aria-controls="app-sidebar" aria-expanded="false">${icon('menu')}</button>
          <div class="topbar-brand">${brand()}</div>
          <div class="topbar-context"><span class="connection-indicator connection-${escapeAttribute(connection)}"><i aria-hidden="true"></i><span>${connection === 'online' ? 'Sistema disponível' : 'Conexão instável'}</span></span></div>
          <div class="topbar-user"><span class="avatar">${escapeHtml(initials(displayName))}</span><span><strong>${escapeHtml(displayName)}</strong><small>${escapeHtml(roleLabel)}</small></span></div>
        </header>
        <main class="page-container" id="main-content" tabindex="-1">${content}</main>
      </div>
      ${client ? `<nav class="bottom-nav" aria-label="Navegação do cliente">${navMarkup(role, path, true)}<button class="nav-item" type="button" data-action="logout">${icon('logout')}<span>Sair</span></button></nav>` : ''}
    </div>
    <div class="toast-stack" id="toast-stack" aria-live="polite" aria-atomic="false"></div>
    <div class="modal-root" id="modal-root"></div>`;
}

export function mountShellInteractions(root, { onLogout, storage = browserStorage() } = {}) {
  if (!root) return () => {};
  const sidebar = root.querySelector('#app-sidebar');
  const menuButton = root.querySelector('[data-action="open-drawer"]');
  const collapseButton = root.querySelector('[data-action="toggle-sidebar-size"]');
  const mainColumn = root.querySelector('.app-main-column');
  const desktopMedia = typeof window === 'undefined' || typeof window.matchMedia !== 'function'
    ? null
    : window.matchMedia('(min-width: 64rem)');
  let previousFocus = null;

  document.body.classList.remove('sidebar-compact');

  const updateCollapseControl = (collapsed) => {
    root.classList.toggle('sidebar-collapsed', collapsed);
    collapseButton?.setAttribute('aria-expanded', String(!collapsed));
    collapseButton?.setAttribute('aria-label', collapsed ? 'Expandir menu' : 'Recolher menu');
    collapseButton?.setAttribute('title', collapsed ? 'Expandir menu' : 'Recolher menu');
    const collapseIcon = collapseButton?.querySelector('.material-symbols-rounded');
    if (collapseIcon) collapseIcon.textContent = collapsed ? 'left_panel_open' : 'left_panel_close';
  };

  const setSidebarCollapsed = (collapsed) => {
    updateCollapseControl(Boolean(collapsed));
    writeSidebarCollapsed(Boolean(collapsed), storage);
  };

  const openDrawer = () => {
    previousFocus = document.activeElement;
    document.body.classList.add('drawer-open');
    root.classList.add('drawer-open');
    sidebar?.classList.add('is-open');
    menuButton?.setAttribute('aria-expanded', 'true');
    if (mainColumn) mainColumn.inert = true;
    sidebar?.querySelector('[data-action="close-drawer"], a, button')?.focus();
  };

  const closeDrawer = ({ restoreFocus = true } = {}) => {
    document.body.classList.remove('drawer-open');
    root.classList.remove('drawer-open');
    sidebar?.classList.remove('is-open');
    menuButton?.setAttribute('aria-expanded', 'false');
    if (mainColumn) mainColumn.inert = false;
    if (restoreFocus) previousFocus?.focus?.();
  };

  const handleClick = (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'open-drawer') openDrawer();
    if (action === 'close-drawer') closeDrawer();
    if (action === 'toggle-sidebar-size') {
      setSidebarCollapsed(!root.classList.contains('sidebar-collapsed'));
    }
    if (action === 'logout') {
      closeDrawer({ restoreFocus: false });
      onLogout?.();
    }
    if (event.target.closest('.sidebar-nav a')) closeDrawer({ restoreFocus: false });
  };

  const handleKeydown = (event) => {
    if (event.key === 'Escape' && sidebar?.classList.contains('is-open')) closeDrawer();
    if (event.key !== 'Tab' || !sidebar?.classList.contains('is-open')) return;
    const focusable = [...sidebar.querySelectorAll('a[href], button:not([disabled])')];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const handleViewportChange = (event) => {
    if (event.matches) closeDrawer({ restoreFocus: false });
  };

  updateCollapseControl(root.classList.contains('sidebar-collapsed'));
  root.addEventListener('click', handleClick);
  root.addEventListener('keydown', handleKeydown);
  desktopMedia?.addEventListener?.('change', handleViewportChange);

  return () => {
    root.removeEventListener('click', handleClick);
    root.removeEventListener('keydown', handleKeydown);
    desktopMedia?.removeEventListener?.('change', handleViewportChange);
    closeDrawer({ restoreFocus: false });
  };
}

export function renderAccessDenied() {
  return `<section class="state-panel state-forbidden" role="alert">${icon('lock')}<p class="eyebrow">Acesso restrito</p><h1>Você não tem permissão para esta área</h1><p>Seu perfil não autoriza esta operação. Volte para uma área disponível no menu.</p>${button({ label: 'Voltar ao início', iconName: 'home', variant: 'primary', href: '#/inicio' })}</section>`;
}

export function renderNotFound() {
  return `<section class="state-panel state-not-found">${icon('search_off')}<p class="eyebrow">Erro 404</p><h1>Página não encontrada</h1><p>O endereço pode estar incorreto ou esta tela não está disponível para seu perfil.</p>${button({ label: 'Ir para o início', iconName: 'home', variant: 'primary', href: '#/inicio' })}</section>`;
}
