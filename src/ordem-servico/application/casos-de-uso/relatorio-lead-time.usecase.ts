import { Inject, Injectable } from '@nestjs/common';
import { ORDEM_SERVICO_REPOSITORY } from '../../domain/ordem-servico.repository';
import type { OrdemServicoRepository } from '../../domain/ordem-servico.repository';

/**
 * Dados de lead-time de uma Ordem de Serviço individual.
 * Lead-time = intervalo entre a abertura (criadoEm) e a entrega do veículo (VEICULO_ENTREGUE).
 */
export interface LeadTimeItem {
  /** Identificador único da OS. */
  osId: string;
  /** Número operacional da OS (referência humana). */
  numero: number;
  /** Data e hora de criação da OS (início do ciclo). */
  criadoEm: Date;
  /** Data e hora do evento VEICULO_ENTREGUE no histórico (fim do ciclo). */
  entregueEm: Date;
  /** Duração total do atendimento em horas (com decimais). */
  leadTimeHoras: number;
}

/**
 * Resultado agregado do relatório de lead-time.
 * Contém estatísticas globais e os dados individuais de cada OS entregue.
 */
export interface RelatorioLeadTimeOutput {
  /** Total de OS com status ENTREGUE consideradas no cálculo. */
  totalOSEntregues: number;
  /** Média aritmética de lead-time em horas. Zero se não houver OS entregues. */
  leadTimeMedioHoras: number;
  /** Menor lead-time registrado em horas. Zero se não houver OS entregues. */
  leadTimeMinimoHoras: number;
  /** Maior lead-time registrado em horas. Zero se não houver OS entregues. */
  leadTimeMaximoHoras: number;
  /** Detalhamento individual de cada OS entregue. */
  ordens: LeadTimeItem[];
}

/**
 * Caso de uso que gera o relatório de lead-time das Ordens de Serviço entregues.
 *
 * Lead-time é calculado como a diferença entre:
 * - Início: `ordemServico.criadoEm` (abertura da OS, status RECEBIDA)
 * - Fim: timestamp do evento `VEICULO_ENTREGUE` no histórico da OS
 *
 * O relatório retorna estatísticas agregadas (média, mínimo, máximo) e o detalhamento
 * individual de cada OS, ordenado cronologicamente pela data de criação.
 */
@Injectable()
export class RelatorioLeadTimeUseCase {
  /**
   * @param osRepository - Repositório de ordens de serviço injetado via token ORDEM_SERVICO_REPOSITORY.
   */
  constructor(
    @Inject(ORDEM_SERVICO_REPOSITORY)
    private readonly osRepository: OrdemServicoRepository,
  ) {}

  /**
   * Executa o cálculo do relatório de lead-time para todas as OS entregues.
   * @returns Estatísticas de lead-time e detalhamento por OS.
   */
  async executar(): Promise<RelatorioLeadTimeOutput> {
    const osEntregues = await this.osRepository.buscarEntregues();

    const itens: LeadTimeItem[] = osEntregues.map((os) => {
      // Busca o evento VEICULO_ENTREGUE no histórico para obter o timestamp real de entrega.
      const eventoEntrega = os.historico.find((h) => h.evento === 'VEICULO_ENTREGUE');
      const entregueEm = eventoEntrega?.criadoEm ?? os.atualizadoEm;

      const diferencaMs = entregueEm.getTime() - os.criadoEm.getTime();
      const leadTimeHoras = diferencaMs / (1000 * 60 * 60);

      return {
        osId: os.id.valor,
        numero: os.numero,
        criadoEm: os.criadoEm,
        entregueEm,
        leadTimeHoras: Math.round(leadTimeHoras * 100) / 100, // 2 casas decimais
      };
    });

    if (itens.length === 0) {
      return {
        totalOSEntregues: 0,
        leadTimeMedioHoras: 0,
        leadTimeMinimoHoras: 0,
        leadTimeMaximoHoras: 0,
        ordens: [],
      };
    }

    const horas = itens.map((i) => i.leadTimeHoras);
    const soma = horas.reduce((acc, h) => acc + h, 0);

    return {
      totalOSEntregues: itens.length,
      leadTimeMedioHoras: Math.round((soma / itens.length) * 100) / 100,
      leadTimeMinimoHoras: Math.min(...horas),
      leadTimeMaximoHoras: Math.max(...horas),
      ordens: itens,
    };
  }
}
