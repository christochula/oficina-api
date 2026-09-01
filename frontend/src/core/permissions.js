import { ORDER_STATUS } from './order-status.js';

export const ROLES = Object.freeze({
  ADMIN: 'ADMINISTRADOR',
  CONSULTANT: 'CONSULTOR_TECNICO',
  MECHANIC: 'MECANICO',
  CLIENT: 'CLIENTE',
});

export const CAPABILITIES = Object.freeze({
  VIEW_DASHBOARD: 'dashboard:view',
  VIEW_ALL_ORDERS: 'orders:view-all',
  VIEW_OWN_ORDERS: 'orders:view-own',
  CREATE_ORDER: 'orders:create',
  ASSIGN_ORDER: 'orders:assign',
  DIAGNOSE_ORDER: 'orders:diagnose',
  BUDGET_ORDER: 'orders:budget',
  DECIDE_BUDGET: 'orders:decide-budget',
  START_ORDER: 'orders:start',
  CONSUME_PART: 'orders:consume-part',
  FINISH_ORDER: 'orders:finish',
  DELIVER_ORDER: 'orders:deliver',
  MANAGE_CLIENTS: 'clients:manage',
  MANAGE_VEHICLES: 'vehicles:manage',
  VIEW_SERVICES: 'services:view',
  MANAGE_SERVICES: 'services:manage',
  VIEW_INVENTORY: 'inventory:view',
  MANAGE_INVENTORY: 'inventory:manage',
  MANAGE_USERS: 'users:manage',
  VIEW_REPORTS: 'reports:view',
});

export const ORDER_ACTIONS = Object.freeze({
  ASSIGN: 'assign',
  DIAGNOSE: 'diagnose',
  CREATE_BUDGET: 'create-budget',
  APPROVE: 'approve',
  REJECT: 'reject',
  START: 'start',
  CONSUME_PART: 'consume-part',
  FINISH: 'finish',
  DELIVER: 'deliver',
});

const ROLE_CAPABILITIES = Object.freeze({
  [ROLES.ADMIN]: [
    CAPABILITIES.VIEW_DASHBOARD,
    CAPABILITIES.VIEW_ALL_ORDERS,
    CAPABILITIES.CREATE_ORDER,
    CAPABILITIES.ASSIGN_ORDER,
    CAPABILITIES.DELIVER_ORDER,
    CAPABILITIES.MANAGE_CLIENTS,
    CAPABILITIES.MANAGE_VEHICLES,
    CAPABILITIES.VIEW_SERVICES,
    CAPABILITIES.MANAGE_SERVICES,
    CAPABILITIES.VIEW_INVENTORY,
    CAPABILITIES.MANAGE_INVENTORY,
    CAPABILITIES.MANAGE_USERS,
    CAPABILITIES.VIEW_REPORTS,
  ],
  [ROLES.CONSULTANT]: [
    CAPABILITIES.VIEW_DASHBOARD,
    CAPABILITIES.VIEW_ALL_ORDERS,
    CAPABILITIES.CREATE_ORDER,
    CAPABILITIES.ASSIGN_ORDER,
    CAPABILITIES.DELIVER_ORDER,
    CAPABILITIES.MANAGE_CLIENTS,
    CAPABILITIES.MANAGE_VEHICLES,
    CAPABILITIES.VIEW_SERVICES,
    CAPABILITIES.VIEW_REPORTS,
  ],
  [ROLES.MECHANIC]: [
    CAPABILITIES.VIEW_DASHBOARD,
    CAPABILITIES.VIEW_OWN_ORDERS,
    CAPABILITIES.DIAGNOSE_ORDER,
    CAPABILITIES.BUDGET_ORDER,
    CAPABILITIES.START_ORDER,
    CAPABILITIES.CONSUME_PART,
    CAPABILITIES.FINISH_ORDER,
    CAPABILITIES.VIEW_SERVICES,
    CAPABILITIES.VIEW_INVENTORY,
  ],
  [ROLES.CLIENT]: [
    CAPABILITIES.VIEW_DASHBOARD,
    CAPABILITIES.VIEW_OWN_ORDERS,
    CAPABILITIES.DECIDE_BUDGET,
  ],
});

const ORDER_ACTION_RULES = Object.freeze({
  [ROLES.ADMIN]: {
    [ORDER_STATUS.RECEIVED]: [ORDER_ACTIONS.ASSIGN],
    [ORDER_STATUS.FINISHED]: [ORDER_ACTIONS.DELIVER],
  },
  [ROLES.CONSULTANT]: {
    [ORDER_STATUS.RECEIVED]: [ORDER_ACTIONS.ASSIGN],
    [ORDER_STATUS.FINISHED]: [ORDER_ACTIONS.DELIVER],
  },
  [ROLES.MECHANIC]: {
    [ORDER_STATUS.ASSIGNED]: [
      ORDER_ACTIONS.DIAGNOSE,
      ORDER_ACTIONS.CREATE_BUDGET,
    ],
    [ORDER_STATUS.IN_DIAGNOSIS]: [ORDER_ACTIONS.CREATE_BUDGET],
    [ORDER_STATUS.APPROVED]: [ORDER_ACTIONS.START],
    [ORDER_STATUS.IN_PROGRESS]: [
      ORDER_ACTIONS.CONSUME_PART,
      ORDER_ACTIONS.FINISH,
    ],
  },
  [ROLES.CLIENT]: {
    [ORDER_STATUS.AWAITING_APPROVAL]: [
      ORDER_ACTIONS.APPROVE,
      ORDER_ACTIONS.REJECT,
    ],
  },
});

export function can(role, capability) {
  return ROLE_CAPABILITIES[role]?.includes(capability) ?? false;
}

export function canAny(role, capabilities) {
  return capabilities.some((capability) => can(role, capability));
}

export function canAll(role, capabilities) {
  return capabilities.every((capability) => can(role, capability));
}

export function homeRouteForRole(role) {
  if (role === ROLES.MECHANIC) return '/meu-trabalho';
  return '/inicio';
}

export function getAllowedOrderActions(role, status) {
  return [...(ORDER_ACTION_RULES[role]?.[status] ?? [])];
}

export function canPerformOrderAction(role, status, action) {
  return getAllowedOrderActions(role, status).includes(action);
}
