import { ORDER_STATUS_FLOW } from './order-status.js';

// Read-only follow-up. Human approval/payment never expires a business state.
export function orderFollowupPolicy(order) {
  if (!order) return null;
  if (order.status === 'RECEBIDA' && order.sincronizacaoPendente?.length) {
    return { key: 'registration', interval: 1_000, duration: 60_000 };
  }
  if (order.status === 'APROVADA' && order.preparacao &&
      !['COMPLETED', 'COMPENSATED', 'MANUAL_ATTENTION'].includes(order.preparacao)) {
    return { key: `preparation:${order.sagaId}:${order.preparacao}`, interval: 2_000, duration: 120_000 };
  }
  if (['AGUARDANDO_PAGAMENTO', 'AGUARDANDO_APROVACAO'].includes(order.status)) {
    return { key: order.status, interval: 5_000, duration: 120_000 };
  }
  if ((order.status === 'APROVADA' && order.preparacao === 'COMPLETED') || order.status === 'EM_EXECUCAO') {
    return { key: order.status, interval: 5_000, duration: 120_000 };
  }
  return null;
}

export function expectedStatusAfterAction(path) {
  if (/\/atribuir\//.test(path)) return ['ATRIBUIDA'];
  const statuses = {
    diagnostico: ['EM_DIAGNOSTICO'], orcamento: ['AGUARDANDO_APROVACAO'],
    aprovar: ['APROVADA'], rejeitar: ['CANCELADA'], 'iniciar-execucao': ['EM_EXECUCAO'],
    finalizar: ['FINALIZADA', 'AGUARDANDO_PAGAMENTO', 'PRONTA_PARA_ENTREGA'], entregar: ['ENTREGUE'],
  };
  return statuses[path.split('/').at(-1)] || null;
}

export function orderTransitionObserved(status, expectedStatuses) {
  if (!expectedStatuses?.length) return false;
  if (status === 'CANCELADA' || expectedStatuses.includes(status)) return true;
  const currentIndex = ORDER_STATUS_FLOW.indexOf(status);
  return currentIndex >= 0 && expectedStatuses.some((expected) => {
    const expectedIndex = ORDER_STATUS_FLOW.indexOf(expected);
    return expectedIndex >= 0 && currentIndex > expectedIndex;
  });
}

export function canRetryPreparation(order, role) {
  return ['ADMINISTRADOR', 'CONSULTOR_TECNICO'].includes(role) &&
    order?.status === 'APROVADA' && order.preparacao === 'COMPENSATED' && !order.paymentConfirmed;
}

// Reject script/data URLs, credentials and non-HTTP localhost protocols as well.
export function checkoutDestination(value) {
  const url = new URL(value);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || (url.protocol !== 'https:' && !(url.protocol === 'http:' && local))) {
    throw new Error('URL de pagamento inválida.');
  }
  return url.href;
}
