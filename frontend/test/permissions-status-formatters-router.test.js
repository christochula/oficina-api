import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatCep,
  formatCnpj,
  formatCpf,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatDurationMinutes,
  formatLicensePlate,
  formatMileage,
  formatPhone,
} from '../src/core/formatters.js';
import {
  buildOrderTimeline,
  ORDER_STATUS,
} from '../src/core/order-status.js';
import {
  can,
  CAPABILITIES,
  getAllowedOrderActions,
  ORDER_ACTIONS,
  ROLES,
} from '../src/core/permissions.js';
import {
  buildHash,
  matchRoute,
  parseHashLocation,
} from '../src/core/router.js';

test('permissões refletem papéis e não expõem gestão indevida', () => {
  assert.equal(can(ROLES.ADMIN, CAPABILITIES.MANAGE_USERS), true);
  assert.equal(can(ROLES.CONSULTANT, CAPABILITIES.MANAGE_USERS), false);
  assert.equal(can(ROLES.CONSULTANT, CAPABILITIES.VIEW_INVENTORY), false);
  assert.equal(can(ROLES.MECHANIC, CAPABILITIES.VIEW_INVENTORY), true);
  assert.equal(can(ROLES.CLIENT, CAPABILITIES.VIEW_ALL_ORDERS), false);
});

test('ações de OS respeitam estado e responsável pelo fluxo', () => {
  assert.deepEqual(
    getAllowedOrderActions(ROLES.CLIENT, ORDER_STATUS.AWAITING_APPROVAL),
    [ORDER_ACTIONS.APPROVE, ORDER_ACTIONS.REJECT],
  );
  assert.deepEqual(
    getAllowedOrderActions(ROLES.ADMIN, ORDER_STATUS.AWAITING_APPROVAL),
    [],
  );
  assert.deepEqual(
    getAllowedOrderActions(ROLES.MECHANIC, ORDER_STATUS.APPROVED),
    [ORDER_ACTIONS.START],
  );
  assert.deepEqual(
    getAllowedOrderActions(ROLES.ADMIN, ORDER_STATUS.FINISHED),
    [ORDER_ACTIONS.DELIVER],
  );
});

test('timeline cancelada encerra no ramo de rejeição', () => {
  const timeline = buildOrderTimeline(ORDER_STATUS.CANCELED);
  assert.equal(timeline.at(-1).status, ORDER_STATUS.CANCELED);
  assert.equal(timeline.at(-1).state, 'canceled');
  assert.equal(
    timeline.some((step) => step.status === ORDER_STATUS.IN_PROGRESS),
    false,
  );
});

test('formatadores apresentam padrões brasileiros', () => {
  assert.equal(formatCpf('52998224725'), '529.982.247-25');
  assert.equal(formatCnpj('11222333000181'), '11.222.333/0001-81');
  assert.equal(formatPhone('11987654321'), '(11) 98765-4321');
  assert.equal(formatCep('01310100'), '01310-100');
  assert.equal(formatLicensePlate('abc1d23'), 'ABC-1D23');
  assert.equal(formatCurrency('1234.5'), 'R$ 1.234,50');
  assert.equal(formatMileage(12345), '12.345 km');
  assert.equal(formatDurationMinutes(150), '2h 30min');
});

test('datas usam dia/mês/ano e relógio de 24 horas', () => {
  const date = '2026-08-31T18:45:00.000Z';
  assert.equal(formatDate(date, { timeZone: 'UTC' }), '31/08/2026');
  assert.match(
    formatDateTime(date, { timeZone: 'UTC' }),
    /^31\/08\/2026,? 18:45$/,
  );
});

test('roteador prioriza rota estática e decodifica parâmetros', () => {
  const routes = [
    { path: '/ordens/:id', name: 'detail' },
    { path: '/ordens/nova', name: 'new' },
  ];
  assert.equal(matchRoute(routes, '/ordens/nova').route.name, 'new');
  assert.equal(
    matchRoute(routes, '/ordens/os%201').params.id,
    'os 1',
  );
});

test('hash router preserva query string navegável', () => {
  assert.equal(
    buildHash('/ordens', { status: 'APROVADA', page: 2 }),
    '#/ordens?status=APROVADA&page=2',
  );
  const location = parseHashLocation('#/ordens?status=APROVADA&page=2');
  assert.equal(location.path, '/ordens');
  assert.equal(location.query.get('status'), 'APROVADA');
  assert.equal(location.query.get('page'), '2');
});
