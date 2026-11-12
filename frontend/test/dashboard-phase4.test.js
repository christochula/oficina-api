import assert from 'node:assert/strict';
import test from 'node:test';
import { mountDashboardView } from '../src/views/dashboard.js';

async function dashboard(role, orders) {
  const root = { innerHTML: '', querySelector() {}, addEventListener() {}, removeEventListener() {} };
  const dispose = await mountDashboardView(root, { role, api: { request: async () => orders } });
  dispose();
  return root.innerHTML;
}

function count(markup, label) {
  const cards = [...markup.matchAll(/<article class="metric-card"[\s\S]*?<\/article>/g)].map((match) => match[0]);
  const card = cards.find((value) => value.includes(`>${label}</span>`));
  assert.ok(card, `Indicador ${label} presente`);
  return card.match(/class="metric-value">([^<]+)</)?.[1];
}

test('mecânico só vê como pronta a OS com aprovação e preparação concluída', async () => {
  const markup = await dashboard('MECANICO', [
    ...['COMPLETED', 'COMPENSATED', 'MANUAL_ATTENTION', 'COMPENSATING', 'RESERVING', undefined].map((preparacao, index) => ({ id: `os${index}`, numero: index, status: 'APROVADA', preparacao })),
    { id: 'os7', numero: 7, status: 'EM_EXECUCAO', preparacao: 'COMPLETED' },
  ]);
  assert.equal(count(markup, 'Prontas para iniciar'), '1');
  assert.equal(count(markup, 'Em execução'), '1');
  assert.match(markup, /sem incluir outras páginas/);
});

test('cliente distingue pagamento pendente de retirada liberada sem contar entrega passada', async () => {
  const markup = await dashboard('CLIENTE', [
    { id: 'os1', numero: 1, status: 'AGUARDANDO_PAGAMENTO' },
    { id: 'os2', numero: 2, status: 'AGUARDANDO_PAGAMENTO' },
    { id: 'os3', numero: 3, status: 'PRONTA_PARA_ENTREGA' },
    { id: 'os4', numero: 4, status: 'ENTREGUE' },
    { id: 'os5', numero: 5, status: 'APROVADA', preparacao: 'COMPENSATED' },
  ]);
  assert.equal(count(markup, 'Aguardando pagamento'), '2');
  assert.equal(count(markup, 'Prontas para retirada'), '1');
  assert.equal(count(markup, 'Em andamento'), '1');
  assert.doesNotMatch(markup, /pela API|pelo backend/);
});
