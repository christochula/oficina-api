import { escapeHtml, icon } from '../components/ui.js';

/**
 * Telas integradas dos recursos auxiliares da oficina.
 *
 * Contrato público:
 * - renderResourcesView(route, { role }) retorna o HTML inicial da tela.
 * - mountResourcesView(root, route, ctx) monta, carrega dados e registra event
 *   delegation. O retorno possui destroy() para remover os listeners.
 * - ctx.role deve ser um papel de domínio: ADMINISTRADOR, CONSULTOR_TECNICO,
 *   MECANICO ou CLIENTE.
 * - ctx.api.request(path, { method = 'GET', body, query }) deve retornar o
 *   payload já desempacotado. Listagens retornam { data, meta }; respostas
 *   simples retornam a entidade.
 * - ctx.notify(message, { type }) é opcional e recebe feedback de sucesso/erro.
 * - ctx.navigate(path) é opcional e fica disponível para o roteador hospedeiro.
 *
 * Rotas HTTP consumidas (todas relativas à base /api/v1 do adapter):
 * - /clientes e /clientes/documento/:numeroDoc
 * - /veiculos e /veiculos/placa/:placa
 * - /estoque e /estoque/pecas/:pecaId
 * - /servicos-oficina e /servicos-oficina/:id
 * - /usuarios e /usuarios/:id
 *
 * Este módulo nunca injeta mocks: loading, vazio e erro são estados reais.
 */

export const RESOURCE_API_PATHS = Object.freeze({
  clientes: '/clientes',
  veiculos: '/veiculos',
  estoque: '/estoque',
  catalogo: '/servicos-oficina',
  usuarios: '/usuarios',
});

const ROLES = Object.freeze({
  ADMIN: 'ADMINISTRADOR',
  CONSULTANT: 'CONSULTOR_TECNICO',
  MECHANIC: 'MECANICO',
  CUSTOMER: 'CLIENTE',
});

const PAGE_SIZE = 20;

const DEFINITIONS = Object.freeze({
  clientes: {
    key: 'clientes',
    title: 'Clientes',
    eyebrow: 'Cadastros',
    description: 'Consulte e mantenha os clientes atendidos pela oficina.',
    icon: 'group',
    endpoint: RESOURCE_API_PATHS.clientes,
    roles: [ROLES.ADMIN, ROLES.CONSULTANT],
    mutationRoles: [ROLES.ADMIN, ROLES.CONSULTANT],
    createLabel: 'Novo cliente',
    searchLabel: 'Buscar clientes',
    searchPlaceholder: 'Nome, contato ou CPF/CNPJ',
    searchHint:
      'A busca filtra a página carregada. Um CPF ou CNPJ completo consulta o cadastro diretamente.',
  },
  veiculos: {
    key: 'veiculos',
    title: 'Veículos',
    eyebrow: 'Cadastros',
    description: 'Localize veículos e mantenha cor e quilometragem atualizadas.',
    icon: 'directions_car',
    endpoint: RESOURCE_API_PATHS.veiculos,
    roles: [ROLES.ADMIN, ROLES.CONSULTANT],
    mutationRoles: [ROLES.ADMIN, ROLES.CONSULTANT],
    createLabel: 'Novo veículo',
    searchLabel: 'Buscar veículos',
    searchPlaceholder: 'Placa, marca ou modelo',
    searchHint:
      'A busca filtra a página carregada. Uma placa completa consulta o cadastro diretamente.',
  },
  estoque: {
    key: 'estoque',
    title: 'Estoque',
    eyebrow: 'Peças',
    description: 'Acompanhe saldo, estoque mínimo e disponibilidade das peças.',
    icon: 'inventory_2',
    endpoint: RESOURCE_API_PATHS.estoque,
    roles: [ROLES.ADMIN, ROLES.MECHANIC],
    mutationRoles: [ROLES.ADMIN],
    createLabel: 'Cadastrar peça',
    searchLabel: 'Buscar peças',
    searchPlaceholder: 'Código, nome ou ID da peça',
    searchHint:
      'A busca filtra a página carregada. Um ID iniciado por pc consulta a peça diretamente.',
  },
  catalogo: {
    key: 'catalogo',
    title: 'Catálogo de serviços',
    eyebrow: 'Serviços',
    description: 'Consulte os serviços padronizados oferecidos pela oficina.',
    icon: 'build_circle',
    endpoint: RESOURCE_API_PATHS.catalogo,
    roles: [ROLES.ADMIN, ROLES.CONSULTANT, ROLES.MECHANIC],
    mutationRoles: [ROLES.ADMIN],
    createLabel: 'Novo serviço',
    searchLabel: 'Buscar serviços',
    searchPlaceholder: 'Nome, categoria ou ID do serviço',
    searchHint:
      'A busca filtra os serviços ativos desta página. Um ID iniciado por sv consulta também serviços inativos.',
  },
  usuarios: {
    key: 'usuarios',
    title: 'Usuários',
    eyebrow: 'Administração',
    description: 'Crie e gerencie os acessos das pessoas que utilizam a oficina.',
    icon: 'manage_accounts',
    endpoint: RESOURCE_API_PATHS.usuarios,
    roles: [ROLES.ADMIN],
    mutationRoles: [ROLES.ADMIN],
    createLabel: 'Novo usuário',
    searchLabel: 'Buscar usuários',
    searchPlaceholder: 'Nome, e-mail ou ID do usuário',
    searchHint:
      'A pesquisa consulta toda a base e pode ser combinada com papel e situação.',
  },
});

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});
const integerFormatter = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 0,
});
const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

function routeKey(route) {
  const value =
    typeof route === 'string'
      ? route
      : route?.name ?? route?.id ?? route?.path ?? route?.pathname ?? '';
  const normalized = String(value).toLocaleLowerCase('pt-BR');
  if (normalized.includes('cliente')) return 'clientes';
  if (normalized.includes('veiculo') || normalized.includes('veículo'))
    return 'veiculos';
  if (normalized.includes('estoque') || normalized.includes('peca'))
    return 'estoque';
  if (
    normalized.includes('catalogo') ||
    normalized.includes('catálogo') ||
    normalized.includes('servicos-oficina')
  )
    return 'catalogo';
  if (normalized.includes('usuario') || normalized.includes('usuário'))
    return 'usuarios';
  return null;
}

function normalizedRole(ctx = {}) {
  return String(
    ctx.role ?? ctx.papel ?? ctx.user?.papel ?? ctx.session?.papel ?? '',
  ).toUpperCase();
}

function isAllowed(definition, role) {
  return Boolean(definition && definition.roles.includes(role));
}

function canMutate(definition, role) {
  return Boolean(definition && definition.mutationRoles.includes(role));
}

export function normalizeResourceId(value) {
  if (typeof value === 'string' || typeof value === 'number')
    return String(value).trim();
  if (!value || typeof value !== 'object') return '';
  if (value.valor !== undefined) return normalizeResourceId(value.valor);
  if (value.value !== undefined) return normalizeResourceId(value.value);
  return '';
}

function itemId(key, item) {
  return key === 'estoque'
    ? normalizeResourceId(item?.peca?.id ?? item?.id)
    : normalizeResourceId(item?.id);
}

function compactId(value) {
  const id = normalizeResourceId(value);
  if (id.length <= 16) return id || '—';
  return `${id.slice(0, 8)}…${id.slice(-5)}`;
}

function normalizeSearch(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

function cleanDocument(value) {
  const raw = String(value ?? '').trim();
  return /[a-z]/i.test(raw)
    ? raw.replace(/[^a-z0-9]/gi, '').toUpperCase()
    : raw.replace(/\D/g, '');
}

function cleanPlate(value) {
  return String(value ?? '')
    .replace(/[^a-z0-9]/gi, '')
    .toUpperCase();
}

function maskDocument(value) {
  const clean = cleanDocument(value);
  if (!clean) return '—';
  return clean.length === 14 ? '**.***.***/****-**' : '***.***.***-**';
}

function maskEmail(value) {
  const email = String(value ?? '');
  const [local, domain] = email.split('@');
  if (!local || !domain) return '—';
  return `${local.slice(0, 1)}•••@${domain}`;
}

function maskPhone(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length < 4) return '—';
  return `(**) *****-${digits.slice(-4)}`;
}

function maskPlate(value) {
  const plate = cleanPlate(value);
  if (plate.length !== 7) return plate || '—';
  return `${plate.slice(0, 3)}••${plate.slice(-2)}`;
}

function formatMoney(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? currencyFormatter.format(numeric) : '—';
}

function formatKm(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric)
    ? `${integerFormatter.format(numeric)} km`
    : '—';
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : dateFormatter.format(date);
}

function activeBadge(active, lowStock = false) {
  if (lowStock) {
    return `<span class="status-badge status-badge-warning">${icon('warning')} Estoque baixo</span>`;
  }
  return active === false
    ? `<span class="status-badge status-badge-neutral">${icon('pause_circle')} Inativo</span>`
    : `<span class="status-badge status-badge-success">${icon('check_circle')} Ativo</span>`;
}

function roleLabel(role) {
  return (
    {
      ADMINISTRADOR: 'Administrador',
      CONSULTOR_TECNICO: 'Consultor técnico',
      MECANICO: 'Mecânico',
      CLIENTE: 'Cliente',
    }[role] ?? role ?? '—'
  );
}

function freshState(key) {
  return {
    key,
    loading: true,
    items: [],
    page: 1,
    perPage: PAGE_SIZE,
    meta: { pagina: 1, porPagina: PAGE_SIZE, total: 0, totalPaginas: 0 },
    search: '',
    roleFilter: '',
    activeFilter: '',
    mode: 'page',
    lookupLabel: '',
    notFound: '',
    error: null,
    dialog: null,
  };
}

function renderUnknownRoute() {
  return `<section class="feedback-state feedback-state-error" role="alert">
    ${icon('route_off', 'feedback-state__icon')}
    <h1>Área não encontrada</h1>
    <p>Este endereço não corresponde a uma tela de cadastro disponível.</p>
  </section>`;
}

function renderAccessDenied() {
  return `<section class="feedback-state feedback-state-denied" role="alert">
    ${icon('lock', 'feedback-state__icon')}
    <p class="eyebrow">Acesso restrito</p>
    <h1>Você não tem acesso a esta área</h1>
    <p>Use a navegação disponível para o seu perfil.</p>
  </section>`;
}

function renderHeader(definition, role) {
  const mutationAllowed = canMutate(definition, role);
  return `<header class="page-header resource-page__header">
    <div class="page-header__copy">
      <p class="eyebrow">${escapeHtml(definition.eyebrow)}</p>
      <div class="page-header__title-row">
        <span class="page-header__icon">${icon(definition.icon)}</span>
        <div>
          <h1>${escapeHtml(definition.title)}</h1>
          <p>${escapeHtml(definition.description)}</p>
        </div>
      </div>
    </div>
    ${
      mutationAllowed
        ? `<button class="interactive-button button-primary" type="button" data-action="create">
            ${icon('add')} <span>${escapeHtml(definition.createLabel)}</span>
          </button>`
        : ''
    }
  </header>`;
}

function renderSearch(definition, state) {
  if (definition.key === 'usuarios') {
    return `<section class="resource-toolbar interactive-card" aria-labelledby="resource-search-title">
      <form class="resource-search resource-search--users" data-resource-search-form>
        <div class="form-field resource-search__field resource-search__field--query">
          <label id="resource-search-title" for="resource-search-input">${escapeHtml(definition.searchLabel)}</label>
          <div class="input-with-icon">
            <span class="input-with-action__icon">${icon('search')}</span>
            <input
              id="resource-search-input"
              name="query"
              type="search"
              value="${escapeHtml(state.search)}"
              placeholder="${escapeHtml(definition.searchPlaceholder)}"
              maxlength="120"
              autocomplete="off"
              aria-describedby="resource-search-hint"
              data-search-input
            />
          </div>
        </div>
        <div class="form-field resource-search__filter">
          <label for="resource-user-role">Papel</label>
          <select id="resource-user-role" name="papel" data-user-filter>
            <option value="">Todos os papéis</option>
            <option value="ADMINISTRADOR" ${state.roleFilter === 'ADMINISTRADOR' ? 'selected' : ''}>Administrador</option>
            <option value="CONSULTOR_TECNICO" ${state.roleFilter === 'CONSULTOR_TECNICO' ? 'selected' : ''}>Consultor técnico</option>
            <option value="MECANICO" ${state.roleFilter === 'MECANICO' ? 'selected' : ''}>Mecânico</option>
          </select>
        </div>
        <div class="form-field resource-search__filter">
          <label for="resource-user-active">Situação</label>
          <select id="resource-user-active" name="ativo" data-user-filter>
            <option value="">Ativos e inativos</option>
            <option value="true" ${state.activeFilter === 'true' ? 'selected' : ''}>Ativos</option>
            <option value="false" ${state.activeFilter === 'false' ? 'selected' : ''}>Inativos</option>
          </select>
        </div>
        <div class="resource-search__actions">
          <button class="interactive-button button-primary" type="submit">${icon('search')} Buscar</button>
          <button class="interactive-button button-ghost" type="button" data-action="clear-filters">${icon('filter_alt_off')} Limpar</button>
        </div>
        <p class="field-hint resource-search__hint" id="resource-search-hint">${escapeHtml(definition.searchHint)}</p>
      </form>
    </section>`;
  }
  const submitLabel = 'Consultar cadastro';
  return `<section class="resource-toolbar interactive-card" aria-labelledby="resource-search-title">
    <form class="resource-search" data-resource-search-form>
      <div class="form-field resource-search__field">
        <label id="resource-search-title" for="resource-search-input">${escapeHtml(definition.searchLabel)}</label>
        <div class="input-with-action">
          <span class="input-with-action__icon">${icon('search')}</span>
          <input
            id="resource-search-input"
            name="query"
            type="search"
            value="${escapeHtml(state.search)}"
            placeholder="${escapeHtml(definition.searchPlaceholder)}"
            autocomplete="off"
            aria-describedby="resource-search-hint"
            data-search-input
          />
          <button class="interactive-button button-secondary" type="submit">${escapeHtml(submitLabel)}</button>
        </div>
        <p class="field-hint" id="resource-search-hint">${escapeHtml(definition.searchHint)}</p>
      </div>
    </form>
    ${
      state.mode === 'lookup' && definition.key !== 'usuarios'
        ? `<div class="lookup-context" role="status">
            <span>${icon('filter_alt')} Consulta direta: ${escapeHtml(state.lookupLabel)}</span>
            <button class="interactive-button button-ghost" type="button" data-action="reset-lookup">Voltar à lista</button>
          </div>`
        : ''
    }
  </section>`;
}

function renderSkeleton() {
  return `<div class="resource-skeleton" aria-busy="true" aria-label="Carregando dados">
    ${Array.from({ length: 5 }, (_, index) => `<div class="skeleton-row" aria-hidden="true" data-skeleton-row="${index}">
      <span class="skeleton skeleton-wide"></span>
      <span class="skeleton skeleton-medium"></span>
      <span class="skeleton skeleton-short"></span>
    </div>`).join('')}
  </div>`;
}

function renderError(error) {
  const detail = error?.correlationId
    ? `<details class="error-detail"><summary>Detalhes para suporte</summary><code>${escapeHtml(error.correlationId)}</code></details>`
    : '';
  return `<div class="feedback-state feedback-state-error" role="alert">
    ${icon('cloud_off', 'feedback-state__icon')}
    <h2>Não foi possível carregar os dados</h2>
    <p>${escapeHtml(error?.message ?? 'Verifique sua conexão e tente novamente.')}</p>
    ${detail}
    <button class="interactive-button button-secondary" type="button" data-action="retry">${icon('refresh')} Tentar novamente</button>
  </div>`;
}

function renderNotFound(message) {
  return `<div class="feedback-state feedback-state-empty" role="status">
    ${icon('search_off', 'feedback-state__icon')}
    <h2>Cadastro não encontrado</h2>
    <p>${escapeHtml(message)}</p>
    <button class="interactive-button button-secondary" type="button" data-action="reset-lookup">Voltar à lista</button>
  </div>`;
}

function searchableText(key, item) {
  if (key === 'clientes') {
    return [
      itemId(key, item),
      item.nome,
      item.email,
      item.telefone,
      item.tipoDoc,
      item.numeroDoc,
      item.cidade,
      item.estado,
    ].join(' ');
  }
  if (key === 'veiculos') {
    return [
      itemId(key, item),
      item.placa,
      item.renavam,
      item.chassi,
      item.marca,
      item.modelo,
      item.ano,
      item.cor,
    ].join(' ');
  }
  if (key === 'estoque') {
    return [
      itemId(key, item),
      item.peca?.codigo,
      item.peca?.nome,
      item.peca?.descricao,
    ].join(' ');
  }
  return [
    itemId(key, item),
    item.nome,
    item.descricao,
    item.categoria,
  ].join(' ');
}

function filteredItems(state) {
  if (state.key === 'usuarios') return state.items;
  const query = normalizeSearch(state.search);
  if (!query || state.mode === 'lookup') return state.items;
  return state.items.filter((item) =>
    normalizeSearch(searchableText(state.key, item)).includes(query),
  );
}

function actionButtons(key, item, mutationAllowed, currentSubject = '') {
  if (!mutationAllowed) return '';
  const id = itemId(key, item);
  const active = key === 'estoque' ? item?.peca?.ativo !== false : item?.ativo !== false;
  const isCurrentActiveUser =
    key === 'usuarios' &&
    active &&
    Boolean(id) &&
    id === normalizeResourceId(currentSubject);
  const accessibleName =
    item?.nome ??
    item?.peca?.nome ??
    item?.placa ??
    item?.codigo ??
    id ??
    'cadastro';
  const editLabel =
    key === 'clientes'
      ? 'Editar cliente'
      : key === 'veiculos'
        ? 'Editar veículo'
        : key === 'estoque'
          ? 'Editar peça'
          : key === 'usuarios'
            ? 'Editar usuário'
            : 'Editar serviço';
  const entry =
    key === 'estoque'
      ? `<button class="interactive-button button-secondary button-small" type="button" data-action="entry" data-item-id="${escapeHtml(id)}">${icon('add_box')} Dar entrada</button>`
      : '';
  return `<div class="resource-actions" aria-label="Ações do cadastro">
    ${entry}
    <button class="interactive-button button-ghost button-small" type="button" data-action="edit" data-item-id="${escapeHtml(id)}" aria-label="${escapeHtml(`${editLabel}: ${accessibleName}`)}">${icon('edit')} ${escapeHtml(editLabel)}</button>
    ${isCurrentActiveUser
      ? `<span class="current-account-note" title="Sua conta atual não pode ser desativada nesta tela." aria-label="Conta atual de ${escapeHtml(accessibleName)}. A desativação não está disponível.">${icon('shield_person')} Sua conta</span>`
      : `<button class="interactive-button ${active ? 'button-danger-ghost' : 'button-secondary'} button-small" type="button" data-action="toggle" data-item-id="${escapeHtml(id)}" aria-label="${escapeHtml(`${active ? 'Desativar' : 'Ativar'} ${accessibleName}`)}">
          ${icon(active ? 'block' : 'check_circle')} ${active ? 'Desativar' : 'Ativar'}
        </button>`}
  </div>`;
}

function renderClientRow(item, mutationAllowed) {
  const id = itemId('clientes', item);
  return `<tr>
    <th scope="row"><strong>${escapeHtml(item.nome || 'Sem nome')}</strong><small title="${escapeHtml(id)}">${escapeHtml(compactId(id))}</small></th>
    <td><span>${escapeHtml(item.tipoDoc || 'Documento')}</span><small>${escapeHtml(maskDocument(item.numeroDoc))}</small></td>
    <td><span>${escapeHtml(maskEmail(item.email))}</span><small>${escapeHtml(maskPhone(item.telefone))}</small></td>
    <td>${activeBadge(item.ativo)}</td>
    <td>${actionButtons('clientes', item, mutationAllowed)}</td>
  </tr>`;
}

function renderVehicleRow(item, mutationAllowed) {
  const id = itemId('veiculos', item);
  return `<tr>
    <th scope="row"><strong>${escapeHtml(maskPlate(item.placa))}</strong><small title="${escapeHtml(id)}">${escapeHtml(compactId(id))}</small></th>
    <td><span>${escapeHtml(`${item.marca ?? ''} ${item.modelo ?? ''}`.trim() || '—')}</span><small>${escapeHtml(item.ano ?? '—')}</small></td>
    <td><span>${escapeHtml(item.cor || '—')}</span><small>${escapeHtml(formatKm(item.quilometragem))}</small></td>
    <td>${activeBadge(item.ativo)}</td>
    <td>${actionButtons('veiculos', item, mutationAllowed)}</td>
  </tr>`;
}

function renderStockRow(item, mutationAllowed) {
  const id = itemId('estoque', item);
  const available = Number(item.quantidadeDisponivel ?? 0);
  const minimum = Number(item.quantidadeMinima ?? 0);
  const low = available <= minimum;
  return `<tr>
    <th scope="row"><strong>${escapeHtml(item.peca?.nome || 'Peça sem nome')}</strong><small>${escapeHtml(item.peca?.codigo || 'Sem código')} · <span title="${escapeHtml(id)}">${escapeHtml(compactId(id))}</span></small></th>
    <td class="numeric-cell"><strong>${escapeHtml(integerFormatter.format(available))}</strong><small>Mínimo: ${escapeHtml(integerFormatter.format(minimum))}</small></td>
    <td class="numeric-cell">${escapeHtml(formatMoney(item.peca?.precoVenda))}</td>
    <td>${activeBadge(item.peca?.ativo, low && item.peca?.ativo !== false)}</td>
    <td>${actionButtons('estoque', item, mutationAllowed)}</td>
  </tr>`;
}

function renderServiceRow(item, mutationAllowed) {
  const id = itemId('catalogo', item);
  return `<tr>
    <th scope="row"><strong>${escapeHtml(item.nome || 'Serviço sem nome')}</strong><small title="${escapeHtml(id)}">${escapeHtml(compactId(id))}</small></th>
    <td>${escapeHtml(item.categoria || 'Sem categoria')}</td>
    <td class="resource-description">${escapeHtml(item.descricao || 'Sem descrição')}</td>
    <td>${activeBadge(item.ativo)}</td>
    <td>${actionButtons('catalogo', item, mutationAllowed)}</td>
  </tr>`;
}

function renderUserRow(item, mutationAllowed, currentSubject) {
  const id = itemId('usuarios', item);
  return `<tr>
    <th scope="row"><strong>${escapeHtml(item.nome || 'Usuário sem nome')}</strong><small title="${escapeHtml(id)}">${escapeHtml(compactId(id))}</small></th>
    <td><span>${escapeHtml(item.email || '—')}</span><small>Criado em ${escapeHtml(formatDate(item.criadoEm))}</small></td>
    <td>${escapeHtml(roleLabel(item.papel))}</td>
    <td>${activeBadge(item.ativo)}</td>
    <td>${actionButtons('usuarios', item, mutationAllowed, currentSubject)}</td>
  </tr>`;
}

function tableDefinition(key) {
  if (key === 'clientes')
    return {
      caption: 'Lista de clientes',
      headings: ['Cliente', 'Documento', 'Contato', 'Situação', 'Ações'],
      row: renderClientRow,
    };
  if (key === 'veiculos')
    return {
      caption: 'Lista de veículos',
      headings: ['Placa', 'Veículo', 'Dados atuais', 'Situação', 'Ações'],
      row: renderVehicleRow,
    };
  if (key === 'estoque')
    return {
      caption: 'Lista de peças em estoque',
      headings: ['Peça', 'Saldo', 'Preço de venda', 'Situação', 'Ações'],
      row: renderStockRow,
    };
  if (key === 'usuarios')
    return {
      caption: 'Lista de usuários',
      headings: ['Usuário', 'Contato', 'Papel', 'Situação', 'Ações'],
      row: renderUserRow,
    };
  return {
    caption: 'Catálogo de serviços',
    headings: ['Serviço', 'Categoria', 'Descrição', 'Situação', 'Ações'],
    row: renderServiceRow,
  };
}

function mobileCard(key, item, mutationAllowed, currentSubject = '') {
  const id = itemId(key, item);
  if (key === 'clientes') {
    return `<article class="resource-card interactive-card">
      <header><div><h3>${escapeHtml(item.nome || 'Sem nome')}</h3><small title="${escapeHtml(id)}">${escapeHtml(compactId(id))}</small></div>${activeBadge(item.ativo)}</header>
      <dl><div><dt>Documento</dt><dd>${escapeHtml(maskDocument(item.numeroDoc))}</dd></div><div><dt>Contato</dt><dd>${escapeHtml(maskEmail(item.email))}</dd></div></dl>
      ${actionButtons(key, item, mutationAllowed)}
    </article>`;
  }
  if (key === 'veiculos') {
    return `<article class="resource-card interactive-card">
      <header><div><h3>${escapeHtml(maskPlate(item.placa))}</h3><small>${escapeHtml(`${item.marca ?? ''} ${item.modelo ?? ''}`.trim())}</small></div>${activeBadge(item.ativo)}</header>
      <dl><div><dt>Ano e cor</dt><dd>${escapeHtml(`${item.ano ?? '—'} · ${item.cor ?? '—'}`)}</dd></div><div><dt>Quilometragem</dt><dd>${escapeHtml(formatKm(item.quilometragem))}</dd></div></dl>
      ${actionButtons(key, item, mutationAllowed)}
    </article>`;
  }
  if (key === 'estoque') {
    const available = Number(item.quantidadeDisponivel ?? 0);
    const minimum = Number(item.quantidadeMinima ?? 0);
    const low = available <= minimum;
    return `<article class="resource-card interactive-card">
      <header><div><h3>${escapeHtml(item.peca?.nome || 'Peça sem nome')}</h3><small>${escapeHtml(item.peca?.codigo || 'Sem código')}</small></div>${activeBadge(item.peca?.ativo, low && item.peca?.ativo !== false)}</header>
      <dl><div><dt>Saldo</dt><dd>${escapeHtml(integerFormatter.format(available))} un.</dd></div><div><dt>Mínimo</dt><dd>${escapeHtml(integerFormatter.format(minimum))} un.</dd></div><div><dt>Preço</dt><dd>${escapeHtml(formatMoney(item.peca?.precoVenda))}</dd></div></dl>
      ${actionButtons(key, item, mutationAllowed)}
    </article>`;
  }
  if (key === 'usuarios') {
    return `<article class="resource-card interactive-card">
      <header><div><h3>${escapeHtml(item.nome || 'Usuário sem nome')}</h3><small title="${escapeHtml(id)}">${escapeHtml(compactId(id))}</small></div>${activeBadge(item.ativo)}</header>
      <dl><div><dt>E-mail</dt><dd>${escapeHtml(item.email || '—')}</dd></div><div><dt>Papel</dt><dd>${escapeHtml(roleLabel(item.papel))}</dd></div><div><dt>Criado em</dt><dd>${escapeHtml(formatDate(item.criadoEm))}</dd></div></dl>
      ${actionButtons(key, item, mutationAllowed, currentSubject)}
    </article>`;
  }
  return `<article class="resource-card interactive-card">
    <header><div><h3>${escapeHtml(item.nome || 'Serviço sem nome')}</h3><small title="${escapeHtml(id)}">${escapeHtml(compactId(id))}</small></div>${activeBadge(item.ativo)}</header>
    <dl><div><dt>Categoria</dt><dd>${escapeHtml(item.categoria || 'Sem categoria')}</dd></div><div><dt>Descrição</dt><dd>${escapeHtml(item.descricao || 'Sem descrição')}</dd></div></dl>
    ${actionButtons(key, item, mutationAllowed)}
  </article>`;
}

function renderPagination(state) {
  if (state.mode !== 'page' || Number(state.meta.totalPaginas ?? 0) <= 1)
    return '';
  const page = Number(state.meta.pagina ?? state.page);
  const totalPages = Number(state.meta.totalPaginas ?? 1);
  return `<nav class="pagination" aria-label="Paginação de resultados">
    <button class="interactive-button button-secondary" type="button" data-action="page" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>${icon('chevron_left')} Anterior</button>
    <span aria-live="polite">Página <strong>${page}</strong> de <strong>${totalPages}</strong></span>
    <button class="interactive-button button-secondary" type="button" data-action="page" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>Próxima ${icon('chevron_right')}</button>
  </nav>`;
}

function renderEmpty(definition, state, mutationAllowed, filtered) {
  const userFiltered = definition.key === 'usuarios' && Boolean(
    state.search || state.roleFilter || state.activeFilter !== '',
  );
  const filteredEmpty = userFiltered || Boolean(state.search && state.items.length && !filtered.length);
  const emptyNoun = {
    clientes: 'cliente',
    veiculos: 'veículo',
    estoque: 'item de estoque',
    catalogo: 'serviço',
    usuarios: 'usuário',
  }[definition.key];
  return `<div class="feedback-state feedback-state-empty" role="status">
    ${icon(filteredEmpty ? 'filter_alt_off' : 'inbox', 'feedback-state__icon')}
    <h2>${filteredEmpty ? 'Nenhum resultado encontrado' : `Nenhum ${emptyNoun} encontrado`}</h2>
    <p>${
      filteredEmpty
        ? 'Revise a pesquisa ou ajuste os filtros aplicados.'
        : 'Assim que houver cadastros, eles aparecerão aqui.'
    }</p>
    ${
      !filteredEmpty && mutationAllowed
        ? `<button class="interactive-button button-primary" type="button" data-action="create">${icon('add')} ${escapeHtml(definition.createLabel)}</button>`
        : ''
    }
  </div>`;
}

function renderResults(definition, state, role, currentSubject = '') {
  if (state.loading) return renderSkeleton();
  if (state.error) return renderError(state.error);
  if (state.notFound) return renderNotFound(state.notFound);
  const mutationAllowed = canMutate(definition, role);
  const items = filteredItems(state);
  if (!items.length)
    return renderEmpty(definition, state, mutationAllowed, items);
  const table = tableDefinition(definition.key);
  const total = Number(state.meta.total ?? state.items.length);
  const pageCount = state.items.length;
  const filteredLabel = state.search && state.mode === 'page'
    ? `${items.length} resultado(s) nesta página`
    : state.mode === 'lookup'
      ? `${items.length} cadastro localizado`
      : `${pageCount} de ${total} resultado(s)`;
  return `<div class="resource-results__summary" role="status" aria-live="polite">
      <span>${escapeHtml(filteredLabel)}</span>
      ${state.mode === 'page' ? `<span>Ordenação fornecida pela API</span>` : ''}
    </div>
    <div class="resource-table-container">
      <table class="resource-table responsive-data-view">
        <caption class="sr-only">${escapeHtml(table.caption)}</caption>
        <thead><tr>${table.headings.map((heading) => `<th scope="col">${escapeHtml(heading)}</th>`).join('')}</tr></thead>
        <tbody>${items.map((item) => table.row(item, mutationAllowed, currentSubject)).join('')}</tbody>
      </table>
    </div>
    <div class="resource-card-list" aria-label="${escapeHtml(table.caption)} em cartões">
      ${items.map((item) => mobileCard(definition.key, item, mutationAllowed, currentSubject)).join('')}
    </div>
    ${renderPagination(state)}`;
}

function renderModalError(error) {
  if (!error) return '';
  return `<div class="feedback-banner feedback-banner-error" role="alert">
    ${icon('error')} <span>${escapeHtml(error.message ?? String(error))}</span>
  </div>`;
}

function inputField({
  name,
  label,
  value = '',
  type = 'text',
  required = false,
  readonly = false,
  min,
  max,
  step,
  minlength,
  maxlength,
  autocomplete,
  hint,
  inputmode,
}) {
  const id = `resource-field-${name}`;
  return `<div class="form-field">
    <label for="${id}">${escapeHtml(label)}${required ? ' <span aria-hidden="true">*</span>' : ''}</label>
    <input id="${id}" name="${escapeHtml(name)}" type="${escapeHtml(type)}" value="${escapeHtml(value)}"
      ${required ? 'required' : ''} ${readonly ? 'readonly aria-readonly="true"' : ''}
      ${min !== undefined ? `min="${escapeHtml(min)}"` : ''} ${max !== undefined ? `max="${escapeHtml(max)}"` : ''}
      ${step !== undefined ? `step="${escapeHtml(step)}"` : ''} ${minlength !== undefined ? `minlength="${escapeHtml(minlength)}"` : ''}
      ${maxlength !== undefined ? `maxlength="${escapeHtml(maxlength)}"` : ''} ${autocomplete ? `autocomplete="${escapeHtml(autocomplete)}"` : ''}
      ${inputmode ? `inputmode="${escapeHtml(inputmode)}"` : ''} ${hint ? `aria-describedby="${id}-hint"` : ''} />
    ${hint ? `<p class="field-hint" id="${id}-hint">${escapeHtml(hint)}</p>` : ''}
  </div>`;
}

function textAreaField({ name, label, value = '', hint }) {
  const id = `resource-field-${name}`;
  return `<div class="form-field form-field-wide">
    <label for="${id}">${escapeHtml(label)}</label>
    <textarea id="${id}" name="${escapeHtml(name)}" rows="3" ${hint ? `aria-describedby="${id}-hint"` : ''}>${escapeHtml(value)}</textarea>
    ${hint ? `<p class="field-hint" id="${id}-hint">${escapeHtml(hint)}</p>` : ''}
  </div>`;
}

function selectField({ name, label, value, options, required = false, hint }) {
  const id = `resource-field-${name}`;
  return `<div class="form-field">
    <label for="${id}">${escapeHtml(label)}${required ? ' <span aria-hidden="true">*</span>' : ''}</label>
    <select id="${id}" name="${escapeHtml(name)}" ${required ? 'required' : ''} ${hint ? `aria-describedby="${id}-hint"` : ''}>
      ${options.map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}
    </select>
    ${hint ? `<p class="field-hint" id="${id}-hint">${escapeHtml(hint)}</p>` : ''}
  </div>`;
}

function clientForm(item, editing) {
  return `<div class="form-grid">
    ${selectField({
      name: 'tipoDoc',
      label: 'Tipo de documento',
      value: item?.tipoDoc ?? 'CPF',
      required: true,
      hint: editing ? 'O tipo não pode ser alterado após o cadastro.' : undefined,
      options: [
        { value: 'CPF', label: 'CPF' },
        { value: 'CNPJ', label: 'CNPJ' },
      ],
    }).replace('<select ', `<select ${editing ? 'disabled aria-disabled="true" ' : ''}`)}
    ${inputField({ name: 'numeroDoc', label: 'CPF ou CNPJ', value: item?.numeroDoc, required: true, readonly: editing, maxlength: 18, autocomplete: 'off', hint: editing ? 'O documento é imutável.' : 'Aceita CPF e CNPJ numérico ou alfanumérico, com ou sem máscara.' })}
    ${inputField({ name: 'nome', label: 'Nome ou razão social', value: item?.nome, required: true, minlength: 2, autocomplete: 'name' })}
    ${inputField({ name: 'email', label: 'E-mail', value: item?.email, type: 'email', required: true, autocomplete: 'email' })}
    ${inputField({ name: 'telefone', label: 'Telefone', value: item?.telefone, required: true, autocomplete: 'tel', inputmode: 'tel' })}
    ${inputField({ name: 'usuarioId', label: 'ID do usuário cliente', value: item?.usuarioId, autocomplete: 'off', hint: editing ? 'Deixe em branco para remover o vínculo atual.' : 'Opcional. Deve apontar para um usuário com papel Cliente.' })}
  </div>
  <fieldset class="form-section">
    <legend>Endereço <span>opcional</span></legend>
    <div class="form-grid">
      ${inputField({ name: 'logradouro', label: 'Logradouro', value: item?.logradouro, autocomplete: 'street-address' })}
      ${inputField({ name: 'numero', label: 'Número', value: item?.numero })}
      ${inputField({ name: 'complemento', label: 'Complemento', value: item?.complemento })}
      ${inputField({ name: 'bairro', label: 'Bairro', value: item?.bairro })}
      ${inputField({ name: 'cidade', label: 'Cidade', value: item?.cidade, autocomplete: 'address-level2' })}
      ${inputField({ name: 'estado', label: 'Estado', value: item?.estado, maxlength: 2, autocomplete: 'address-level1' })}
      ${inputField({ name: 'cep', label: 'CEP', value: item?.cep, maxlength: 9, autocomplete: 'postal-code', inputmode: 'numeric' })}
    </div>
  </fieldset>`;
}

function vehicleForm(item, editing) {
  return `<div class="form-grid">
    ${inputField({ name: 'placa', label: 'Placa', value: item?.placa, required: true, readonly: editing, maxlength: 8, autocomplete: 'off', hint: editing ? 'A placa é imutável.' : 'Formato antigo ou Mercosul.' })}
    ${inputField({ name: 'renavam', label: 'RENAVAM', value: item?.renavam, required: true, readonly: editing, autocomplete: 'off', inputmode: 'numeric' })}
    ${inputField({ name: 'chassi', label: 'Chassi', value: item?.chassi, required: true, readonly: editing, autocomplete: 'off' })}
    ${inputField({ name: 'marca', label: 'Marca', value: item?.marca, required: true, readonly: editing })}
    ${inputField({ name: 'modelo', label: 'Modelo', value: item?.modelo, required: true, readonly: editing })}
    ${inputField({ name: 'ano', label: 'Ano', value: item?.ano, type: 'number', required: true, readonly: editing, min: 1900, step: 1, inputmode: 'numeric' })}
    ${inputField({ name: 'cor', label: 'Cor', value: item?.cor, required: true })}
    ${inputField({ name: 'quilometragem', label: 'Quilometragem', value: item?.quilometragem ?? 0, type: 'number', required: true, min: 0, step: 1, inputmode: 'numeric' })}
  </div>`;
}

function stockForm(item, editing) {
  return `<div class="form-grid">
    ${inputField({ name: 'codigo', label: 'Código da peça', value: item?.peca?.codigo, required: true, readonly: editing, hint: editing ? 'O código é imutável.' : undefined })}
    ${inputField({ name: 'nome', label: 'Nome da peça', value: item?.peca?.nome, required: true, minlength: 2 })}
    ${inputField({ name: 'precoVenda', label: 'Preço de venda', value: item?.peca?.precoVenda ?? '', type: 'number', required: true, min: 0, step: '0.01', inputmode: 'decimal' })}
    ${
      editing
        ? ''
        : inputField({ name: 'quantidadeInicial', label: 'Quantidade inicial', value: 0, type: 'number', min: 0, step: '0.001', inputmode: 'decimal' }) +
          inputField({ name: 'quantidadeMinima', label: 'Quantidade mínima', value: 0, type: 'number', min: 0, step: '0.001', inputmode: 'decimal', hint: 'Definida somente no cadastro nesta versão da API.' })
    }
    ${textAreaField({ name: 'descricao', label: 'Descrição', value: item?.peca?.descricao })}
  </div>`;
}

function serviceForm(item) {
  return `<div class="form-grid">
    ${inputField({ name: 'nome', label: 'Nome do serviço', value: item?.nome, required: true, minlength: 2 })}
    ${inputField({ name: 'categoria', label: 'Categoria', value: item?.categoria })}
    ${textAreaField({ name: 'descricao', label: 'Descrição', value: item?.descricao, hint: 'O catálogo não possui preço base; valores são definidos no orçamento.' })}
  </div>`;
}

function userForm(item, editing) {
  return `<div class="form-grid">
    ${inputField({ name: 'nome', label: 'Nome completo', value: item?.nome, required: true, minlength: 2, autocomplete: 'name' })}
    ${inputField({ name: 'email', label: 'E-mail de acesso', value: item?.email, type: 'email', required: true, autocomplete: 'email' })}
    ${editing
      ? inputField({ name: 'senha', label: 'Nova senha', type: 'password', minlength: 6, maxlength: 72, autocomplete: 'new-password', hint: 'Opcional. Preencha somente para trocar a senha, usando de 6 a 72 caracteres.' })
      : inputField({ name: 'senha', label: 'Senha inicial', type: 'password', required: true, minlength: 6, maxlength: 72, autocomplete: 'new-password', hint: 'Use de 6 a 72 caracteres. A senha não será exibida novamente.' })}
    ${selectField({
      name: 'papel',
      label: 'Papel',
      value: item?.papel ?? 'CONSULTOR_TECNICO',
      required: true,
      options: [
        { value: 'ADMINISTRADOR', label: 'Administrador' },
        { value: 'CONSULTOR_TECNICO', label: 'Consultor técnico' },
        { value: 'MECANICO', label: 'Mecânico' },
      ],
      hint: 'Esta área gerencia somente acessos internos da oficina.',
    })}
  </div>`;
}

function dialogCopy(key, mode, item) {
  if (mode === 'entry')
    return {
      title: 'Dar entrada no estoque',
      description: `Adicione unidades ao saldo de ${item?.peca?.nome ?? 'esta peça'}.`,
      submit: 'Registrar entrada',
      body: `<div class="form-grid">${inputField({ name: 'quantidade', label: 'Quantidade de entrada', type: 'number', required: true, min: '0.001', step: '0.001', inputmode: 'decimal', hint: 'Informe um valor maior que zero.' })}</div>`,
    };
  const editing = mode === 'edit';
  const titles = {
    clientes: editing ? 'Editar cliente' : 'Novo cliente',
    veiculos: editing ? 'Editar veículo' : 'Novo veículo',
    estoque: editing ? 'Editar peça' : 'Cadastrar peça',
    catalogo: editing ? 'Editar serviço' : 'Novo serviço',
    usuarios: editing ? 'Editar usuário' : 'Novo usuário',
  };
  const bodies = {
    clientes: () => clientForm(item, editing),
    veiculos: () => vehicleForm(item, editing),
    estoque: () => stockForm(item, editing),
    catalogo: () => serviceForm(item),
    usuarios: () => userForm(item, editing),
  };
  return {
    title: titles[key],
    description: editing
      ? 'Revise os campos editáveis e confirme para salvar.'
      : 'Os campos marcados com * são obrigatórios.',
    submit: editing ? 'Salvar alterações' : key === 'usuarios' ? 'Criar usuário' : 'Cadastrar',
    body: bodies[key](),
  };
}

function toggleCopy(key, item) {
  const active = key === 'estoque' ? item?.peca?.ativo !== false : item?.ativo !== false;
  const subject =
    key === 'clientes'
      ? item?.nome
      : key === 'veiculos'
        ? item?.placa
        : key === 'estoque'
          ? item?.peca?.nome
          : item?.nome;
  const noun =
    key === 'clientes'
      ? 'cliente'
      : key === 'veiculos'
        ? 'veículo'
        : key === 'estoque'
          ? 'peça'
          : key === 'usuarios'
            ? 'usuário'
            : 'serviço';
  const consequence =
    key === 'usuarios'
      ? active
        ? 'O acesso ao sistema será bloqueado e as sessões futuras serão recusadas.'
        : 'O acesso ao sistema será restaurado para este usuário.'
      : key === 'catalogo' && active
      ? 'O serviço deixará de aparecer no catálogo ativo e em novas seleções. Guarde o ID para poder consultá-lo e reativá-lo.'
      : active
        ? `O ${noun} ficará indisponível para novos fluxos até ser reativado.`
        : `O ${noun} voltará a ficar disponível nos fluxos permitidos.`;
  return {
    active,
    title: `${active ? 'Desativar' : 'Ativar'} ${noun}`,
    description: `${subject ? `${subject}: ` : ''}${consequence}`,
    submit: `${active ? 'Desativar' : 'Ativar'} ${noun}`,
  };
}

function renderDialog(state) {
  if (!state.dialog) return '';
  const { mode, item, busy, error } = state.dialog;
  if (mode === 'toggle') {
    const copy = toggleCopy(state.key, item);
    return `<dialog class="confirm-dialog" data-resource-dialog aria-labelledby="resource-dialog-title" aria-describedby="resource-dialog-description">
      <div class="dialog-surface">
        <div class="dialog-icon ${copy.active ? 'dialog-icon-danger' : 'dialog-icon-success'}">${icon(copy.active ? 'warning' : 'check_circle')}</div>
        <h2 id="resource-dialog-title">${escapeHtml(copy.title)}</h2>
        <p id="resource-dialog-description">${escapeHtml(copy.description)}</p>
        ${state.key === 'catalogo' && copy.active ? `<p class="technical-id">ID: <code>${escapeHtml(itemId(state.key, item))}</code></p>` : ''}
        ${renderModalError(error)}
        <form data-resource-form data-form-mode="toggle">
          <div class="dialog-actions">
            <button class="interactive-button button-secondary" type="button" data-action="close-modal" ${busy ? 'disabled' : ''}>Voltar</button>
            <button class="interactive-button ${copy.active ? 'button-danger' : 'button-primary'}" type="submit" ${busy ? 'disabled aria-busy="true"' : ''}>${busy ? `${icon('progress_activity')} Processando` : escapeHtml(copy.submit)}</button>
          </div>
        </form>
      </div>
    </dialog>`;
  }
  const copy = dialogCopy(state.key, mode, item);
  return `<dialog class="resource-dialog" data-resource-dialog aria-labelledby="resource-dialog-title" aria-describedby="resource-dialog-description">
    <div class="dialog-surface">
      <header class="dialog-header">
        <div><p class="eyebrow">${mode === 'edit' ? 'Atualização' : mode === 'entry' ? 'Movimentação' : 'Cadastro'}</p><h2 id="resource-dialog-title">${escapeHtml(copy.title)}</h2><p id="resource-dialog-description">${escapeHtml(copy.description)}</p></div>
        <button class="interactive-button button-ghost icon-button" type="button" data-action="close-modal" aria-label="Fechar" ${busy ? 'disabled' : ''}>${icon('close')}</button>
      </header>
      <form class="resource-form" data-resource-form data-form-mode="${escapeHtml(mode)}">
        ${renderModalError(error)}
        ${copy.body}
        <div class="dialog-actions">
          <button class="interactive-button button-secondary" type="button" data-action="close-modal" ${busy ? 'disabled' : ''}>Cancelar</button>
          <button class="interactive-button button-primary" type="submit" ${busy ? 'disabled aria-busy="true"' : ''}>${busy ? `${icon('progress_activity')} Salvando` : escapeHtml(copy.submit)}</button>
        </div>
      </form>
    </div>
  </dialog>`;
}

function renderPage(definition, state, role, currentSubject = '') {
  return `<section class="resource-page" data-resource-view="${escapeHtml(definition.key)}">
    ${renderHeader(definition, role)}
    ${renderSearch(definition, state)}
    <section class="resource-results" data-resource-results aria-label="Resultados">
      ${renderResults(definition, state, role, currentSubject)}
    </section>
    ${renderDialog(state)}
  </section>`;
}

export function renderResourcesView(route, ctx = {}) {
  const key = routeKey(route);
  if (!key) return renderUnknownRoute();
  const definition = DEFINITIONS[key];
  const role = normalizedRole(ctx);
  if (!isAllowed(definition, role)) return renderAccessDenied();
  return renderPage(
    definition,
    freshState(key),
    role,
    normalizeResourceId(ctx.subject),
  );
}

function normalizePagedResponse(response, page, perPage) {
  const raw = response?.data?.data && Array.isArray(response.data.data)
    ? response.data
    : response;
  const data = Array.isArray(raw?.data)
    ? raw.data
    : Array.isArray(raw)
      ? raw
      : [];
  const meta = raw?.meta ?? {
    pagina: page,
    porPagina: perPage,
    total: data.length,
    totalPaginas: data.length ? 1 : 0,
  };
  return { data, meta };
}

function normalizeEntityResponse(response) {
  if (
    response &&
    typeof response === 'object' &&
    !Array.isArray(response) &&
    'data' in response &&
    !('meta' in response)
  )
    return response.data;
  return response;
}

function statusOf(error) {
  return Number(
    error?.status ?? error?.statusCode ?? error?.response?.status ?? 0,
  );
}

function safeError(error, fallback = 'Não foi possível concluir a operação.') {
  const status = statusOf(error);
  const payload = error?.response?.data ?? error?.data ?? error;
  const rawMessage = payload?.mensagem ?? payload?.message ?? error?.message;
  const joined = Array.isArray(rawMessage) ? rawMessage.join(' ') : rawMessage;
  let message = typeof joined === 'string' && joined.trim() ? joined.trim() : fallback;
  if (status === 401) message = 'Sua sessão expirou. Entre novamente para continuar.';
  if (status === 403) message = 'Seu perfil não permite realizar esta ação.';
  if (status >= 500) message = 'O serviço está indisponível no momento. Tente novamente.';
  if (message.length > 240) message = `${message.slice(0, 237)}…`;
  return {
    status,
    message,
    correlationId:
      payload?.correlationId ?? error?.correlationId ?? error?.response?.headers?.['x-correlation-id'],
  };
}

function formValue(formData, name) {
  return String(formData.get(name) ?? '').trim();
}

function optionalValue(formData, name) {
  const value = formValue(formData, name);
  return value ? value : undefined;
}

function numericValue(formData, name, { optional = false, positive = false } = {}) {
  const raw = formValue(formData, name);
  if (!raw && optional) return undefined;
  const value = Number(raw.replace(',', '.'));
  if (!Number.isFinite(value) || (positive ? value <= 0 : value < 0)) {
    throw new Error(positive ? 'Informe uma quantidade maior que zero.' : 'Informe um valor numérico válido.');
  }
  return value;
}

function compactObject(object) {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined),
  );
}

function buildPayload(key, mode, formData, item = null) {
  if (mode === 'entry') {
    return { quantidade: numericValue(formData, 'quantidade', { positive: true }) };
  }
  if (key === 'clientes') {
    const editing = mode === 'edit';
    const tipoDoc = formValue(formData, 'tipoDoc') || 'CPF';
    const numeroDoc = cleanDocument(formValue(formData, 'numeroDoc'));
    if (!editing) {
      const expected = tipoDoc === 'CPF' ? 11 : 14;
      if (numeroDoc.length !== expected)
        throw new Error(`${tipoDoc} deve ter ${expected} caracteres sem a máscara.`);
    }
    const endereco = compactObject({
      logradouro: optionalValue(formData, 'logradouro'),
      numero: optionalValue(formData, 'numero'),
      complemento: optionalValue(formData, 'complemento'),
      bairro: optionalValue(formData, 'bairro'),
      cidade: optionalValue(formData, 'cidade'),
      estado: optionalValue(formData, 'estado')?.toUpperCase(),
      cep: optionalValue(formData, 'cep'),
    });
    const payload = {
      nome: formValue(formData, 'nome'),
      email: formValue(formData, 'email').toLocaleLowerCase('pt-BR'),
      telefone: formValue(formData, 'telefone'),
      endereco: Object.keys(endereco).length ? endereco : undefined,
    };
    if (editing) {
      payload.usuarioId = optionalValue(formData, 'usuarioId') ?? null;
      return compactObject(payload);
    }
    return compactObject({
      tipoDoc,
      numeroDoc,
      ...payload,
      usuarioId: optionalValue(formData, 'usuarioId'),
    });
  }
  if (key === 'veiculos') {
    if (mode === 'edit') {
      return {
        cor: formValue(formData, 'cor'),
        quilometragem: numericValue(formData, 'quilometragem'),
      };
    }
    const placa = cleanPlate(formValue(formData, 'placa'));
    if (!/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(placa))
      throw new Error('Informe uma placa brasileira válida, antiga ou Mercosul.');
    return {
      placa,
      renavam: formValue(formData, 'renavam').replace(/\D/g, ''),
      chassi: formValue(formData, 'chassi').toUpperCase(),
      marca: formValue(formData, 'marca'),
      modelo: formValue(formData, 'modelo'),
      ano: numericValue(formData, 'ano'),
      cor: formValue(formData, 'cor'),
      quilometragem: numericValue(formData, 'quilometragem'),
    };
  }
  if (key === 'estoque') {
    const base = {
      nome: formValue(formData, 'nome'),
      descricao: optionalValue(formData, 'descricao'),
      precoVenda: numericValue(formData, 'precoVenda'),
    };
    if (mode === 'edit') return { ...base, descricao: base.descricao ?? null };
    return compactObject({
      codigo: formValue(formData, 'codigo'),
      ...base,
      quantidadeInicial: numericValue(formData, 'quantidadeInicial', { optional: true }),
      quantidadeMinima: numericValue(formData, 'quantidadeMinima', { optional: true }),
    });
  }
  if (key === 'catalogo') {
    const description = optionalValue(formData, 'descricao');
    const category = optionalValue(formData, 'categoria');
    return mode === 'edit'
      ? {
          nome: formValue(formData, 'nome'),
          descricao: description ?? null,
          categoria: category ?? null,
        }
      : compactObject({
          nome: formValue(formData, 'nome'),
          descricao: description,
          categoria: category,
        });
  }
  if (mode === 'edit') {
    const nome = formValue(formData, 'nome');
    const email = formValue(formData, 'email').toLocaleLowerCase('pt-BR');
    const papel = formValue(formData, 'papel');
    const senha = optionalValue(formData, 'senha');
    return compactObject({
      nome: nome !== String(item?.nome ?? '').trim() ? nome : undefined,
      email:
        email !== String(item?.email ?? '').trim().toLocaleLowerCase('pt-BR')
          ? email
          : undefined,
      papel: papel !== String(item?.papel ?? '') ? papel : undefined,
      senha,
    });
  }
  return {
    nome: formValue(formData, 'nome'),
    email: formValue(formData, 'email').toLocaleLowerCase('pt-BR'),
    senha: formValue(formData, 'senha'),
    papel: formValue(formData, 'papel'),
  };
}

function findItem(state, id) {
  return state.items.find((item) => itemId(state.key, item) === id) ?? null;
}

function notify(ctx, message, type = 'success') {
  if (typeof ctx.notify === 'function') ctx.notify(message, { type });
}

export function mountResourcesView(root, route, ctx = {}) {
  if (!(root instanceof Element))
    throw new TypeError('mountResourcesView requer um elemento raiz válido.');
  const key = routeKey(route);
  const definition = key ? DEFINITIONS[key] : null;
  const role = normalizedRole(ctx);
  const currentSubject = normalizeResourceId(ctx.subject);
  root.innerHTML = renderResourcesView(route, ctx);
  if (!definition || !isAllowed(definition, role)) return { destroy() {} };
  if (!ctx.api || typeof ctx.api.request !== 'function') {
    throw new TypeError('ctx.api.request(path, options) é obrigatório.');
  }

  const state = freshState(key);
  let destroyed = false;
  let loadSequence = 0;
  let userSearchTimer = null;

  const syncDialog = () => {
    const dialog = root.querySelector('[data-resource-dialog]');
    if (!dialog || dialog.open) return;
    dialog.showModal();
    queueMicrotask(() => {
      dialog.querySelector('input:not([readonly]), select, textarea, button')?.focus();
    });
  };

  const render = () => {
    if (destroyed) return;
    root.innerHTML = renderPage(definition, state, role, currentSubject);
    syncDialog();
  };

  const renderResultsOnly = () => {
    if (destroyed) return;
    const container = root.querySelector('[data-resource-results]');
    if (container) {
      container.innerHTML = renderResults(
        definition,
        state,
        role,
        currentSubject,
      );
    }
  };

  const request = (path, options = {}) =>
    ctx.api.request(path, {
      method: options.method ?? 'GET',
      body: options.body,
      query: options.query,
    });

  const loadPage = async (
    page = state.page,
    { preserveToolbar = false } = {},
  ) => {
    const sequence = ++loadSequence;
    state.loading = true;
    state.error = null;
    state.notFound = '';
    state.mode = 'page';
    state.lookupLabel = '';
    state.page = Math.max(1, Number(page) || 1);
    if (preserveToolbar) renderResultsOnly();
    else render();
    try {
      const query = { pagina: state.page, porPagina: state.perPage };
      if (key === 'usuarios') {
        const busca = state.search.trim();
        if (busca) query.busca = busca;
        if (state.roleFilter) query.papel = state.roleFilter;
        if (state.activeFilter !== '') {
          query.ativo = state.activeFilter === 'true';
        }
      }
      const response = await request(definition.endpoint, {
        query,
      });
      if (destroyed || sequence !== loadSequence) return;
      const normalized = normalizePagedResponse(
        response,
        state.page,
        state.perPage,
      );
      const lastValidPage = Math.max(
        1,
        Number(normalized.meta.totalPaginas ?? 0),
      );
      if (state.page > lastValidPage) {
        return await loadPage(lastValidPage, { preserveToolbar });
      }
      state.items = normalized.data;
      state.meta = normalized.meta;
      state.page = Number(normalized.meta.pagina ?? state.page);
    } catch (error) {
      if (destroyed || sequence !== loadSequence) return;
      state.error = safeError(error, 'Não foi possível carregar esta lista.');
    } finally {
      if (!destroyed && sequence === loadSequence) {
        state.loading = false;
        if (preserveToolbar) renderResultsOnly();
        else render();
      }
    }
  };

  const cancelUserSearchTimer = () => {
    if (userSearchTimer !== null) globalThis.clearTimeout(userSearchTimer);
    userSearchTimer = null;
  };

  const scheduleUserSearch = () => {
    cancelUserSearchTimer();
    userSearchTimer = globalThis.setTimeout(() => {
      userSearchTimer = null;
      void loadPage(1, { preserveToolbar: true });
    }, 300);
  };

  const exactLookup = async (rawQuery) => {
    const query = String(rawQuery ?? '').trim();
    if (!query) return;
    let path = '';
    let label = query;
    if (key === 'clientes') {
      const document = cleanDocument(query);
      if (![11, 14].includes(document.length)) return;
      path = `${definition.endpoint}/documento/${encodeURIComponent(document)}`;
      label = maskDocument(document);
    } else if (key === 'veiculos') {
      const plate = cleanPlate(query);
      if (plate.length !== 7) return;
      path = `${definition.endpoint}/placa/${encodeURIComponent(plate)}`;
      label = maskPlate(plate);
    } else if (key === 'estoque') {
      if (!/^pc[a-z0-9]+$/i.test(query)) return;
      path = `${definition.endpoint}/pecas/${encodeURIComponent(query)}`;
    } else if (key === 'catalogo') {
      if (!/^sv[a-z0-9]+$/i.test(query)) return;
      path = `${definition.endpoint}/${encodeURIComponent(query)}`;
    }
    if (!path) return;
    state.loading = true;
    state.error = null;
    state.notFound = '';
    state.mode = 'lookup';
    state.lookupLabel = label;
    render();
    try {
      const entity = normalizeEntityResponse(await request(path));
      if (destroyed) return;
      state.items = entity ? [entity] : [];
      state.meta = {
        pagina: 1,
        porPagina: 1,
        total: entity ? 1 : 0,
        totalPaginas: entity ? 1 : 0,
      };
    } catch (error) {
      if (destroyed) return;
      const safe = safeError(error);
      if (safe.status === 404) {
        state.notFound = 'Nenhum cadastro corresponde ao valor informado.';
        state.items = [];
      } else state.error = safe;
    } finally {
      state.loading = false;
      render();
    }
  };

  const openDialog = (mode, item = null) => {
    state.dialog = { mode, item, busy: false, error: null };
    render();
  };

  const closeDialog = () => {
    state.dialog = null;
    render();
  };

  const mutationPath = (mode, item, active) => {
    const id = itemId(key, item);
    if (mode === 'create')
      return key === 'estoque' ? `${definition.endpoint}/pecas` : definition.endpoint;
    if (mode === 'entry')
      return `${definition.endpoint}/pecas/${encodeURIComponent(id)}/entrada`;
    const base =
      key === 'estoque'
        ? `${definition.endpoint}/pecas/${encodeURIComponent(id)}`
        : `${definition.endpoint}/${encodeURIComponent(id)}`;
    if (mode === 'toggle') return `${base}/${active ? 'desativar' : 'ativar'}`;
    return base;
  };

  const submitMutation = async (form, mode) => {
    if (!state.dialog || state.dialog.busy) return;
    const item = state.dialog.item;
    let payload;
    try {
      payload = buildPayload(key, mode, new FormData(form), item);
    } catch (error) {
      state.dialog.error = safeError(error);
      render();
      return;
    }
    if (key === 'usuarios' && mode === 'edit' && !Object.keys(payload).length) {
      state.dialog = null;
      notify(ctx, 'Nenhuma alteração foi necessária.', 'info');
      render();
      return;
    }
    state.dialog.busy = true;
    state.dialog.error = null;
    render();
    try {
      const currentlyActive =
        key === 'estoque' ? item?.peca?.ativo !== false : item?.ativo !== false;
      const path = mutationPath(mode, item, currentlyActive);
      const method = mode === 'create' ? 'POST' : 'PATCH';
      await request(path, {
        method,
        body: mode === 'toggle' ? undefined : payload,
      });
      if (destroyed) return;
      state.dialog = null;
      const successMessages = {
        create:
          key === 'usuarios'
            ? 'Usuário criado com sucesso.'
            : 'Cadastro realizado com sucesso.',
        edit: 'Alterações salvas com sucesso.',
        entry: 'Entrada de estoque registrada.',
        toggle: currentlyActive
          ? 'Cadastro desativado com sucesso.'
          : 'Cadastro ativado com sucesso.',
      };
      notify(ctx, successMessages[mode]);
      await loadPage(mode === 'create' ? 1 : state.page);
    } catch (error) {
      if (destroyed || !state.dialog) return;
      state.dialog.busy = false;
      state.dialog.error = safeError(error);
      render();
    }
  };

  const onClick = (event) => {
    const button = event.target.closest('[data-action]');
    if (!button || !root.contains(button)) return;
    const action = button.dataset.action;
    if (action === 'create') {
      cancelUserSearchTimer();
      openDialog('create');
      return;
    }
    if (action === 'close-modal') {
      closeDialog();
      return;
    }
    if (action === 'retry') {
      if (state.mode === 'lookup') exactLookup(state.search);
      else loadPage(state.page);
      return;
    }
    if (action === 'clear-filters' && key === 'usuarios') {
      cancelUserSearchTimer();
      state.search = '';
      state.roleFilter = '';
      state.activeFilter = '';
      loadPage(1);
      return;
    }
    if (action === 'reset-lookup') {
      state.search = '';
      state.notFound = '';
      state.error = null;
      loadPage(1);
      return;
    }
    if (action === 'page') {
      const page = Number(button.dataset.page);
      if (Number.isInteger(page) && page > 0) loadPage(page);
      return;
    }
    const id = button.dataset.itemId;
    const item = findItem(state, id);
    if (!item) return;
    if (action === 'edit') {
      cancelUserSearchTimer();
      openDialog('edit', item);
    }
    if (action === 'entry') openDialog('entry', item);
    if (
      action === 'toggle' &&
      !(
        key === 'usuarios' &&
        item?.ativo !== false &&
        id === currentSubject
      )
    ) {
      cancelUserSearchTimer();
      openDialog('toggle', item);
    }
  };

  const onInput = (event) => {
    if (!event.target.matches('[data-search-input]')) return;
    state.search = event.target.value;
    if (state.mode === 'page' && key !== 'usuarios') renderResultsOnly();
    if (key === 'usuarios') {
      loadSequence += 1;
      state.loading = true;
      state.error = null;
      renderResultsOnly();
      scheduleUserSearch();
    }
  };

  const onChange = (event) => {
    if (key !== 'usuarios' || !event.target.matches('[data-user-filter]')) {
      return;
    }
    cancelUserSearchTimer();
    if (event.target.name === 'papel') state.roleFilter = event.target.value;
    if (event.target.name === 'ativo') state.activeFilter = event.target.value;
    void loadPage(1);
  };

  const onSubmit = (event) => {
    if (event.target.matches('[data-resource-search-form]')) {
      event.preventDefault();
      const formData = new FormData(event.target);
      if (key === 'usuarios') {
        cancelUserSearchTimer();
        state.search = formValue(formData, 'query');
        state.roleFilter = formValue(formData, 'papel');
        state.activeFilter = formValue(formData, 'ativo');
        loadPage(1);
      } else {
        exactLookup(formData.get('query'));
      }
      return;
    }
    if (event.target.matches('[data-resource-form]')) {
      event.preventDefault();
      if (!event.target.reportValidity()) return;
      submitMutation(event.target, event.target.dataset.formMode);
    }
  };

  const onDialogClose = (event) => {
    if (event.target.matches('[data-resource-dialog]') && state.dialog) {
      state.dialog = null;
      render();
    }
  };

  root.addEventListener('click', onClick);
  root.addEventListener('input', onInput);
  root.addEventListener('change', onChange);
  root.addEventListener('submit', onSubmit);
  root.addEventListener('close', onDialogClose, true);

  loadPage(1);

  return {
    destroy() {
      destroyed = true;
      loadSequence += 1;
      cancelUserSearchTimer();
      root.removeEventListener('click', onClick);
      root.removeEventListener('input', onInput);
      root.removeEventListener('change', onChange);
      root.removeEventListener('submit', onSubmit);
      root.removeEventListener('close', onDialogClose, true);
    },
  };
}
