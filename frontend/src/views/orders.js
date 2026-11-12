export { renderOrdersListView, mountOrdersListView } from './order-list.js';
import { budgetBuilderModal, budgetPayload, validBudgetLines } from './order-budget.js';
export { validBudgetLines } from './order-budget.js';
export { renderNewOrderView, mountNewOrderView } from './order-wizard.js';
import { ROLES } from '../core/permissions.js';
import { buildOrderTimeline, getOrderStatusMeta } from '../core/order-status.js';
import { canRetryPreparation, checkoutDestination, expectedStatusAfterAction, orderFollowupPolicy, orderTransitionObserved } from '../core/order-followup.js';
import { beginConsumption, finishConsumption, pendingConsumption } from '../core/consumption-attempt.js';
import { formatCurrency, formatDateTime, formatOrderNumber } from '../core/formatters.js';
import {
  button,
  confirmAction,
  domainId,
  escapeAttribute,
  escapeHtml,
  icon,
  openModal,
  setButtonBusy,
  skeleton,
  statePanel,
  statusBadge,
} from '../components/ui-kit.js';

import {
  mountMechanicCombobox,
  renderMechanicComboboxField,
} from '../components/mechanic-combobox.js';
import { pageHeader } from '../components/shell.js';
import { apiErrorMessage } from '../services/domain-api.js';

const INTERNAL_ROLES = new Set([ROLES.ADMIN, ROLES.CONSULTANT]);

function orderId(order) {
  return domainId(order?.id);
}

function statusMeta(status) {
  const meta = getOrderStatusMeta(status) ?? {};
  return {
    label: meta.label ?? String(status ?? 'Status desconhecido').replaceAll('_', ' '),
    icon: meta.icon ?? 'circle',
  };
}

function orderNumber(order) {
  return formatOrderNumber?.(order?.numero) ?? `OS ${order?.numero ?? '—'}`;
}

function orderDetailPath(role, id) {
  if (role === ROLES.MECHANIC) return `/ordens-servico/mecanico/${encodeURIComponent(id)}`;
  if (role === ROLES.CLIENT) return `/ordens-servico/minhas/${encodeURIComponent(id)}`;
  return `/ordens-servico/${encodeURIComponent(id)}`;
}

export function renderOrderDetailView() {
  return `<div id="order-detail">${skeleton({ cards: 2, rows: 8, label: 'Carregando detalhes da ordem' })}</div>`;
}

function timelineMarkup(order) {
  const items = buildOrderTimeline(order.status) ?? [];
  return `<ol class="timeline" aria-label="Etapas da ordem">${items.map((item) => `<li class="timeline-item ${item.state === 'completed' ? 'is-complete' : ''} ${item.state === 'current' ? 'is-current status-pulse' : ''} ${item.state === 'canceled' ? 'is-canceled' : ''}"><span class="timeline-marker">${icon(item.icon ?? (item.state === 'completed' ? 'check' : 'circle'))}</span><div><strong>${escapeHtml(item.label ?? statusMeta(item.status).label)}</strong>${item.state === 'current' ? '<small>Etapa atual</small>' : ''}</div></li>`).join('')}</ol>`;
}

function orderLines(order) {
  return order.orcamento?.grupos?.flatMap((group) => group.linhasServico ?? group.linhas ?? []) ?? [];
}

function budgetMarkup(order, clientView) {
  if (!order.orcamento) return statePanel({ kind: 'empty', title: 'Orçamento ainda não gerado', description: 'O mecânico responsável registrará as linhas depois do diagnóstico.' });
  const groups = order.orcamento.grupos ?? [];
  return `<div class="budget-groups">${groups.map((group) => {
    const lines = group.linhasServico ?? group.linhas ?? [];
    return `<section class="budget-group"><header><h3>${escapeHtml(group.titulo)}</h3><strong>${escapeHtml(formatCurrency(group.total ?? lines.reduce((sum, line) => sum + Number(line.subtotal ?? 0), 0)))}</strong></header><div class="responsive-table-wrapper"><table class="responsive-table"><thead><tr><th>Item</th><th>Tipo</th><th>Qtd.</th><th>Unitário</th><th>Subtotal</th></tr></thead><tbody>${lines.map((line) => `<tr><td data-label="Item">${escapeHtml(line.descricao)}</td><td data-label="Tipo">${escapeHtml(line.tipo === 'MATERIAL' ? 'Material' : 'Serviço')}</td><td data-label="Quantidade">${escapeHtml(line.quantidade)}</td><td data-label="Unitário">${escapeHtml(formatCurrency(line.valorUnitario))}</td><td data-label="Subtotal"><strong>${escapeHtml(formatCurrency(line.subtotal ?? Number(line.quantidade) * Number(line.valorUnitario)))}</strong></td></tr>`).join('')}</tbody></table></div></section>`;
  }).join('')}<footer class="budget-total"><span>Total do orçamento</span><strong>${escapeHtml(formatCurrency(order.orcamento.total))}</strong></footer>${order.orcamento.notasCliente ? `<aside class="customer-note"><strong>${icon('chat')} Observação da oficina</strong><p>${escapeHtml(order.orcamento.notasCliente)}</p></aside>` : ''}${!clientView && order.orcamento.notasInternas ? `<aside class="internal-note"><strong>${icon('lock')} Nota interna</strong><p>${escapeHtml(order.orcamento.notasInternas)}</p></aside>` : ''}</div>`;
}

function historyMarkup(order) {
  const history = [...(order.historico ?? [])].sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm));
  if (!history.length) return statePanel({ kind: 'empty', title: 'Sem histórico disponível', description: 'Os eventos da ordem aparecerão aqui conforme o ciclo avançar.' });
  return `<ol class="event-list">${history.map((event) => `<li><span class="event-icon">${icon('history')}</span><div><strong>${escapeHtml(String(event.evento ?? 'Atualização').replaceAll('_', ' '))}</strong><p>${event.statusAnterior ? `${escapeHtml(statusMeta(event.statusAnterior).label)} → ` : ''}${escapeHtml(statusMeta(event.statusNovo).label)}</p><time datetime="${escapeAttribute(event.criadoEm ?? '')}">${escapeHtml(formatDateTime(event.criadoEm))}</time></div></li>`).join('')}</ol>`;
}

function orderContextMarkup(order, clientView) {
  const payment = order.paymentConfirmed || order.pagamento?.status === 'APPROVED'
    ? 'Confirmado' : order.pagamento?.status === 'REJECTED' ? 'Não aprovado' : 'Aguardando confirmação';
  return `<article class="context-card"><h2>Resumo do atendimento</h2><dl>
    <div><dt>Ordem</dt><dd>${escapeHtml(orderNumber(order))}</dd></div>
    <div><dt>Cliente</dt><dd>${escapeHtml(order.clienteNome || 'Cadastro anterior sem nome disponível')}</dd></div>
    <div><dt>Veículo</dt><dd>${escapeHtml([order.veiculoPlaca, order.veiculoMarca, order.veiculoModelo].filter(Boolean).join(' · ') || 'Cadastro anterior sem identificação disponível')}</dd></div>
    ${!clientView ? `<div><dt>Mecânico</dt><dd>${escapeHtml(order.mecanicoNome || 'Ainda não atribuído')}</dd></div>` : ''}
    <div><dt>Filial</dt><dd>${escapeHtml(order.filialId || 'Não informada')}</dd></div>
    <div><dt>Orçamento</dt><dd>${order.orcamento ? escapeHtml(formatCurrency(order.orcamento.total)) : 'Em elaboração'}</dd></div>
    ${order.pagamento || order.paymentConfirmed ? `<div><dt>Pagamento</dt><dd>${escapeHtml(payment)}</dd></div>` : ''}
  </dl>${clientView ? '<p class="field-hint">Use o número da OS ao falar com a oficina.</p>' : `<details class="order-references"><summary>Identificadores do atendimento</summary><dl>
    <div><dt>Ordem</dt><dd class="mono-value">${escapeHtml(orderId(order))}</dd></div>
    <div><dt>Veículo</dt><dd class="mono-value">${escapeHtml(domainId(order.veiculoId))}</dd></div>
    <div><dt>Cliente</dt><dd class="mono-value">${escapeHtml(domainId(order.clienteId))}</dd></div>
    <div><dt>Mecânico</dt><dd class="mono-value">${escapeHtml(domainId(order.mecanicoResponsavelId) || 'Não atribuído')}</dd></div>
  </dl></details>`}</article>`;
}

function awaitingRegistration(order) {
  return order.status === 'RECEBIDA' &&
    Array.isArray(order.sincronizacaoPendente) &&
    order.sincronizacaoPendente.length > 0;
}

function canReconcilePreparation(order, role) {
  return role === ROLES.ADMIN && order.status === 'APROVADA' &&
    order.preparacao === 'MANUAL_ATTENTION' && !order.paymentConfirmed &&
    typeof order.sagaId === 'string' &&
    /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(order.sagaId);
}

function confirmPreparationReconciliation() {
  return new Promise((resolve) => {
    const modal = openModal({
      title: 'Reconciliar a preparação?',
      content: `<div class="confirmation-copy">${icon('help')}<div><p>Esta ação solicita o cancelamento da preparação antes do início do reparo. A ordem e o orçamento aprovado serão preservados.</p><small>A reconciliação não repõe o estoque. Aguarde a compensação terminar, corrija a falta de peças e só então tente preparar a execução novamente.</small></div></div>`,
      actions: `${button({ label: 'Cancelar', variant: 'ghost', action: 'modal-cancel' })}${button({ label: 'Reconciliar preparação', iconName: 'check', variant: 'primary', action: 'modal-confirm' })}`,
    });
    if (!modal) return resolve(false);
    modal.onClose(() => resolve(false));
    modal.root.querySelector('[data-action="modal-cancel"]')?.addEventListener('click', modal.close);
    modal.root.querySelector('[data-action="modal-confirm"]')?.addEventListener('click', () => {
      resolve(true);
      modal.close();
    });
  });
}

function nextAction(order, role) {
  const status = order.status;
  if (status === 'ENTREGUE') return { tone: 'neutral', icon: 'task_alt', title: 'Atendimento concluído', text: 'O veículo foi entregue e esta ordem está encerrada. Consulte o orçamento e o histórico abaixo. Para um novo serviço, entre em contato com a oficina.', actions: '' };
  if (status === 'CANCELADA') return { tone: 'attention', icon: 'info', title: 'Ordem cancelada', text: role === ROLES.CLIENT ? 'O orçamento foi rejeitado e esta ordem foi encerrada. Fale com a oficina para esclarecer os itens ou solicitar um novo atendimento, informando o número desta OS.' : 'Após a rejeição, esta ordem permanece cancelada. Contate o cliente para esclarecer os itens e, se houver uma nova solicitação, abra outro atendimento.', actions: INTERNAL_ROLES.has(role) ? button({ label: 'Novo atendimento', iconName: 'add', href: '#/ordens/nova', variant: 'secondary' }) : '' };
  if (awaitingRegistration(order)) return { tone: 'neutral', icon: 'hourglass_top', title: 'Preparando atendimento', text: 'Estamos confirmando a abertura da ordem. A atribuição do mecânico será liberada em instantes.', actions: button({ label: 'Atualizar andamento', variant: 'secondary', action: 'order:retry' }) };
  if (status === 'APROVADA' && order.preparacao === 'MANUAL_ATTENTION') return { tone: 'attention', icon: 'support_agent', title: 'Preparação exige intervenção', text: 'A equipe técnica precisa reconciliar a preparação antes de liberar a execução. O orçamento aprovado foi preservado.', actions: canReconcilePreparation(order, role) ? button({ label: 'Reconciliar preparação', variant: 'primary', action: 'order:saga-reconcile' }) : '' };
  if (status === 'APROVADA' && order.preparacao === 'COMPENSATING' && order.reconciliation?.id) return { tone: 'neutral', icon: 'hourglass_top', title: 'Reconciliando preparação', text: 'A solicitação foi registrada. Aguardando a confirmação dos serviços para concluir a compensação.', actions: button({ label: 'Atualizar andamento', variant: 'secondary', action: 'order:retry' }) };
  if (status === 'APROVADA' && order.preparacao === 'COMPENSATING') return { tone: 'attention', icon: 'restart_alt', title: 'Desfazendo a preparação', text: 'A preparação não pôde ser concluída. Aguarde a liberação das reservas; o orçamento aprovado será preservado.', actions: button({ label: 'Atualizar andamento', variant: 'secondary', action: 'order:retry' }) };
  if (status === 'AGUARDANDO_PAGAMENTO' && order.pagamento?.status === 'APPROVED') return { tone: 'neutral', icon: 'task_alt', title: 'Pagamento recebido: atualizando a ordem', text: 'O pagamento foi confirmado. Estamos aguardando a liberação para retirada. Não é necessário pagar novamente.', actions: button({ label: 'Atualizar andamento', variant: 'secondary', action: 'order:retry' }) };
  if (status === 'AGUARDANDO_PAGAMENTO' && role === ROLES.CLIENT && !order.pagamento?.checkoutUrl) return { tone: 'neutral', icon: 'hourglass_top', title: 'Preparando pagamento', text: 'Estamos preparando o link de pagamento. A tela será atualizada automaticamente quando estiver pronto.', actions: button({ label: 'Atualizar andamento', variant: 'secondary', action: 'order:retry' }) };
  if (status === 'AGUARDANDO_PAGAMENTO') return { tone: 'attention', icon: 'payments', title: 'Reparo concluído: aguardando pagamento', text: role === ROLES.CLIENT ? 'Pague com segurança no Mercado Pago para liberar a retirada do veículo.' : 'A entrega será liberada após a confirmação do pagamento.', actions: role === ROLES.CLIENT ? button({ label: 'Pagar OS', iconName: 'payments', variant: 'primary', action: 'order:pay' }) : '' };
  if (status === 'APROVADA' && order.preparacao === 'COMPENSATED') return { tone: 'attention', icon: 'info', title: 'Preparação cancelada', text: role === ROLES.CLIENT ? 'Seu orçamento continua aprovado. A oficina está verificando as peças antes de liberar o reparo.' : 'O orçamento continua aprovado e as reservas foram desfeitas. Confira a disponibilidade das peças nesta filial antes de tentar novamente.', actions: canRetryPreparation(order, role) ? button({ label: 'Tentar preparação novamente', variant: 'primary', action: 'order:saga-retry' }) : '' };
  if (status === 'APROVADA' && order.preparacao && order.preparacao !== 'COMPLETED') return { tone: 'neutral', icon: 'hourglass_top', title: 'Preparando execução', text: 'A oficina está confirmando o orçamento e a disponibilidade das peças.', actions: button({ label: 'Atualizar andamento', variant: 'secondary', action: 'order:retry' }) };
  if (role === ROLES.CLIENT && status === 'AGUARDANDO_APROVACAO') return { tone: 'attention', icon: 'task_alt', title: 'Seu orçamento está pronto', text: 'Revise os itens e decida se a oficina pode prosseguir.', actions: `${button({ label: 'Rejeitar orçamento', iconName: 'close', variant: 'danger', action: 'order:reject' })}${button({ label: 'Aprovar orçamento', iconName: 'check', variant: 'primary', action: 'order:approve' })}` };
  if (role === ROLES.CLIENT) return { tone: 'neutral', icon: 'visibility', title: 'Acompanhe o andamento', text: status === 'CANCELADA' ? 'Esta ordem foi cancelada após a rejeição do orçamento.' : 'Nenhuma ação sua é necessária neste momento.', actions: '' };
  if (INTERNAL_ROLES.has(role) && status === 'RECEBIDA') return { tone: 'action', icon: 'engineering', title: 'Atribua um mecânico', text: 'A OS precisa de um responsável antes do diagnóstico.', actions: button({ label: 'Informar mecânico', iconName: 'person_add', variant: 'primary', action: 'order:assign' }) };
  if (INTERNAL_ROLES.has(role) && status === 'AGUARDANDO_APROVACAO') return { tone: 'attention', icon: 'hourglass_top', title: 'Aguardando decisão do cliente', text: 'Somente o cliente titular pode aprovar ou rejeitar. A equipe deve apenas acompanhar.', actions: '' };
  if (INTERNAL_ROLES.has(role) && status === 'PRONTA_PARA_ENTREGA') return { tone: 'action', icon: 'key', title: 'Pagamento confirmado: pronto para entrega', text: 'Confirme a retirada somente quando o veículo for efetivamente entregue.', actions: button({ label: 'Registrar entrega', iconName: 'key', variant: 'primary', action: 'order:deliver' }) };
  if (role === ROLES.MECHANIC && ['ATRIBUIDA', 'EM_DIAGNOSTICO'].includes(status)) return { tone: 'action', icon: 'diagnosis', title: status === 'ATRIBUIDA' ? 'Inicie o diagnóstico' : 'Conclua diagnóstico e orçamento', text: 'Registre evidências técnicas e envie um orçamento claro ao cliente.', actions: `${button({ label: 'Registrar diagnóstico', iconName: 'stethoscope', variant: 'secondary', action: 'order:diagnosis' })}${button({ label: 'Gerar orçamento', iconName: 'request_quote', variant: 'primary', action: 'order:budget' })}` };
  if (role === ROLES.MECHANIC && status === 'APROVADA') return { tone: 'action', icon: 'play_circle', title: 'Orçamento aprovado', text: 'O mecânico responsável já está definido. Inicie a execução quando o veículo entrar no box.', actions: button({ label: 'Iniciar execução', iconName: 'play_arrow', variant: 'primary', action: 'order:start' }) };
  if (role === ROLES.MECHANIC && status === 'EM_EXECUCAO') return { tone: 'action', icon: 'build', title: 'Serviço em execução', text: 'Registre cada consumo de peça e finalize somente após conferir o trabalho.', actions: `${button({ label: 'Consumir peça', iconName: 'inventory', variant: 'secondary', action: 'order:consume' })}${button({ label: 'Finalizar serviço', iconName: 'done_all', variant: 'primary', action: 'order:finish' })}` };
  return { tone: 'neutral', icon: 'info', title: 'Nenhuma ação disponível', text: 'O próximo passo pertence a outro perfil ou depende de uma mudança de status.', actions: '' };
}

function detailMarkup(order, role) {
  const clientView = role === ROLES.CLIENT;
  const meta = statusMeta(order.status);
  const action = nextAction(order, role);
  const problems = order.problemasRelatados ?? [];
  const services = order.servicosSolicitados ?? [];
  return `${pageHeader({ eyebrow: 'Ordem de serviço', title: orderNumber(order), description: `Criada em ${formatDateTime(order.criadoEm)}`, backHref: '/ordens', actions: statusBadge(order.status, meta) })}
    <section class="next-action-panel next-action-${action.tone}" aria-labelledby="next-action-title"><div class="next-action-icon">${icon(action.icon)}</div><div class="next-action-copy"><p class="eyebrow">Próxima ação</p><h2 id="next-action-title">${escapeHtml(action.title)}</h2><p>${escapeHtml(action.text)}</p></div>${action.actions ? `<div class="next-action-buttons">${action.actions}</div>` : ''}</section>
    <div id="order-sync-state" class="order-sync-bar" aria-live="polite"></div>
    ${shortageMarkup(order, role)}
    <section class="timeline-card"><div class="section-heading"><div><p class="eyebrow">Ciclo da ordem</p><h2>Progresso</h2></div></div>${timelineMarkup(order)}</section>
    <div class="detail-layout"><section class="detail-main"><div class="tabs" data-tabs><div class="tab-list" role="tablist" aria-label="Detalhes da ordem"><button role="tab" id="tab-summary" aria-selected="true" aria-controls="panel-summary" tabindex="0">Resumo</button><button role="tab" id="tab-diagnosis" aria-selected="false" aria-controls="panel-diagnosis" tabindex="-1">Diagnóstico</button><button role="tab" id="tab-budget" aria-selected="false" aria-controls="panel-budget" tabindex="-1">Orçamento <span class="tab-count">${orderLines(order).length}</span></button><button role="tab" id="tab-history" aria-selected="false" aria-controls="panel-history" tabindex="-1">Histórico</button></div>
      <div role="tabpanel" id="panel-summary" aria-labelledby="tab-summary"><div class="summary-grid"><article class="data-card"><p class="eyebrow">Problemas relatados</p><h3>Solicitação do cliente</h3>${problems.length ? `<ul class="check-list">${problems.map((item) => `<li>${icon('report')}<span>${escapeHtml(item.descricao)}</span></li>`).join('')}</ul>` : '<p class="muted">Nenhum problema textual registrado.</p>'}</article><article class="data-card"><p class="eyebrow">Serviços solicitados</p><h3>Escopo inicial</h3>${services.length ? `<ul class="check-list">${services.map((item) => `<li>${icon('home_repair_service')}<span>${escapeHtml(item.nomeServico ?? domainId(item.servicoId))}${item.observacao ? `<small>${escapeHtml(item.observacao)}</small>` : ''}</span></li>`).join('')}</ul>` : '<p class="muted">Nenhum serviço do catálogo selecionado.</p>'}</article></div>${order.notasCliente ? `<article class="customer-note"><strong>${icon('chat')} Nota para o cliente</strong><p>${escapeHtml(order.notasCliente)}</p></article>` : ''}${!clientView && order.notasInternas ? `<article class="internal-note"><strong>${icon('lock')} Nota interna</strong><p>${escapeHtml(order.notasInternas)}</p></article>` : ''}</div>
      <div role="tabpanel" id="panel-diagnosis" aria-labelledby="tab-diagnosis" hidden>${order.diagnostico ? `<article class="diagnosis-card"><span class="section-icon">${icon('stethoscope')}</span><div><p class="eyebrow">Parecer técnico</p><h3>Diagnóstico registrado</h3><p>${escapeHtml(order.diagnostico.descricao)}</p></div></article>` : statePanel({ kind: 'empty', title: 'Diagnóstico não registrado', description: 'O parecer técnico aparecerá aqui quando o mecânico responsável concluir a análise.' })}</div>
      <div role="tabpanel" id="panel-budget" aria-labelledby="tab-budget" hidden>${budgetMarkup(order, clientView)}</div>
      <div role="tabpanel" id="panel-history" aria-labelledby="tab-history" hidden>${historyMarkup(order)}</div></div></section>
      <aside class="detail-aside">${orderContextMarkup(order, clientView)}${requestedPartsMarkup(order)}${consumptionSummaryMarkup(order, role)}</aside></div>`;
}

function pieceName(piece) {
  return [piece.codigo, piece.nome ?? piece.descricao].filter(Boolean).join(' · ') || 'Peça do orçamento';
}

function requestedPartsMarkup(order) {
  if (!Array.isArray(order.pecasSolicitadas)) return '<article class="context-card"><h2>Peças solicitadas na abertura</h2><p class="field-hint">Esta OS foi criada antes do registro de peças solicitadas. Consulte o orçamento para conferir os materiais aprovados.</p></article>';
  const pieces = order.pecasSolicitadas ?? [];
  if (!pieces.length) return '<article class="context-card"><h2>Peças solicitadas na abertura</h2><p class="field-hint">Nenhuma peça foi solicitada na abertura. Os materiais da execução constam no orçamento aprovado.</p></article>';
  return `<article class="context-card"><h2>Peças solicitadas na abertura</h2><p class="field-hint">A solicitação não representa reserva. A execução segue os materiais do orçamento aprovado.</p><ul class="check-list">${pieces.map((piece) => `<li><span><strong>${escapeHtml(pieceName(piece))}</strong><small>${escapeHtml(piece.quantidade)} unidade(s) · ${escapeHtml(piece.filialId ?? order.filialId)}</small></span></li>`).join('')}</ul></article>`;
}

function consumptionSummaryMarkup(order, role) {
  const pieces = order.consumosPeca ?? [];
  if (!pieces.length || role === ROLES.CLIENT) return '';
  return `<article class="context-card"><h2>Peças desta OS</h2><p class="field-hint">Reserva e consumo da ordem, separados do saldo geral do estoque.</p>${pieces.map((piece) => `<div class="piece-balance"><strong>${escapeHtml(pieceName(piece))}</strong><small>Filial: ${escapeHtml(piece.filialId ?? order.filialId)}</small><dl><div><dt>Reservada</dt><dd>${escapeHtml(piece.quantidadeReservada)}</dd></div><div><dt>Consumida</dt><dd>${escapeHtml(piece.quantidadeConsumida)}</dd></div><div><dt>Restante</dt><dd>${escapeHtml(piece.quantidadeRestante)}</dd></div></dl></div>`).join('')}</article>`;
}

function shortageMarkup(order, role) {
  const shortages = order.faltasEstoque ?? [];
  if (role === ROLES.CLIENT || !shortages.length || !['APROVADA'].includes(order.status) || order.preparacao === 'COMPLETED') return '';
  const reasons = {
    PECA_INATIVA: 'Peça inativa. Solicite ao administrador a regularização do cadastro.',
    PECA_NAO_ENCONTRADA_NA_FILIAL: 'Peça não encontrada nesta filial.',
    ESTOQUE_INSUFICIENTE: 'Saldo insuficiente nesta filial.',
    INACTIVE: 'Peça inativa. Solicite ao administrador a regularização do cadastro.',
    NOT_FOUND: 'Peça não encontrada nesta filial.',
    INSUFFICIENT_STOCK: 'Saldo insuficiente nesta filial.',
  };
  return `<section class="data-card shortage-card" aria-labelledby="shortage-title"><h2 id="shortage-title">Peças que impedem a preparação</h2><p>O orçamento aprovado e esta OS foram mantidos. Corrija a disponibilidade na filial indicada antes de tentar novamente.</p>${shortages.map((piece) => `<article class="shortage-item"><strong>${escapeHtml(pieceName(piece))}</strong><p>Filial: ${escapeHtml(piece.filialId)} · Necessária: ${escapeHtml(piece.quantidadeNecessaria)}${piece.quantidadeDisponivel === undefined ? '' : ` · Disponível: ${escapeHtml(piece.quantidadeDisponivel)}`} · Falta: ${escapeHtml(piece.quantidadeFaltante)}</p>${piece.motivo ? `<p>${escapeHtml(reasons[piece.motivo] ?? piece.motivo)}</p>` : ''}${role === ROLES.ADMIN ? button({ label: 'Consultar e repor nesta filial', iconName: 'inventory_2', variant: 'secondary', href: `#/estoque?busca=${encodeURIComponent(piece.codigo || piece.nome || '')}&filialId=${encodeURIComponent(piece.filialId)}` }) : '<p class="field-hint">Solicite ao administrador a reposição ou regularização desta peça nesta filial, informando o número da OS, código e quantidade faltante.</p>'}</article>`).join('')}</section>`;
}

export function renderSimpleFieldModalActions(action, submitLabel) {
  return `${button({ label: 'Cancelar', variant: 'ghost', action: 'modal-cancel' })}${button({ label: submitLabel, iconName: 'check', variant: 'primary', type: 'submit', action, attributes: 'form="order-action-form"' })}`;
}

function simpleFieldModal(title, fieldHtml, action, submitLabel, size = 'medium') {
  return openModal({
    title,
    size,
    content: `<form id="order-action-form" class="form-stack" novalidate>${fieldHtml}<div class="form-error-summary" role="alert" tabindex="-1" hidden></div></form>`,
    actions: renderSimpleFieldModalActions(action, submitLabel),
  });
}

export function renderMechanicAssignmentField() {
  return renderMechanicComboboxField({
    id: 'order-mechanic',
    name: 'mechanicId',
    label: 'Mecânico responsável',
    hint: 'Digite pelo menos 2 caracteres para pesquisar por nome, e-mail ou ID. Com o campo vazio, mostramos os primeiros 10 mecânicos ativos.',
  });
}

function consumptionFields(order) {
  const materials = order.consumosPeca?.length ? order.consumosPeca : orderLines(order).filter((line) => line.tipo === 'MATERIAL' && line.pecaId);
  const piece = `<label>Peça do orçamento<select name="pecaId" required><option value="">${materials.length ? 'Selecione a peça utilizada' : 'Nenhuma peça disponível nesta OS'}</option>${materials.map((line) => `<option value="${escapeAttribute(line.pecaId)}">${escapeHtml(pieceName(line))}${line.quantidadeRestante === undefined ? '' : ` · ${escapeHtml(line.quantidadeRestante)} restante(s)`}</option>`).join('')}</select></label>`;
  return `<div class="form-grid">${piece}<label>Quantidade<input name="quantidade" type="number" min="1" step="1" value="1" required></label></div><p class="field-hint" data-consumption-balance aria-live="polite">Selecione uma peça para conferir a reserva desta ordem.</p>`;
}

export async function mountOrderDetailView(root, { id, role, subject, api, navigate, notify }) {
  const target = root.querySelector('#order-detail');
  let order;
  let disposed = false;
  let pollTimer = null;
  let pollDeadline = null;
  let pollKey = null;
  let reconcilingPreparation = false;
  let confirmingAction = false;
  let actionPending = false;
  let pendingStatus = null;
  let stale = false;
  let lastUpdated = null;
  let selectedTab = 'tab-summary';
  let loadVersion = 0;
  const isActive = () => !disposed && target.isConnected !== false;
  const followupPolicy = () => pendingStatus
    ? { key: `action:${pendingStatus.join(',')}`, interval: 1_000, duration: 60_000 }
    : orderFollowupPolicy(order);
  const updateControls = () => {
    target.querySelectorAll?.('[data-action^="order:"]').forEach((control) => {
      if (!['order:retry', 'order:back'].includes(control.dataset.action)) {
        control.disabled = actionPending || stale || Boolean(pendingStatus);
        control.setAttribute('aria-disabled', String(control.disabled));
      }
    });
  };
  const updateSync = (message = '', warning = false) => {
    const bar = target.querySelector?.('#order-sync-state');
    if (!bar) return;
    const policy = followupPolicy();
    const refresh = !target.querySelector('.next-action-panel [data-action="order:retry"]') && (warning || order?.preparacao !== 'MANUAL_ATTENTION');
    const text = message || (pendingStatus ? 'Solicitação aceita. Aguardando a atualização do andamento antes da próxima ação.' : `${lastUpdated ? `Atualizado às ${lastUpdated}. ` : ''}${policy ? 'Acompanhamento automático ativo.' : 'Andamento atualizado.'}`);
    bar.classList.toggle('order-sync-warning', warning);
    bar.innerHTML = `<span>${escapeHtml(text)}</span><span class="order-sync-actions">${refresh ? button({ label: 'Atualizar andamento', iconName: 'refresh', variant: 'ghost', action: 'order:retry' }) : ''}</span>`;
  };
  const render = () => {
    const focusId = globalThis.document?.activeElement?.id;
    const activeTab = target.querySelector?.('[role="tab"][aria-selected="true"]');
    selectedTab = activeTab?.id || selectedTab;
    target.innerHTML = detailMarkup(order, role);
    target.querySelectorAll?.('[role="tab"]').forEach((tab) => {
      const active = tab.id === selectedTab;
      tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1;
      const panel = target.querySelector('#' + tab.getAttribute('aria-controls'));
      if (panel) panel.hidden = !active;
    });
    // Preserve the reading context; never refocus the page on a background GET.
    if (focusId && target.querySelector?.(`[id="${escapeAttribute(focusId)}"]`)) {
      globalThis.document?.getElementById(focusId)?.focus({ preventScroll: true });
    }
    updateControls();
    updateSync();
  };
  const stopPoll = () => {
    if (pollTimer !== null) clearTimeout(pollTimer);
    pollTimer = null;
  };
  const schedulePoll = () => {
    stopPoll();
    const policy = followupPolicy();
    if (!isActive() || !policy || stale) {
      pollDeadline = null;
      pollKey = null;
      return;
    }
    if (pollKey !== policy.key) { pollDeadline = null; pollKey = policy.key; }
    pollDeadline ??= Date.now() + policy.duration;
    if (Date.now() + policy.interval > pollDeadline) {
      updateSync(pendingStatus ? 'A solicitação foi aceita, mas o andamento ainda não foi confirmado. Use Atualizar andamento; não repita a operação.' : 'Atualização automática pausada. Use Atualizar andamento para consultar novamente; nenhuma ação foi repetida.', true);
      return;
    }
    pollTimer = setTimeout(() => {
      pollTimer = null;
      if (globalThis.document?.hidden || globalThis.document?.body?.classList?.contains?.('modal-open') || actionPending) {
        schedulePoll();
        return;
      }
      void load({ background: true });
    }, policy.interval);
  };
  const load = async ({ background = false } = {}) => {
    if (!isActive()) return;
    stopPoll();
    const version = ++loadVersion;
    if (!order) target.innerHTML = skeleton({ cards: 2, rows: 8, label: 'Atualizando detalhes da ordem' });
    else if (!background) updateSync('Consultando andamento…');
    try {
      const snapshot = await api.request(orderDetailPath(role, id));
      if (!isActive() || version !== loadVersion) return;
      const changed = JSON.stringify(order) !== JSON.stringify(snapshot);
      order = snapshot;
      if (orderTransitionObserved(order.status, pendingStatus)) pendingStatus = null;
      stale = false;
      lastUpdated = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      if (changed || !background) render();
      else { updateControls(); updateSync(); }
      schedulePoll();
    }
    catch (error) {
      if (!isActive() || version !== loadVersion) return;
      pollDeadline = null;
      if (order && ![401, 403, 404].includes(error?.status)) {
        stale = true;
        render();
        updateSync(`Não foi possível atualizar. ${apiErrorMessage(error)} Os últimos dados foram preservados. Atualize antes de realizar outra ação.`, true);
      } else {
        order = null;
        const retryable = !error?.status || error.status >= 500 || [408, 429].includes(error.status);
        target.innerHTML = statePanel({ kind: error?.status === 403 ? 'forbidden' : error?.status === 404 ? 'notFound' : 'error', title: error?.status === 403 ? 'Ordem fora do seu escopo' : error?.status === 404 ? 'Ordem não encontrada' : 'Não foi possível abrir a ordem', description: apiErrorMessage(error), actionLabel: retryable ? 'Tentar novamente' : 'Voltar às ordens', action: retryable ? 'order:retry' : 'order:back', correlationId: error?.correlationId });
      }
    }
  };
  const runAction = async (path, { method = 'PATCH', body, success, onSuccess, onFailure }) => {
    if (actionPending || stale || pendingStatus || !isActive()) return false;
    actionPending = true; loadVersion += 1; stopPoll(); updateControls();
    try {
      await api.request(path, { method, body });
      onSuccess?.();
      pendingStatus = expectedStatusAfterAction(path);
      if (!isActive()) return true;
      notify({ kind: 'success', title: success, message: 'Solicitação registrada. Acompanhe a confirmação nesta tela.' });
      pollDeadline = null;
      await load();
      return true;
    } catch (error) {
      onFailure?.(error);
      if (isActive()) {
        notify({ kind: 'error', title: 'A operação não foi concluída', message: apiErrorMessage(error) });
        // A timeout may follow an accepted write: consult instead of replaying it.
        await load({ background: true });
      }
      return false;
    } finally { actionPending = false; if (isActive()) { updateControls(); schedulePoll(); } }
  };
  const submitModal = async (modal, form, path, options) => {
    if (actionPending || stale) return;
    const submit = modal.root.querySelector('button[type="submit"]');
    const errorBox = form.querySelector('[role="alert"]');
    if (submit) setButtonBusy(submit, true);
    if (errorBox) errorBox.hidden = true;
    let failure;
    const saved = await runAction(path, { ...options, onFailure: (error) => { failure = error; options.onFailure?.(error); } });
    if (saved) modal.close();
    else {
      if (submit) setButtonBusy(submit, false);
      if (errorBox) {
        errorBox.textContent = [400, 409, 422].includes(failure?.status) ? `${apiErrorMessage(failure)} Corrija os dados antes de tentar novamente.` : 'Não foi possível confirmar a operação. Seus dados foram mantidos; confira o andamento antes de tentar novamente.';
        errorBox.hidden = false;
        errorBox.setAttribute?.('tabindex', '-1'); errorBox.focus?.();
      }
    }
  };
  const onClick = async (event) => {
    if (!isActive()) return;
    const trigger = event.target.closest('[data-action], [role="tab"]'); const action = trigger?.dataset.action;
    if (trigger?.matches('[role="tab"]')) {
      const list = trigger.closest('[role="tablist"]'); list.querySelectorAll('[role="tab"]').forEach((tab) => { const active = tab === trigger; tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1; const panel = target.querySelector('#' + tab.getAttribute('aria-controls')); if (panel) panel.hidden = !active; });
      return;
    }
    if (!action) return;
    if (action === 'order:retry') { if (actionPending) return; pollDeadline = null; return load(); }
    if (action === 'order:back') return navigate('/ordens');
    if (actionPending || stale || pendingStatus || confirmingAction) return;
    if (action === 'order:saga-retry') {
      if (!canRetryPreparation(order, role)) return;
      return runAction(`/ordens-servico/${encodeURIComponent(id)}/saga/retry`, { method: 'POST', success: 'Nova preparação solicitada' });
    }
    if (action === 'order:saga-reconcile') {
      if (reconcilingPreparation || !canReconcilePreparation(order, role)) return;
      reconcilingPreparation = true;
      const expectedSagaId = order.sagaId;
      try {
        const confirmed = await confirmPreparationReconciliation();
        if (!confirmed || !isActive() || !canReconcilePreparation(order, role) || order.sagaId !== expectedSagaId) return;
        await runAction(`/ordens-servico/${encodeURIComponent(id)}/saga/reconcile`, {
          method: 'POST', body: { expectedSagaId }, success: 'Reconciliação solicitada',
        });
      } finally { reconcilingPreparation = false; }
      return;
    }
    if (action === 'order:pay') {
      if (role !== ROLES.CLIENT || order?.status !== 'AGUARDANDO_PAGAMENTO' || !order.pagamento?.checkoutUrl || order.paymentConfirmed || order.pagamento?.status === 'APPROVED') return;
      actionPending = true; loadVersion += 1; stopPoll(); updateControls();
      setButtonBusy(trigger, true);
      try {
        const result = await api.request(`/billing/orders/${encodeURIComponent(id)}/checkout`, { method: 'POST' });
        const url = result.checkoutUrl ?? result.payment?.checkoutUrl;
        if (!url) throw new Error('A cobrança está sendo preparada. Atualize o andamento em instantes.');
        if (isActive()) window.location.assign(checkoutDestination(url));
      } catch (error) { notify({ kind: 'error', title: 'Não foi possível abrir o pagamento', message: apiErrorMessage(error) }); setButtonBusy(trigger, false); }
      finally { actionPending = false; if (isActive()) { updateControls(); schedulePoll(); } }
      return;
    }
    if (action === 'order:assign') {
      if (awaitingRegistration(order)) return;
      const modal = simpleFieldModal(
        'Atribuir mecânico',
        renderMechanicAssignmentField(),
        'order:assign-submit',
        'Atribuir',
        'large',
      );
      if (!modal) return;
      const form = modal.root.querySelector('#order-action-form');
      const errorBox = form.querySelector('[role="alert"]');
      const searchInput = form.querySelector('[data-mechanic-combobox-input]');
      const submitButton = modal.root.querySelector('[data-action="order:assign-submit"]');
      const setSelectionValidity = (valid) => {
        submitButton.disabled = !valid;
        submitButton.setAttribute('aria-disabled', String(!valid));
        searchInput.setAttribute('aria-invalid', String(!valid && !errorBox.hidden));
        if (valid) {
          errorBox.hidden = true;
          errorBox.textContent = '';
        }
      };
      const mechanicCombobox = mountMechanicCombobox(modal.root, {
        api,
        onSelect: () => setSelectionValidity(true),
        onClear: () => setSelectionValidity(false),
      });
      setSelectionValidity(false);
      modal.onClose(mechanicCombobox.destroy);
      mechanicCombobox.focus();
      modal.root.querySelector('[data-action="modal-cancel"]')?.addEventListener('click', modal.close);
      form.addEventListener('submit', async (submitEvent) => {
        submitEvent.preventDefault();
        const mechanicId = mechanicCombobox.value;
        if (!mechanicId) {
          errorBox.textContent = 'Selecione um mecânico nos resultados da busca antes de atribuir.';
          errorBox.hidden = false;
          setSelectionValidity(false);
          mechanicCombobox.focus();
          return;
        }
        await submitModal(modal, form, `/ordens-servico/${encodeURIComponent(id)}/atribuir/${encodeURIComponent(mechanicId)}`, { success: 'Mecânico atribuído' });
      });
    }
    if (action === 'order:diagnosis') {
      const modal = simpleFieldModal('Registrar diagnóstico', '<label for="diagnosis-description">Descrição técnica<textarea id="diagnosis-description" name="descricao" rows="6" required maxlength="3000" placeholder="Descreva achados, causa provável e verificações realizadas"></textarea></label>', 'order:diagnosis-submit', 'Salvar diagnóstico');
      modal.root.querySelector('[data-action="modal-cancel"]')?.addEventListener('click', modal.close);
      modal.root.querySelector('#order-action-form').addEventListener('submit', async (submitEvent) => { submitEvent.preventDefault(); const descricao = new FormData(submitEvent.currentTarget).get('descricao')?.trim(); if (!descricao) return; await submitModal(modal, submitEvent.currentTarget, `/ordens-servico/${encodeURIComponent(id)}/diagnostico`, { body: { descricao }, success: 'Diagnóstico registrado' }); });
    }
    if (action === 'order:budget') {
      const modal = budgetBuilderModal({ api, scope: { role, subject }, order }); const form = modal.root.querySelector('#budget-form');
      form.addEventListener('submit', async (submitEvent) => { submitEvent.preventDefault(); const payload = budgetPayload(form); if (!payload.grupos[0].titulo || !validBudgetLines(payload.grupos[0].linhas)) { const box = form.querySelector('[role="alert"]'); box.textContent = 'Informe o título, descrição, quantidade inteira positiva e valores válidos. Selecione cada material no catálogo. O total precisa ser maior que zero.'; box.hidden = false; box.focus(); return; } await submitModal(modal, form, `/ordens-servico/${encodeURIComponent(id)}/orcamento`, { body: payload, success: 'Orçamento enviado ao cliente', onSuccess: () => modal.complete() }); });
    }
    if (action === 'order:consume') {
      const modal = simpleFieldModal('Registrar consumo de peça', consumptionFields(order), 'order:consume-submit', 'Registrar consumo');
      const form = modal.root.querySelector('#order-action-form');
      const pieceInput = form.elements.namedItem('pecaId');
      const quantityInput = form.elements.namedItem('quantidade');
      const errorBox = form.querySelector('[role="alert"]');
      const showBalance = () => {
        const balance = form.querySelector('[data-consumption-balance]');
        const piece = order.consumosPeca?.find((item) => item.pecaId === pieceInput.value);
        if (balance) balance.textContent = piece ? `Reservada: ${piece.quantidadeReservada} · Consumida: ${piece.quantidadeConsumida} · Restante: ${piece.quantidadeRestante}` : 'O saldo da reserva aparecerá após a sincronização desta OS. Atualize o andamento se necessário.';
      };
      pieceInput.addEventListener?.('change', showBalance);
      const restorePending = () => {
        const pending = pendingConsumption(id);
        if (pending) {
          pieceInput.value = pending.pecaId;
          quantityInput.value = String(pending.quantidade);
          errorBox.textContent = 'Há um consumo sem resposta confirmada. Envie novamente para consultar a mesma operação, sem duplicar o consumo.';
          errorBox.hidden = false;
        }
        pieceInput.disabled = Boolean(pending);
        quantityInput.readOnly = Boolean(pending);
        showBalance();
      };
      restorePending();
      modal.root.querySelector('[data-action="modal-cancel"]')?.addEventListener('click', modal.close);
      form.addEventListener('submit', async (submitEvent) => {
        submitEvent.preventDefault();
        if (actionPending || stale) return;
        const pecaId = pieceInput.value;
        const quantidade = Number(quantityInput.value);
        if (!pecaId || !Number.isSafeInteger(quantidade) || quantidade < 1) {
          errorBox.textContent = 'Selecione a peça e informe uma quantidade inteira positiva.'; errorBox.hidden = false; return;
        }
        const attempt = beginConsumption(id, { pecaId, quantidade });
        restorePending();
        await submitModal(modal, form, `/ordens-servico/${encodeURIComponent(id)}/consumo-peca`, {
          body: attempt, success: 'Consumo registrado',
          onSuccess: () => finishConsumption(id, attempt.operationId),
          onFailure: (error) => {
            // These are definitive domain rejections. A lost/5xx/401 response
            // retains the same operation across retries and page reloads.
            if ([400, 409, 422].includes(error?.status)) finishConsumption(id, attempt.operationId);
          },
        });
        restorePending();
      });
    }
    const confirmations = {
      'order:approve': { title: 'Aprovar este orçamento?', message: 'A oficina poderá iniciar a execução dos serviços e materiais apresentados.', label: 'Aprovar orçamento', path: 'aprovar', success: 'Orçamento aprovado', tone: 'primary' },
      'order:reject': { title: 'Rejeitar este orçamento?', message: 'A rejeição cancelará esta ordem de serviço e não poderá ser desfeita pela interface.', label: 'Rejeitar e cancelar', path: 'rejeitar', success: 'Orçamento rejeitado', tone: 'danger' },
      'order:start': { title: 'Iniciar a execução?', message: 'Confirme que o veículo está no box e o orçamento aprovado será executado.', label: 'Iniciar execução', path: 'iniciar-execucao', success: 'Execução iniciada', tone: 'primary' },
      'order:finish': { title: 'Finalizar o serviço?', message: 'Confirme que todos os serviços foram conferidos e os consumos de peças registrados.', label: 'Finalizar serviço', path: 'finalizar', success: 'Serviço finalizado', tone: 'primary' },
      'order:deliver': { title: 'Registrar a entrega do veículo?', message: 'Esta é a conclusão definitiva do ciclo da OS. Confirme somente após entregar o veículo ao cliente.', label: 'Confirmar entrega', path: 'entregar', success: 'Veículo entregue', tone: 'primary' },
    };
    if (confirmations[action]) {
      const item = confirmations[action];
      const expectedState = `${order.status}:${order.preparacao}:${order.sagaId}`;
      confirmingAction = true;
      try {
        const confirmed = await confirmAction({ title: item.title, message: item.message, confirmLabel: item.label, tone: item.tone });
        if (confirmed && isActive() && `${order.status}:${order.preparacao}:${order.sagaId}` === expectedState) {
          await runAction(`/ordens-servico/${encodeURIComponent(id)}/${item.path}`, { success: item.success });
        }
      } finally { confirmingAction = false; }
    }

  };
  root.addEventListener('click', onClick);
  await load();
  return () => {
    disposed = true;
    loadVersion += 1;
    stopPoll();
    root.removeEventListener('click', onClick);
  };
}
