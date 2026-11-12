import assert from 'node:assert/strict';
import test from 'node:test';
import { budgetPayload, validBudgetLines } from '../src/views/order-budget.js';
function payload(values, rows) {
  const OriginalFormData = globalThis.FormData;
  globalThis.FormData = class { get(key) { return values[key] ?? null; } };
  try { return budgetPayload({ querySelectorAll(selector) {
    assert.equal(selector, 'fieldset[data-line]', 'somente editores entram no payload, nunca botões');
    return rows.map((key) => ({ dataset: { line: String(key) } }));
  } }); } finally { globalThis.FormData = OriginalFormData; }
}
test('orçamento gera uma linha por editor e total de 175 sem duplicar material', () => {
  const result = payload({
    groupTitle: ' Serviços recomendados ', notasCliente: 'Nota pública', notasInternas: 'Nota privada',
    'type-1': 'SERVICO', 'description-1': 'Mão de obra', 'quantity-1': '1', 'price-1': '100', 'piece-1': 'ignored',
    'type-2': 'MATERIAL', 'description-2': 'Óleo', 'quantity-2': '1', 'price-2': '50', 'piece-2': 'piece-oil',
    'type-4': 'MATERIAL', 'description-4': 'Filtro', 'quantity-4': '1', 'price-4': '25', 'piece-4': 'piece-filter',
  }, [1, 2, 4]);
  const lines = result.grupos[0].linhas;
  assert.equal(lines.length, 3); assert.equal(lines.reduce((sum, line) => sum + line.quantidade * line.valorUnitario, 0), 175);
  assert.equal('pecaId' in lines[0], false); assert.equal(lines[1].pecaId, 'piece-oil'); assert.equal(lines[2].pecaId, 'piece-filter');
  assert.equal(result.notasCliente, 'Nota pública'); assert.equal(result.notasInternas, 'Nota privada');
  assert.equal(result.grupos[0].titulo, 'Serviços recomendados'); assert.equal(validBudgetLines(lines), true);
});
test('editores removidos não reaparecem no orçamento e notas vazias são omitidas', () => {
  const result = payload({ 'type-3': 'SERVICO', 'description-3': 'Revisão', 'quantity-3': '2', 'price-3': '12.50' }, [3]);
  assert.equal(result.grupos[0].linhas.length, 1); assert.equal(result.grupos[0].linhas[0].quantidade, 2);
  assert.equal(result.grupos[0].linhas[0].valorUnitario, 12.5);
  assert.equal('notasCliente' in result, false); assert.equal('notasInternas' in result, false);
});
test('validação bloqueia material sem seleção e quantidades, preços e totais inválidos', () => {
  const service = { tipo: 'SERVICO', descricao: 'Revisão', quantidade: 1, valorUnitario: 100 };
  for (const invalid of [[], [{ ...service, tipo: 'MATERIAL' }], [{ ...service, quantidade: 0 }], [{ ...service, quantidade: 1.2 }], [{ ...service, valorUnitario: -1 }], [{ ...service, valorUnitario: NaN }], [{ ...service, valorUnitario: 0 }], [{ ...service, descricao: '' }], [{ ...service, descricao: 'x'.repeat(201) }], Array(101).fill(service)]) assert.equal(Boolean(validBudgetLines(invalid)), false);
  assert.equal(Boolean(validBudgetLines([{ ...service, tipo: 'MATERIAL', pecaId: 'selected-piece' }])), true);
  assert.equal(Boolean(validBudgetLines([service, { ...service, valorUnitario: 0 }])), true);
});
