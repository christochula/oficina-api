import { API_ENDPOINTS } from '../api/endpoints.js';
import {
  formatDateTime,
  formatDurationMinutes,
  formatOrderNumber,
} from '../core/formatters.js';
import { can, CAPABILITIES, ROLES } from '../core/permissions.js';
import { pageHeader } from '../components/shell.js';
import {
  button,
  domainId,
  escapeAttribute,
  escapeHtml,
  icon,
  skeleton,
  statePanel,
} from '../components/ui-kit.js';

const KPI_DEFINITIONS = Object.freeze([
  {
    key: 'esperaAtribuicao',
    label: 'Espera por atribuição',
    description: 'Da abertura da ordem até a definição do mecânico.',
    iconName: 'person_search',
  },
  {
    key: 'diagnosticoOrcamento',
    label: 'Diagnóstico e orçamento',
    description: 'Da atribuição até a geração do orçamento.',
    iconName: 'troubleshoot',
  },
  {
    key: 'aprovacaoCliente',
    label: 'Decisão do cliente',
    description: 'Da geração do orçamento até sua aprovação.',
    iconName: 'how_to_reg',
  },
  {
    key: 'execucao',
    label: 'Execução técnica',
    description: 'Do início da execução até a finalização técnica.',
    iconName: 'build',
  },
  {
    key: 'esperaEntrega',
    label: 'Espera para entrega',
    description: 'Da finalização técnica até a entrega do veículo.',
    iconName: 'key',
  },
  {
    key: 'leadTimeTotal',
    label: 'Lead-time total',
    description: 'Da abertura da ordem até a entrega do veículo.',
    iconName: 'route',
  },
  {
    key: 'tempoTecnicoLiquido',
    label: 'Tempo técnico líquido',
    description: 'Lead-time sem espera de atribuição, decisão e entrega.',
    iconName: 'engineering',
  },
]);

function hasReportAccess(role) {
  return can(role, CAPABILITIES.VIEW_REPORTS) &&
    (role === ROLES.ADMIN || role === ROLES.CONSULTANT);
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatCount(value) {
  const number = finiteNumber(value) ?? 0;
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(number);
}

function formatPercent(value) {
  const number = finiteNumber(value);
  if (number === null) return '—';
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(number)}%`;
}

function formatHours(value) {
  const hours = finiteNumber(value);
  if (hours === null || hours < 0) return '—';
  return formatDurationMinutes(hours * 60);
}

function hasSamples(metric) {
  return finiteNumber(metric?.totalAmostras) > 0;
}

function formatMetricHours(metric, property) {
  return hasSamples(metric)
    ? formatHours(metric?.[property])
    : 'Sem dados suficientes';
}

function metricCard({ label, value, detail, iconName }) {
  return `<article class="metric-card">
    <div class="metric-top"><span class="metric-label">${escapeHtml(label)}</span><span class="metric-icon">${icon(iconName)}</span></div>
    <p class="metric-value">${escapeHtml(value)}</p>
    <p class="metric-detail">${icon('info')}<span>${escapeHtml(detail)}</span></p>
  </article>`;
}

function reportsHeader() {
  return pageHeader({
    eyebrow: 'Eficiência operacional',
    title: 'Relatórios',
    description: 'Tempos e taxas calculados pela API a partir do histórico real das ordens de serviço.',
    actions: button({
      label: 'Atualizar dados',
      iconName: 'refresh',
      variant: 'secondary',
      action: 'refresh-reports',
    }),
  });
}

function accessDeniedMarkup() {
  return statePanel({
    kind: 'forbidden',
    title: 'Relatórios restritos',
    description: 'Somente administradores e consultores técnicos podem consultar estes indicadores.',
    iconName: 'lock',
  });
}

export function renderReportsView({ role } = {}) {
  if (!hasReportAccess(role)) return accessDeniedMarkup();
  return `${reportsHeader()}${skeleton({ cards: 4, rows: 7, label: 'Carregando relatórios' })}`;
}

function renderLeadTimeSummary(leadTime) {
  const total = Math.max(0, finiteNumber(leadTime?.totalOSEntregues) ?? 0);
  const enoughData = total > 0;
  const formatLead = (value) => enoughData ? formatHours(value) : 'Sem dados suficientes';
  return `<section aria-labelledby="lead-time-summary-title">
    <div class="section-header"><div><h2 id="lead-time-summary-title">Lead-time das ordens entregues</h2><p class="section-description">Do momento da abertura até o registro da entrega do veículo.</p></div></div>
    <div class="metric-grid">
      ${metricCard({ label: 'Ordens entregues analisadas', value: formatCount(total), detail: 'Amostras retornadas pelo relatório', iconName: 'assignment_turned_in' })}
      ${metricCard({ label: 'Lead-time médio', value: formatLead(leadTime?.leadTimeMedioHoras), detail: enoughData ? 'Média das ordens entregues' : 'Sem ordens entregues para calcular', iconName: 'avg_time' })}
      ${metricCard({ label: 'Menor lead-time', value: formatLead(leadTime?.leadTimeMinimoHoras), detail: enoughData ? 'Menor duração observada' : 'Sem dados suficientes', iconName: 'south_east' })}
      ${metricCard({ label: 'Maior lead-time', value: formatLead(leadTime?.leadTimeMaximoHoras), detail: enoughData ? 'Maior duração observada' : 'Sem dados suficientes', iconName: 'north_east' })}
    </div>
  </section>`;
}

function renderKpiCards(kpis) {
  const lead = kpis?.leadTimeTotal;
  const technical = kpis?.tempoTecnicoLiquido;
  const execution = kpis?.execucao;
  const approval = finiteNumber(kpis?.taxaAprovacaoOrcamento);
  const approvalProgress = Math.min(100, Math.max(0, approval ?? 0));

  return `<section class="section" aria-labelledby="kpi-highlights-title">
    <div class="section-header"><div><h2 id="kpi-highlights-title">Indicadores de ciclo</h2><p class="section-description">Cada tempo usa somente ordens que possuem os dois eventos necessários para o cálculo.</p></div></div>
    <div class="metric-grid">
      ${metricCard({ label: 'Lead-time médio', value: formatMetricHours(lead, 'mediaHoras'), detail: `${formatCount(lead?.totalAmostras)} amostra(s)`, iconName: 'route' })}
      ${metricCard({ label: 'Tempo técnico líquido médio', value: formatMetricHours(technical, 'mediaHoras'), detail: `${formatCount(technical?.totalAmostras)} amostra(s)`, iconName: 'engineering' })}
      ${metricCard({ label: 'Execução média', value: formatMetricHours(execution, 'mediaHoras'), detail: `${formatCount(execution?.totalAmostras)} amostra(s)`, iconName: 'timer' })}
      <article class="metric-card">
        <div class="metric-top"><span class="metric-label">Taxa de aprovação de orçamentos</span><span class="metric-icon">${icon('verified')}</span></div>
        <p class="metric-value">${escapeHtml(formatPercent(approval))}</p>
        <div class="metric-detail"><span>Percentual calculado pela API</span></div>
        <div class="kpi-bar" role="progressbar" aria-label="Taxa de aprovação de orçamentos" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${escapeAttribute(approvalProgress)}"><span style="--progress: ${escapeAttribute(approvalProgress)}%"></span></div>
      </article>
    </div>
  </section>`;
}

function renderKpiTable(kpis) {
  const rows = KPI_DEFINITIONS.map((definition) => {
    const metric = kpis?.[definition.key];
    const enoughData = hasSamples(metric);
    const average = formatMetricHours(metric, 'mediaHoras');
    const minimum = formatMetricHours(metric, 'minimoHoras');
    const maximum = formatMetricHours(metric, 'maximoHoras');
    return `<tr>
      <td data-label="Indicador"><div class="table-primary">${icon(definition.iconName)} ${escapeHtml(definition.label)}</div><p class="table-secondary">${escapeHtml(definition.description)}</p></td>
      <td data-label="Média">${escapeHtml(average)}</td>
      <td data-label="Mínimo">${escapeHtml(minimum)}</td>
      <td data-label="Máximo">${escapeHtml(maximum)}</td>
      <td data-label="Amostras">${enoughData ? escapeHtml(formatCount(metric?.totalAmostras)) : '<span class="text-muted">0 · Sem dados suficientes</span>'}</td>
    </tr>`;
  }).join('');

  return `<section class="section" aria-labelledby="kpi-detail-title">
    <div class="section-header"><div><h2 id="kpi-detail-title">Detalhamento dos tempos</h2><p class="section-description">Média, mínimo e máximo em cada segmento do fluxo.</p></div></div>
    <div class="responsive-table">
      <table class="data-table">
        <caption>Indicadores de tempo calculados sobre o histórico das ordens de serviço.</caption>
        <thead><tr><th scope="col">Indicador</th><th scope="col">Média</th><th scope="col">Mínimo</th><th scope="col">Máximo</th><th scope="col">Amostras</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </section>`;
}

function normalizeLeadOrders(leadTime) {
  return Array.isArray(leadTime?.ordens) ? leadTime.ordens : [];
}

function renderLeadTimeOrders(leadTime) {
  const orders = normalizeLeadOrders(leadTime);
  if (!orders.length) {
    return `<section class="section" aria-labelledby="lead-orders-title">
      <div class="section-header"><div><h2 id="lead-orders-title">Ordens consideradas</h2><p class="section-description">Detalhamento individual das ordens entregues.</p></div></div>
      ${statePanel({
        kind: 'empty',
        title: 'Sem dados suficientes',
        description: 'Ainda não há ordens entregues com histórico suficiente para o relatório de lead-time.',
        iconName: 'query_stats',
      })}
    </section>`;
  }

  const rows = orders.map((order) => {
    const id = domainId(order?.osId);
    return `<tr>
      <td data-label="Ordem"><span class="table-primary">${escapeHtml(formatOrderNumber(order?.numero))}</span><p class="table-secondary">${escapeHtml(id || 'Identificador indisponível')}</p></td>
      <td data-label="Abertura">${escapeHtml(formatDateTime(order?.criadoEm))}</td>
      <td data-label="Entrega">${escapeHtml(formatDateTime(order?.entregueEm))}</td>
      <td data-label="Lead-time">${escapeHtml(formatHours(order?.leadTimeHoras))}</td>
      <td data-label="Ação"><div class="table-actions">${button({
        label: 'Abrir',
        iconName: 'arrow_forward',
        variant: 'ghost',
        href: id ? `#/ordens/${encodeURIComponent(id)}` : '#/ordens',
        className: 'button-small',
        ariaLabel: `Abrir ordem ${formatOrderNumber(order?.numero)}`,
        attributes: id ? `data-report-order data-order-id="${escapeAttribute(id)}"` : '',
      })}</div></td>
    </tr>`;
  }).join('');

  return `<section class="section" aria-labelledby="lead-orders-title">
    <div class="section-header"><div><h2 id="lead-orders-title">Ordens consideradas</h2><p class="section-description">Detalhamento individual retornado pelo relatório de lead-time.</p></div></div>
    <div class="responsive-table">
      <table class="data-table">
        <caption>${escapeHtml(formatCount(orders.length))} ordem(ns) entregue(s) no conjunto retornado.</caption>
        <thead><tr><th scope="col">Ordem</th><th scope="col">Abertura</th><th scope="col">Entrega</th><th scope="col">Lead-time</th><th scope="col">Ação</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </section>`;
}

function renderReportData(leadTime, kpis) {
  return `${reportsHeader()}
    ${renderLeadTimeSummary(leadTime)}
    ${renderKpiCards(kpis)}
    ${renderKpiTable(kpis)}
    ${renderLeadTimeOrders(leadTime)}`;
}

function renderReportError(error) {
  return `${reportsHeader()}${statePanel({
    kind: 'error',
    title: 'Não foi possível carregar os relatórios',
    description: 'Os indicadores não foram estimados. Verifique a conexão e tente novamente.',
    actionLabel: 'Tentar novamente',
    action: 'refresh-reports',
    correlationId: error?.correlationId,
  })}`;
}

function announce(notify, payload) {
  if (typeof notify === 'function') notify(payload);
}

export async function mountReportsView(root, {
  role,
  api,
  navigate,
  notify,
} = {}) {
  if (!root?.querySelector) {
    throw new TypeError('Uma raiz válida é obrigatória para montar os relatórios.');
  }
  if (!hasReportAccess(role)) {
    root.innerHTML = accessDeniedMarkup();
    return () => {};
  }

  let loadVersion = 0;
  const load = async () => {
    const version = ++loadVersion;
    root.innerHTML = renderReportsView({ role });
    try {
      if (typeof api?.request !== 'function') {
        throw new TypeError('Cliente da API indisponível.');
      }
      const [leadTime, kpis] = await Promise.all([
        api.request(API_ENDPOINTS.orders.reportLeadTime, { method: 'GET' }),
        api.request(API_ENDPOINTS.orders.reportKpis, { method: 'GET' }),
      ]);
      if (version !== loadVersion) return;
      root.innerHTML = renderReportData(leadTime ?? {}, kpis ?? {});
    } catch (error) {
      if (version !== loadVersion) return;
      root.innerHTML = renderReportError(error);
      announce(notify, {
        title: 'Relatórios indisponíveis',
        message: 'Não foi possível consultar os indicadores agora.',
        kind: 'error',
      });
    }
  };

  const onClick = (event) => {
    const refresh = event.target.closest('[data-action="refresh-reports"]');
    if (refresh) {
      event.preventDefault();
      void load();
      return;
    }
    const orderLink = event.target.closest('[data-report-order]');
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
