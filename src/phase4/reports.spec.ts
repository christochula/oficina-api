import 'reflect-metadata';
import { PAPEIS_KEY } from '../auth/decorators/papeis.decorator';
import { PapelUsuario as Role } from '../usuario/domain/papel-usuario.enum';
import { Order } from './contracts';
import { OrderStore } from './store';
import { ReportsController, segment, statistics } from './reports';

function fixture(): Order {
  const at = (hours: number) =>
    new Date(Date.UTC(2026, 10, 4, hours)).toISOString();
  return {
    id: 'os-report',
    numero: 42,
    filialId: 'filial-sp',
    clienteId: 'cl-report',
    veiculoId: 've-report',
    status: 'ENTREGUE',
    sagaId: 'saga-report',
    sagaState: 'COMPLETED',
    paymentConfirmed: true,
    problemasRelatados: [],
    servicosSolicitados: [],
    criadoEm: at(0),
    atualizadoEm: at(12),
    historico: [
      ['ORDEM_ABERTA', 0],
      ['MECANICO_ATRIBUIDO', 1],
      ['ORCAMENTO_GERADO', 3],
      ['ORCAMENTO_APROVADO', 5],
      ['EXECUCAO_INICIADA', 7],
      ['ORDEM_FINALIZADA', 10],
      ['VEICULO_ENTREGUE', 12],
    ].map(([evento, hours]) => ({ evento, criadoEm: at(Number(hours)) })),
  };
}
function setup(orders: Order[] = [fixture()]) {
  const store = { list: jest.fn().mockResolvedValue(orders) };
  return new ReportsController(store as unknown as OrderStore);
}

describe('distributed OS reports from real lifecycle history', () => {
  it('restricts reports to workshop administration and consultants', () => {
    expect(Reflect.getMetadata(PAPEIS_KEY, ReportsController)).toEqual([
      Role.ADMINISTRADOR,
      Role.CONSULTOR_TECNICO,
    ]);
  });
  it('calculates durations only for chronological pairs with both events', () => {
    const order = fixture();
    expect(segment(order, 'ORDEM_ABERTA', 'VEICULO_ENTREGUE')).toBe(12);
    expect(segment(order, 'ORDEM_ABERTA', 'ORDEM_ABERTA')).toBe(0);
    expect(segment(order, 'VEICULO_ENTREGUE', 'ORDEM_ABERTA')).toBeUndefined();
    expect(segment(order, 'MISSING', 'VEICULO_ENTREGUE')).toBeUndefined();
    expect(segment(order, 'ORDEM_ABERTA', 'MISSING')).toBeUndefined();
    order.historico[0].criadoEm = 'invalid-date';
    expect(segment(order, 'ORDEM_ABERTA', 'VEICULO_ENTREGUE')).toBeUndefined();
  });
  it('rounds statistics and produces finite empty results', () => {
    expect(statistics([1, 2, 2 / 3])).toEqual({
      totalAmostras: 3,
      mediaHoras: 1.2222,
      minimoHoras: 0.6667,
      maximoHoras: 2,
    });
    expect(statistics([])).toEqual({
      totalAmostras: 0,
      mediaHoras: 0,
      minimoHoras: 0,
      maximoHoras: 0,
    });
  });
  it('calculates operational stages and approval rate without inventing missing samples', async () => {
    const declined = { ...fixture(), id: 'declined', status: 'CANCELADA' };
    declined.historico = declined.historico.filter(
      (entry) =>
        ![
          'ORCAMENTO_APROVADO',
          'EXECUCAO_INICIADA',
          'ORDEM_FINALIZADA',
          'VEICULO_ENTREGUE',
        ].includes(String(entry.evento)),
    );
    const result = await setup([fixture(), declined]).kpis();
    expect(result.esperaAtribuicao).toMatchObject({
      totalAmostras: 2,
      mediaHoras: 1,
    });
    expect(result.diagnosticoOrcamento).toMatchObject({
      totalAmostras: 2,
      mediaHoras: 2,
    });
    expect(result.aprovacaoCliente).toMatchObject({
      totalAmostras: 1,
      mediaHoras: 2,
    });
    expect(result.esperaExecucao).toMatchObject({
      totalAmostras: 1,
      mediaHoras: 2,
    });
    expect(result.execucao).toMatchObject({ totalAmostras: 1, mediaHoras: 3 });
    expect(result.esperaEntrega).toMatchObject({
      totalAmostras: 1,
      mediaHoras: 2,
    });
    expect(result.leadTimeTotal).toMatchObject({
      totalAmostras: 1,
      mediaHoras: 12,
    });
    expect(result.tempoTecnicoLiquido).toMatchObject({
      totalAmostras: 1,
      mediaHoras: 5,
    });
    expect(result.taxaAprovacaoOrcamento).toBe(50);
  });
  it('filters KPI samples by one or several OS identifiers', async () => {
    const other = { ...fixture(), id: 'other-os', historico: [] };
    const controller = setup([fixture(), other]);
    expect((await controller.kpis('other-os')).execucao.totalAmostras).toBe(0);
    expect((await controller.kpis(['os-report'])).execucao.mediaHoras).toBe(3);
    expect(
      (await controller.kpis(['missing'])).leadTimeTotal.totalAmostras,
    ).toBe(0);
  });
  it('counts delivered orders but excludes missing duration evidence from statistics', async () => {
    const controller = setup([
      fixture(),
      { ...fixture(), id: 'without-history', historico: [] },
    ]);
    const result = await controller.lead();
    expect(result.totalOSEntregues).toBe(2);
    expect(result.leadTimeMedioHoras).toBe(12);
    expect(result.leadTimeMinimoHoras).toBe(12);
    expect(result.ordens).toHaveLength(1);
  });
  it('handles empty portfolios and orders without lifecycle evidence', async () => {
    const empty = await setup([]).kpis();
    expect(empty.taxaAprovacaoOrcamento).toBe(0);
    expect(empty.execucao).toEqual(statistics([]));
    expect(
      await setup([{ ...fixture(), historico: [] }]).cycle(),
    ).toMatchObject({ totalAmostras: 0, ordens: [] });
    expect(await setup([]).lead()).toMatchObject({
      totalOSEntregues: 0,
      leadTimeMedioHoras: 0,
      leadTimeMinimoHoras: 0,
      leadTimeMaximoHoras: 0,
      ordens: [],
    });
  });
  it('lists only delivered orders in lead-time results', async () => {
    const result = await setup([
      fixture(),
      { ...fixture(), id: 'running', status: 'EM_EXECUCAO' },
    ]).lead();
    expect(result).toMatchObject({
      totalOSEntregues: 1,
      leadTimeMedioHoras: 12,
      leadTimeMinimoHoras: 12,
      leadTimeMaximoHoras: 12,
    });
    expect(result.ordens).toEqual([
      expect.objectContaining({
        osId: 'os-report',
        numero: 42,
        leadTimeHoras: 12,
      }),
    ]);
  });
  it('filters cycle samples by selected start/end events and subtracts approval waiting', async () => {
    const incomplete = { ...fixture(), id: 'no-execution', historico: [] };
    const result = await setup([fixture(), incomplete]).cycle(
      'MECANICO_ATRIBUIDO',
      'ORDEM_FINALIZADA',
      'ORCAMENTO_GERADO:ORCAMENTO_APROVADO',
    );
    expect(result).toMatchObject({
      eventoInicio: 'MECANICO_ATRIBUIDO',
      eventoFim: 'ORDEM_FINALIZADA',
      descontos: ['ORCAMENTO_GERADO:ORCAMENTO_APROVADO'],
      totalAmostras: 1,
      mediaHoras: 7,
    });
    expect(result.ordens[0]).toMatchObject({
      duracaoBrutaHoras: 9,
      duracaoLiquidaHoras: 7,
      totalDescontadoHoras: 2,
    });
  });
  it('supports several discounts, ignores incomplete pairs and never produces negative duration', async () => {
    const controller = setup();
    const result = await controller.cycle('ORDEM_ABERTA', 'VEICULO_ENTREGUE', [
      'ORCAMENTO_GERADO:ORCAMENTO_APROVADO',
      'ORCAMENTO_APROVADO:EXECUCAO_INICIADA',
      'MISSING:ALSO_MISSING',
    ]);
    expect(result.ordens[0]).toMatchObject({
      duracaoBrutaHoras: 12,
      duracaoLiquidaHoras: 8,
      totalDescontadoHoras: 4,
    });
    const clamped = await controller.cycle(undefined, undefined, [
      'ORDEM_ABERTA:VEICULO_ENTREGUE',
      'ORDEM_ABERTA:VEICULO_ENTREGUE',
    ]);
    expect(clamped.ordens[0]).toMatchObject({
      duracaoLiquidaHoras: 0,
      totalDescontadoHoras: 12,
    });
  });
  it('clips discounts to the measured window and counts overlapping intervals once', async () => {
    const controller = setup();
    const outside = await controller.cycle(
      'EXECUCAO_INICIADA',
      'ORDEM_FINALIZADA',
      'ORCAMENTO_GERADO:ORCAMENTO_APROVADO',
    );
    expect(outside.ordens[0]).toMatchObject({
      duracaoBrutaHoras: 3,
      duracaoLiquidaHoras: 3,
      totalDescontadoHoras: 0,
    });
    const overlapping = await controller.cycle(
      'ORDEM_ABERTA',
      'VEICULO_ENTREGUE',
      [
        'ORCAMENTO_GERADO:EXECUCAO_INICIADA',
        'ORCAMENTO_APROVADO:ORDEM_FINALIZADA',
      ],
    );
    expect(overlapping.ordens[0]).toMatchObject({
      duracaoBrutaHoras: 12,
      duracaoLiquidaHoras: 5,
      totalDescontadoHoras: 7,
    });
    const clipped = await controller.cycle(
      'EXECUCAO_INICIADA',
      'ORDEM_FINALIZADA',
      'ORCAMENTO_APROVADO:VEICULO_ENTREGUE',
    );
    expect(clipped.ordens[0]).toMatchObject({
      duracaoLiquidaHoras: 0,
      totalDescontadoHoras: 3,
    });
  });
});
