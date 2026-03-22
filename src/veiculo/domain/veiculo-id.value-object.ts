import { IdUnico } from '../../shared/domain/id.value-object';

/**
 * Value Object que representa o identificador único de um Veículo.
 * Utiliza ULID com o prefixo "ve" para garantir rastreabilidade e ordenação cronológica.
 * Exemplo de valor gerado: "ve_01ARZ3NDEKTSV4RRFFQ69G5FAV"
 */
export class VeiculoId extends IdUnico {
  /**
   * Constrói um VeiculoId, gerando um novo ULID se nenhum valor for fornecido.
   * @param valor - ULID existente com prefixo "ve". Omitir para gerar um novo ID.
   */
  constructor(valor?: string) {
    super('ve', valor);
  }

  /**
   * Cria um novo VeiculoId com ULID gerado automaticamente.
   * Deve ser usado ao registrar um novo veículo no sistema.
   * @returns Nova instância de VeiculoId com identificador único.
   */
  static novo(): VeiculoId {
    return new VeiculoId();
  }

  /**
   * Reconstitui um VeiculoId a partir de um valor de string já existente.
   * Deve ser usado ao carregar um veículo da persistência.
   * @param valor - String do ULID armazenado no banco de dados.
   * @returns Instância de VeiculoId com o valor fornecido.
   */
  static de(valor: string): VeiculoId {
    return new VeiculoId(valor);
  }
}
