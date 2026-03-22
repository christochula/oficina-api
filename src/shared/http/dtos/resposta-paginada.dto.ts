/**
 * Metadados de paginação incluídos em respostas de listagem.
 *
 * Fornece ao cliente todas as informações necessárias para implementar
 * navegação entre páginas: número da página atual, tamanho da página,
 * total de registros e total de páginas disponíveis.
 */
export interface MetaPaginacao {
  /** Número da página atual (base 1). */
  pagina: number;

  /** Quantidade de registros retornados por página. */
  porPagina: number;

  /** Total de registros existentes para a consulta realizada (sem paginação). */
  total: number;

  /** Total de páginas disponíveis, calculado com base em `total` e `porPagina`. */
  totalPaginas: number;
}

/**
 * DTO genérico de resposta paginada para endpoints de listagem.
 *
 * Encapsula a lista de itens retornados (`data`) junto com os metadados de
 * paginação (`meta`), seguindo o envelope padrão da API. O `RespostaInterceptor`
 * detecta automaticamente esta estrutura `{ data, meta }` e a repassa sem
 * duplo envelope.
 *
 * @template T - Tipo dos itens contidos na lista paginada.
 *
 * @example
 * return new RespostaPaginadaDto(clientes, total, pagina, porPagina);
 * // Resulta em: { data: [...], meta: { pagina: 1, porPagina: 20, total: 150, totalPaginas: 8 } }
 */
export class RespostaPaginadaDto<T> {
  /** Lista de itens da página solicitada. */
  data: T[];

  /** Metadados de paginação com informações sobre o total de resultados e navegação. */
  meta: MetaPaginacao;

  /**
   * Constrói a resposta paginada calculando automaticamente o total de páginas.
   *
   * @param data - Lista de itens da página corrente.
   * @param total - Total de registros existentes para a consulta (sem paginação).
   * @param pagina - Número da página atual solicitada.
   * @param porPagina - Quantidade de registros por página.
   */
  constructor(data: T[], total: number, pagina: number, porPagina: number) {
    this.data = data;
    this.meta = {
      pagina,
      porPagina,
      total,
      totalPaginas: Math.ceil(total / porPagina),
    };
  }
}
