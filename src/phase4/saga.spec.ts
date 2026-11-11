import { command, history, Order } from './contracts';
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
  it('ignora inicio tardio apos reparo sem reabrir execucao ou repetir cobranca', () => {
    const order = fixture();
    order.status = 'EM_EXECUCAO';
    order.totalCents = 15000;
    const payment = transition(order, command(order, 'ProductionCompleted'));
    expect(payment.map((delivery) => delivery.message.type)).toEqual([
      'CreatePayment',
    ]);
    const completedRepair = structuredClone(order);

    expect(transition(order, command(order, 'ExecutionStarted'))).toEqual([]);
    expect(transition(order, command(order, 'ProductionCompleted'))).toEqual(
      [],
    );
    expect(order).toEqual(completedRepair);

    transition(
      order,
      command(order, 'PaymentConfirmed', { amountCents: 15000 }),
    );
    expect(order.status).toBe('PRONTA_PARA_ENTREGA');
    expect(order.paymentConfirmed).toBe(true);
  });
  it.each(['PRONTA_PARA_ENTREGA', 'ENTREGUE'])(
    'preserva %s e seu historico diante de eventos fisicos tardios',
    (status) => {
      const order = fixture();
      order.status = 'EM_EXECUCAO';
      order.totalCents = 15000;
      transition(order, command(order, 'ProductionCompleted'));
      transition(
        order,
        command(order, 'PaymentConfirmed', { amountCents: 15000 }),
      );
      if (status === 'ENTREGUE') history(order, 'VEICULO_ENTREGUE', 'ENTREGUE');
      const paidOrder = structuredClone(order);

      for (const type of ['ExecutionStarted', 'ProductionCompleted'])
        expect(transition(order, command(order, type))).toEqual([]);

      expect(order).toEqual(paidOrder);
      expect(order.status).toBe(status);
      expect(order.paymentConfirmed).toBe(true);
      expect(order.sagaState).toBe('PAID');
    },
  );
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

describe('Saga administrative reconciliation of failed compensation', () => {
  function recovering(
    phase: 'CANCELLING' | 'RELEASING_BUDGET' = 'CANCELLING',
  ): Order {
    return {
      ...fixture(),
      status: 'APROVADA',
      sagaState: 'COMPENSATING',
      totalCents: 17500,
      deadline: new Date(Date.now() + 60000).toISOString(),
      reconciliation: { id: 'current-recovery', phase },
    };
  }

  it('requires this recovery cancellation before releasing Billing and preserving approval', () => {
    const order = recovering();
    const sagaId = order.sagaId;
    const prematureRelease = command(order, 'BudgetReleased');
    const before = structuredClone(order);

    expect(transition(order, prematureRelease)).toEqual([]);
    expect(order).toEqual(before);

    const cancellation = command(order, 'ExecutionCancelled', {
      reconciliationId: 'current-recovery',
    });
    expect(transition(order, cancellation)).toEqual([
      {
        destination: 'BILLING',
        message: expect.objectContaining({
          type: 'ReleaseBudgetPreparation',
          osId: order.id,
          sagaId,
        }),
      },
    ]);
    expect(order.reconciliation).toEqual({
      id: 'current-recovery',
      phase: 'RELEASING_BUDGET',
    });
    const releasing = structuredClone(order);
    expect(transition(order, cancellation)).toEqual([]);
    expect(order).toEqual(releasing);

    // Billing replies without a recovery ID; its active prepared Saga is the fence.
    expect(transition(order, command(order, 'BudgetReleased'))).toEqual([]);
    expect(order).toMatchObject({
      status: 'APROVADA',
      sagaState: 'COMPENSATED',
      sagaId,
      totalCents: 17500,
      paymentConfirmed: false,
      reconciliation: undefined,
      deadline: undefined,
    });
    expect(order.historico).toEqual([
      expect.objectContaining({ evento: 'SAGA_COMPENSADA' }),
    ]);
    const compensated = structuredClone(order);
    expect(transition(order, cancellation)).toEqual([]);
    expect(transition(order, command(order, 'BudgetReleased'))).toEqual([]);
    expect(order).toEqual(compensated);
  });

  it.each([{}, { reconciliationId: 'previous-recovery' }])(
    'ignores an old cancellation acknowledgement while recovering: %j',
    (payload) => {
      const order = recovering();
      const before = structuredClone(order);

      expect(
        transition(order, command(order, 'ExecutionCancelled', payload)),
      ).toEqual([]);

      expect(order).toEqual(before);
    },
  );

  it.each([
    { commandType: 'CancelExecutionReservation' },
    { commandType: 'ReserveExecution' },
    { commandType: 'ReleaseBudgetPreparation' },
    { commandType: 'ReconcileExecutionReservation' },
    {
      commandType: 'ReconcileExecutionReservation',
      reconciliationId: 'previous-recovery',
    },
  ])('ignores failures from previous compensation work: %j', (payload) => {
    const order = recovering();
    const before = structuredClone(order);

    expect(transition(order, command(order, 'CommandFailed', payload))).toEqual(
      [],
    );

    expect(order).toEqual(before);
  });

  it('returns to intervention when the current recovery cancellation fails', () => {
    const order = recovering();

    expect(
      transition(
        order,
        command(order, 'CommandFailed', {
          commandType: 'ReconcileExecutionReservation',
          reconciliationId: 'current-recovery',
          reason: 'Physical work cannot be compensated',
        }),
      ),
    ).toEqual([]);

    expect(order).toMatchObject({
      status: 'APROVADA',
      sagaState: 'MANUAL_ATTENTION',
      failure: 'Physical work cannot be compensated',
      deadline: undefined,
      paymentConfirmed: false,
    });
  });

  it('accepts only Billing failure while releasing its budget', () => {
    const order = recovering('RELEASING_BUDGET');
    const before = structuredClone(order);
    for (const payload of [
      { commandType: 'CancelExecutionReservation' },
      {
        commandType: 'ReconcileExecutionReservation',
        reconciliationId: 'current-recovery',
      },
    ]) {
      expect(
        transition(order, command(order, 'CommandFailed', payload)),
      ).toEqual([]);
      expect(order).toEqual(before);
    }

    transition(
      order,
      command(order, 'CommandFailed', {
        commandType: 'ReleaseBudgetPreparation',
        reason: 'Saga divergente',
      }),
    );

    expect(order.sagaState).toBe('MANUAL_ATTENTION');
    expect(order.failure).toBe('Saga divergente');
    expect(order.deadline).toBeUndefined();
    expect(order.status).toBe('APROVADA');
  });

  it.each(['CANCELLING', 'RELEASING_BUDGET'] as const)(
    'requires intervention on a technical timeout in phase %s',
    (phase) => {
      const order = recovering(phase);

      expect(transition(order, command(order, 'StepTimedOut'))).toEqual([]);

      expect(order).toMatchObject({
        status: 'APROVADA',
        sagaState: 'MANUAL_ATTENTION',
        deadline: undefined,
        paymentConfirmed: false,
      });
    },
  );

  it('does not release Billing or claim compensation after concurrent physical work starts', () => {
    const order = recovering();

    expect(transition(order, command(order, 'ExecutionStarted'))).toEqual([]);
    expect(order.status).toBe('EM_EXECUCAO');
    expect(order.sagaState).toBe('MANUAL_ATTENTION');
    const physicalWork = structuredClone(order);

    expect(
      transition(
        order,
        command(order, 'ExecutionCancelled', {
          reconciliationId: 'current-recovery',
        }),
      ),
    ).toEqual([]);
    expect(transition(order, command(order, 'BudgetReleased'))).toEqual([]);
    expect(order).toEqual(physicalWork);
  });
});
