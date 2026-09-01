import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { ROLES } from '../src/core/permissions.js';
import {
  mountShellInteractions,
  readSidebarCollapsed,
  renderAppShell,
  SIDEBAR_PREFERENCE_KEY,
  writeSidebarCollapsed,
} from '../src/components/shell.js';
import { domainId, escapeHtml } from '../src/components/ui-kit.js';
import {
  renderMechanicAssignmentField,
  renderNewOrderView,
  renderOrdersListView,
  renderSimpleFieldModalActions,
} from '../src/views/orders.js';
import { renderResourcesView } from '../src/views/resources.js';
import { renderDashboardView } from '../src/views/dashboard.js';
import { renderReportsView } from '../src/views/reports.js';

test('shell do cliente não expõe áreas administrativas', () => {
  const html = renderAppShell({
    role: ROLES.CLIENT,
    path: '/inicio',
    user: { name: 'Cliente Teste' },
    content: '<h1>Início</h1>',
  });
  assert.match(html, /Minhas ordens/);
  assert.doesNotMatch(html, /Usuários|Estoque|Relatórios|Clientes/);
  assert.match(html, /bottom-nav/);
});

test('shell administrativo contém somente módulos previstos', () => {
  const html = renderAppShell({
    role: ROLES.ADMIN,
    path: '/ordens',
    user: { name: 'Admin Teste' },
    content: '<h1>Ordens</h1>',
  });
  assert.match(html, /Usuários/);
  assert.match(html, /Relatórios/);
  assert.doesNotMatch(html, /Financeiro|Notificações|Ajuda/);
});

test('sidebar renderiza estados expandido e colapsado com controles acessíveis', () => {
  const base = {
    role: ROLES.ADMIN,
    path: '/inicio',
    user: { name: 'Admin Teste' },
    content: '<h1>Visão geral</h1>',
  };
  const expanded = renderAppShell(base);
  assert.doesNotMatch(expanded, /app-shell sidebar-collapsed/);
  assert.match(expanded, /aria-label="Recolher menu"/);
  assert.match(expanded, /aria-controls="app-sidebar" aria-expanded="true"/);
  assert.match(expanded, /data-action="close-drawer" aria-label="Fechar menu"/);

  const collapsed = renderAppShell({ ...base, sidebarCollapsed: true });
  assert.match(collapsed, /app-shell sidebar-collapsed/);
  assert.match(collapsed, /aria-label="Expandir menu"/);
  assert.match(collapsed, /aria-controls="app-sidebar" aria-expanded="false"/);
  assert.match(collapsed, /left_panel_open/);
  assert.match(collapsed, /aria-label="Visão geral"/);
  assert.match(collapsed, /data-action="logout" aria-label="Sair" title="Sair"/);
});

test('preferência da sidebar persiste sem tornar o shell dependente do storage', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  assert.equal(readSidebarCollapsed(storage), false);
  writeSidebarCollapsed(true, storage);
  assert.equal(values.get(SIDEBAR_PREFERENCE_KEY), 'true');
  assert.equal(readSidebarCollapsed(storage), true);
  writeSidebarCollapsed(false, storage);
  assert.equal(readSidebarCollapsed(storage), false);

  const unavailable = {
    getItem: () => { throw new Error('storage unavailable'); },
    setItem: () => { throw new Error('storage unavailable'); },
  };
  assert.equal(readSidebarCollapsed(unavailable), false);
  assert.doesNotThrow(() => writeSidebarCollapsed(true, unavailable));
});

test('clique no controle alterna classe, ARIA, ícone e preferência persistida', () => {
  const classList = (initial = []) => {
    const values = new Set(initial);
    return {
      add: (...names) => names.forEach((name) => values.add(name)),
      remove: (...names) => names.forEach((name) => values.delete(name)),
      contains: (name) => values.has(name),
      toggle: (name, force) => {
        const enabled = force ?? !values.has(name);
        if (enabled) values.add(name);
        else values.delete(name);
        return enabled;
      },
    };
  };
  const listeners = new Map();
  const attributes = new Map();
  const collapseIcon = { textContent: 'left_panel_close' };
  const collapseButton = {
    setAttribute: (name, value) => attributes.set(name, value),
    querySelector: () => collapseIcon,
  };
  const menuButton = { setAttribute: () => {} };
  const sidebar = {
    classList: classList(),
    querySelector: () => ({ focus: () => {} }),
    querySelectorAll: () => [],
  };
  const mainColumn = { inert: false };
  const root = {
    classList: classList(),
    querySelector: (selector) => ({
      '#app-sidebar': sidebar,
      '[data-action="open-drawer"]': menuButton,
      '[data-action="toggle-sidebar-size"]': collapseButton,
      '.app-main-column': mainColumn,
    })[selector] ?? null,
    addEventListener: (name, listener) => listeners.set(name, listener),
    removeEventListener: (name) => listeners.delete(name),
  };
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const originalDocument = globalThis.document;
  globalThis.document = {
    activeElement: null,
    body: { classList: classList() },
  };

  const cleanup = mountShellInteractions(root, { storage });
  const toggleTarget = {
    closest: (selector) => selector === '[data-action]'
      ? { dataset: { action: 'toggle-sidebar-size' } }
      : null,
  };

  try {
    listeners.get('click')({ target: toggleTarget });
    assert.equal(root.classList.contains('sidebar-collapsed'), true);
    assert.equal(attributes.get('aria-expanded'), 'false');
    assert.equal(attributes.get('aria-label'), 'Expandir menu');
    assert.equal(collapseIcon.textContent, 'left_panel_open');
    assert.equal(values.get(SIDEBAR_PREFERENCE_KEY), 'true');

    listeners.get('click')({ target: toggleTarget });
    assert.equal(root.classList.contains('sidebar-collapsed'), false);
    assert.equal(attributes.get('aria-expanded'), 'true');
    assert.equal(collapseIcon.textContent, 'left_panel_close');
    assert.equal(values.get(SIDEBAR_PREFERENCE_KEY), 'false');
  } finally {
    cleanup();
    globalThis.document = originalDocument;
  }
});

test('CSS reserva a largura da sidebar e neutraliza o recuo no drawer móvel', async () => {
  const cssPath = fileURLToPath(new URL('../src/styles.css', import.meta.url));
  const css = await readFile(cssPath, 'utf8');
  assert.match(
    css,
    /\.main-shell,\s*\.app-main,\s*\.app-main-column\s*\{[^}]*margin-left:\s*var\(--app-sidebar-width\)/s,
  );
  assert.match(
    css,
    /\.app-shell\.sidebar-collapsed\s*\{[^}]*--app-sidebar-width:\s*var\(--sidebar-collapsed-width\)/s,
  );
  assert.match(
    css,
    /@media \(max-width: 63\.999rem\)[\s\S]*?\.main-shell,\s*\.app-main,\s*\.app-main-column\s*\{[^}]*margin-left:\s*0/s,
  );
});

test('busca de recursos reserva a largura do botão e empilha no mobile', async () => {
  const cssPath = fileURLToPath(new URL('../src/app-overrides.css', import.meta.url));
  const css = await readFile(cssPath, 'utf8');
  assert.match(
    css,
    /\.input-with-action\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(0, 1fr\) max-content;/s,
  );
  assert.match(
    css,
    /\.input-with-action \.interactive-button\s*\{[^}]*width:\s*max-content;[^}]*min-width:\s*max-content;/s,
  );
  assert.match(
    css,
    /@media \(max-width: 47\.99rem\)[\s\S]*?\.input-with-action\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/s,
  );
  assert.match(
    css,
    /\.resource-search--users\s*>\s*\*[^}]*min-width:\s*0;/s,
  );
  assert.match(
    css,
    /\.resource-search__actions \.interactive-button\s*\{[^}]*min-width:\s*0;[^}]*max-width:\s*100%;[^}]*white-space:\s*normal;[^}]*overflow-wrap:\s*anywhere;/s,
  );
  assert.match(
    css,
    /@media \(max-width: 79\.99rem\)[\s\S]*?\.resource-search--users\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);[\s\S]*?\.resource-search__field--query,\s*\.resource-search__actions\s*\{[^}]*grid-column:\s*1\s*\/\s*-1;/s,
  );
  assert.match(
    css,
    /@media \(max-width: 47\.99rem\)[\s\S]*?\.resource-search--users\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/s,
  );
});

test('abertura de OS é bloqueada visualmente para mecânico e cliente', () => {
  assert.match(renderNewOrderView({ role: ROLES.MECHANIC }), /Abertura não autorizada/);
  assert.match(renderNewOrderView({ role: ROLES.CLIENT }), /Abertura não autorizada/);
  assert.match(renderNewOrderView({ role: ROLES.CONSULTANT }), /Registrar entrada do veículo/);
});

test('abertura de OS usa busca dinâmica e acessível para selecionar cliente', () => {
  const html = renderNewOrderView({ role: ROLES.ADMIN });

  assert.match(html, /data-client-combobox/);
  assert.match(html, /role="combobox"/);
  assert.match(html, /role="listbox"/);
  assert.match(html, /name="clienteId"[^>]*type="hidden"|type="hidden"[^>]*name="clienteId"/);
  assert.ok(html.includes('nome, CPF/CNPJ, e-mail ou telefone'));
  assert.doesNotMatch(html, /<select[^>]+(?:id|name)="clienteId"/);
});

test('novo cliente segue o padrão visual e mantém campos obrigatórios responsivos', async () => {
  const html = renderNewOrderView({ role: ROLES.ADMIN });
  const cssPath = fileURLToPath(
    new URL('../src/app-overrides.css', import.meta.url),
  );
  const css = await readFile(cssPath, 'utf8');

  assert.match(
    html,
    /data-mode="client-new" class="wizard-inline-form" hidden/,
  );
  assert.match(html, /Dados do novo cliente/);
  assert.match(html, /class="form-grid wizard-client-form"/);
  assert.match(html, /class="form-field span-3"/);
  assert.match(html, /class="form-field span-9"/);
  assert.match(html, /class="form-field span-12"/);
  assert.match(html, /class="form-field span-6"/);
  assert.match(html, /name="clienteTipoDoc" required/);
  assert.match(html, /name="clienteNumeroDoc"[^>]*required/);
  assert.match(html, /name="clienteNome"[^>]*required/);
  assert.match(html, /name="clienteEmail"[^>]*required/);
  assert.match(html, /name="clienteTelefone"[^>]*required/);
  assert.match(html, /O cliente será cadastrado somente quando a ordem/);

  assert.ok(css.includes('.wizard-inline-form {'));
  assert.ok(css.includes('.wizard-inline-form[hidden] {'));
  assert.ok(css.includes('.wizard-inline-form__header {'));
  assert.ok(css.includes('.wizard-inline-form__note {'));
  assert.ok(css.includes('@media (max-width: 47.99rem)'));
});

test('atribuição de OS usa busca dinâmica e submit real para selecionar mecânico', () => {
  const field = renderMechanicAssignmentField();
  const actions = renderSimpleFieldModalActions(
    'order:assign-submit',
    'Atribuir',
  );

  assert.match(field, /data-mechanic-combobox/);
  assert.match(field, /role="combobox"/);
  assert.match(field, /role="listbox"/);
  assert.match(field, /nome, e-mail ou ID/);
  assert.match(
    field,
    /name="mechanicId"[^>]*type="hidden"|type="hidden"[^>]*name="mechanicId"/,
  );
  assert.doesNotMatch(field, /<select[^>]+(?:id|name)="mechanicId"/);
  assert.match(actions, /type="submit"/);
  assert.match(actions, /data-action="order:assign-submit"/);
  assert.match(actions, /form="order-action-form"/);
});

test('fila interna informa seu escopo parcial sem prometer histórico completo', () => {
  const html = renderOrdersListView({ role: ROLES.ADMIN });
  assert.match(html, /Escopo da fila/);
  assert.match(html, /demais estados não compõem esta listagem/);
});

test('gestão de recursos respeita gating de papéis', () => {
  assert.match(renderResourcesView('usuarios', { role: ROLES.ADMIN }), /Usuários/);
  assert.match(renderResourcesView('usuarios', { role: ROLES.CONSULTANT }), /Acesso restrito/);
  assert.match(renderResourcesView('estoque', { role: ROLES.MECHANIC }), /Estoque/);
});

test('dashboard e relatórios deixam claro que usam dados reais/visíveis', () => {
  assert.match(renderDashboardView({ role: ROLES.ADMIN }), /fila visível/i);
  assert.match(renderDashboardView({ role: ROLES.CLIENT }), /lista visível/i);
  assert.match(renderReportsView({ role: ROLES.ADMIN }), /Relatórios/i);
  assert.match(renderReportsView({ role: ROLES.MECHANIC }), /Relatórios restritos/i);
});

test('IDs de value object e HTML externo são normalizados com segurança', () => {
  assert.equal(domainId({ valor: 'os_123' }), 'os_123');
  assert.equal(domainId('os_456'), 'os_456');
  assert.equal(escapeHtml('<img onerror=alert(1)>'), '&lt;img onerror=alert(1)&gt;');
});

test('código não reintroduz ações e conceitos inválidos do protótipo Stitch', async () => {
  const sourceRoot = fileURLToPath(new URL('../src/', import.meta.url));
  const files = ['app.js', 'components/shell.js', 'views/orders.js', 'views/dashboard.js'];
  const content = (await Promise.all(files.map((file) => readFile(`${sourceRoot}${file}`, 'utf8')))).join('\n');
  assert.doesNotMatch(content, /Aprovar Manualmente|Lembrar Cliente|Cliente Premium|Financeiro/);
});
