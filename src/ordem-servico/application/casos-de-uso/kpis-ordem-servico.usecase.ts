import { Inject, Injectable } from '@nestjs/common';
import { HistoricoOSItem } from '../../domain/ordem-servico.entity';
import { ORDEM_SERVICO_REPOSITORY } from '../../domain/ordem-servico.repository';
import type { OrdemServicoRepository } from '../../domain/ordem-servico.repository';

/** Estatísticas de tempo para um segmento do ciclo de atendimento. */
export interface KpiTempo {
  /** Média aritmética em horas. Zero se não houver amostras. */
  mediaHoras: number;
  /** Menor valor em horas. Zero se não houver amostras. */
  minimoHoras: number;
  /** Maior valor em horas. Zero se não houver amostras. */
  maximoHoras: number;
  /** Número de OS que possuem dados suficientes para este segmento. */
  totalAmostras: number;
}

/**
 * Resultado completo do relatório de KPIs de Ordens de Serviço.
 *
 * Cada KpiTempo representa um segmento específico do ciclo de atendimento,
 * calculado sobre todas as OS que passaram por aquele segmento.
 *
 * Mapeamento de eventos por segmento:
 * - esperaAtribuicao:      ORDEM_ABERTA        → MECANICO_ATRIBUIDO
 * - diagnosticoOrcamento:  MECANICO_ATRIBUIDO  → ORCAMENTO_GERADO
 * - aprovacaoCliente:      ORCAMENTO_GERADO    → ORCAMENTO_APROVADO
 * - execucao:              EXECUCAO_INICIADA   → ORDEM_FINALIZADA
 * - esperaEntrega:         ORDEM_FINALIZADA    → VEICULO_ENTREGUE
 * - leadTimeTotal:         ORDEM_ABERTA        → VEICULO_ENTREGUE
 * - tempoTecnicoLiquido:   leadTime − esperaAtribuicao − aprovacaoCliente − esperaEntrega
 */
export interface KpisOrdemServicoOutput {
  /**
   * Tempo de espera até a atribuição do mecânico.
   * Mede a eficiência operacional da recepção.
   */
  esperaAtribuicao: KpiTempo;

  /**
   * Tempo do mecânico para diagnosticar e gerar o orçamento.
   * Mede a agilidade técnica inicial.
   */
  diagnosticoOrcamento: KpiTempo;

  /**
   * Tempo que o cliente leva para aprovar ou rejeitar o orçamento.
   * Representa o tempo fora do controle da oficina.
   */
  aprovacaoCliente: KpiTempo;

  /**
   * Tempo de execução dos serviços aprovados.
   * Mede a produtividade do mecânico na bancada.
   */
  execucao: KpiTempo;

  /**
   * Tempo de espera para entrega após conclusão técnica.
   * Mede a eficiência da entrega ao cliente.
   */
  esperaEntrega: KpiTempo;

  /**
   * Lead-time total da OS (abertura até entrega).
   * Mede o tempo total de ocupação de uma "vaga de garagem".
   */
  leadTimeTotal: KpiTempo;

  /**
   * Tempo técnico líquido = leadTime − esperaAtribuicao − aprovacaoCliente − esperaEntrega.
   * Representa o tempo em que a OS estava efetivamente nas mãos da equipe técnica.
   */
  tempoTecnicoLiquido: KpiTempo;

  /**
   * Taxa de aprovação de orçamentos em percentual (0–100).
   * Calculada sobre todas as OS que geraram orçamento.
   */
  taxaAprovacaoOrcamento: number;
}

// ── Helpers privados ──────────────────────────────────────────────────────────

/** Arredonda para 2 casas decimais. */
function arredondar(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/** Extrai o timestamp de um evento específico no histórico da OS. */
function tsEvento(historico: HistoricoOSItem[], evento: string): Date | undefined {
  return historico.find((h) => h.evento === evento)?.criadoEm;
}

/** Calcula a diferença em horas entre dois timestamps. */
function diffHoras(inicio: Date, fim: Date): number {
  return arredondar((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60));
}

/** Agrega uma lista de durações em um KpiTempo. */
function calcularKpi(amostras: number[]): KpiTempo {
  if (amostras.length === 0) {
    return { mediaHoras: 0, minimoHoras: 0, maximoHoras: 0, totalAmostras: 0 };
  }
  const soma = amostras.reduce((acc, v) => acc + v, 0);
  return {
    mediaHoras: arredondar(soma / amostras.length),
    minimoHoras: arredondar(Math.min(...amostras)),
    maximoHoras: arredondar(Math.max(...amostras)),
    totalAmostras: amostras.length,
  };
}

/** Filtros opcionais de entrada para o cálculo de KPIs. */
export interface KpisInput {
  /**
   * Restringe o cálculo a uma ou mais OS específicas pelo ID.
   * Quando omitido, todos as OS são consideradas.
   */
  osIds?: string[];
}

/**
 * Caso de uso que calcula os KPIs pré-definidos do ciclo de atendimento das OS.
 *
 * Cada KPI é calculado sobre o conjunto de OS que possuem dados suficientes
 * para aquele segmento específico, independentemente do status atual da OS.
 * Isso permite análise parcial (ex: tempo de atribuição de OS ainda em andamento).
 *
 * O filtro `osIds` permite analisar uma OS individual ou um subconjunto específico,
 * útil para auditoria ou comparação pontual.
 */
@Injectable()
export class KpisOrdemServicoUseCase {
  constructor(
    @Inject(ORDEM_SERVICO_REPOSITORY)
    private readonly osRepository: OrdemServicoRepository,
  ) {}

  /**
   * Executa o cálculo de todos os KPIs de ciclo de atendimento.
   * @param input - Filtros opcionais (osIds para escopo reduzido).
   * @returns KPIs agregados por segmento e taxa de aprovação de orçamentos.
   */
  async executar(input?: KpisInput): Promise<KpisOrdemServicoOutput> {
    const osFiltradas = await this.osRepository.buscarTodasComHistorico(input?.osIds);

    const amostrasEsperaAtribuicao: number[] = [];
    const amostrasdiagnosticoOrcamento: number[] = [];
    const amostrasAprovacaoCliente: number[] = [];
    const amostrasExecucao: number[] = [];
    const amostrasEsperaEntrega: number[] = [];
    const amostrasLeadTimeTotal: number[] = [];
    const amostrasTempoTecnicoLiquido: number[] = [];

    let totalComOrcamento = 0;
    let totalAprovados = 0;

    for (const os of osFiltradas) {
      const h = os.historico;

      const tsAberta = tsEvento(h, 'ORDEM_ABERTA');
      const tsAtribuida = tsEvento(h, 'MECANICO_ATRIBUIDO');
      const tsOrcamentoGerado = tsEvento(h, 'ORCAMENTO_GERADO');
      const tsOrcamentoAprovado = tsEvento(h, 'ORCAMENTO_APROVADO');
      const tsExecucaoIniciada = tsEvento(h, 'EXECUCAO_INICIADA');
      const tsFinalizada = tsEvento(h, 'ORDEM_FINALIZADA');
      const tsEntregue = tsEvento(h, 'VEICULO_ENTREGUE');

      if (tsAberta && tsAtribuida) {
        amostrasEsperaAtribuicao.push(diffHoras(tsAberta, tsAtribuida));
      }
      if (tsAtribuida && tsOrcamentoGerado) {
        amostrasdiagnosticoOrcamento.push(diffHoras(tsAtribuida, tsOrcamentoGerado));
      }
      if (tsOrcamentoGerado && tsOrcamentoAprovado) {
        amostrasAprovacaoCliente.push(diffHoras(tsOrcamentoGerado, tsOrcamentoAprovado));
      }
      if (tsExecucaoIniciada && tsFinalizada) {
        amostrasExecucao.push(diffHoras(tsExecucaoIniciada, tsFinalizada));
      }
      if (tsFinalizada && tsEntregue) {
        amostrasEsperaEntrega.push(diffHoras(tsFinalizada, tsEntregue));
      }
      if (tsAberta && tsEntregue) {
        const leadTime = diffHoras(tsAberta, tsEntregue);
        amostrasLeadTimeTotal.push(leadTime);

        // Tempo técnico líquido: só calculável quando todos os descontos estão presentes
        if (tsAtribuida && tsOrcamentoGerado && tsOrcamentoAprovado && tsFinalizada) {
          const esperaAtrib = diffHoras(tsAberta, tsAtribuida);
          const aprovCliente = diffHoras(tsOrcamentoGerado, tsOrcamentoAprovado);
          const esperaEntrega = diffHoras(tsFinalizada, tsEntregue);
          const liquido = arredondar(leadTime - esperaAtrib - aprovCliente - esperaEntrega);
          amostrasTempoTecnicoLiquido.push(liquido);
        }
      }

      // Taxa de aprovação de orçamentos
      if (os.orcamento) {
        totalComOrcamento++;
        if (os.orcamento.aprovadoEm) {
          totalAprovados++;
        }
      }
    }

    const taxaAprovacaoOrcamento =
      totalComOrcamento > 0
        ? arredondar((totalAprovados / totalComOrcamento) * 100)
        : 0;

    return {
      esperaAtribuicao: calcularKpi(amostrasEsperaAtribuicao),
      diagnosticoOrcamento: calcularKpi(amostrasdiagnosticoOrcamento),
      aprovacaoCliente: calcularKpi(amostrasAprovacaoCliente),
      execucao: calcularKpi(amostrasExecucao),
      esperaEntrega: calcularKpi(amostrasEsperaEntrega),
      leadTimeTotal: calcularKpi(amostrasLeadTimeTotal),
      tempoTecnicoLiquido: calcularKpi(amostrasTempoTecnicoLiquido),
      taxaAprovacaoOrcamento,
    };
  }
}
