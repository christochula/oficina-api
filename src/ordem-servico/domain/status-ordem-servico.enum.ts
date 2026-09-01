/**
 * Enum que representa os possíveis estados do ciclo de vida de uma Ordem de Serviço.
 *
 * Fluxo principal:
 * RECEBIDA → ATRIBUIDA → EM_DIAGNOSTICO* → AGUARDANDO_APROVACAO → APROVADA → EM_EXECUCAO → FINALIZADA → ENTREGUE
 *
 * * EM_DIAGNOSTICO é um estado opcional — OS com serviços claramente definidos
 *   podem avançar diretamente de ATRIBUIDA para AGUARDANDO_APROVACAO.
 *
 * Estado terminal alternativo:
 * AGUARDANDO_APROVACAO → CANCELADA (quando o cliente rejeita o orçamento)
 */
export enum StatusOrdemServico {
  /** OS aberta e aguardando atribuição de mecânico responsável. */
  RECEBIDA = 'RECEBIDA',
  /** Mecânico atribuído; OS aguardando início de diagnóstico ou geração de orçamento. */
  ATRIBUIDA = 'ATRIBUIDA',
  /** Mecânico realizando diagnóstico técnico do veículo. */
  EM_DIAGNOSTICO = 'EM_DIAGNOSTICO',
  /** Orçamento gerado; aguardando aprovação ou rejeição pelo cliente. */
  AGUARDANDO_APROVACAO = 'AGUARDANDO_APROVACAO',
  /** Orçamento aprovado; aguardando início da execução dos serviços. */
  APROVADA = 'APROVADA',
  /** Serviços em execução; peças podem ser consumidas do estoque neste estado. */
  EM_EXECUCAO = 'EM_EXECUCAO',
  /** Execução técnica concluída pelo mecânico; aguardando entrega ao cliente. */
  FINALIZADA = 'FINALIZADA',
  /** Veículo entregue ao cliente; estado final do ciclo de atendimento. */
  ENTREGUE = 'ENTREGUE',
  /** OS cancelada em decorrência da rejeição do orçamento pelo cliente. */
  CANCELADA = 'CANCELADA',
}
