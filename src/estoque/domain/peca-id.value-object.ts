import { IdUnico } from '../../shared/domain/id.value-object';

/**
 * Objeto de valor que representa o identificador único de uma Peça no aggregate Estoque.
 * Gera IDs no formato ULID com prefixo `pc` (ex: `pc_01ARZ3NDEKTSV4RRFFQ69G5FAV`).
 * Estende {@link IdUnico} para herdar a lógica de geração e validação do ULID.
 */
export class PecaId extends IdUnico {
  /**
   * Cria uma instância de PecaId.
   * @param valor - Valor do ID existente. Se omitido, um novo ULID com prefixo `pc` é gerado.
   */
  constructor(valor?: string) {
    super('pc', valor);
  }

  /**
   * Cria um novo PecaId com ULID gerado automaticamente.
   * @returns Nova instância de PecaId.
   */
  static novo(): PecaId {
    return new PecaId();
  }

  /**
   * Reconstitui um PecaId a partir de um valor já existente (ex: banco de dados).
   * @param valor - String do ID previamente persistido.
   * @returns Instância de PecaId com o valor informado.
   */
  static de(valor: string): PecaId {
    return new PecaId(valor);
  }
}
