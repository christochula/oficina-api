import { OrdemServico } from './ordem-servico.entity';
import { OrdemServicoId } from './ordem-servico-id.value-object';

/** Token de injeção de dependência para o repositório de OrdemServico. */
export const ORDEM_SERVICO_REPOSITORY = 'ORDEM_SERVICO_REPOSITORY';

/**
 * Filtros disponíveis para a listagem paginada de ordens de serviço.
 * Todos os campos são opcionais; filtros não informados são ignorados.
 */
export interface FiltrosListagemOS {
  /** Filtra por status da OS (ex: 'RECEBIDA', 'EM_EXECUCAO'). */
  status?: string;
  /** Filtra por múltiplos status simultaneamente (OR). Tem precedência sobre `status` quando informado. */
  statusIn?: string[];
  /** Filtra OS pertencentes a um cliente específico (usado para acesso do CLIENTE). */
  clienteId?: string;
  /** Filtra OS atribuídas a um mecânico específico. */
  mecanicoResponsavelId?: string;
  /** Número da página para paginação (padrão: 1). */
  pagina?: number;
  /** Quantidade de registros por página (padrão: 20). */
  porPagina?: number;
  /** Ordenação por data de criação. */
  ordemCriacao?: 'asc' | 'desc';
}

/**
 * Estrutura de retorno do método `listar` do repositório.
 * Contém os itens da página solicitada e o total geral para cálculo de paginação.
 */
export interface RepositorioListagem {
  /** Lista de OS da página atual. */
  itens: OrdemServico[];
  /** Total de OS que correspondem aos filtros aplicados (independente da paginação). */
  total: number;
}

/**
 * Interface do repositório de OrdemServico.
 * Define o contrato que qualquer implementação de persistência deve cumprir.
 * A implementação concreta é {@link PrismaOrdemServicoRepository}.
 */
export interface OrdemServicoRepository {
  /**
   * Persiste uma OS. Cria um novo registro se não existir; atualiza se já existir.
   * @param os - Aggregate OrdemServico a ser salvo.
   */
  salvar(os: OrdemServico): Promise<void>;

  /**
   * Busca uma OS pelo seu identificador único.
   * @param id - OrdemServicoId da OS a buscar.
   * @returns A OS encontrada ou null se não existir.
   */
  buscarPorId(id: OrdemServicoId): Promise<OrdemServico | null>;

  /**
   * Busca uma OS pelo número operacional (autoincremental).
   * @param numero - Número da OS visível ao cliente.
   * @returns A OS encontrada ou null se não existir.
   */
  buscarPorNumero(numero: number): Promise<OrdemServico | null>;

  /**
   * Lista OS de forma paginada aplicando filtros opcionais.
   * @param filtros - Critérios de filtragem e paginação.
   * @returns Lista de OS da página e total de registros correspondentes.
   */
  listar(filtros: FiltrosListagemOS): Promise<RepositorioListagem>;

  /**
   * Retorna todas as OS com status ENTREGUE, carregando o histórico completo.
   * Utilizado pelo relatório de lead-time para calcular o tempo médio de atendimento.
   * @returns Lista de OS entregues com histórico para extração do timestamp de entrega.
   */
  buscarEntregues(): Promise<OrdemServico[]>;

  /**
   * Retorna OS de qualquer status, carregando o histórico completo.
   * Utilizado pelos relatórios de KPIs e tempo de ciclo personalizado para análise por segmento.
   * @param osIds - Quando fornecido, aplica WHERE id IN (...) no banco. Sem este parâmetro, retorna todas.
   * @returns Lista de OS com histórico de eventos.
   */
  buscarTodasComHistorico(osIds?: string[]): Promise<OrdemServico[]>;
}
