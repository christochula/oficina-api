import { Inject, Injectable } from '@nestjs/common';
import { HistoricoOSItem } from '../../domain/ordem-servico.entity';
import { ORDEM_SERVICO_REPOSITORY } from '../../domain/ordem-servico.repository';
import type { OrdemServicoRepository } from '../../domain/ordem-servico.repository';

/**
 * Parâmetros de entrada para o cálculo de tempo de ciclo personalizado.
 */
export interface TempoCicloInput {
  /** Código do evento de início da medição (ex: 'MECANICO_ATRIBUIDO'). */
  eventoInicio: string;
  /** Código do evento de fim da medição (ex: 'ORDEM_FINALIZADA'). */
  eventoFim: string;
  /**
   * Pares de eventos cujo intervalo deve ser descontado do tempo total.
   * Formato: array de strings "EVENTO_INICIO:EVENTO_FIM"
   * Exemplo: ['ORCAMENTO_GERADO:ORCAMENTO_APROVADO'] desconta o tempo de aprovação do cliente.
   */
  descontar?: string[];
  /**
   * Restringe o cálculo a uma ou mais OS específicas pelo ID.
   * Quando omitido, todas as OS são consideradas.
   */
  osIds?: string[];
}

/** Detalhamento de tempo de ciclo de uma OS individual. */
export interface TempoCicloItem {
  /** Identificador único da OS. */
  osId: string;
  /** Número operacional da OS. */
  numero: number;
  /** Timestamp do evento de início. */
  inicioEm: Date;
  /** Timestamp do evento de fim. */
  fimEm: Date;
  /** Duração bruta em horas (sem descontos). */
  duracaoBrutaHoras: number;
  /** Duração líquida em horas (após aplicar os descontos). */
  duracaoLiquidaHoras: number;
  /** Total de horas descontadas. */
  totalDescontadoHoras: number;
}

/** Resultado agregado do cálculo de tempo de ciclo personalizado. */
export interface TempoCicloOutput {
  /** Evento usado como marco de início. */
  eventoInicio: string;
  /** Evento usado como marco de fim. */
  eventoFim: string;
  /** Pares de desconto aplicados. */
  descontos: string[];
  /** Número de OS que possuem ambos os eventos de início e fim. */
  totalAmostras: number;
  /** Média de duração líquida em horas. */
  mediaHoras: number;
  /** Menor duração líquida em horas. */
  minimoHoras: number;
  /** Maior duração líquida em horas. */
  maximoHoras: number;
  /** Detalhamento individual por OS. */
  ordens: TempoCicloItem[];
}

// ── Helpers privados ──────────────────────────────────────────────────────────

/** Arredonda para 2 casas decimais. */
function arredondar(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/** Extrai o timestamp do primeiro evento com o código especificado. */
function tsEvento(
  historico: HistoricoOSItem[],
  evento: string,
): Date | undefined {
  return historico.find((h) => h.evento === evento)?.criadoEm;
}

/** Calcula a diferença positiva em horas entre dois timestamps. */
function diffHoras(inicio: Date, fim: Date): number {
  const diff = (fim.getTime() - inicio.getTime()) / (1000 * 60 * 60);
  return arredondar(Math.max(0, diff));
}

/**
 * Caso de uso que calcula o tempo de ciclo entre dois eventos quaisquer do histórico,
 * com suporte a descontos de intervalos intermediários.
 *
 * Permite construir KPIs customizados como:
 * - "Tempo do mecânico" = MECANICO_ATRIBUIDO → ORDEM_FINALIZADA
 *   descontando ORCAMENTO_GERADO:ORCAMENTO_APROVADO (tempo de espera do cliente)
 * - "Tempo de diagnóstico puro" = MECANICO_ATRIBUIDO → ORCAMENTO_GERADO (sem descontos)
 *
 * Apenas OS que possuem ambos os eventos (início e fim) são incluídas no resultado.
 * Para cada desconto, se a OS não possuir os dois eventos do par, o desconto é ignorado
 * para aquela OS específica.
 */
@Injectable()
export class TempoCicloPersonalizadoUseCase {
  constructor(
    @Inject(ORDEM_SERVICO_REPOSITORY)
    private readonly osRepository: OrdemServicoRepository,
  ) {}

  /**
   * Executa o cálculo de tempo de ciclo com os parâmetros informados.
   * @param input - Evento de início, evento de fim e pares de desconto opcionais.
   * @returns Estatísticas agregadas e detalhamento por OS.
   */
  async executar(input: TempoCicloInput): Promise<TempoCicloOutput> {
    const osFiltradas = await this.osRepository.buscarTodasComHistorico(
      input.osIds,
    );
    const descontos = input.descontar ?? [];

    // Analisa cada par de desconto uma única vez
    const paresDesconto = descontos.map((par) => {
      const [ini, fim] = par.split(':');
      return { ini, fim };
    });

    const itens: TempoCicloItem[] = [];

    for (const os of osFiltradas) {
      const h = os.historico;

      const tsInicio = tsEvento(h, input.eventoInicio);
      const tsFim = tsEvento(h, input.eventoFim);

      // OS sem ambos os eventos não contribuem para o relatório
      if (!tsInicio || !tsFim) continue;

      const duracaoBruta = diffHoras(tsInicio, tsFim);

      // Calcula o total de horas a descontar
      let totalDescontado = 0;
      for (const { ini, fim } of paresDesconto) {
        const tsIniDesconto = tsEvento(h, ini);
        const tsFimDesconto = tsEvento(h, fim);
        if (tsIniDesconto && tsFimDesconto) {
          totalDescontado += diffHoras(tsIniDesconto, tsFimDesconto);
        }
      }
      totalDescontado = arredondar(totalDescontado);

      const duracaoLiquida = arredondar(
        Math.max(0, duracaoBruta - totalDescontado),
      );

      itens.push({
        osId: os.id.valor,
        numero: os.numero,
        inicioEm: tsInicio,
        fimEm: tsFim,
        duracaoBrutaHoras: duracaoBruta,
        duracaoLiquidaHoras: duracaoLiquida,
        totalDescontadoHoras: totalDescontado,
      });
    }

    if (itens.length === 0) {
      return {
        eventoInicio: input.eventoInicio,
        eventoFim: input.eventoFim,
        descontos,
        totalAmostras: 0,
        mediaHoras: 0,
        minimoHoras: 0,
        maximoHoras: 0,
        ordens: [],
      };
    }

    const horas = itens.map((i) => i.duracaoLiquidaHoras);
    const soma = horas.reduce((acc, v) => acc + v, 0);

    return {
      eventoInicio: input.eventoInicio,
      eventoFim: input.eventoFim,
      descontos,
      totalAmostras: itens.length,
      mediaHoras: arredondar(soma / itens.length),
      minimoHoras: arredondar(Math.min(...horas)),
      maximoHoras: arredondar(Math.max(...horas)),
      ordens: itens,
    };
  }
}
