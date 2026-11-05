import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PapeisGuard } from '../auth/guards/papeis.guard';
import { Papeis } from '../auth/decorators/papeis.decorator';
import { PapelUsuario as Role } from '../usuario/domain/papel-usuario.enum';
import { Order } from './contracts';
import { OrderStore } from './store';

function timestamp(order: Order, event: string) {
  const value = order.historico.find((item) => item.evento === event)?.criadoEm;
  return typeof value === 'string' ? Date.parse(value) : undefined;
}
export function segment(order: Order, start: string, end: string) {
  const a = timestamp(order, start),
    b = timestamp(order, end);
  return a !== undefined && b !== undefined && b >= a
    ? (b - a) / 3600000
    : undefined;
}
export function statistics(values: number[]) {
  const round = (n: number) => Math.round(n * 10000) / 10000;
  return {
    totalAmostras: values.length,
    mediaHoras: values.length
      ? round(values.reduce((a, b) => a + b, 0) / values.length)
      : 0,
    minimoHoras: values.length ? round(Math.min(...values)) : 0,
    maximoHoras: values.length ? round(Math.max(...values)) : 0,
  };
}
@Controller({ path: 'ordens-servico/relatorio', version: '1' })
@UseGuards(JwtAuthGuard, PapeisGuard)
@Papeis(Role.ADMINISTRADOR, Role.CONSULTOR_TECNICO)
export class ReportsController {
  constructor(private readonly store: OrderStore) {}
  @Get('kpis')
  async kpis(@Query('osId') ids?: string | string[]) {
    const selected = ids ? (Array.isArray(ids) ? ids : [ids]) : undefined;
    const orders = (await this.store.list()).filter(
      (o) => !selected || selected.includes(o.id),
    );
    const metric = (a: string, b: string) =>
      statistics(
        orders
          .map((o) => segment(o, a, b))
          .filter((n): n is number => n !== undefined),
      );
    const generated = orders.filter(
      (o) => timestamp(o, 'ORCAMENTO_GERADO') !== undefined,
    ).length;
    return {
      esperaAtribuicao: metric('ORDEM_ABERTA', 'MECANICO_ATRIBUIDO'),
      diagnosticoOrcamento: metric('MECANICO_ATRIBUIDO', 'ORCAMENTO_GERADO'),
      aprovacaoCliente: metric('ORCAMENTO_GERADO', 'ORCAMENTO_APROVADO'),
      esperaExecucao: metric('ORCAMENTO_APROVADO', 'EXECUCAO_INICIADA'),
      execucao: metric('EXECUCAO_INICIADA', 'ORDEM_FINALIZADA'),
      esperaEntrega: metric('ORDEM_FINALIZADA', 'VEICULO_ENTREGUE'),
      leadTimeTotal: metric('ORDEM_ABERTA', 'VEICULO_ENTREGUE'),
      tempoTecnicoLiquido: statistics(
        orders.flatMap((o) => {
          const a = segment(o, 'MECANICO_ATRIBUIDO', 'ORCAMENTO_GERADO'),
            b = segment(o, 'EXECUCAO_INICIADA', 'ORDEM_FINALIZADA');
          return a !== undefined && b !== undefined ? [a + b] : [];
        }),
      ),
      taxaAprovacaoOrcamento: generated
        ? (orders.filter(
            (o) => timestamp(o, 'ORCAMENTO_APROVADO') !== undefined,
          ).length /
            generated) *
          100
        : 0,
    };
  }
  @Get('lead-time')
  async lead() {
    const orders = (await this.store.list()).filter(
      (o) => o.status === 'ENTREGUE',
    );
    const ordens = orders.flatMap((o) => {
      const duration = segment(o, 'ORDEM_ABERTA', 'VEICULO_ENTREGUE');
      return duration === undefined
        ? []
        : [
            {
              osId: o.id,
              numero: o.numero,
              criadoEm: o.criadoEm,
              entregueEm: new Date(
                timestamp(o, 'VEICULO_ENTREGUE')!,
              ).toISOString(),
              leadTimeHoras: duration,
            },
          ];
    });
    const stats = statistics(ordens.map((o) => o.leadTimeHoras));
    return {
      totalOSEntregues: orders.length,
      leadTimeMedioHoras: stats.mediaHoras,
      leadTimeMinimoHoras: stats.minimoHoras,
      leadTimeMaximoHoras: stats.maximoHoras,
      ordens,
    };
  }
  @Get('tempo-ciclo')
  async cycle(
    @Query('eventoInicio') start = 'ORDEM_ABERTA',
    @Query('eventoFim') end = 'VEICULO_ENTREGUE',
    @Query('descontar') discounts?: string | string[],
  ) {
    const descontos = discounts
      ? Array.isArray(discounts)
        ? discounts
        : [discounts]
      : [];
    const ordens = (await this.store.list()).flatMap((o) => {
      const duration = segment(o, start, end);
      if (duration === undefined) return [];
      const intervals = descontos
        .flatMap((pair) => {
          const [a, b] = pair.split(':'),
            from = timestamp(o, a),
            to = timestamp(o, b);
          if (from === undefined || to === undefined) return [];
          const left = Math.max(timestamp(o, start)!, from),
            right = Math.min(timestamp(o, end)!, to);
          return right > left ? [[left, right]] : [];
        })
        .sort((a, b) => a[0] - b[0]);
      let deductedMs = 0,
        previousEnd = -Infinity;
      for (const [left, right] of intervals) {
        deductedMs += Math.max(0, right - Math.max(left, previousEnd));
        previousEnd = Math.max(previousEnd, right);
      }
      const deducted = deductedMs / 3600000;
      return [
        {
          osId: o.id,
          numero: o.numero,
          inicioEm: new Date(timestamp(o, start)!).toISOString(),
          fimEm: new Date(timestamp(o, end)!).toISOString(),
          duracaoBrutaHoras: duration,
          duracaoLiquidaHoras: Math.max(0, duration - deducted),
          totalDescontadoHoras: Math.min(duration, deducted),
        },
      ];
    });
    return {
      eventoInicio: start,
      eventoFim: end,
      descontos,
      ...statistics(ordens.map((o) => o.duracaoLiquidaHoras)),
      ordens,
    };
  }
}
