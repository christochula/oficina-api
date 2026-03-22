import { IdUnico } from '../../shared/domain/id.value-object';

/**
 * Objeto de valor que representa o identificador único de uma Ordem de Serviço.
 * Gera IDs no formato ULID com prefixo `os` (ex: `os_01ARZ3NDEKTSV4RRFFQ69G5FAV`).
 * Estende {@link IdUnico} para herdar a lógica de geração e validação do ULID.
 */
export class OrdemServicoId extends IdUnico {
  /**
   * Cria uma instância de OrdemServicoId.
   * @param valor - Valor do ID existente. Se omitido, um novo ULID com prefixo `os` é gerado.
   */
  constructor(valor?: string) {
    super('os', valor);
  }

  /**
   * Cria um novo OrdemServicoId com ULID gerado automaticamente.
   * @returns Nova instância de OrdemServicoId.
   */
  static novo(): OrdemServicoId {
    return new OrdemServicoId();
  }

  /**
   * Reconstitui um OrdemServicoId a partir de um valor já existente (ex: banco de dados).
   * @param valor - String do ID previamente persistido.
   * @returns Instância de OrdemServicoId com o valor informado.
   */
  static de(valor: string): OrdemServicoId {
    return new OrdemServicoId(valor);
  }
}
