import { Estoque } from './estoque.entity';
import { PecaId } from './peca-id.value-object';

/** Token de injeção de dependência para o repositório de Estoque. */
export const ESTOQUE_REPOSITORY = 'ESTOQUE_REPOSITORY';

/**
 * Token de injeção de dependência para o serviço de Estoque.
 * O serviço expõe operações de domínio que podem ser chamadas por outros módulos
 * (ex: OrdemServicoModule ao processar eventos ConsumoPeca).
 */
export const ESTOQUE_SERVICE = 'ESTOQUE_SERVICE';

/**
 * Interface do repositório de Estoque.
 * Define o contrato de persistência que qualquer implementação deve cumprir.
 * A implementação concreta é {@link PrismaEstoqueRepository}.
 */
export interface EstoqueRepository {
  /**
   * Persiste um Estoque. Cria a Peça e o Estoque se não existirem;
   * atualiza apenas o Estoque (quantidades) se a Peça já existir.
   * @param estoque - Aggregate Estoque a ser salvo.
   */
  salvar(estoque: Estoque): Promise<void>;

  /**
   * Busca o registro de estoque pelo ID da peça associada.
   * @param pecaId - PecaId da peça cujo estoque deve ser buscado.
   * @returns O Estoque encontrado ou null se não existir.
   */
  buscarPorPecaId(pecaId: PecaId): Promise<Estoque | null>;

  /**
   * Busca o registro de estoque pela string do ID da peça.
   * Atalho para `buscarPorPecaId` quando já se tem a string do ID.
   * @param id - String do ID da peça.
   * @returns O Estoque encontrado ou null se não existir.
   */
  buscarPorId(id: string): Promise<Estoque | null>;

  /**
   * Lista registros de estoque de forma paginada, ordenados pelo nome da peça.
   * @param pagina - Número da página (base 1).
   * @param porPagina - Quantidade de registros por página.
   * @returns Lista de Estoques da página e total geral de registros.
   */
  listar(
    pagina: number,
    porPagina: number,
  ): Promise<{ itens: Estoque[]; total: number }>;
}

/**
 * Interface do serviço de Estoque, exposta para consumo por outros módulos.
 * Implementada por {@link PrismaEstoqueRepository}, que também implementa EstoqueRepository.
 * Utilizada pelo caso de uso {@link RegistrarConsumoPecaUseCase} ao processar eventos de domínio.
 */
export interface EstoqueService {
  /**
   * Processa o consumo de uma peça disparado por um evento da OrdemServico.
   * Busca o estoque da peça, chama `darSaida` e persiste a atualização.
   * @param pecaId - ID da peça consumida.
   * @param quantidade - Quantidade de unidades consumidas.
   * @throws RecursoNaoEncontrado se não houver registro de estoque para a peça.
   * @throws RegraDeNegocio se o estoque disponível for insuficiente.
   */
  processarConsumoPeca(pecaId: string, quantidade: number): Promise<void>;
}
