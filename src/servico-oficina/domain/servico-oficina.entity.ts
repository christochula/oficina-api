import { EntidadeBase } from '../../shared/domain/entidade-base';
import { ServicoOficinaId } from './servico-oficina-id.value-object';

/**
 * Interface interna com as propriedades para construção e reconstituição de ServicoOficina.
 */
interface PropriedadesServicoOficina {
  id?: ServicoOficinaId;
  nome: string;
  descricao?: string | null;
  categoria?: string | null;
  ativo?: boolean;
  criadoEm?: Date;
  atualizadoEm?: Date;
}

/**
 * Entidade que representa um serviço disponível no catálogo da oficina.
 *
 * O catálogo é a base estruturada que padroniza quais serviços a oficina oferece.
 * Ao abrir uma OS, o consultor técnico seleciona serviços deste catálogo
 * para compor a lista de serviços solicitados.
 *
 * O catálogo NÃO possui preço base — o custo é definido pelo mecânico
 * no momento da geração do orçamento, pois varia por veículo e escopo.
 */
export class ServicoOficina extends EntidadeBase<ServicoOficinaId> {
  /** Nome do serviço (ex: "Troca de Óleo", "Alinhamento", "Geometria"). */
  nome: string;
  /** Descrição detalhada do serviço. */
  descricao: string | null;
  /** Categoria do serviço para agrupamento (ex: "Manutenção Preventiva", "Diagnóstico"). */
  categoria: string | null;
  /** Indica se o serviço está ativo e disponível para seleção. */
  ativo: boolean;

  private constructor(props: PropriedadesServicoOficina) {
    super(props.id ?? ServicoOficinaId.novo(), props.criadoEm, props.atualizadoEm);
    this.nome = props.nome;
    this.descricao = props.descricao ?? null;
    this.categoria = props.categoria ?? null;
    this.ativo = props.ativo ?? true;
  }

  /**
   * Cria um novo serviço no catálogo da oficina.
   * @param props - Dados do novo serviço.
   * @returns Nova instância de ServicoOficina.
   */
  static criar(props: { nome: string; descricao?: string; categoria?: string }): ServicoOficina {
    return new ServicoOficina(props);
  }

  /**
   * Reconstitui um ServicoOficina a partir dos dados persistidos no banco.
   * @param props - Propriedades completas incluindo id.
   * @returns Instância reconstituída.
   */
  static reconstituir(
    props: PropriedadesServicoOficina & { id: ServicoOficinaId },
  ): ServicoOficina {
    return new ServicoOficina(props);
  }

  /**
   * Atualiza os dados editáveis do serviço.
   * @param dados - Campos a atualizar (ao menos um deve ser informado).
   */
  atualizar(dados: { nome?: string; descricao?: string | null; categoria?: string | null }): void {
    if (dados.nome !== undefined) this.nome = dados.nome;
    if (Object.prototype.hasOwnProperty.call(dados, 'descricao')) this.descricao = dados.descricao ?? null;
    if (Object.prototype.hasOwnProperty.call(dados, 'categoria')) this.categoria = dados.categoria ?? null;
    this.tocarAtualizadoEm();
  }

  /** Desativa o serviço, impedindo sua seleção em novas OS. */
  desativar(): void {
    this.ativo = false;
    this.tocarAtualizadoEm();
  }
}
