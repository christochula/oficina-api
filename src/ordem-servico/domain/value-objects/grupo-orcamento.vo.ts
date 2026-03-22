import { LinhaServico, LinhaServicoProps } from './linha-servico.vo';

/**
 * Interface com as propriedades necessárias para construir um GrupoOrcamento.
 */
export interface GrupoOrcamentoProps {
  /** Identificador do grupo no banco de dados (preenchido ao reconstituir). */
  id?: string;
  /** Título descritivo do grupo, escrito livremente pelo mecânico. Ex: "Retífica do Motor". */
  titulo: string;
  /** Linhas de serviço (MATERIAL e SERVICO) que compõem o grupo. */
  linhasServico: LinhaServico[];
  /** Ordem de exibição do grupo no orçamento. */
  ordem?: number;
}

/**
 * Interface para criação de grupo via use case (antes de instanciar LinhaServico).
 */
export interface GrupoOrcamentoInput {
  titulo: string;
  linhas: LinhaServicoProps[];
}

/**
 * Objeto de valor que representa um grupo de itens dentro de um orçamento.
 *
 * O mecânico organiza o orçamento em grupos temáticos — um por problema ou
 * serviço macro identificado (ex: "Retífica do Motor", "Troca de Óleo").
 * Cada grupo contém linhas de MATERIAL e/ou SERVICO com seus respectivos custos.
 * O total do grupo é calculado automaticamente como soma dos subtotais das linhas.
 */
export class GrupoOrcamento {
  /** Identificador do grupo no banco de dados. */
  readonly id: string | undefined;
  /** Título descritivo do grupo. */
  readonly titulo: string;
  /** Linhas de serviço do grupo. */
  readonly linhasServico: LinhaServico[];
  /** Total calculado do grupo: soma dos subtotais das linhas. */
  readonly total: number;
  /** Ordem de exibição no orçamento. */
  readonly ordem: number;

  constructor(props: GrupoOrcamentoProps) {
    this.id = props.id;
    this.titulo = props.titulo;
    this.linhasServico = props.linhasServico;
    this.total = Number(
      props.linhasServico.reduce((acc, l) => acc + l.subtotal, 0).toFixed(2),
    );
    this.ordem = props.ordem ?? 0;
  }
}
