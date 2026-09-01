import { IdUnico } from './id.value-object';

/**
 * Classe base abstrata para todas as entidades de domínio do sistema.
 *
 * Fornece os atributos de identidade e rastreamento temporal obrigatórios para
 * qualquer entidade do modelo de domínio: identificador único tipado, data de criação
 * e data da última atualização. Define também igualdade por identidade e o mecanismo
 * de atualização do timestamp `atualizadoEm`.
 *
 * Toda entidade concreta deve estender esta classe e passar o tipo específico de
 * seu `IdUnico` como parâmetro genérico (ex: `EntidadeBase<OrdemServicoId>`).
 *
 * @template TId - Tipo do identificador único da entidade, derivado de `IdUnico`.
 */
export abstract class EntidadeBase<TId extends IdUnico> {
  /** Identificador único da entidade no domínio. Imutável após a criação. */
  readonly id: TId;

  /** Data e hora em que a entidade foi criada. Imutável após a criação. */
  readonly criadoEm: Date;

  /** Data e hora da última modificação do estado da entidade. Atualizado via `tocarAtualizadoEm()`. */
  atualizadoEm: Date;

  /**
   * Inicializa os atributos base da entidade.
   *
   * Quando `criadoEm` e `atualizadoEm` são omitidos (criação de nova entidade), ambos
   * recebem a data e hora atuais. Quando fornecidos (reconstituição a partir da persistência),
   * os valores originais são preservados.
   *
   * @param id - Identificador único já construído para esta entidade.
   * @param criadoEm - Data de criação original; omitido define como agora.
   * @param atualizadoEm - Data da última atualização; omitido define como agora.
   */
  protected constructor(id: TId, criadoEm?: Date, atualizadoEm?: Date) {
    this.id = id;
    this.criadoEm = criadoEm ?? new Date();
    this.atualizadoEm = atualizadoEm ?? new Date();
  }

  /**
   * Compara esta entidade com outra por identidade de domínio.
   * Duas entidades são iguais se seus IDs forem iguais, independentemente
   * do estado dos demais atributos.
   *
   * @param outra - Outra entidade do mesmo tipo a ser comparada.
   * @returns `true` se os identificadores forem iguais; `false` caso contrário.
   */
  equals(outra: EntidadeBase<TId>): boolean {
    return this.id.equals(outra.id);
  }

  /**
   * Atualiza o campo `atualizadoEm` para o momento presente.
   *
   * Deve ser chamado internamente pelos métodos de negócio da entidade sempre que
   * houver mudança de estado, garantindo rastreabilidade da última modificação.
   */
  protected tocarAtualizadoEm(): void {
    this.atualizadoEm = new Date();
  }
}
