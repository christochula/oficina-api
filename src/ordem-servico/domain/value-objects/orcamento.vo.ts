import { GrupoOrcamento } from './grupo-orcamento.vo';

/**
 * Interface com as propriedades necessárias para construir um Orcamento.
 */
export interface OrcamentoProps {
  /** Identificador do orçamento (preenchido ao reconstituir do banco de dados). */
  id?: string;
  /** Grupos de itens que compõem o orçamento. Cada grupo agrupa linhas por problema/serviço. */
  grupos: GrupoOrcamento[];
  /** Notas internas do mecânico — não visíveis ao cliente. */
  notasInternas?: string | null;
  /** Notas enviadas ao cliente junto com o orçamento. */
  notasCliente?: string | null;
  /** Data e hora em que o orçamento foi aprovado. Null enquanto pendente. */
  aprovadoEm?: Date | null;
  /** Data e hora em que o orçamento foi rejeitado. Null enquanto pendente ou aprovado. */
  rejeitadoEm?: Date | null;
  /** Data e hora de criação do orçamento. */
  criadoEm?: Date;
}

/**
 * Objeto de valor que representa o orçamento de uma Ordem de Serviço.
 *
 * O orçamento é organizado em grupos temáticos (GrupoOrcamento), cada um
 * contendo linhas de MATERIAL e/ou SERVICO. O total geral é a soma dos totais
 * de todos os grupos.
 *
 * O orçamento pode conter notas internas (apenas para a equipe da oficina)
 * e notas para o cliente (enviadas junto com a proposta).
 */
export class Orcamento {
  /** Identificador do orçamento no banco de dados. */
  readonly id: string | undefined;
  /** Grupos de itens do orçamento. */
  readonly grupos: GrupoOrcamento[];
  /** Total geral do orçamento: soma dos totais de todos os grupos. */
  readonly total: number;
  /** Notas internas — visíveis apenas para a equipe da oficina. */
  readonly notasInternas: string | null;
  /** Notas para o cliente — enviadas junto com a proposta de orçamento. */
  readonly notasCliente: string | null;
  /** Data de aprovação. Null se ainda não aprovado. */
  aprovadoEm: Date | null;
  /** Data de rejeição. Null se ainda não rejeitado. */
  rejeitadoEm: Date | null;
  /** Data de criação do orçamento. */
  readonly criadoEm: Date;

  constructor(props: OrcamentoProps) {
    this.id = props.id;
    this.grupos = props.grupos;
    this.total = Number(
      props.grupos.reduce((acc, g) => acc + g.total, 0).toFixed(2),
    );
    this.notasInternas = props.notasInternas ?? null;
    this.notasCliente = props.notasCliente ?? null;
    this.aprovadoEm = props.aprovadoEm ?? null;
    this.rejeitadoEm = props.rejeitadoEm ?? null;
    this.criadoEm = props.criadoEm ?? new Date();
  }
}
