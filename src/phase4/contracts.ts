import { randomUUID } from 'node:crypto';

export interface Budget {
  items: {
    description: string;
    quantity: number;
    unitPriceCents: number;
    pecaId?: string;
  }[];
  totalCents: number;
  version: number;
  approved?: boolean;
}
export interface Payload {
  budget?: Budget;
  mecanicoId?: string;
  descricao?: string;
  amountCents?: number;
  reason?: string;
  [key: string]: unknown;
}

export interface Message {
  messageId: string;
  type: string;
  version: 1;
  sagaId: string;
  osId: string;
  filialId: string;
  correlationId: string;
  occurredAt: string;
  traceparent?: string;
  payload: Payload;
}
export interface Order {
  id: string;
  numero: number;
  filialId: string;
  clienteId: string;
  veiculoId: string;
  mecanicoResponsavelId?: string;
  status: string;
  sagaId: string;
  sagaState: string;
  correlationId?: string;
  traceparent?: string;
  deadline?: string;
  failure?: string;
  paymentConfirmed: boolean;
  totalCents?: number;
  problemasRelatados: { descricao: string }[];
  servicosSolicitados: unknown[];
  notasInternas?: string;
  notasCliente?: string;
  criadoEm: string;
  atualizadoEm: string;
  historico: Record<string, unknown>[];
}
export interface Delivery {
  destination:
    | 'BILLING'
    | 'PRODUCTION'
    | 'REGISTER_BILLING'
    | 'REGISTER_PRODUCTION';
  message: Message;
}
export function command(order: Order, type: string, payload = {}): Message {
  return {
    messageId: randomUUID(),
    type,
    version: 1,
    sagaId: order.sagaId,
    osId: order.id,
    filialId: order.filialId,
    correlationId: order.correlationId || order.sagaId,
    ...(order.traceparent ? { traceparent: order.traceparent } : {}),
    occurredAt: new Date().toISOString(),
    payload,
  };
}
export function history(
  order: Order,
  event: string,
  status = order.status,
): void {
  order.historico.push({
    evento: event,
    statusAnterior: order.status,
    statusNovo: status,
    criadoEm: new Date().toISOString(),
  });
  order.status = status;
  order.atualizadoEm = new Date().toISOString();
}
