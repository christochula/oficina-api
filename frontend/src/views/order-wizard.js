import { ROLES } from '../core/permissions.js';
import { button, domainId, escapeAttribute, escapeHtml, icon, setButtonBusy, statePanel } from '../components/ui-kit.js';
import { pageHeader } from '../components/shell.js';
import { apiErrorMessage } from '../services/domain-api.js';
import { mountClientCombobox, renderClientComboboxField } from '../components/client-combobox.js';
import { mountCatalogCombobox, renderCatalogComboboxField } from '../components/catalog-combobox.js';
import { captureForm, restoreForm, readDraft, saveDraft, clearDraft } from '../core/draft-store.js';
import { formatOrderNumber } from '../core/formatters.js';
const INTERNAL_ROLES = new Set([ROLES.ADMIN, ROLES.CONSULTANT]);
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
        <aside class="draft-notice" role="status"><span id="wizard-draft-status">Seu rascunho é salvo nesta aba por 24 horas. Sair da conta descarta o rascunho.</span>${button({ label: 'Descartar rascunho', variant: 'ghost', action: 'wizard:discard' })}</aside>
<label>Filial<select name="filialId"><option value="filial-sp">São Paulo</option><option value="filial-rj">Rio de Janeiro</option></select></label>
        <section class="wizard-panel" data-step-panel="1"><div class="section-heading"><span class="section-icon">${icon('person')}</span><div><p class="eyebrow">Etapa 1 de 4</p><h2>Identifique o cliente</h2><p>Escolha um cadastro existente ou informe um novo cliente.</p></div></div>
          <fieldset class="choice-cards"><legend class="sr-only">Origem do cliente</legend><label><input type="radio" name="clientMode" value="existing" checked><span>${icon('person_search')}<strong>Cliente cadastrado</strong><small>Busque por nome, documento ou contato</small></span></label><label><input type="radio" name="clientMode" value="new"><span>${icon('person_add')}<strong>Novo cliente</strong><small>Cadastre junto com a OS</small></span></label></fieldset>
          <div data-mode="client-existing">${renderClientComboboxField({ id: 'order-client', hint: 'Digite pelo menos 2 caracteres para pesquisar em toda a base. Com o campo vazio, mostramos os primeiros 10 clientes ativos.' })}</div>
          <div data-mode="client-new" class="wizard-inline-form" hidden>${renderNewClientForm()}</div>
        </section>
        <section class="wizard-panel" data-step-panel="2" hidden><div class="section-heading"><span class="section-icon">${icon('directions_car')}</span><div><p class="eyebrow">Etapa 2 de 4</p><h2>Identifique o veículo</h2><p>Veículos não possuem vínculo direto com clientes; a associação acontece nesta OS.</p></div></div>
          <fieldset class="choice-cards"><legend class="sr-only">Origem do veículo</legend><label><input type="radio" name="vehicleMode" value="existing" checked><span>${icon('garage_home')}<strong>Veículo cadastrado</strong><small>Selecione na lista carregada</small></span></label><label><input type="radio" name="vehicleMode" value="new"><span>${icon('add_road')}<strong>Novo veículo</strong><small>Cadastre junto com a OS</small></span></label></fieldset>
          <div data-mode="vehicle-existing">${renderCatalogComboboxField({ id: 'order-vehicle', name: 'veiculoId', label: 'Veículo', kind: 'vehicle', hint: 'Busque pela placa, marca ou modelo em toda a base.' })}</div>
          <div data-mode="vehicle-new" class="form-grid" hidden><label>Placa<input name="veiculoPlaca" autocomplete="off"></label><label>RENAVAM<input name="veiculoRenavam" inputmode="numeric"></label><label>Chassi<input name="veiculoChassi"></label><label>Marca<input name="veiculoMarca"></label><label>Modelo<input name="veiculoModelo"></label><label>Ano<input name="veiculoAno" type="number" min="1900" max="2100"></label><label>Cor<input name="veiculoCor"></label><label>Quilometragem<input name="veiculoKm" type="number" min="0" step="1"></label></div>
        </section>
        <section class="wizard-panel" data-step-panel="3" hidden><div class="section-heading"><span class="section-icon">${icon('fact_check')}</span><div><p class="eyebrow">Etapa 3 de 4</p><h2>Registre a solicitação</h2><p>Informe ao menos um problema, serviço ou peça.</p></div></div>
          <div class="form-group"><label for="problemaDescricao">Problema relatado pelo cliente</label><textarea id="problemaDescricao" name="problemaDescricao" rows="4" maxlength="1000" placeholder="Descreva os sintomas nas palavras do cliente"></textarea></div>
          <div class="form-grid">${renderCatalogComboboxField({ id: 'order-service', name: 'servicoId', label: 'Serviço solicitado', kind: 'service', required: false, hint: 'Pesquise pelo nome ou descrição do serviço.' })}<label>Observação do serviço<input name="servicoObservacao" maxlength="300"></label></div>
          ${role === ROLES.ADMIN ? `<fieldset class="subsection"><legend>Peças solicitadas (opcional)</legend><div id="requested-parts"></div>${button({ label: 'Adicionar peça', iconName: 'add', variant: 'secondary', action: 'wizard:add-piece' })}<p class="field-hint">A solicitação registra a intenção do cliente. A reserva ocorre somente após a aprovação do orçamento.</p></fieldset>` : '<aside class="scope-notice"><p>Para incluir uma peça específica, registre a necessidade no problema relatado e solicite ao administrador a identificação no estoque da filial.</p></aside>'}
          <div class="form-grid"><label>Notas visíveis ao cliente<textarea name="notasCliente" rows="3" maxlength="1000"></textarea></label><label>Notas internas<textarea name="notasInternas" rows="3" maxlength="1000"></textarea></label></div>
        </section>
        <section class="wizard-panel" data-step-panel="4" hidden><div class="section-heading"><span class="section-icon">${icon('preview')}</span><div><p class="eyebrow">Etapa 4 de 4</p><h2>Revise antes de criar</h2><p>Confira os dados. Campos estruturais não poderão ser corrigidos pela interface depois.</p></div></div><div id="order-review" class="review-grid"></div></section>
        <div class="form-error-summary" id="new-order-errors" role="alert" aria-live="assertive" tabindex="-1" hidden></div>
        <footer class="wizard-actions">${button({ label: 'Voltar', iconName: 'arrow_back', variant: 'ghost', action: 'wizard:previous', disabled: true })}<span class="wizard-spacer"></span>${button({ label: 'Continuar', iconName: 'arrow_forward', variant: 'primary', action: 'wizard:next', className: 'icon-end' })}${button({ label: 'Criar ordem', iconName: 'check', variant: 'primary', type: 'submit', action: 'wizard:submit', className: 'is-hidden' })}</footer>
      </form>
    </section>`;
}

function formValue(formData, name) {
  return String(formData.get(name) ?? '').trim();
}

function buildNewOrderPayload(form) {
  const data = new FormData(form);
  const payload = { filialId: formValue(data, 'filialId') || 'filial-sp' };
  if (formValue(data, 'clientMode') === 'existing') payload.clienteId = formValue(data, 'clienteId');
  else payload.cliente = { tipoDoc: formValue(data, 'clienteTipoDoc'), numeroDoc: formValue(data, 'clienteNumeroDoc'), nome: formValue(data, 'clienteNome'), email: formValue(data, 'clienteEmail'), telefone: formValue(data, 'clienteTelefone') };
  if (formValue(data, 'vehicleMode') === 'existing') payload.veiculoId = formValue(data, 'veiculoId');
  else payload.veiculo = { placa: formValue(data, 'veiculoPlaca').toUpperCase(), renavam: formValue(data, 'veiculoRenavam'), chassi: formValue(data, 'veiculoChassi').toUpperCase(), marca: formValue(data, 'veiculoMarca'), modelo: formValue(data, 'veiculoModelo'), ano: Number(formValue(data, 'veiculoAno')), cor: formValue(data, 'veiculoCor'), ...(formValue(data, 'veiculoKm') ? { quilometragem: Number(formValue(data, 'veiculoKm')) } : {}) };
  const problem = formValue(data, 'problemaDescricao');
  const service = formValue(data, 'servicoId');
  if (problem) payload.problemasRelatados = [{ descricao: problem }];
  if (service) payload.servicosSolicitados = [{ servicoId: service, ...(formValue(data, 'servicoObservacao') ? { observacao: formValue(data, 'servicoObservacao') } : {}) }];
  const pieces = [...form.querySelectorAll('[data-requested-piece]')].map((row) => ({ pecaId: formValue(data, `pecaId-${row.dataset.requestedPiece}`), quantidade: Number(formValue(data, `pecaQuantidade-${row.dataset.requestedPiece}`)) })).filter((item) => item.pecaId);
  if (pieces.length) payload.pecasSolicitadas = pieces;
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
  if (step === 3) {
    const pieces = buildNewOrderPayload(form).pecasSolicitadas ?? [];
    if (!formValue(data, 'problemaDescricao') && !formValue(data, 'servicoId') && !pieces.length) errors.push('Informe ao menos um problema, serviço ou peça.');
    if (pieces.some((item) => !Number.isSafeInteger(item.quantidade) || item.quantidade < 1)) errors.push('Informe uma quantidade inteira positiva para cada peça.');
    if (new Set(pieces.map((item) => item.pecaId)).size !== pieces.length) errors.push('Selecione cada peça uma única vez e ajuste sua quantidade.');
  }
  return [...new Set(errors)];
}

function renderReview(payload, { clientLabel = '', vehicleLabel = '', serviceLabel = '', pieceLabels = [] } = {}) {
  const client = payload.clienteId ? clientLabel || `Cadastro ${payload.clienteId}` : `${payload.cliente.nome} · ${payload.cliente.tipoDoc} ${payload.cliente.numeroDoc}`;
  const vehicle = payload.veiculoId ? vehicleLabel || `Cadastro ${payload.veiculoId}` : `${payload.veiculo.marca} ${payload.veiculo.modelo} · ${payload.veiculo.placa}`;
  const requests = [payload.problemasRelatados?.[0]?.descricao, serviceLabel, ...pieceLabels].filter(Boolean);
  return `<article class="review-card">${icon('person')}<div><small>Cliente</small><strong>${escapeHtml(client)}</strong></div></article><article class="review-card">${icon('directions_car')}<div><small>Veículo</small><strong>${escapeHtml(vehicle)}</strong></div></article><article class="review-card review-card-wide">${icon('fact_check')}<div><small>Solicitação</small><ul>${requests.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div></article>`;
}

export async function mountNewOrderView(root, { role, subject, api, navigate, notify }) {
  if (!INTERNAL_ROLES.has(role)) return;
  const scope = { role, subject };
  const draft = readDraft(scope, 'new-order');
  const form = root.querySelector('#new-order-form');
  const errorBox = root.querySelector('#new-order-errors');
  const draftStatus = root.querySelector('#wizard-draft-status');
  let step = Math.max(1, Math.min(4, Number(draft?.step) || 1));
  let ready = false;
  let completed = false;
  let pieceSequence = 0;
  let pieces = [];
  const showError = (message) => { errorBox.textContent = message; errorBox.hidden = false; errorBox.focus(); };
  const save = () => {
    if (!ready || completed) return;
    const saved = saveDraft(scope, 'new-order', {
      step, values: captureForm(form), client: clientCombobox.selected,
      vehicle: vehicleCombobox.selected, service: serviceCombobox.selected,
      pieces: pieces.map(({ picker, row }) => ({ selected: picker.selected, quantity: row.querySelector('input[type="number"]').value })),
    });
    if (!saved && subject) draftStatus.textContent = 'O navegador não permitiu salvar o rascunho. Mantenha esta tela aberta até concluir.';
  };
  const clientCombobox = mountClientCombobox(root, { api, initialSelectedClient: draft?.client, onSelect: save, onClear: save,
    onError: () => notify?.({ kind: 'warning', title: 'Busca de clientes indisponível', message: 'Tente a busca novamente. Os dados preenchidos foram preservados.' }) });
  const vehicleCombobox = mountCatalogCombobox(root.querySelector('[data-mode="vehicle-existing"]'), { api, kind: 'vehicle', initialSelected: draft?.vehicle, getFilters: () => ({ ativo: true }), onSelect: save, onClear: save });
  const serviceCombobox = mountCatalogCombobox(root.querySelector('[data-catalog-id="order-service"]'), { api, kind: 'service', initialSelected: draft?.service, getFilters: () => ({ ativo: true }), onSelect: save, onClear: save });
  const addPiece = (saved = {}) => {
    const holder = root.querySelector('#requested-parts');
    if (!holder) return;
    const key = ++pieceSequence;
    const row = document.createElement('div'); row.className = 'requested-piece-row form-grid'; row.dataset.requestedPiece = String(key);
    row.innerHTML = `${renderCatalogComboboxField({ id: `order-piece-${key}`, name: `pecaId-${key}`, label: 'Peça solicitada', kind: 'piece', required: false, hint: 'Nome, código ou descrição; somente peças ativas desta filial.' })}<label>Quantidade<input name="pecaQuantidade-${key}" type="number" min="1" step="1" value="${escapeAttribute(saved.quantity ?? 1)}"></label>${button({ label: 'Remover peça', iconName: 'delete', variant: 'ghost', action: 'wizard:remove-piece' })}`;
    holder.append(row);
    const picker = mountCatalogCombobox(row, { api, kind: 'piece', getFilters: () => ({ filialId: form.elements.filialId.value, ativo: true }), initialSelected: saved.selected, onSelect: save, onClear: save });
    pieces.push({ row, picker });
  };
  if (draft?.values) restoreForm(form, draft.values);
  (draft?.pieces?.length ? draft.pieces : [{}]).forEach(addPiece);
  const setMode = (prefix, value) => {
    root.querySelector(`[data-mode="${prefix}-existing"]`)?.toggleAttribute('hidden', value !== 'existing');
    root.querySelector(`[data-mode="${prefix}-new"]`)?.toggleAttribute('hidden', value !== 'new');
  };
  const paintStep = ({ focus = true } = {}) => {
    root.querySelectorAll('[data-step-panel]').forEach((panel) => { panel.hidden = Number(panel.dataset.stepPanel) !== step; });
    root.querySelectorAll('[data-step-indicator]').forEach((item) => {
      const current = Number(item.dataset.stepIndicator); item.classList.toggle('is-current', current === step); item.classList.toggle('is-complete', current < step);
      if (current === step) item.setAttribute('aria-current', 'step'); else item.removeAttribute('aria-current');
    });
    const previous = root.querySelector('[data-action="wizard:previous"]');
    previous.disabled = step === 1; previous.setAttribute('aria-disabled', String(step === 1));
    root.querySelector('[data-action="wizard:next"]').classList.toggle('is-hidden', step === 4);
    root.querySelector('[data-action="wizard:submit"]').classList.toggle('is-hidden', step !== 4);
    if (step === 4) {
      root.querySelector('#order-review').innerHTML = renderReview(buildNewOrderPayload(form), {
        clientLabel: clientCombobox.selectedLabel, vehicleLabel: vehicleCombobox.selectedLabel,
        serviceLabel: serviceCombobox.selectedLabel,
        pieceLabels: pieces.filter((item) => item.picker.value).map(({ picker, row }) => `${picker.selectedLabel} · ${row.querySelector('input[type="number"]').value} unidade(s)`),
      }) + `<article class="review-card"><div><small>Filial</small><strong>${escapeHtml(form.elements.filialId.selectedOptions[0].textContent)}</strong><p>Peças solicitadas ainda não foram reservadas.</p></div></article>`;
    }
    errorBox.hidden = true;
    const heading = root.querySelector(`[data-step-panel="${step}"] h2`); heading?.setAttribute('tabindex', '-1');
    if (focus) heading?.focus();
    save();
  };
  const change = (event) => {
    if (event.target.name === 'clientMode') { setMode('client', event.target.value); clientCombobox.close(); }
    if (event.target.name === 'vehicleMode') { setMode('vehicle', event.target.value); vehicleCombobox.close(); }
    if (event.target.name === 'filialId') {
      pieces.forEach(({ picker }) => picker.refresh({ clearSelection: true }));
      notify?.({ kind: 'info', title: 'Filial alterada', message: 'Selecione as peças da nova filial. Os outros dados foram mantidos.' });
    }
    save();
  };
  const click = (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'wizard:previous' && step > 1) { step -= 1; paintStep(); }
    if (action === 'wizard:next') {
      const errors = validateWizardStep(step, form);
      if (errors.length) return showError(errors.join(' '));
      step = Math.min(4, step + 1); paintStep();
    }
    if (action === 'wizard:add-piece') { addPiece(); save(); }
    if (action === 'wizard:remove-piece') {
      const row = event.target.closest('[data-requested-piece]');
      pieces.find((item) => item.row === row)?.picker.destroy(); row?.remove();
      pieces = pieces.filter((item) => item.row !== row); save();
    }
    if (action === 'wizard:discard') {
      ready = false; form.reset(); clientCombobox.clear(); vehicleCombobox.clear(); serviceCombobox.clear();
      pieces.forEach(({ picker, row }) => { picker.destroy(); row.remove(); }); pieces = []; addPiece();
      step = 1; setMode('client', 'existing'); setMode('vehicle', 'existing'); paintStep();
      clearDraft(scope, 'new-order'); ready = true;
      draftStatus.textContent = 'Rascunho descartado. Os próximos preenchimentos serão salvos nesta aba.';
    }
  };
  const submit = async (event) => {
    event.preventDefault();
    const errors = [1, 2, 3].flatMap((value) => validateWizardStep(value, form));
    if (errors.length) return showError([...new Set(errors)].join(' '));
    const submitButton = form.querySelector('[data-action="wizard:submit"]');
    if (submitButton.disabled) return;
    setButtonBusy(submitButton, true, 'Criando ordem…'); save();
    try {
      const created = await api.request('/ordens-servico', { method: 'POST', body: buildNewOrderPayload(form) });
      completed = true; clearDraft(scope, 'new-order');
      notify?.({ kind: 'success', title: 'Ordem criada', message: `${formatOrderNumber(created.numero)} foi registrada com sucesso.` });
      navigate(`/ordens/${domainId(created.id)}`);
    } catch (error) { showError(apiErrorMessage(error)); setButtonBusy(submitButton, false); }
  };
  setMode('client', form.querySelector('[name="clientMode"]:checked').value);
  setMode('vehicle', form.querySelector('[name="vehicleMode"]:checked').value);
  paintStep({ focus: false }); ready = true;
  if (draft) draftStatus.textContent = 'Rascunho recuperado nesta conta. Revise os dados antes de criar a ordem.';
  form.addEventListener('input', save); form.addEventListener('change', change); form.addEventListener('submit', submit); root.addEventListener('click', click);
  globalThis.addEventListener?.('pagehide', save);
  return () => {
    save(); ready = false; clientCombobox.destroy(); vehicleCombobox.destroy(); serviceCombobox.destroy(); pieces.forEach(({ picker }) => picker.destroy());
    form.removeEventListener('input', save); form.removeEventListener('change', change); form.removeEventListener('submit', submit); root.removeEventListener('click', click); globalThis.removeEventListener?.('pagehide', save);
  };
}
