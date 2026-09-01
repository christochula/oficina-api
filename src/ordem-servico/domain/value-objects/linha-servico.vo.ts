/**
 * Enum que classifica o tipo de uma linha de serviço no orçamento.
 * Distingue entre itens de mão de obra (SERVICO) e peças físicas utilizadas (MATERIAL).
 */
export enum TipoLinhaServico {
  /** Linha referente a uma peça física consumida do estoque. */
  MATERIAL = 'MATERIAL',
  /** Linha referente a um serviço de mão de obra realizado pelo mecânico. */
  SERVICO = 'SERVICO',
}

/**
 * Interface com as propriedades necessárias para construir uma LinhaServico.
 */
export interface LinhaServicoProps {
  /** Identificador da linha (preenchido ao reconstituir do banco de dados). */
  id?: string;
  /** Tipo da linha: MATERIAL ou SERVICO. */
  tipo: TipoLinhaServico;
  /** Descrição do serviço ou material. */
  descricao: string;
  /** Quantidade de unidades do serviço ou material. */
  quantidade: number;
  /** Valor unitário em reais. */
  valorUnitario: number;
  /** ID da peça do estoque (obrigatório apenas para linhas do tipo MATERIAL). */
  pecaId?: string | null;
}

/**
 * Objeto de valor imutável que representa uma linha de item no orçamento de uma OS.
 * Pode representar um serviço de mão de obra ou um material (peça) utilizado.
 * O subtotal é calculado automaticamente na construção: quantidade × valorUnitário.
 */
export class LinhaServico {
  /** Identificador da linha no banco de dados (pode ser undefined em novas linhas). */
  readonly id: string | undefined;
  /** Tipo da linha: MATERIAL ou SERVICO. */
  readonly tipo: TipoLinhaServico;
  /** Descrição do serviço ou material. */
  readonly descricao: string;
  /** Quantidade de unidades. */
  readonly quantidade: number;
  /** Valor unitário em reais. */
  readonly valorUnitario: number;
  /** Subtotal calculado: quantidade × valorUnitario, arredondado para 2 casas decimais. */
  readonly subtotal: number;
  /** ID da peça relacionada no estoque. Null para linhas do tipo SERVICO. */
  readonly pecaId: string | null;

  /**
   * Cria uma nova instância de LinhaServico e calcula o subtotal automaticamente.
   * @param props - Propriedades da linha de serviço.
   */
  constructor(props: LinhaServicoProps) {
    this.id = props.id;
    this.tipo = props.tipo;
    this.descricao = props.descricao;
    this.quantidade = props.quantidade;
    this.valorUnitario = props.valorUnitario;
    this.subtotal = Number((props.quantidade * props.valorUnitario).toFixed(2));
    this.pecaId = props.pecaId ?? null;
  }
}
