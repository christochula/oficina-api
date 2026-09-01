/**
 * Contrato base para todos os eventos de domínio do sistema.
 *
 * Eventos de domínio representam fatos relevantes que ocorreram dentro de um aggregate,
 * expressos na linguagem ubíqua do negócio. Eles permitem comunicação desacoplada entre
 * aggregates — por exemplo, `ConsumoPecaEvento` é disparado por `OrdemServico`
 * e processado por `Estoque` para baixar o estoque da peça utilizada.
 *
 * Toda implementação concreta deve registrar o momento exato da ocorrência (`ocorridoEm`)
 * e um identificador de tipo (`tipo`) que permita roteamento e rastreabilidade do evento.
 */
export interface EventoDominio {
  /** Data e hora em que o fato de domínio ocorreu. */
  readonly ocorridoEm: Date;

  /** Identificador textual do tipo do evento (ex: 'consumo-peca'). Usado para roteamento e logging. */
  readonly tipo: string;
}
