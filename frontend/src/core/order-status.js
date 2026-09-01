export const ORDER_STATUS = Object.freeze({
  RECEIVED: 'RECEBIDA',
  ASSIGNED: 'ATRIBUIDA',
  IN_DIAGNOSIS: 'EM_DIAGNOSTICO',
  AWAITING_APPROVAL: 'AGUARDANDO_APROVACAO',
  APPROVED: 'APROVADA',
  IN_PROGRESS: 'EM_EXECUCAO',
  FINISHED: 'FINALIZADA',
  DELIVERED: 'ENTREGUE',
  CANCELED: 'CANCELADA',
});

export const ORDER_STATUS_FLOW = Object.freeze([
  ORDER_STATUS.RECEIVED,
  ORDER_STATUS.ASSIGNED,
  ORDER_STATUS.IN_DIAGNOSIS,
  ORDER_STATUS.AWAITING_APPROVAL,
  ORDER_STATUS.APPROVED,
  ORDER_STATUS.IN_PROGRESS,
  ORDER_STATUS.FINISHED,
  ORDER_STATUS.DELIVERED,
]);

const STATUS_META = Object.freeze({
  [ORDER_STATUS.RECEIVED]: {
    label: 'Recebida',
    shortLabel: 'Recepção',
    description: 'Aguardando atribuição de um mecânico responsável.',
    icon: 'inbox',
    tone: 'received',
  },
  [ORDER_STATUS.ASSIGNED]: {
    label: 'Atribuída',
    shortLabel: 'Atribuição',
    description: 'Mecânico responsável definido.',
    icon: 'assignment_ind',
    tone: 'assigned',
  },
  [ORDER_STATUS.IN_DIAGNOSIS]: {
    label: 'Em diagnóstico',
    shortLabel: 'Diagnóstico',
    description: 'O veículo está em avaliação técnica.',
    icon: 'troubleshoot',
    tone: 'diagnosis',
  },
  [ORDER_STATUS.AWAITING_APPROVAL]: {
    label: 'Aguardando aprovação',
    shortLabel: 'Orçamento',
    description: 'O orçamento aguarda a decisão do cliente.',
    icon: 'schedule',
    tone: 'awaiting',
  },
  [ORDER_STATUS.APPROVED]: {
    label: 'Aprovada',
    shortLabel: 'Aprovação',
    description: 'O cliente aprovou o orçamento.',
    icon: 'verified',
    tone: 'approved',
  },
  [ORDER_STATUS.IN_PROGRESS]: {
    label: 'Em execução',
    shortLabel: 'Execução',
    description: 'Os serviços aprovados estão em execução.',
    icon: 'build',
    tone: 'execution',
  },
  [ORDER_STATUS.FINISHED]: {
    label: 'Finalizada',
    shortLabel: 'Finalização',
    description: 'O trabalho técnico foi concluído e aguarda entrega.',
    icon: 'task_alt',
    tone: 'finished',
  },
  [ORDER_STATUS.DELIVERED]: {
    label: 'Entregue',
    shortLabel: 'Entrega',
    description: 'O veículo foi entregue ao cliente.',
    icon: 'key',
    tone: 'delivered',
  },
  [ORDER_STATUS.CANCELED]: {
    label: 'Cancelada',
    shortLabel: 'Cancelamento',
    description: 'O orçamento foi rejeitado pelo cliente.',
    icon: 'cancel',
    tone: 'canceled',
  },
});

const UNKNOWN_STATUS_META = Object.freeze({
  label: 'Status indisponível',
  shortLabel: 'Status',
  description: 'Não foi possível identificar a etapa atual.',
  icon: 'help',
  tone: 'unknown',
});

export function getOrderStatusMeta(status) {
  return STATUS_META[status] ?? UNKNOWN_STATUS_META;
}

export function isTerminalOrderStatus(status) {
  return status === ORDER_STATUS.DELIVERED || status === ORDER_STATUS.CANCELED;
}

export function buildOrderTimeline(status) {
  if (status === ORDER_STATUS.CANCELED) {
    const branchPoint = ORDER_STATUS_FLOW.indexOf(
      ORDER_STATUS.AWAITING_APPROVAL,
    );
    return [
      ...ORDER_STATUS_FLOW.slice(0, branchPoint + 1).map((step) => ({
        status: step,
        ...getOrderStatusMeta(step),
        state: 'completed',
      })),
      {
        status: ORDER_STATUS.CANCELED,
        ...getOrderStatusMeta(ORDER_STATUS.CANCELED),
        state: 'canceled',
      },
    ];
  }

  const currentIndex = ORDER_STATUS_FLOW.indexOf(status);
  return ORDER_STATUS_FLOW.map((step, index) => ({
    status: step,
    ...getOrderStatusMeta(step),
    state:
      currentIndex === -1
        ? 'future'
        : index < currentIndex
          ? 'completed'
          : index === currentIndex
            ? 'current'
            : 'future',
  }));
}
