import { ROLES } from '../core/permissions.js';
import { buildOrderTimeline, getOrderStatusMeta } from '../core/order-status.js';
import { formatCurrency, formatDateTime, formatOrderNumber } from '../core/formatters.js';
import {
  button,
  confirmAction,
  domainId,
  escapeAttribute,
  escapeHtml,
  icon,
  openModal,
  pagination,
  setButtonBusy,
  skeleton,
  statePanel,
  statusBadge,
} from '../components/ui-kit.js';
import {
  mountClientCombobox,
  renderClientComboboxField,
} from '../components/client-combobox.js';
import {
  mountMechanicCombobox,
  renderMechanicComboboxField,
} from '../components/mechanic-combobox.js';
import { pageHeader } from '../components/shell.js';
import { apiErrorMessage, extractPage } from '../services/domain-api.js';

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

function orderListPath(role) {
  if (role === ROLES.MECHANIC) return '/ordens-servico/mecanico/minhas-ordens';
  if (role === ROLES.CLIENT) return '/ordens-servico/minhas/lista';
  return '/ordens-servico';
}

function orderDetailPath(role, id) {
  if (role === ROLES.MECHANIC) return `/ordens-servico/mecanico/${encodeURIComponent(id)}`;
  if (role === ROLES.CLIENT) return `/ordens-servico/minhas/${encodeURIComponent(id)}`;
  return `/ordens-servico/${encodeURIComponent(id)}`;
}

export function renderOrdersListView({ role }) {
  const canCreate = INTERNAL_ROLES.has(role);
  const title = role === ROLES.CLIENT ? 'Minhas ordens' : role === ROLES.MECHANIC ? 'Minhas ordens' : 'Ordens de serviço';
  const description = role === ROLES.CLIENT
    ? 'Acompanhe o andamento e decida sobre orçamentos pendentes.'
    : role === ROLES.MECHANIC
      ? 'Priorize diagnósticos e execuções sob sua responsabilidade.'
      : 'Fila operacional atual da oficina, ordenada pelas prioridades do backend.';
  return `${pageHeader({
    eyebrow: role === ROLES.CLIENT ? 'Portal do cliente' : 'Operação da oficina',
    title,
    description,
    actions: canCreate ? button({ label: 'Nova ordem', iconName: 'add', variant: 'primary', href: '#/ordens/nova' }) : '',
  })}
    ${INTERNAL_ROLES.has(role) ? '<aside class="scope-notice" role="note"><span class="material-symbols-rounded" aria-hidden="true">info</span><p><strong>Escopo da fila:</strong> a API atual retorna Recebida, Em diagnóstico, Aguardando aprovação e Em execução. Os demais estados não compõem esta listagem.</p></aside>' : ''}
    <section class="data-card orders-list-card" aria-labelledby="orders-list-title">
      <div class="data-card-toolbar">
        <div><p class="eyebrow">Fila visível</p><h2 id="orders-list-title">Ordens disponíveis</h2></div>
        <div class="filter-bar">
          <label class="search-field"><span class="sr-only">Filtrar ordens carregadas</span>${icon('search')}<input type="search" id="order-search" placeholder="Número, status ou ID" autocomplete="off"></label>
          <label><span class="sr-only">Filtrar por status</span><select id="order-status-filter"><option value="">Todos os status carregados</option><option value="RECEBIDA">Recebida</option><option value="ATRIBUIDA">Atribuída</option><option value="EM_DIAGNOSTICO">Em diagnóstico</option><option value="AGUARDANDO_APROVACAO">Aguardando aprovação</option><option value="APROVADA">Aprovada</option><option value="EM_EXECUCAO">Em execução</option><option value="FINALIZADA">Finalizada</option><option value="ENTREGUE">Entregue</option><option value="CANCELADA">Cancelada</option></select></label>
        </div>
      </div>
      <div id="orders-result">${skeleton({ rows: 6, label: 'Carregando ordens de serviço' })}</div>
    </section>`;
}

function renderOrderRows(orders, role, query = '', status = '') {
  const term = query.trim().toLocaleLowerCase('pt-BR');
  const filtered = orders.filter((order) => {
    if (status && order.status !== status) return false;
    if (!term) return true;
    return [order.numero, order.status, orderId(order), domainId(order.veiculoId)]
      .some((value) => String(value ?? '').toLocaleLowerCase('pt-BR').includes(term));
  });
  if (!filtered.length) {
    return statePanel({
      kind: orders.length ? 'filtered' : 'empty',
      title: orders.length ? 'Nenhuma ordem corresponde aos filtros' : 'Nenhuma ordem nesta fila',
      description: orders.length ? 'Limpe ou altere os filtros para ver outros registros carregados.' : 'Quando houver uma ordem disponível para seu perfil, ela aparecerá aqui.',
      actionLabel: orders.length ? 'Limpar filtros' : undefined,
      action: 'orders:clear-filters',
    });
  }
  const rows = filtered.map((order) => {
    const id = orderId(order);
    const meta = statusMeta(order.status);
    const pending = role === ROLES.CLIENT && order.status === 'AGUARDANDO_APROVACAO';
    return `<tr data-search-row>
      <td data-label="Ordem"><a class="table-primary-link" href="#/ordens/${escapeAttribute(id)}"><strong>${escapeHtml(orderNumber(order))}</strong><small>${escapeHtml(id)}</small></a></td>
      <td data-label="Status">${statusBadge(order.status, meta)}</td>
      <td data-label="Veículo"><span class="mono-value">${escapeHtml(domainId(order.veiculoId) || 'Detalhes não disponíveis')}</span></td>
      <td data-label="Atualizada"><time datetime="${escapeAttribute(order.atualizadoEm ?? '')}">${escapeHtml(formatDateTime(order.atualizadoEm))}</time></td>
      <td data-label="Ação" class="table-actions"><a class="interactive-button button-${pending ? 'primary' : 'ghost'} button-small" href="#/ordens/${escapeAttribute(id)}">${icon(pending ? 'task_alt' : 'arrow_forward')}<span>${pending ? 'Analisar' : 'Abrir'}</span></a></td>
    </tr>`;
  }).join('');
  return `<div class="responsive-table-wrapper"><table class="responsive-table"><caption class="sr-only">Ordens de serviço carregadas</caption><thead><tr><th>Ordem</th><th>Status</th><th>Veículo</th><th>Atualizada</th><th><span class="sr-only">Ação</span></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

export async function mountOrdersListView(root, { role, api, notify }) {
  const result = root.querySelector('#orders-result');
  const search = root.querySelector('#order-search');
  const status = root.querySelector('#order-status-filter');
  let orders = [];
  let meta = {};
  let page = 1;

  const paint = () => {
    result.innerHTML = `${renderOrderRows(orders, role, search.value, status.value)}${orders.length ? pagination(meta, 'orders-page') : ''}`;
  };
  const load = async () => {
    result.innerHTML = skeleton({ rows: 6, label: 'Atualizando ordens de serviço' });
    try {
      const payload = await api.request(orderListPath(role), { query: { pagina: page, porPagina: 20 } });
      const parsed = extractPage(payload);
      orders = parsed.data;
      meta = parsed.meta;
      paint();
    } catch (error) {
      result.innerHTML = statePanel({ kind: navigator.onLine ? 'error' : 'offline', title: navigator.onLine ? 'Não foi possível carregar as ordens' : 'Você está sem conexão', description: apiErrorMessage(error), actionLabel: 'Tentar novamente', action: 'orders:retry', correlationId: error?.correlationId });
    }
  };
  search.addEventListener('input', paint);
  status.addEventListener('change', paint);
  root.addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'orders:retry') load();
    if (action === 'orders:clear-filters') { search.value = ''; status.value = ''; paint(); search.focus(); }
    if (action === 'orders-page:previous' && page > 1) { page -= 1; load(); }
    if (action === 'orders-page:next' && page < Number(meta.totalPaginas ?? 1)) { page += 1; load(); }
  });
  await load();
  notify?.({ kind: 'info', title: 'Fila sincronizada', message: `${orders.length} ordem(ns) carregada(s).`, duration: 2200 });
}

function renderNewClientForm() {
  return [
    '<div class="wizard-inline-form__header">',
    '<span class="wizard-inline-form__icon" aria-hidden="true">' +
      icon('person_add') +
      '</span>',
    '<div><h3>Dados do novo cliente</h3><p>Preencha os dados obrigatórios para criar o cadastro junto com a ordem de serviço.</p></div>',
    '</div>',
    '<div class="form-grid wizard-client-form">',
    '<label class="form-field span-3"><span class="form-label">Tipo de documento <span class="required-mark" aria-hidden="true">*</span></span><select name="clienteTipoDoc" required><option>CPF</option><option>CNPJ</option></select><small class="form-helper">Selecione o documento informado.</small></label>',
    '<label class="form-field span-9"><span class="form-label">Documento <span class="required-mark" aria-hidden="true">*</span></span><input name="clienteNumeroDoc" inputmode="numeric" autocomplete="off" maxlength="18" placeholder="CPF ou CNPJ, com ou sem máscara" required><small class="form-helper">O documento será validado antes da criação da OS.</small></label>',
    '<label class="form-field span-12"><span class="form-label">Nome ou razão social <span class="required-mark" aria-hidden="true">*</span></span><input name="clienteNome" autocomplete="name" maxlength="160" placeholder="Nome completo ou razão social" required></label>',
    '<label class="form-field span-6"><span class="form-label">E-mail <span class="required-mark" aria-hidden="true">*</span></span><input name="clienteEmail" type="email" autocomplete="email" maxlength="254" placeholder="cliente@exemplo.com" required></label>',
    '<label class="form-field span-6"><span class="form-label">Telefone <span class="required-mark" aria-hidden="true">*</span></span><input name="clienteTelefone" type="tel" autocomplete="tel" maxlength="20" placeholder="(11) 99999-9999" required></label>',
    '</div>',
    '<p class="wizard-inline-form__note">' +
      icon('info') +
      '<span>O cliente será cadastrado somente quando a ordem de serviço for criada.</span></p>',
  ].join('');
}

export function renderNewOrderView({ role }) {
  if (!INTERNAL_ROLES.has(role)) return statePanel({ kind: 'forbidden', title: 'Abertura não autorizada', description: 'Somente administradores e consultores técnicos podem abrir ordens de serviço.' });
  return `${pageHeader({ eyebrow: 'Nova ordem de serviço', title: 'Registrar entrada do veículo', description: 'Preencha os dados em quatro etapas. A ordem será criada com status Recebida.', backHref: '/ordens' })}
    <section class="wizard-card" id="new-order-wizard">
      <ol class="stepper" aria-label="Progresso da abertura">
        <li class="stepper-step is-current" data-step-indicator="1"><span class="stepper-marker">1</span><strong class="stepper-label">Cliente</strong></li>
        <li class="stepper-step" data-step-indicator="2"><span class="stepper-marker">2</span><strong class="stepper-label">Veículo</strong></li>
        <li class="stepper-step" data-step-indicator="3"><span class="stepper-marker">3</span><strong class="stepper-label">Solicitação</strong></li>
        <li class="stepper-step" data-step-indicator="4"><span class="stepper-marker">4</span><strong class="stepper-label">Revisão</strong></li>
      </ol>
      <form id="new-order-form" novalidate>
        <section class="wizard-panel" data-step-panel="1"><div class="section-heading"><span class="section-icon">${icon('person')}</span><div><p class="eyebrow">Etapa 1 de 4</p><h2>Identifique o cliente</h2><p>Escolha um cadastro existente ou informe um novo cliente.</p></div></div>
          <fieldset class="choice-cards"><legend class="sr-only">Origem do cliente</legend><label><input type="radio" name="clientMode" value="existing" checked><span>${icon('person_search')}<strong>Cliente cadastrado</strong><small>Busque por nome, documento ou contato</small></span></label><label><input type="radio" name="clientMode" value="new"><span>${icon('person_add')}<strong>Novo cliente</strong><small>Cadastre junto com a OS</small></span></label></fieldset>
          <div data-mode="client-existing">${renderClientComboboxField({ id: 'order-client', hint: 'Digite pelo menos 2 caracteres para pesquisar em toda a base. Com o campo vazio, mostramos os primeiros 10 clientes ativos.' })}</div>
          <div data-mode="client-new" class="wizard-inline-form" hidden>${renderNewClientForm()}</div>
        </section>
        <section class="wizard-panel" data-step-panel="2" hidden><div class="section-heading"><span class="section-icon">${icon('directions_car')}</span><div><p class="eyebrow">Etapa 2 de 4</p><h2>Identifique o veículo</h2><p>Veículos não possuem vínculo direto com clientes; a associação acontece nesta OS.</p></div></div>
          <fieldset class="choice-cards"><legend class="sr-only">Origem do veículo</legend><label><input type="radio" name="vehicleMode" value="existing" checked><span>${icon('garage_home')}<strong>Veículo cadastrado</strong><small>Selecione na lista carregada</small></span></label><label><input type="radio" name="vehicleMode" value="new"><span>${icon('add_road')}<strong>Novo veículo</strong><small>Cadastre junto com a OS</small></span></label></fieldset>
          <div data-mode="vehicle-existing" class="form-group"><label for="veiculoId">Veículo <span aria-hidden="true">*</span></label><select id="veiculoId" name="veiculoId" required><option value="">Carregando veículos…</option></select></div>
          <div data-mode="vehicle-new" class="form-grid" hidden><label>Placa<input name="veiculoPlaca" autocomplete="off"></label><label>RENAVAM<input name="veiculoRenavam" inputmode="numeric"></label><label>Chassi<input name="veiculoChassi"></label><label>Marca<input name="veiculoMarca"></label><label>Modelo<input name="veiculoModelo"></label><label>Ano<input name="veiculoAno" type="number" min="1900" max="2100"></label><label>Cor<input name="veiculoCor"></label><label>Quilometragem<input name="veiculoKm" type="number" min="0" step="1"></label></div>
        </section>
        <section class="wizard-panel" data-step-panel="3" hidden><div class="section-heading"><span class="section-icon">${icon('fact_check')}</span><div><p class="eyebrow">Etapa 3 de 4</p><h2>Registre a solicitação</h2><p>Informe ao menos um problema, serviço ou peça.</p></div></div>
          <div class="form-group"><label for="problemaDescricao">Problema relatado pelo cliente</label><textarea id="problemaDescricao" name="problemaDescricao" rows="4" maxlength="1000" placeholder="Descreva os sintomas nas palavras do cliente"></textarea></div>
          <div class="form-grid"><label>Serviço solicitado<select name="servicoId"><option value="">Nenhum serviço selecionado</option></select></label><label>Observação do serviço<input name="servicoObservacao" maxlength="300"></label></div>
          ${role === ROLES.ADMIN ? '<fieldset class="subsection"><legend>Peça solicitada (opcional)</legend><div class="form-grid"><label>ID da peça<input name="pecaId" placeholder="pc..." autocomplete="off"></label><label>Quantidade<input name="pecaQuantidade" type="number" min="1" step="1" value="1"></label></div><p class="field-hint">A seleção por catálogo depende de leitura do estoque, disponível somente ao Administrador.</p></fieldset>' : ''}
          <div class="form-grid"><label>Notas visíveis ao cliente<textarea name="notasCliente" rows="3" maxlength="1000"></textarea></label><label>Notas internas<textarea name="notasInternas" rows="3" maxlength="1000"></textarea></label></div>
        </section>
        <section class="wizard-panel" data-step-panel="4" hidden><div class="section-heading"><span class="section-icon">${icon('preview')}</span><div><p class="eyebrow">Etapa 4 de 4</p><h2>Revise antes de criar</h2><p>Confira os dados. Campos estruturais não poderão ser corrigidos pela interface depois.</p></div></div><div id="order-review" class="review-grid"></div></section>
        <div class="form-error-summary" id="new-order-errors" role="alert" aria-live="assertive" hidden></div>
        <footer class="wizard-actions">${button({ label: 'Voltar', iconName: 'arrow_back', variant: 'ghost', action: 'wizard:previous', disabled: true })}<span class="wizard-spacer"></span>${button({ label: 'Continuar', iconName: 'arrow_forward', variant: 'primary', action: 'wizard:next', className: 'icon-end' })}${button({ label: 'Criar ordem', iconName: 'check', variant: 'primary', type: 'submit', action: 'wizard:submit', className: 'is-hidden' })}</footer>
      </form>
    </section>`;
}

function formValue(formData, name) {
  return String(formData.get(name) ?? '').trim();
}

function buildNewOrderPayload(form) {
  const data = new FormData(form);
  const payload = {};
  if (formValue(data, 'clientMode') === 'existing') payload.clienteId = formValue(data, 'clienteId');
  else payload.cliente = { tipoDoc: formValue(data, 'clienteTipoDoc'), numeroDoc: formValue(data, 'clienteNumeroDoc'), nome: formValue(data, 'clienteNome'), email: formValue(data, 'clienteEmail'), telefone: formValue(data, 'clienteTelefone') };
  if (formValue(data, 'vehicleMode') === 'existing') payload.veiculoId = formValue(data, 'veiculoId');
  else payload.veiculo = { placa: formValue(data, 'veiculoPlaca').toUpperCase(), renavam: formValue(data, 'veiculoRenavam'), chassi: formValue(data, 'veiculoChassi').toUpperCase(), marca: formValue(data, 'veiculoMarca'), modelo: formValue(data, 'veiculoModelo'), ano: Number(formValue(data, 'veiculoAno')), cor: formValue(data, 'veiculoCor'), ...(formValue(data, 'veiculoKm') ? { quilometragem: Number(formValue(data, 'veiculoKm')) } : {}) };
  const problem = formValue(data, 'problemaDescricao');
  const service = formValue(data, 'servicoId');
  const piece = formValue(data, 'pecaId');
  if (problem) payload.problemasRelatados = [{ descricao: problem }];
  if (service) payload.servicosSolicitados = [{ servicoId: service, ...(formValue(data, 'servicoObservacao') ? { observacao: formValue(data, 'servicoObservacao') } : {}) }];
  if (piece) payload.pecasSolicitadas = [{ pecaId: piece, quantidade: Number(formValue(data, 'pecaQuantidade') || 1) }];
  if (formValue(data, 'notasCliente')) payload.notasCliente = formValue(data, 'notasCliente');
  if (formValue(data, 'notasInternas')) payload.notasInternas = formValue(data, 'notasInternas');
  return payload;
}

function validateWizardStep(step, form) {
  const data = new FormData(form);
  const errors = [];
  if (step === 1) {
    if (formValue(data, 'clientMode') === 'existing' && !formValue(data, 'clienteId')) errors.push('Selecione um cliente.');
    if (formValue(data, 'clientMode') === 'new') {
      ['clienteNumeroDoc', 'clienteNome', 'clienteEmail', 'clienteTelefone'].forEach((name) => { if (!formValue(data, name)) errors.push('Preencha todos os dados obrigatórios do novo cliente.'); });
    }
  }
  if (step === 2) {
    if (formValue(data, 'vehicleMode') === 'existing' && !formValue(data, 'veiculoId')) errors.push('Selecione um veículo.');
    if (formValue(data, 'vehicleMode') === 'new') {
      ['veiculoPlaca', 'veiculoRenavam', 'veiculoChassi', 'veiculoMarca', 'veiculoModelo', 'veiculoAno', 'veiculoCor'].forEach((name) => { if (!formValue(data, name)) errors.push('Preencha todos os dados obrigatórios do novo veículo.'); });
      const year = Number(formValue(data, 'veiculoAno')); if (year < 1900 || year > 2100) errors.push('Informe um ano válido para o veículo.');
    }
  }
  if (step === 3 && !formValue(data, 'problemaDescricao') && !formValue(data, 'servicoId') && !formValue(data, 'pecaId')) errors.push('Informe ao menos um problema, serviço ou peça.');
  return [...new Set(errors)];
}

function renderReview(payload, { clientLabel = '', vehicleLabel = '' } = {}) {
  const client = payload.clienteId ? clientLabel || `Cadastro ${payload.clienteId}` : `${payload.cliente.nome} · ${payload.cliente.tipoDoc} ${payload.cliente.numeroDoc}`;
  const vehicle = payload.veiculoId ? vehicleLabel || `Cadastro ${payload.veiculoId}` : `${payload.veiculo.marca} ${payload.veiculo.modelo} · ${payload.veiculo.placa}`;
  const requests = [payload.problemasRelatados?.[0]?.descricao, payload.servicosSolicitados?.length ? 'Serviço do catálogo selecionado' : '', payload.pecasSolicitadas?.length ? 'Peça solicitada' : ''].filter(Boolean);
  return `<article class="review-card">${icon('person')}<div><small>Cliente</small><strong>${escapeHtml(client)}</strong></div></article><article class="review-card">${icon('directions_car')}<div><small>Veículo</small><strong>${escapeHtml(vehicle)}</strong></div></article><article class="review-card review-card-wide">${icon('fact_check')}<div><small>Solicitação</small><ul>${requests.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div></article>`;
}

export async function mountNewOrderView(root, { role, api, navigate, notify }) {
  if (!INTERNAL_ROLES.has(role)) return;
  const form = root.querySelector('#new-order-form');
  const errorBox = root.querySelector('#new-order-errors');
  let clientCombobox;
  let step = 1;
  const paintStep = () => {
    root.querySelectorAll('[data-step-panel]').forEach((panel) => { panel.hidden = Number(panel.dataset.stepPanel) !== step; });
    root.querySelectorAll('[data-step-indicator]').forEach((item) => {
      const current = Number(item.dataset.stepIndicator); item.classList.toggle('is-current', current === step); item.classList.toggle('is-complete', current < step);
    });
    const previous = root.querySelector('[data-action="wizard:previous"]');
    const next = root.querySelector('[data-action="wizard:next"]');
    const submit = root.querySelector('[data-action="wizard:submit"]');
    previous.disabled = step === 1; next.classList.toggle('is-hidden', step === 4); submit.classList.toggle('is-hidden', step !== 4);
    if (step === 4) {
      const vehicleOption = form.elements.veiculoId?.selectedOptions?.[0];
      root.querySelector('#order-review').innerHTML = renderReview(
        buildNewOrderPayload(form),
        {
          clientLabel: clientCombobox?.selectedLabel,
          vehicleLabel: vehicleOption?.value
            ? vehicleOption.textContent.trim()
            : '',
        },
      );
    }
    errorBox.hidden = true; root.querySelector(`[data-step-panel="${step}"] h2`)?.focus?.();
  };
  const setMode = (prefix, value) => {
    root.querySelector(`[data-mode="${prefix}-existing"]`)?.toggleAttribute('hidden', value !== 'existing');
    root.querySelector(`[data-mode="${prefix}-new"]`)?.toggleAttribute('hidden', value !== 'new');
    errorBox.hidden = true;
    errorBox.innerHTML = '';
  };
  root.addEventListener('change', (event) => {
    if (event.target.name === 'clientMode') {
      setMode('client', event.target.value);
      clientCombobox?.close();
    }
    if (event.target.name === 'vehicleMode') setMode('vehicle', event.target.value);
  });
  root.addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'wizard:previous' && step > 1) { step -= 1; paintStep(); }
    if (action === 'wizard:next') {
      const errors = validateWizardStep(step, form);
      if (errors.length) {
        errorBox.innerHTML = `<strong>Revise esta etapa:</strong><ul>${errors.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
        errorBox.hidden = false;
        if (
          step === 1 &&
          form.querySelector('[name="clientMode"]:checked')?.value ===
            'existing' &&
          !form.elements.clienteId.value
        ) {
          clientCombobox?.focus();
        } else {
          errorBox.focus();
        }
        return;
      }
      step += 1; paintStep();
    }
  });
  let clientSearchErrorShown = false;
  clientCombobox = mountClientCombobox(root, {
    api,
    onError: () => {
      if (clientSearchErrorShown) return;
      clientSearchErrorShown = true;
      notify?.({
        kind: 'warning',
        title: 'Busca de clientes indisponível',
        message:
          'Tente novamente ou use a opção Novo cliente para continuar.',
      });
    },
    onSelect: () => {
      clientSearchErrorShown = false;
    },
  });

  const [vehiclesResult, servicesResult] = await Promise.allSettled([
    api.request('/veiculos', { query: { pagina: 1, porPagina: 100 } }),
    api.request('/servicos-oficina', {
      query: { pagina: 1, porPagina: 100 },
    }),
  ]);

  if (vehiclesResult.status === 'fulfilled') {
    const vehicles = extractPage(vehiclesResult.value).data.filter(
      (item) => item.ativo !== false,
    );
    form.elements.veiculoId.innerHTML = `<option value="">Selecione…</option>${vehicles.map((item) => `<option value="${escapeAttribute(domainId(item.id))}">${escapeHtml(item.placa)} · ${escapeHtml(item.marca)} ${escapeHtml(item.modelo)}</option>`).join('')}`;
  } else {
    form.elements.veiculoId.innerHTML =
      '<option value="">Veículos indisponíveis</option>';
    form.querySelector('[name="vehicleMode"][value="new"]').click();
    notify?.({
      kind: 'warning',
      title: 'Veículos não carregados',
      message: 'Cadastre os dados do veículo junto com a ordem.',
    });
  }

  if (servicesResult.status === 'fulfilled') {
    const services = extractPage(servicesResult.value).data;
    form.elements.servicoId.innerHTML = `<option value="">Nenhum serviço selecionado</option>${services.map((item) => `<option value="${escapeAttribute(domainId(item.id))}">${escapeHtml(item.nome)}</option>`).join('')}`;
  } else {
    form.elements.servicoId.innerHTML =
      '<option value="">Catálogo indisponível</option>';
    notify?.({
      kind: 'warning',
      title: 'Catálogo não carregado',
      message: 'Ainda é possível registrar o problema relatado pelo cliente.',
    });
  }
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const errors = [1, 2, 3].flatMap((value) => validateWizardStep(value, form));
    if (errors.length) { errorBox.innerHTML = `<strong>Não foi possível criar:</strong><ul>${errors.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`; errorBox.hidden = false; return; }
    const submit = form.querySelector('[data-action="wizard:submit"]'); setButtonBusy(submit, true, 'Criando ordem…');
    try {
      const created = await api.request('/ordens-servico', { method: 'POST', body: buildNewOrderPayload(form) });
      notify({ kind: 'success', title: 'Ordem criada', message: `${orderNumber(created)} foi registrada com sucesso.` });
      navigate(`/ordens/${orderId(created)}`);
    } catch (error) {
      errorBox.innerHTML = `<strong>Não foi possível criar a ordem.</strong><p>${escapeHtml(apiErrorMessage(error))}</p>${error?.correlationId ? `<code>${escapeHtml(error.correlationId)}</code>` : ''}`; errorBox.hidden = false; setButtonBusy(submit, false);
    }
  });
  return () => clientCombobox?.destroy();
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

function nextAction(order, role) {
  const status = order.status;
  if (role === ROLES.CLIENT && status === 'AGUARDANDO_APROVACAO') return { tone: 'attention', icon: 'task_alt', title: 'Seu orçamento está pronto', text: 'Revise os itens e decida se a oficina pode prosseguir.', actions: `${button({ label: 'Rejeitar orçamento', iconName: 'close', variant: 'danger', action: 'order:reject' })}${button({ label: 'Aprovar orçamento', iconName: 'check', variant: 'primary', action: 'order:approve' })}` };
  if (role === ROLES.CLIENT) return { tone: 'neutral', icon: 'visibility', title: 'Acompanhe o andamento', text: status === 'CANCELADA' ? 'Esta ordem foi cancelada após a rejeição do orçamento.' : 'Nenhuma ação sua é necessária neste momento.', actions: '' };
  if (INTERNAL_ROLES.has(role) && status === 'RECEBIDA') return { tone: 'action', icon: 'engineering', title: 'Atribua um mecânico', text: 'A OS precisa de um responsável antes do diagnóstico.', actions: button({ label: 'Informar mecânico', iconName: 'person_add', variant: 'primary', action: 'order:assign' }) };
  if (INTERNAL_ROLES.has(role) && status === 'AGUARDANDO_APROVACAO') return { tone: 'attention', icon: 'hourglass_top', title: 'Aguardando decisão do cliente', text: 'Somente o cliente titular pode aprovar ou rejeitar. A equipe deve apenas acompanhar.', actions: '' };
  if (INTERNAL_ROLES.has(role) && status === 'FINALIZADA') return { tone: 'action', icon: 'key', title: 'Veículo pronto para entrega', text: 'Confirme a retirada somente quando o veículo for efetivamente entregue.', actions: button({ label: 'Registrar entrega', iconName: 'key', variant: 'primary', action: 'order:deliver' }) };
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
    <section class="timeline-card"><div class="section-heading"><div><p class="eyebrow">Ciclo da ordem</p><h2>Progresso</h2></div></div>${timelineMarkup(order)}</section>
    <div class="detail-layout"><section class="detail-main"><div class="tabs" data-tabs><div class="tab-list" role="tablist" aria-label="Detalhes da ordem"><button role="tab" id="tab-summary" aria-selected="true" aria-controls="panel-summary" tabindex="0">Resumo</button><button role="tab" id="tab-diagnosis" aria-selected="false" aria-controls="panel-diagnosis" tabindex="-1">Diagnóstico</button><button role="tab" id="tab-budget" aria-selected="false" aria-controls="panel-budget" tabindex="-1">Orçamento <span class="tab-count">${orderLines(order).length}</span></button><button role="tab" id="tab-history" aria-selected="false" aria-controls="panel-history" tabindex="-1">Histórico</button></div>
      <div role="tabpanel" id="panel-summary" aria-labelledby="tab-summary"><div class="summary-grid"><article class="data-card"><p class="eyebrow">Problemas relatados</p><h3>Solicitação do cliente</h3>${problems.length ? `<ul class="check-list">${problems.map((item) => `<li>${icon('report')}<span>${escapeHtml(item.descricao)}</span></li>`).join('')}</ul>` : '<p class="muted">Nenhum problema textual registrado.</p>'}</article><article class="data-card"><p class="eyebrow">Serviços solicitados</p><h3>Escopo inicial</h3>${services.length ? `<ul class="check-list">${services.map((item) => `<li>${icon('home_repair_service')}<span>${escapeHtml(item.nomeServico ?? domainId(item.servicoId))}${item.observacao ? `<small>${escapeHtml(item.observacao)}</small>` : ''}</span></li>`).join('')}</ul>` : '<p class="muted">Nenhum serviço do catálogo selecionado.</p>'}</article></div>${order.notasCliente ? `<article class="customer-note"><strong>${icon('chat')} Nota para o cliente</strong><p>${escapeHtml(order.notasCliente)}</p></article>` : ''}${!clientView && order.notasInternas ? `<article class="internal-note"><strong>${icon('lock')} Nota interna</strong><p>${escapeHtml(order.notasInternas)}</p></article>` : ''}</div>
      <div role="tabpanel" id="panel-diagnosis" aria-labelledby="tab-diagnosis" hidden>${order.diagnostico ? `<article class="diagnosis-card"><span class="section-icon">${icon('stethoscope')}</span><div><p class="eyebrow">Parecer técnico</p><h3>Diagnóstico registrado</h3><p>${escapeHtml(order.diagnostico.descricao)}</p></div></article>` : statePanel({ kind: 'empty', title: 'Diagnóstico não registrado', description: 'O parecer técnico aparecerá aqui quando o mecânico responsável concluir a análise.' })}</div>
      <div role="tabpanel" id="panel-budget" aria-labelledby="tab-budget" hidden>${budgetMarkup(order, clientView)}</div>
      <div role="tabpanel" id="panel-history" aria-labelledby="tab-history" hidden>${historyMarkup(order)}</div></div></section>
      <aside class="detail-aside"><article class="context-card"><p class="eyebrow">Referências</p><h2>Dados vinculados</h2><dl><div><dt>ID da ordem</dt><dd class="mono-value">${escapeHtml(orderId(order))}</dd></div><div><dt>Veículo</dt><dd class="mono-value">${escapeHtml(domainId(order.veiculoId))}</dd></div>${clientView ? '' : `<div><dt>Cliente</dt><dd class="mono-value">${escapeHtml(domainId(order.clienteId))}</dd></div><div><dt>Mecânico</dt><dd class="mono-value">${escapeHtml(domainId(order.mecanicoResponsavelId) || 'Não atribuído')}</dd></div>`}</dl>${clientView ? '<p class="field-hint">A API do cliente não fornece placa, marca ou modelo do veículo. O identificador é exibido sem inventar dados.</p>' : '<p class="field-hint">A API de OS retorna identificadores, sem expandir nomes dos cadastros relacionados.</p>'}</article></aside></div>`;
}

export function renderSimpleFieldModalActions(action, submitLabel) {
  return `${button({ label: 'Cancelar', variant: 'ghost', action: 'modal-cancel' })}${button({ label: submitLabel, iconName: 'check', variant: 'primary', type: 'submit', action, attributes: 'form="order-action-form"' })}`;
}

function simpleFieldModal(title, fieldHtml, action, submitLabel, size = 'medium') {
  return openModal({
    title,
    size,
    content: `<form id="order-action-form" class="form-stack" novalidate>${fieldHtml}<div class="form-error-summary" role="alert" hidden></div></form>`,
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

function budgetBuilderModal() {
  const modal = openModal({ title: 'Gerar orçamento', size: 'large', content: `<form id="budget-form" class="form-stack" novalidate><label>Título do grupo<input name="groupTitle" value="Serviços recomendados" required maxlength="120"></label><div class="budget-builder" id="budget-lines"></div>${button({ label: 'Adicionar item', iconName: 'add', variant: 'secondary', action: 'budget:add-line' })}<div class="form-grid"><label>Notas visíveis ao cliente<textarea name="notasCliente" rows="3"></textarea></label><label>Notas internas<textarea name="notasInternas" rows="3"></textarea></label></div><div class="form-error-summary" role="alert" hidden></div></form>`, actions: `${button({ label: 'Cancelar', variant: 'ghost', action: 'modal-cancel' })}${button({ label: 'Enviar ao cliente', iconName: 'send', variant: 'primary', type: 'submit', action: 'order:budget-submit', attributes: 'form="budget-form"' })}` });
  if (!modal) return null;
  const lines = modal.root.querySelector('#budget-lines');
  let sequence = 0;
  const addLine = () => {
    sequence += 1;
    const row = document.createElement('fieldset'); row.className = 'budget-line-editor'; row.dataset.line = String(sequence);
    row.innerHTML = `<legend>Item ${sequence}</legend><div class="form-grid"><label>Tipo<select name="type-${sequence}"><option value="SERVICO">Serviço</option><option value="MATERIAL">Material</option></select></label><label>Descrição<input name="description-${sequence}" required maxlength="240"></label><label>Quantidade<input name="quantity-${sequence}" type="number" min="0.01" step="0.01" value="1" required></label><label>Valor unitário<input name="price-${sequence}" type="number" min="0" step="0.01" required></label><label>ID da peça (para material)<input name="piece-${sequence}" placeholder="pc..."></label></div>${button({ label: 'Remover item', iconName: 'delete', variant: 'ghost', action: 'budget:remove-line', attributes: `data-line="${sequence}"` })}`;
    lines.append(row);
  };
  addLine();
  modal.root.addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'budget:add-line') addLine();
    if (action === 'budget:remove-line' && lines.children.length > 1) event.target.closest('[data-line]')?.remove();
    if (action === 'modal-cancel') modal.close();
  });
  return modal;
}

function budgetPayload(form) {
  const data = new FormData(form);
  const lines = [...form.querySelectorAll('[data-line]')].map((row) => {
    const key = row.dataset.line;
    const tipo = formValue(data, `type-${key}`); const pecaId = formValue(data, `piece-${key}`);
    return { tipo, descricao: formValue(data, `description-${key}`), quantidade: Number(formValue(data, `quantity-${key}`)), valorUnitario: Number(formValue(data, `price-${key}`)), ...(tipo === 'MATERIAL' && pecaId ? { pecaId } : {}) };
  });
  return { grupos: [{ titulo: formValue(data, 'groupTitle'), linhas: lines }], ...(formValue(data, 'notasCliente') ? { notasCliente: formValue(data, 'notasCliente') } : {}), ...(formValue(data, 'notasInternas') ? { notasInternas: formValue(data, 'notasInternas') } : {}) };
}

export async function mountOrderDetailView(root, { id, role, api, navigate, notify }) {
  const target = root.querySelector('#order-detail');
  let order;
  const load = async () => {
    target.innerHTML = skeleton({ cards: 2, rows: 8, label: 'Atualizando detalhes da ordem' });
    try { order = await api.request(orderDetailPath(role, id)); target.innerHTML = detailMarkup(order, role); }
    catch (error) { target.innerHTML = statePanel({ kind: error?.status === 403 ? 'forbidden' : error?.status === 404 ? 'notFound' : 'error', title: error?.status === 403 ? 'Ordem fora do seu escopo' : error?.status === 404 ? 'Ordem não encontrada' : 'Não foi possível abrir a ordem', description: apiErrorMessage(error), actionLabel: error?.status >= 500 ? 'Tentar novamente' : 'Voltar às ordens', action: error?.status >= 500 ? 'order:retry' : 'order:back', correlationId: error?.correlationId }); }
  };
  const runAction = async (path, { method = 'PATCH', body, success }) => {
    try { await api.request(path, { method, body }); notify({ kind: 'success', title: success, message: 'Os dados foram sincronizados com a API.' }); await load(); }
    catch (error) { notify({ kind: 'error', title: 'A operação não foi concluída', message: apiErrorMessage(error) }); }
  };
  root.addEventListener('click', async (event) => {
    const trigger = event.target.closest('[data-action], [role="tab"]'); const action = trigger?.dataset.action;
    if (trigger?.matches('[role="tab"]')) {
      const list = trigger.closest('[role="tablist"]'); list.querySelectorAll('[role="tab"]').forEach((tab) => { const active = tab === trigger; tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1; const panel = target.querySelector('#' + tab.getAttribute('aria-controls')); if (panel) panel.hidden = !active; });
      return;
    }
    if (!action) return;
    if (action === 'order:retry') return load();
    if (action === 'order:back') return navigate('/ordens');
    if (action === 'order:assign') {
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
        modal.close();
        await runAction(`/ordens-servico/${encodeURIComponent(id)}/atribuir/${encodeURIComponent(mechanicId)}`, { success: 'Mecânico atribuído' });
      });
    }
    if (action === 'order:diagnosis') {
      const modal = simpleFieldModal('Registrar diagnóstico', '<label for="diagnosis-description">Descrição técnica<textarea id="diagnosis-description" name="descricao" rows="6" required maxlength="3000" placeholder="Descreva achados, causa provável e verificações realizadas"></textarea></label>', 'order:diagnosis-submit', 'Salvar diagnóstico');
      modal.root.querySelector('[data-action="modal-cancel"]')?.addEventListener('click', modal.close);
      modal.root.querySelector('#order-action-form').addEventListener('submit', async (submitEvent) => { submitEvent.preventDefault(); const descricao = new FormData(submitEvent.currentTarget).get('descricao')?.trim(); if (!descricao) return; modal.close(); await runAction(`/ordens-servico/${encodeURIComponent(id)}/diagnostico`, { body: { descricao }, success: 'Diagnóstico registrado' }); });
    }
    if (action === 'order:budget') {
      const modal = budgetBuilderModal(); const form = modal.root.querySelector('#budget-form');
      form.addEventListener('submit', async (submitEvent) => { submitEvent.preventDefault(); const payload = budgetPayload(form); const invalid = payload.grupos[0].linhas.some((line) => !line.descricao || line.quantidade <= 0 || line.valorUnitario < 0 || (line.tipo === 'MATERIAL' && !line.pecaId)); if (invalid) { const box = form.querySelector('[role="alert"]'); box.textContent = 'Revise descrição, quantidade, valor e ID das peças de todos os itens.'; box.hidden = false; return; } modal.close(); await runAction(`/ordens-servico/${encodeURIComponent(id)}/orcamento`, { body: payload, success: 'Orçamento enviado ao cliente' }); });
    }
    if (action === 'order:consume') {
      const modal = simpleFieldModal('Registrar consumo de peça', '<div class="form-grid"><label>ID da peça<input name="pecaId" required placeholder="pc..."></label><label>Quantidade<input name="quantidade" type="number" min="1" step="1" value="1" required></label></div>', 'order:consume-submit', 'Registrar consumo');
      modal.root.querySelector('[data-action="modal-cancel"]')?.addEventListener('click', modal.close);
      modal.root.querySelector('#order-action-form').addEventListener('submit', async (submitEvent) => { submitEvent.preventDefault(); const data = new FormData(submitEvent.currentTarget); const pecaId = formValue(data, 'pecaId'); const quantidade = Number(formValue(data, 'quantidade')); if (!pecaId || quantidade < 1) return; modal.close(); await runAction(`/ordens-servico/${encodeURIComponent(id)}/consumo-peca`, { body: { pecaId, quantidade }, success: 'Consumo registrado' }); });
    }
    const confirmations = {
      'order:approve': { title: 'Aprovar este orçamento?', message: 'A oficina poderá iniciar a execução dos serviços e materiais apresentados.', label: 'Aprovar orçamento', path: 'aprovar', success: 'Orçamento aprovado', tone: 'primary' },
      'order:reject': { title: 'Rejeitar este orçamento?', message: 'A rejeição cancelará esta ordem de serviço e não poderá ser desfeita pela interface.', label: 'Rejeitar e cancelar', path: 'rejeitar', success: 'Orçamento rejeitado', tone: 'danger' },
      'order:start': { title: 'Iniciar a execução?', message: 'Confirme que o veículo está no box e o orçamento aprovado será executado.', label: 'Iniciar execução', path: 'iniciar-execucao', success: 'Execução iniciada', tone: 'primary' },
      'order:finish': { title: 'Finalizar o serviço?', message: 'Confirme que todos os serviços foram conferidos e os consumos de peças registrados.', label: 'Finalizar serviço', path: 'finalizar', success: 'Serviço finalizado', tone: 'primary' },
      'order:deliver': { title: 'Registrar a entrega do veículo?', message: 'Esta é a conclusão definitiva do ciclo da OS. Confirme somente após entregar o veículo ao cliente.', label: 'Confirmar entrega', path: 'entregar', success: 'Veículo entregue', tone: 'primary' },
    };
    if (confirmations[action]) { const item = confirmations[action]; const confirmed = await confirmAction({ title: item.title, message: item.message, confirmLabel: item.label, tone: item.tone }); if (confirmed) await runAction(`/ordens-servico/${encodeURIComponent(id)}/${item.path}`, { success: item.success }); }

  });
  await load();
}
