import { IdUnico } from '../../shared/domain/id.value-object';

/**
 * Identificador único do aggregate ServicoOficina.
 * Utiliza o prefixo 'sv' combinado com um ULID monotônico.
 */
export class ServicoOficinaId extends IdUnico {
  private constructor(valor?: string) {
    super('sv', valor);
  }

  /** Gera um novo ServicoOficinaId com ULID recém-gerado. */
  static novo(): ServicoOficinaId {
    return new ServicoOficinaId();
  }

  /** Reconstitui um ServicoOficinaId a partir de um valor persistido. */
  static de(valor: string): ServicoOficinaId {
    return new ServicoOficinaId(valor);
  }
}
