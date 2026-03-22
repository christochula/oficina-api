import { IdUnico } from '../../shared/domain/id.value-object';

/**
 * Value Object que representa o identificador único de um Cliente.
 * Utiliza ULID com o prefixo "cl" para garantir rastreabilidade e ordenação cronológica.
 * Exemplo de valor gerado: "cl_01ARZ3NDEKTSV4RRFFQ69G5FAV"
 */
export class ClienteId extends IdUnico {
  /**
   * Constrói um ClienteId, gerando um novo ULID se nenhum valor for fornecido.
   * @param valor - ULID existente com prefixo "cl". Omitir para gerar um novo ID.
   */
  constructor(valor?: string) {
    super('cl', valor);
  }

  /**
   * Cria um novo ClienteId com ULID gerado automaticamente.
   * Deve ser usado ao cadastrar um novo cliente no sistema.
   * @returns Nova instância de ClienteId com identificador único.
   */
  static novo(): ClienteId {
    return new ClienteId();
  }

  /**
   * Reconstitui um ClienteId a partir de um valor de string já existente.
   * Deve ser usado ao carregar um cliente da persistência.
   * @param valor - String do ULID armazenado no banco de dados.
   * @returns Instância de ClienteId com o valor fornecido.
   */
  static de(valor: string): ClienteId {
    return new ClienteId(valor);
  }
}
