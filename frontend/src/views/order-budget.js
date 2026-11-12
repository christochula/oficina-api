import { button, escapeAttribute, escapeHtml, openModal } from '../components/ui-kit.js';
import { formatCurrency } from '../core/formatters.js';
import { mountCatalogCombobox, renderCatalogComboboxField } from '../components/catalog-combobox.js';
import { captureForm, restoreForm, readDraft, saveDraft, clearDraft } from '../core/draft-store.js';

function formValue(data, name) { return String(data.get(name) ?? '').trim(); }

export function budgetBuilderModal({ api, scope, order } = {}) {
  const draftKey = `budget:${order?.id?.valor ?? order?.id}:v${order?.orcamento?.version ?? 0}`;
  const draft = readDraft(scope, draftKey);
  const modal = openModal({ title: 'Gerar orçamento', size: 'large', content: `<form id="budget-form" class="form-stack" novalidate>
    <aside class="draft-notice" role="status"><span data-draft-status>${draft ? 'Rascunho recuperado. Revise os itens antes de enviar.' : 'O rascunho permanece nesta conta por 24 horas, inclusive ao fechar esta janela. Sair da conta o descarta.'}</span>${button({ label: 'Descartar rascunho', variant: 'ghost', action: 'budget:discard' })}</aside>
    <label>Título do grupo<input name="groupTitle" value="Serviços recomendados" required maxlength="120"></label><div class="budget-builder" id="budget-lines"></div>${button({ label: 'Adicionar item', iconName: 'add', variant: 'secondary', action: 'budget:add-line' })}
    <div class="form-grid"><label>Notas visíveis ao cliente<textarea name="notasCliente" rows="3" maxlength="1000"></textarea></label><label>Notas internas<textarea name="notasInternas" rows="3" maxlength="1000"></textarea></label></div><div class="form-error-summary" role="alert" tabindex="-1" hidden></div></form>`, actions: `${button({ label: 'Fechar e guardar', variant: 'ghost', action: 'modal-cancel' })}${button({ label: 'Enviar ao cliente', iconName: 'send', variant: 'primary', type: 'submit', action: 'order:budget-submit', attributes: 'form="budget-form"' })}` });
  if (!modal) return null;
  const form = modal.root.querySelector('#budget-form');
  const lines = modal.root.querySelector('#budget-lines');
  const total = document.createElement('output'); total.className = 'budget-total'; total.setAttribute('aria-live', 'polite'); lines.after(total);
  let sequence = 0, ready = false, completed = false;
  const pickers = new Map();
  const updateTotal = () => {
    const cents = budgetPayload(form).grupos[0].linhas.reduce((sum, line) => sum + Math.round(line.valorUnitario * 100) * line.quantidade, 0);
    total.innerHTML = `<span>Total do orçamento</span><strong>${escapeHtml(formatCurrency(Number.isFinite(cents) ? cents / 100 : 0))}</strong>`;
  };
  const save = () => {
    if (!ready || completed) return;
    updateTotal();
    const saved = saveDraft(scope, draftKey, { values: captureForm(form), rows: [...pickers].map(([key, picker]) => ({ key, selected: picker.selected })) });
    if (!saved && scope?.subject) form.querySelector('[data-draft-status]').textContent = 'O navegador não permitiu salvar o rascunho. Mantenha a janela aberta até concluir.';
  };
  const addLine = (saved = {}) => {
    const key = saved.key ? Number(saved.key) : sequence + 1; sequence = Math.max(sequence, key);
    const row = document.createElement('fieldset'); row.className = 'budget-line-editor'; row.dataset.line = String(key);
    row.innerHTML = `<legend>Item ${key}</legend><div class="form-grid"><label>Tipo<select name="type-${key}"><option value="SERVICO">Serviço</option><option value="MATERIAL">Material</option></select></label>
      <div data-material-field hidden>${renderCatalogComboboxField({ id: `budget-piece-${key}`, name: `piece-${key}`, kind: 'piece', label: 'Peça do catálogo', hint: `Peças ativas da filial ${order?.filialId ?? ''}. A descrição e o preço sugeridos podem ser ajustados.` })}</div>
      <label>Descrição<input name="description-${key}" required maxlength="200"></label><label>Quantidade<input name="quantity-${key}" type="number" min="1" step="1" value="1" required></label><label>Valor unitário<input name="price-${key}" type="number" min="0" step="0.01" required></label></div>${button({ label: 'Remover item', iconName: 'delete', variant: 'ghost', action: 'budget:remove-line', attributes: `data-line="${escapeAttribute(key)}"` })}`;
    lines.append(row);
    const picker = mountCatalogCombobox(row, { api, kind: 'piece', getFilters: () => ({ filialId: order?.filialId, ativo: true }), initialSelected: saved.selected,
      onSelect(record) {
        const piece = record.peca ?? record;
        row.querySelector(`[name="description-${key}"]`).value = piece.nome ?? piece.descricao ?? '';
        const price = Number(piece.precoVenda); if (Number.isFinite(price)) row.querySelector(`[name="price-${key}"]`).value = price.toFixed(2);
        save();
      }, onClear: save,
    });
    pickers.set(String(key), picker);
    row.querySelector(`[name="type-${key}"]`).addEventListener('change', (event) => { row.querySelector('[data-material-field]').hidden = event.target.value !== 'MATERIAL'; picker.close(); save(); });
  };
  (draft?.rows?.length ? draft.rows : [{}]).forEach(addLine);
  if (draft?.values) restoreForm(form, draft.values);
  lines.querySelectorAll('fieldset[data-line]').forEach((row) => { row.querySelector('[data-material-field]').hidden = form.elements[`type-${row.dataset.line}`].value !== 'MATERIAL'; });
  updateTotal(); ready = true;
  form.addEventListener('input', save); form.addEventListener('change', save);
  const onClick = (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'budget:add-line') { addLine(); save(); }
    if (action === 'budget:remove-line' && lines.children.length > 1) {
      const row = event.target.closest('fieldset[data-line]'); pickers.get(row.dataset.line)?.destroy(); pickers.delete(row.dataset.line); row.remove(); save();
    }
    if (action === 'modal-cancel') modal.close();
    if (action === 'budget:discard') {
      ready = false; pickers.forEach((picker) => picker.destroy()); pickers.clear(); lines.innerHTML = ''; sequence = 0; form.reset(); addLine(); updateTotal(); clearDraft(scope, draftKey); ready = true;
      form.querySelector('[data-draft-status]').textContent = 'Rascunho descartado. Preencha um novo orçamento.';
    }
  };
  modal.root.addEventListener('click', onClick);
  globalThis.addEventListener?.('pagehide', save);
  modal.onClose(() => { save(); ready = false; pickers.forEach((picker) => picker.destroy()); modal.root.removeEventListener('click', onClick); globalThis.removeEventListener?.('pagehide', save); });
  modal.complete = () => { completed = true; clearDraft(scope, draftKey); };
  return modal;
}

export function budgetPayload(form) {
  const data = new FormData(form);
  const lines = [...form.querySelectorAll('fieldset[data-line]')].map((row) => {
    const key = row.dataset.line;
    const tipo = formValue(data, `type-${key}`), pecaId = formValue(data, `piece-${key}`);
    return { tipo, descricao: formValue(data, `description-${key}`), quantidade: Number(formValue(data, `quantity-${key}`)), valorUnitario: Number(formValue(data, `price-${key}`)), ...(tipo === 'MATERIAL' && pecaId ? { pecaId } : {}) };
  });
  return { grupos: [{ titulo: formValue(data, 'groupTitle'), linhas: lines }], ...(formValue(data, 'notasCliente') ? { notasCliente: formValue(data, 'notasCliente') } : {}), ...(formValue(data, 'notasInternas') ? { notasInternas: formValue(data, 'notasInternas') } : {}) };
}

export function validBudgetLines(lines) {
  return lines.length > 0 && lines.length <= 100 && lines.every((line) =>
    line.descricao && line.descricao.length <= 200 && Number.isSafeInteger(line.quantidade) && line.quantidade > 0 &&
    Number.isFinite(line.valorUnitario) && line.valorUnitario >= 0 &&
    (line.tipo !== 'MATERIAL' || line.pecaId)) &&
    lines.reduce((sum, line) => sum + Math.round(line.valorUnitario * 100) * line.quantidade, 0) > 0;
}
