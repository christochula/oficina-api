import { ServicoOficina } from './servico-oficina.entity';
import { ServicoOficinaId } from './servico-oficina-id.value-object';

/** Token de injeção para o repositório de ServicoOficina. */
export const SERVICO_OFICINA_REPOSITORY = 'SERVICO_OFICINA_REPOSITORY';

export interface ServicoListFilters {
  busca?: string;
  ativo?: boolean;
}

/**
 * Interface do repositório de ServicoOficina.
 * Define o contrato de persistência sem acoplamento à implementação concreta.
 */
export interface ServicoOficinaRepository {
  /** Persiste um serviço (cria ou atualiza). */
  salvar(servico: ServicoOficina): Promise<void>;

  /** Busca um serviço pelo ID. Retorna null se não encontrado. */
  buscarPorId(id: ServicoOficinaId): Promise<ServicoOficina | null>;

  /** Lista serviços ativos de forma paginada, ordenados por nome. */
  listar(
    pagina: number,
    porPagina: number,
    filtros?: ServicoListFilters,
  ): Promise<{ itens: ServicoOficina[]; total: number }>;
}
