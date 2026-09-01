import { API_ENDPOINTS } from '../api/endpoints.js';
import {
  formatDateTime,
  formatDurationMinutes,
  formatOrderNumber,
} from '../core/formatters.js';
import { getOrderStatusMeta, ORDER_STATUS } from '../core/order-status.js';
import { ROLES } from '../core/permissions.js';
import { pageHeader } from '../components/shell.js';
import {
  button,
  domainId,
  escapeAttribute,
  escapeHtml,
  icon,
  skeleton,
  statePanel,
  statusBadge,
} from '../components/ui-kit.js';

const LIST_QUERY = Object.freeze({ pagina: 1, porPagina: 50 });

const ROLE_COPY = Object.freeze({
  [ROLES.ADMIN]: {
    eyebrow: 'Operação da oficina',
    title: 'Visão geral',
    description: 'Prioridades da fila visível e indicadores reais do ciclo de atendimento.',
  },
  [ROLES.CONSULTANT]: {
    eyebrow: 'Atendimento técnico',
    title: 'Visão geral',
    description: 'Acompanhe a fila visível e os tempos reais que orientam o atendimento.',
  },
  [ROLES.MECHANIC]: {
    eyebrow: 'Bancada técnica',
    title: 'Meu trabalho',
    description: 'Suas ordens ativas na lista visível, organizadas pela etapa atual.',
  },
  [ROLES.CLIENT]: {
    eyebrow: 'Acompanhamento',
    title: 'Meus serviços',
    description: 'Acompanhe as ordens presentes na lista visível e veja quando uma decisão for necessária.',
  },
});

function isKnownRole(role) {
  return Object.hasOwn(ROLE_COPY, role);
}

function normalizeList(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.itens)) return response.itens;
  return [];
}

function countStatus(orders, statuses) {
  const accepted = Array.isArray(statuses) ? statuses : [statuses];
  return orders.filter((order) => accepted.includes(order?.status)).length;
}

function formatCount(value) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function formatPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(number)}%`;
}

function formatKpiTime(kpi) {
  if (!kpi || Number(kpi.totalAmostras) <= 0) return 'Sem dados suficientes';
  return formatDurationMinutes(Number(kpi.mediaHoras) * 60);
}

function metricCard({ label, value, detail, iconName, tone = 'action' }) {
  return `<article class="metric-card" data-tone="${escapeAttribute(tone)}">
    <div class="metric-top">
      <span class="metric-label">${escapeHtml(label)}</span>
      <span class="metric-icon">${icon(iconName)}</span>
    </div>
    <p class="metric-value">${escapeHtml(value)}</p>
    <p class="metric-detail">${icon('info')}<span>${escapeHtml(detail)}</span></p>
  </article>`;
}

function orderHref(order) {
  const id = domainId(order?.id);
  return id ? `#/ordens/${encodeURIComponent(id)}` : '#/ordens';
}

function renderOrdersTable(orders, { title, description }) {
  if (!orders.length) {
    return `<section class="section" aria-labelledby="dashboard-orders-title">
      <div class="section-header"><div><h2 id="dashboard-orders-title">${escapeHtml(title)}</h2><p class="section-description">${escapeHtml(description)}</p></div></div>
      ${statePanel({
        kind: 'empty',
        title: 'Nenhuma ordem nesta lista',
        description: 'Quando houver ordens disponíveis para este perfil, elas aparecerão aqui.',
        iconName: 'assignment_turned_in',
      })}
    </section>`;
  }

  const rows = orders.slice(0, 8).map((order) => {
    const id = domainId(order?.id);
    const vehicleId = domainId(order?.veiculoId);
    const status = getOrderStatusMeta(order?.status);
    return `<tr>
      <td data-label="Ordem"><span class="table-primary">${escapeHtml(formatOrderNumber(order?.numero))}</span><p class="table-secondary">${escapeHtml(id || 'Identificador indisponível')}</p></td>
      <td data-label="Veículo">${escapeHtml(vehicleId || '—')}</td>
      <td data-label="Status">${statusBadge(order?.status, status)}</td>
      <td data-label="Atualizada">${escapeHtml(formatDateTime(order?.atualizadoEm ?? order?.criadoEm))}</td>
      <td data-label="Ação"><div class="table-actions">${button({
        label: 'Abrir',
        iconName: 'arrow_forward',
        variant: 'ghost',
        href: orderHref(order),
        className: 'button-small',
        ariaLabel: `Abrir ordem ${formatOrderNumber(order?.numero)}`,
        attributes: id ? `data-order-link data-order-id="${escapeAttribute(id)}"` : '',
      })}</div></td>
    </tr>`;
  }).join('');

  return `<section class="section" aria-labelledby="dashboard-orders-title">
    <div class="section-header"><div><h2 id="dashboard-orders-title">${escapeHtml(title)}</h2><p class="section-description">${escapeHtml(description)}</p></div>${button({ label: 'Ver todas', iconName: 'view_list', variant: 'secondary', href: '#/ordens', className: 'button-small' })}</div>
    <div class="responsive-table">
      <table class="data-table">
        <caption>Até oito ordens retornadas na primeira página da lista visível.</caption>
        <thead><tr><th scope="col">Ordem</th><th scope="col">Veículo</th><th scope="col">Status</th><th scope="col">Atualizada</th><th scope="col">Ação</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </section>`;
}

function renderInternalDashboard(role, orders, kpis) {
  const copy = ROLE_COPY[role];
  const received = countStatus(orders, ORDER_STATUS.RECEIVED);
  const diagnosing = countStatus(orders, ORDER_STATUS.IN_DIAGNOSIS);
  const awaiting = countStatus(orders, ORDER_STATUS.AWAITING_APPROVAL);
  const executing = countStatus(orders, ORDER_STATUS.IN_PROGRESS);

  return `${pageHeader({
    ...copy,
    actions: button({ label: 'Nova ordem', iconName: 'add', variant: 'primary', href: '#/ordens/nova' }),
  })}
  <section aria-labelledby="visible-queue-title">
    <div class="section-header"><div><h2 id="visible-queue-title">Fila visível</h2><p class="section-description">Contagens derivadas somente dos ${formatCount(orders.length)} itens retornados nesta página; não representam totais globais.</p></div></div>
    <div class="metric-grid">
      ${metricCard({ label: 'Recebidas · fila visível', value: formatCount(received), detail: 'Aguardam atribuição', iconName: 'inbox', tone: 'received' })}
      ${metricCard({ label: 'Em diagnóstico · fila visível', value: formatCount(diagnosing), detail: 'Em avaliação técnica', iconName: 'troubleshoot', tone: 'diagnosis' })}
      ${metricCard({ label: 'Aguardando cliente · fila visível', value: formatCount(awaiting), detail: 'Somente o cliente decide', iconName: 'schedule', tone: 'awaiting' })}
      ${metricCard({ label: 'Em execução · fila visível', value: formatCount(executing), detail: 'Serviços aprovados em andamento', iconName: 'build', tone: 'execution' })}
    </div>
  </section>
  <section class="section" aria-labelledby="cycle-kpis-title">
    <div class="section-header"><div><h2 id="cycle-kpis-title">Indicadores reais do ciclo</h2><p class="section-description">Médias calculadas pela API sobre ordens com eventos suficientes.</p></div>${button({ label: 'Abrir relatórios', iconName: 'monitoring', variant: 'secondary', href: '#/relatorios', className: 'button-small' })}</div>
    <div class="metric-grid">
      ${metricCard({ label: 'Lead-time médio', value: formatKpiTime(kpis?.leadTimeTotal), detail: `${formatCount(kpis?.leadTimeTotal?.totalAmostras)} amostra(s)`, iconName: 'route' })}
      ${metricCard({ label: 'Tempo técnico líquido', value: formatKpiTime(kpis?.tempoTecnicoLiquido), detail: `${formatCount(kpis?.tempoTecnicoLiquido?.totalAmostras)} amostra(s)`, iconName: 'engineering' })}
      ${metricCard({ label: 'Execução média', value: formatKpiTime(kpis?.execucao), detail: `${formatCount(kpis?.execucao?.totalAmostras)} amostra(s)`, iconName: 'timer' })}
      ${metricCard({ label: 'Taxa de aprovação', value: formatPercent(kpis?.taxaAprovacaoOrcamento), detail: 'Percentual informado pela API', iconName: 'verified' })}
    </div>
  </section>
  ${renderOrdersTable(orders, {
    title: 'Prioridades da fila',
    description: 'Ordem priorizada pelo backend; a equipe monitora aprovações sem decidir pelo cliente.',
  })}`;
}

function renderMechanicDashboard(orders) {
  const ready = countStatus(orders, ORDER_STATUS.APPROVED);
  const executing = countStatus(orders, ORDER_STATUS.IN_PROGRESS);
  const diagnosis = countStatus(orders, [ORDER_STATUS.ASSIGNED, ORDER_STATUS.IN_DIAGNOSIS]);
  const waiting = countStatus(orders, ORDER_STATUS.AWAITING_APPROVAL);

  return `${pageHeader(ROLE_COPY[ROLES.MECHANIC])}
  <section aria-labelledby="mechanic-visible-title">
    <div class="section-header"><div><h2 id="mechanic-visible-title">Minha lista visível</h2><p class="section-description">Contagens dos ${formatCount(orders.length)} itens retornados nesta página, sem inferir totais fora da lista.</p></div></div>
    <div class="metric-grid">
      ${metricCard({ label: 'Diagnóstico · lista visível', value: formatCount(diagnosis), detail: 'Ordens atribuídas ou em diagnóstico', iconName: 'troubleshoot' })}
      ${metricCard({ label: 'Prontas para iniciar · lista visível', value: formatCount(ready), detail: 'Orçamentos aprovados pelo cliente', iconName: 'play_circle' })}
      ${metricCard({ label: 'Em execução · lista visível', value: formatCount(executing), detail: 'Serviços em andamento', iconName: 'build' })}
      ${metricCard({ label: 'Aguardando cliente · lista visível', value: formatCount(waiting), detail: 'Acompanhe; nenhuma ação técnica nesta etapa', iconName: 'schedule' })}
    </div>
  </section>
  ${renderOrdersTable(orders, {
    title: 'Ordens sob sua responsabilidade',
    description: 'Abra uma ordem para ver a próxima ação permitida pelo status atual.',
  })}`;
}

function renderClientDashboard(orders) {
  const decision = countStatus(orders, ORDER_STATUS.AWAITING_APPROVAL);
  const active = countStatus(orders, [
    ORDER_STATUS.RECEIVED,
    ORDER_STATUS.ASSIGNED,
    ORDER_STATUS.IN_DIAGNOSIS,
    ORDER_STATUS.APPROVED,
    ORDER_STATUS.IN_PROGRESS,
  ]);
  const finished = countStatus(orders, ORDER_STATUS.FINISHED);
  const delivered = countStatus(orders, ORDER_STATUS.DELIVERED);

  return `${pageHeader(ROLE_COPY[ROLES.CLIENT])}
  ${decision > 0 ? `<section class="next-action-panel" aria-labelledby="client-next-action"><span class="metric-icon">${icon('priority_high')}</span><div><p class="page-eyebrow">Sua próxima ação</p><h2 id="client-next-action">Há ${formatCount(decision)} orçamento(s) aguardando sua decisão na lista visível</h2><p>Abra a ordem para aprovar ou rejeitar. A equipe da oficina não pode decidir por você.</p></div>${button({ label: 'Ver minhas ordens', iconName: 'arrow_forward', variant: 'primary', href: '#/ordens' })}</section>` : ''}
  <section class="section" aria-labelledby="client-visible-title">
    <div class="section-header"><div><h2 id="client-visible-title">Resumo da lista visível</h2><p class="section-description">Contagens dos ${formatCount(orders.length)} itens retornados nesta página; não são totais globais.</p></div></div>
    <div class="metric-grid">
      ${metricCard({ label: 'Aguardando sua decisão · lista visível', value: formatCount(decision), detail: 'Orçamentos para aprovar ou rejeitar', iconName: 'how_to_reg' })}
      ${metricCard({ label: 'Em andamento · lista visível', value: formatCount(active), detail: 'Serviços antes da finalização', iconName: 'settings' })}
      ${metricCard({ label: 'Finalizadas · lista visível', value: formatCount(finished), detail: 'Aguardam entrega do veículo', iconName: 'task_alt' })}
      ${metricCard({ label: 'Entregues · lista visível', value: formatCount(delivered), detail: 'Atendimentos concluídos', iconName: 'key' })}
    </div>
  </section>
  ${renderOrdersTable(orders, {
    title: 'Minhas ordens',
    description: 'Somente dados das suas próprias ordens são exibidos nesta área.',
  })}`;
}

export function renderDashboardView({ role } = {}) {
  if (!isKnownRole(role)) {
    return statePanel({
      kind: 'forbidden',
      title: 'Perfil sem acesso ao painel',
      description: 'Seu perfil não possui uma visão inicial configurada.',
      iconName: 'lock',
    });
  }
  const copy = ROLE_COPY[role];
  return `${pageHeader(copy)}${skeleton({ cards: 4, rows: 5, label: 'Carregando painel' })}`;
}

function errorMarkup(error) {
  return statePanel({
    kind: 'error',
    title: 'Não foi possível carregar o painel',
    description: 'Verifique sua conexão e tente novamente. Nenhum dado estimado foi exibido.',
    actionLabel: 'Tentar novamente',
    action: 'retry-dashboard',
    correlationId: error?.correlationId,
  });
}

function announce(notify, payload) {
  if (typeof notify === 'function') notify(payload);
}

export async function mountDashboardView(root, {
  role,
  api,
  navigate,
  notify,
} = {}) {
  if (!root?.querySelector) {
    throw new TypeError('Uma raiz válida é obrigatória para montar o painel.');
  }
  if (!isKnownRole(role)) {
    root.innerHTML = renderDashboardView({ role });
    return () => {};
  }

  let loadVersion = 0;
  const load = async () => {
    const version = ++loadVersion;
    root.innerHTML = renderDashboardView({ role });
    try {
      if (typeof api?.request !== 'function') {
        throw new TypeError('Cliente da API indisponível.');
      }

      if (role === ROLES.ADMIN || role === ROLES.CONSULTANT) {
        const [queueResponse, kpis] = await Promise.all([
          api.request(API_ENDPOINTS.orders.queue, { method: 'GET', query: LIST_QUERY }),
          api.request(API_ENDPOINTS.orders.reportKpis, { method: 'GET' }),
        ]);
        if (version !== loadVersion) return;
        root.innerHTML = renderInternalDashboard(role, normalizeList(queueResponse), kpis ?? {});
        return;
      }

      const path = role === ROLES.MECHANIC
        ? API_ENDPOINTS.orders.mechanicMine
        : API_ENDPOINTS.orders.clientMine;
      const response = await api.request(path, { method: 'GET', query: LIST_QUERY });
      if (version !== loadVersion) return;
      const orders = normalizeList(response);
      root.innerHTML = role === ROLES.MECHANIC
        ? renderMechanicDashboard(orders)
        : renderClientDashboard(orders);
    } catch (error) {
      if (version !== loadVersion) return;
      root.innerHTML = `${pageHeader(ROLE_COPY[role])}${errorMarkup(error)}`;
      announce(notify, {
        title: 'Painel indisponível',
        message: 'Não foi possível consultar os dados agora.',
        kind: 'error',
      });
    }
  };

  const onClick = (event) => {
    const retry = event.target.closest('[data-action="retry-dashboard"]');
    if (retry) {
      event.preventDefault();
      void load();
      return;
    }
    const orderLink = event.target.closest('[data-order-link]');
    if (!orderLink || typeof navigate !== 'function') return;
    const id = orderLink.dataset.orderId;
    if (!id) return;
    event.preventDefault();
    navigate(`/ordens/${id}`);
  };

  root.addEventListener('click', onClick);
  await load();
  return () => {
    loadVersion += 1;
    root.removeEventListener('click', onClick);
  };
}
