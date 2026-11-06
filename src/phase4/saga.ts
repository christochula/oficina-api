import { command, Delivery, history, Message, Order } from './contracts';

/** Pure state machine. Persist its result and deliveries in one local transaction. */
export function transition(order: Order, event: Message): Delivery[] {
  if (event.osId !== order.id || event.filialId !== order.filialId)
    throw new Error('Evento pertence a outra OS ou filial');
  const out: Delivery[] = [];
  const send = (
    destination: 'BILLING' | 'PRODUCTION',
    type: string,
    payload = {},
  ) => out.push({ destination, message: command(order, type, payload) });
  const step = (state: string) => {
    order.sagaState = state;
    order.deadline = new Date(
      Date.now() + Number(process.env.SAGA_TIMEOUT_MS || 60000),
    ).toISOString();
  };
  // Human actions belong to the order, technical replies must belong to the active attempt.
  const humanEvents = [
    'MechanicAssigned',
    'DiagnosisRecorded',
    'BudgetGenerated',
    'BudgetApproved',
    'BudgetRejected',
  ];
  if (!humanEvents.includes(event.type) && event.sagaId !== order.sagaId)
    return out;
  switch (event.type) {
    case 'MechanicAssigned':
      if (['RECEBIDA', 'ATRIBUIDA'].includes(order.status)) {
        order.mecanicoResponsavelId = event.payload.mecanicoId;
        history(order, 'MECANICO_ATRIBUIDO', 'ATRIBUIDA');
        send('BILLING', 'AssignMechanic', {
          mecanicoId: event.payload.mecanicoId,
        });
      }
      break;
    case 'DiagnosisRecorded':
      if (['ATRIBUIDA', 'EM_DIAGNOSTICO'].includes(order.status))
        history(order, 'DIAGNOSTICO_REGISTRADO', 'EM_DIAGNOSTICO');
      break;
    case 'BudgetGenerated':
      if (
        ['ATRIBUIDA', 'EM_DIAGNOSTICO', 'AGUARDANDO_APROVACAO'].includes(
          order.status,
        )
      ) {
        order.totalCents = event.payload.budget?.totalCents;
        history(order, 'ORCAMENTO_GERADO', 'AGUARDANDO_APROVACAO');
      }
      break;
    case 'BudgetApproved':
      if (order.status !== 'AGUARDANDO_APROVACAO') break;
      history(order, 'ORCAMENTO_APROVADO', 'APROVADA');
      step('PREPARING_BUDGET');
      send('BILLING', 'PrepareApprovedBudget');
      break;
    case 'BudgetPrepared':
      if (order.sagaState !== 'PREPARING_BUDGET') break;
      order.totalCents = event.payload.budget?.totalCents;
      step('RESERVING_EXECUTION');
      send('PRODUCTION', 'ReserveExecution', { budget: event.payload.budget });
      break;
    case 'ExecutionReserved':
      if (order.sagaState !== 'RESERVING_EXECUTION') break;
      step('CONFIRMING_EXECUTION');
      send('PRODUCTION', 'ConfirmExecution');
      break;
    case 'ExecutionReady':
      if (order.sagaState !== 'CONFIRMING_EXECUTION') break;
      order.sagaState = 'COMPLETED';
      order.deadline = undefined;
      history(order, 'EXECUCAO_LIBERADA');
      break;
    case 'ExecutionStarted':
      // Delayed physical events cannot reopen a completed repair or payment.
      if (
        ['AGUARDANDO_PAGAMENTO', 'PRONTA_PARA_ENTREGA', 'ENTREGUE'].includes(
          order.status,
        )
      )
        break;
      if (order.sagaState === 'COMPENSATING')
        order.sagaState = 'MANUAL_ATTENTION';
      history(order, 'EXECUCAO_INICIADA', 'EM_EXECUCAO');
      order.deadline = undefined;
      break;
    case 'ProductionCompleted':
      if (order.status !== 'EM_EXECUCAO') break;
      history(order, 'ORDEM_FINALIZADA', 'AGUARDANDO_PAGAMENTO');
      order.sagaState = 'AWAITING_PAYMENT';
      order.deadline = undefined;
      send('BILLING', 'CreatePayment');
      break;
    case 'PaymentConfirmed':
      if (
        order.status !== 'AGUARDANDO_PAGAMENTO' ||
        event.payload.amountCents !== order.totalCents
      )
        break;
      order.paymentConfirmed = true;
      order.sagaState = 'PAID';
      history(order, 'PAGAMENTO_CONFIRMADO', 'PRONTA_PARA_ENTREGA');
      break;
    case 'BudgetRejected':
      if (order.status === 'AGUARDANDO_APROVACAO') {
        history(order, 'ORCAMENTO_REJEITADO', 'CANCELADA');
        order.sagaState = 'CANCELLED';
        send('PRODUCTION', 'CancelExecutionReservation');
      }
      break;
    case 'CommandFailed':
    case 'StepTimedOut':
      if (order.status === 'AGUARDANDO_PAGAMENTO') {
        order.failure = String(
          event.payload.reason || 'Cobrança pendente de reconciliação',
        );
        break;
      }
      if (
        ['EM_EXECUCAO', 'PRONTA_PARA_ENTREGA', 'ENTREGUE'].includes(
          order.status,
        )
      ) {
        order.sagaState = 'MANUAL_ATTENTION';
        break;
      }
      if (order.sagaState === 'COMPENSATING') {
        order.sagaState = 'MANUAL_ATTENTION';
        order.deadline = undefined;
        break;
      }
      if (
        [
          'PREPARING_BUDGET',
          'RESERVING_EXECUTION',
          'CONFIRMING_EXECUTION',
        ].includes(order.sagaState)
      ) {
        order.failure = String(event.payload.reason || 'Timeout de preparação');
        step('COMPENSATING');
        // Cancellation is conditional in Production. It cannot undo physical work.
        send('PRODUCTION', 'CancelExecutionReservation');
      }
      break;
    case 'ExecutionCancelled':
      if (order.sagaState === 'COMPENSATING')
        send('BILLING', 'ReleaseBudgetPreparation');
      break;
    case 'BudgetReleased':
      if (order.sagaState === 'COMPENSATING') {
        order.sagaState = 'COMPENSATED';
        order.deadline = undefined;
        history(order, 'SAGA_COMPENSADA', 'APROVADA');
      }
      break;
  }
  return out;
}
