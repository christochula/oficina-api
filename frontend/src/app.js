import '@fontsource-variable/inter';
import '@fontsource-variable/manrope';
import 'material-symbols/rounded.css';
import './styles.css';
import './app-overrides.css';

import { loginClient, loginOperator, logoutCurrentSession } from './api/auth.js';
import { sessionStore } from './core/session.js';
import { createHashRouter } from './core/router.js';
import { ROLES } from './core/permissions.js';
import { domainApi } from './services/domain-api.js';
import {
  installRipple,
  installTabs,
  showToast,
  statePanel,
} from './components/ui-kit.js';
import {
  mountShellInteractions,
  readSidebarCollapsed,
  renderAccessDenied,
  renderAppShell,
  renderNotFound,
} from './components/shell.js';
import { mountLoginView, renderLoginView } from './views/auth.js';
import {
  mountNewOrderView,
  mountOrderDetailView,
  mountOrdersListView,
  renderNewOrderView,
  renderOrderDetailView,
  renderOrdersListView,
} from './views/orders.js';
import { mountResourcesView, renderResourcesView } from './views/resources.js';
import { mountDashboardView, renderDashboardView } from './views/dashboard.js';
import { mountReportsView, renderReportsView } from './views/reports.js';

const appRoot = document.querySelector('#app');
const ALL_ROLES = new Set(Object.values(ROLES));
const INTERNAL_MANAGEMENT = new Set([ROLES.ADMIN, ROLES.CONSULTANT]);
const REPORT_ROLES = new Set([ROLES.ADMIN, ROLES.CONSULTANT]);
let cleanupFunctions = [];
let router;

function cleanupCurrentView() {
  cleanupFunctions.forEach((cleanup) => {
    try { cleanup?.(); } catch { /* A desmontagem nunca deve bloquear a navegação. */ }
  });
  cleanupFunctions = [];
}

function registerCleanup(candidate) {
  if (typeof candidate === 'function') cleanupFunctions.push(candidate);
}

function notify(payload) {
  showToast({
    kind: payload?.kind ?? 'info',
    title: payload?.title ?? 'AutoGestão Pro',
    message: payload?.message ?? '',
    duration: payload?.duration,
  });
}

function currentSession() {
  return sessionStore.get();
}

function guardAuthenticated({ path }) {
  const session = currentSession();
  if (!session) return '/login';
  if (!ALL_ROLES.has(session.role)) return '/acesso-negado';
  if (path === '/login') return session.role === ROLES.MECHANIC ? '/meu-trabalho' : '/inicio';
  return true;
}

function guardRoles(roles) {
  return (context) => {
    const authResult = guardAuthenticated(context);
    if (authResult !== true) return authResult;
    return roles.has(currentSession()?.role) ? true : '/acesso-negado';
  };
}

function shellUser(session) {
  if (session.role === ROLES.CLIENT) return { name: 'Cliente da oficina' };
  return { name: session.email?.split('@')[0] ?? 'Equipe AutoGestão', email: session.email };
}

async function logout() {
  const button = document.querySelector('[data-action="logout"]');
  button?.setAttribute('aria-busy', 'true');
  await logoutCurrentSession();
  router.navigate('/login', { replace: true });
}

function renderProtected(content, path) {
  cleanupCurrentView();
  const session = currentSession();
  appRoot.innerHTML = renderAppShell({
    role: session.role,
    path,
    user: shellUser(session),
    connection: navigator.onLine ? 'online' : 'offline',
    sidebarCollapsed: readSidebarCollapsed(),
    content,
  });
  registerCleanup(mountShellInteractions(appRoot.querySelector('.app-shell'), { onLogout: logout }));
  document.title = `AutoGestão Pro · ${document.querySelector('h1')?.textContent ?? 'Oficina'}`;
  requestAnimationFrame(() => document.querySelector('#main-content')?.focus({ preventScroll: true }));
  return session;
}

async function loginHandler() {
  cleanupCurrentView();
  if (currentSession()) return router.navigate(currentSession().role === ROLES.MECHANIC ? '/meu-trabalho' : '/inicio', { replace: true });
  appRoot.innerHTML = `${renderLoginView()}<div class="toast-stack" id="toast-stack" aria-live="polite"></div><div class="modal-root" id="modal-root"></div>`;
  document.title = 'Entrar · AutoGestão Pro';
  registerCleanup(mountLoginView(appRoot, {
    auth: { loginOperator, loginClient },
    navigate: (path) => router.navigate(path, { replace: true }),
    notify,
  }));
}

async function dashboardHandler(context) {
  const session = currentSession();
  renderProtected(renderDashboardView({ role: session.role }), context.path);
  registerCleanup(await mountDashboardView(appRoot.querySelector('#main-content'), {
    role: session.role,
    api: domainApi,
    navigate: (path) => router.navigate(path),
    notify,
  }));
}

async function ordersHandler(context) {
  const session = currentSession();
  renderProtected(renderOrdersListView({ role: session.role }), context.path);
  registerCleanup(await mountOrdersListView(appRoot.querySelector('#main-content'), { role: session.role, api: domainApi, notify }));
}

async function newOrderHandler(context) {
  const session = currentSession();
  renderProtected(renderNewOrderView({ role: session.role }), context.path);
  registerCleanup(await mountNewOrderView(appRoot.querySelector('#main-content'), {
    role: session.role,
    api: domainApi,
    navigate: (path) => router.navigate(path),
    notify,
  }));
}

async function orderDetailHandler(context) {
  const session = currentSession();
  renderProtected(renderOrderDetailView({ role: session.role }), context.path);
  registerCleanup(await mountOrderDetailView(appRoot.querySelector('#main-content'), {
    id: context.params.id,
    role: session.role,
    api: domainApi,
    navigate: (path) => router.navigate(path),
    notify,
  }));
}

async function resourcesHandler(context) {
  const session = currentSession();
  const resource = context.route.resource;
  renderProtected(
    renderResourcesView(resource, {
      role: session.role,
      subject: session.subject,
    }),
    context.path,
  );
  const mounted = await mountResourcesView(appRoot.querySelector('#main-content'), resource, {
    role: session.role,
    subject: session.subject,
    api: domainApi,
    navigate: (path) => router.navigate(path),
    notify: (message, options = {}) => notify({
      kind: options.type ?? 'success',
      title: options.type === 'error' ? 'Operação não concluída' : 'Dados atualizados',
      message,
    }),
  });
  if (typeof mounted?.destroy === 'function') registerCleanup(() => mounted.destroy());
}

async function reportsHandler(context) {
  const session = currentSession();
  renderProtected(renderReportsView({ role: session.role }), context.path);
  registerCleanup(await mountReportsView(appRoot.querySelector('#main-content'), {
    role: session.role,
    api: domainApi,
    navigate: (path) => router.navigate(path),
    notify,
  }));
}

async function forbiddenHandler(context) {
  if (!currentSession()) return router.navigate('/login', { replace: true });
  renderProtected(renderAccessDenied(), context.path);
}

async function notFoundHandler(context) {
  if (!currentSession()) return router.navigate('/login', { replace: true });
  renderProtected(renderNotFound(), context.path);
}

const routes = [
  { path: '/login', handler: loginHandler },
  { path: '/inicio', guard: guardAuthenticated, handler: dashboardHandler },
  { path: '/meu-trabalho', guard: guardAuthenticated, handler: dashboardHandler },
  { path: '/ordens', guard: guardAuthenticated, handler: ordersHandler },
  { path: '/ordens/nova', guard: guardRoles(INTERNAL_MANAGEMENT), handler: newOrderHandler },
  { path: '/ordens/:id', guard: guardAuthenticated, handler: orderDetailHandler },
  { path: '/clientes', resource: 'clientes', guard: guardRoles(INTERNAL_MANAGEMENT), handler: resourcesHandler },
  { path: '/veiculos', resource: 'veiculos', guard: guardRoles(INTERNAL_MANAGEMENT), handler: resourcesHandler },
  { path: '/estoque', resource: 'estoque', guard: guardRoles(new Set([ROLES.ADMIN, ROLES.MECHANIC])), handler: resourcesHandler },
  { path: '/catalogo', resource: 'catalogo', guard: guardRoles(new Set([ROLES.ADMIN, ROLES.CONSULTANT, ROLES.MECHANIC])), handler: resourcesHandler },
  { path: '/usuarios', resource: 'usuarios', guard: guardRoles(new Set([ROLES.ADMIN])), handler: resourcesHandler },
  { path: '/relatorios', guard: guardRoles(REPORT_ROLES), handler: reportsHandler },
  { path: '/acesso-negado', handler: forbiddenHandler },
];

router = createHashRouter({
  routes,
  defaultPath: currentSession() ? (currentSession().role === ROLES.MECHANIC ? '/meu-trabalho' : '/inicio') : '/login',
  notFound: notFoundHandler,
  onError(error) {
    const session = currentSession();
    const content = statePanel({ kind: 'error', title: 'A tela encontrou um erro inesperado', description: 'Recarregue a página. Se o problema continuar, use o código de suporte exibido pela API.', actionLabel: 'Recarregar', action: 'app:reload', correlationId: error?.correlationId });
    if (session) renderProtected(content, '/erro');
    else appRoot.innerHTML = content;
  },
});

installRipple(document);
installTabs(document);

window.addEventListener('oficina:session-expired', () => {
  notify({ kind: 'warning', title: 'Sessão expirada', message: currentSession()?.role === ROLES.CLIENT ? 'Informe seu CPF novamente para continuar.' : 'Entre novamente para continuar.' });
  sessionStore.clear('expired');
  router.navigate('/login', { replace: true });
});

window.addEventListener('offline', () => {
  document.body.classList.add('is-offline');
  notify({ kind: 'warning', title: 'Você está sem conexão', message: 'As ações serão retomadas quando a rede voltar.' });
});
window.addEventListener('online', () => {
  document.body.classList.remove('is-offline');
  notify({ kind: 'success', title: 'Conexão restabelecida', message: 'Você já pode atualizar os dados.' });
});

document.addEventListener('click', (event) => {
  if (event.target.closest('[data-action="app:reload"]')) window.location.reload();
});

router.start();
