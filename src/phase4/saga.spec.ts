import { command, Order } from './contracts';
import { transition } from './saga';

export function fixture(): Order {
  return {
    id: 'os-test',
    numero: 1,
    filialId: 'filial-sp',
    clienteId: 'cl-test',
    veiculoId: 've-test',
    status: 'AGUARDANDO_APROVACAO',
    sagaId: 'saga-test',
    sagaState: 'AWAITING_APPROVAL',
    paymentConfirmed: false,
    problemasRelatados: [],
    servicosSolicitados: [],
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
    historico: [],
  };
}
describe('Saga distribuída de preparação e cobrança', () => {
  it('libera execução, aguarda reparo e pagamento antes de liberar entrega', () => {
    const order = fixture();
    const apply = (type: string, payload = {}) =>
      transition(order, command(order, type, payload));
    expect(apply('BudgetApproved')[0].message.type).toBe(
      'PrepareApprovedBudget',
    );
    expect(
      apply('BudgetPrepared', { budget: { totalCents: 15000 } })[0].message
        .type,
    ).toBe('ReserveExecution');
    expect(apply('ExecutionReserved')[0].message.type).toBe('ConfirmExecution');
    apply('ExecutionReady');
    expect(order.sagaState).toBe('COMPLETED');
    apply('ExecutionStarted');
    expect(order.status).toBe('EM_EXECUCAO');
    expect(apply('ProductionCompleted')[0].message.type).toBe('CreatePayment');
    expect(order.status).toBe('AGUARDANDO_PAGAMENTO');
    apply('PaymentConfirmed', { amountCents: 1 });
    expect(order.paymentConfirmed).toBe(false);
    apply('PaymentConfirmed', { amountCents: 15000 });
    expect(order.status).toBe('PRONTA_PARA_ENTREGA');
    expect(order.paymentConfirmed).toBe(true);
    expect(apply('PaymentConfirmed', { amountCents: 15000 })).toEqual([]);
  });
  it('compensa reserva antes de liberar orçamento e preserva aprovação', () => {
    const order = fixture();
    transition(order, command(order, 'BudgetApproved'));
    const failure = transition(
      order,
      command(order, 'CommandFailed', { reason: 'Estoque insuficiente' }),
    );
    expect(failure[0].message.type).toBe('CancelExecutionReservation');
    expect(order.failure).toBe('Estoque insuficiente');
    expect(
      transition(order, command(order, 'ExecutionCancelled'))[0].message.type,
    ).toBe('ReleaseBudgetPreparation');
    transition(order, command(order, 'BudgetReleased'));
    expect(order.sagaState).toBe('COMPENSATED');
    expect(order.status).toBe('APROVADA');
    expect(transition(order, command(order, 'ExecutionReady'))).toEqual([]);
    expect(order.sagaState).toBe('COMPENSATED');
  });
  it('ignora respostas de tentativa anterior e rejeita outra filial ou OS', () => {
    const order = fixture();
    expect(
      transition(order, {
        ...command(order, 'ExecutionReserved'),
        sagaId: 'old',
      }),
    ).toEqual([]);
    expect(() =>
      transition(order, {
        ...command(order, 'BudgetApproved'),
        filialId: 'outra',
      }),
    ).toThrow();
    expect(() =>
      transition(order, { ...command(order, 'BudgetApproved'), osId: 'outra' }),
    ).toThrow();
  });
  it('não desfaz reparo e não perde cobrança em falha posterior', () => {
    const order = fixture();
    order.status = 'EM_EXECUCAO';
    transition(order, command(order, 'CommandFailed'));
    expect(order.sagaState).toBe('MANUAL_ATTENTION');
    order.status = 'AGUARDANDO_PAGAMENTO';
    transition(order, command(order, 'CommandFailed'));
    expect(order.status).toBe('AGUARDANDO_PAGAMENTO');
    expect(order.failure).toContain('reconciliação');
  });
  it('sinaliza compensação falha e início concorrente para intervenção', () => {
    const order = fixture();
    order.sagaState = 'COMPENSATING';
    transition(order, command(order, 'CommandFailed'));
    expect(order.sagaState).toBe('MANUAL_ATTENTION');
    order.sagaState = 'COMPENSATING';
    transition(order, command(order, 'ExecutionStarted'));
    expect(order.sagaState).toBe('MANUAL_ATTENTION');
  });
  it('processa atribuição, diagnóstico, orçamento e rejeição sem timeout humano', () => {
    const order = fixture();
    order.status = 'RECEBIDA';
    transition(
      order,
      command(order, 'MechanicAssigned', { mecanicoId: 'mech' }),
    );
    expect(order.mecanicoResponsavelId).toBe('mech');
    transition(
      order,
      command(order, 'DiagnosisRecorded', { descricao: 'Freios' }),
    );
    transition(
      order,
      command(order, 'BudgetGenerated', { budget: { totalCents: 5000 } }),
    );
    expect(order.status).toBe('AGUARDANDO_APROVACAO');
    expect(order.deadline).toBeUndefined();
    expect(
      transition(order, command(order, 'BudgetRejected'))[0].message.type,
    ).toBe('CancelExecutionReservation');
    expect(order.status).toBe('CANCELADA');
  });
  it('torna eventos fora de ordem inócuos e compensa timeout técnico', () => {
    const order = fixture();
    for (const type of [
      'ExecutionCancelled',
      'BudgetReleased',
      'BudgetPrepared',
      'ExecutionReserved',
      'ExecutionReady',
      'ProductionCompleted',
      'PaymentConfirmed',
      'Unknown',
    ])
      expect(transition(order, command(order, type))).toEqual([]);
    transition(order, command(order, 'BudgetApproved'));
    expect(
      transition(order, command(order, 'StepTimedOut'))[0].message.type,
    ).toBe('CancelExecutionReservation');
    expect(order.sagaState).toBe('COMPENSATING');
  });
});
