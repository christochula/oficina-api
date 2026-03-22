import { IdUnico } from '../../shared/domain/id.value-object';

/**
 * Identificador único da entidade Usuario no domínio da oficina.
 *
 * Estende {@link IdUnico} utilizando o prefixo `us` seguido de um ULID,
 * resultando em valores como `us_01ARZ3NDEKTSV4RRFFQ69G5FAV`.
 * Garante identidade forte e rastreabilidade entre camadas.
 */
export class UsuarioId extends IdUnico {
  /**
   * Cria uma instância de UsuarioId.
   * @param valor - ULID com prefixo `us` já existente. Omitir para gerar um novo ID.
   */
  constructor(valor?: string) {
    super('us', valor);
  }

  /**
   * Fábrica que gera um novo UsuarioId com ULID único.
   */
  static novo(): UsuarioId {
    return new UsuarioId();
  }

  /**
   * Fábrica que reconstitui um UsuarioId a partir de um valor já persistido.
   * @param valor - String do ID previamente gerado (ex: `us_01ARZ3NDEKTSV4RRFFQ69G5FAV`).
   */
  static de(valor: string): UsuarioId {
    return new UsuarioId(valor);
  }
}
