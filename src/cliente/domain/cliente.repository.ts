import { Cliente } from './cliente.entity';
import { ClienteId } from './cliente-id.value-object';

/**
 * Token de injeção de dependência para o repositório de clientes.
 * Usado com @Inject(CLIENTE_REPOSITORY) nos casos de uso para desacoplar
 * a camada de aplicação da implementação de persistência concreta.
 */
export const CLIENTE_REPOSITORY = 'CLIENTE_REPOSITORY';

/**
 * Interface do repositório de clientes — contrato da camada de domínio.
 * Define as operações de persistência que o domínio necessita sem depender
 * de tecnologia específica. A implementação concreta fica na camada de infraestrutura.
 */
export interface ClienteRepository {
  /**
   * Persiste um cliente (inserção ou atualização via upsert).
   * @param cliente - Aggregate Cliente com estado atualizado a ser salvo.
   */
  salvar(cliente: Cliente): Promise<void>;

  /**
   * Busca um cliente pelo seu identificador interno.
   * @param id - ClienteId do cliente desejado.
   * @returns O Cliente encontrado ou null se não existir.
   */
  buscarPorId(id: ClienteId): Promise<Cliente | null>;

  /**
   * Busca um cliente pelo usuário autenticável associado.
   * @param usuarioId - ID do usuário (prefixo "us").
   * @returns O Cliente associado ou null se não houver vínculo.
   */
  buscarPorUsuarioId(usuarioId: string): Promise<Cliente | null>;

  /**
   * Busca um cliente pelo número do documento (CPF ou CNPJ).
   * Usado para verificar duplicidade no cadastro e para consultas via rota pública.
   * @param numeroDoc - CPF ou CNPJ sem formatação.
   * @returns O Cliente encontrado ou null se não existir.
   */
  buscarPorNumeroDoc(numeroDoc: string): Promise<Cliente | null>;

  /**
   * Lista clientes de forma paginada, ordenados por nome (ASC).
   * @param pagina - Número da página (base 1).
   * @param porPagina - Quantidade de registros por página.
   * @returns Lista de clientes da página e total geral de registros.
   */
  listar(pagina: number, porPagina: number): Promise<{ itens: Cliente[]; total: number }>;
}
