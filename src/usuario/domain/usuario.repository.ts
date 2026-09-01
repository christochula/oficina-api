import { Usuario } from './usuario.entity';
import { UsuarioId } from './usuario-id.value-object';
import { PapelUsuarioInterno } from './papel-usuario.enum';

/** Token de injeção de dependência para o repositório de usuários no contêiner NestJS. */
export const USUARIO_REPOSITORY = 'USUARIO_REPOSITORY';

/** Filtros opcionais aplicados à listagem paginada de mecânicos. */
export interface FiltrosListagemMecanicos {
  /** Trecho do nome, e-mail ou identificador interno do mecânico. */
  busca?: string;
  /** Estado de ativação desejado. Quando omitido, retorna ambos. */
  ativo?: boolean;
}

/** Filtros da gestão paginada de usuários internos. */
export interface FiltrosListagemUsuarios {
  /** Trecho do nome, e-mail ou identificador interno. */
  busca?: string;
  /** Papel interno específico. */
  papel?: PapelUsuarioInterno;
  /** Estado de ativação desejado. */
  ativo?: boolean;
}

/**
 * Interface do repositório de Usuario no domínio da oficina.
 *
 * Define o contrato que toda implementação de persistência deve satisfazer,
 * desacoplando o domínio dos detalhes de infraestrutura (Prisma, memória, etc.).
 * A implementação concreta é fornecida pela camada de infraestrutura via injeção de dependência.
 */
export interface UsuarioRepository {
  /**
   * Persiste um usuario no repositório. Realiza insert ou update conforme o ID já existir.
   * @param usuario - Entidade de domínio a ser salva.
   */
  salvar(usuario: Usuario): Promise<void>;

  /**
   * Busca um usuario pelo seu identificador único de domínio.
   * @param id - UsuarioId da entidade procurada.
   * @returns A entidade encontrada ou `null` se não existir.
   */
  buscarPorId(id: UsuarioId): Promise<Usuario | null>;

  /**
   * Busca um usuario pelo endereço de e-mail, usado para autenticação e validação de unicidade.
   * @param email - E-mail do usuário a ser pesquisado.
   * @returns A entidade encontrada ou `null` se não existir.
   */
  buscarPorEmail(email: string): Promise<Usuario | null>;

  /**
   * Lista somente usuários com papel MECANICO, de forma paginada e ordenada.
   * @param pagina - Número da página (base 1).
   * @param porPagina - Quantidade de registros por página.
   * @param filtros - Busca textual e estado de ativação opcionais.
   */
  listarMecanicos(
    pagina: number,
    porPagina: number,
    filtros?: FiltrosListagemMecanicos,
  ): Promise<{ itens: Usuario[]; total: number }>;

  /** Lista usuários internos de forma paginada. */
  listarInternos(
    pagina: number,
    porPagina: number,
    filtros?: FiltrosListagemUsuarios,
  ): Promise<{ itens: Usuario[]; total: number }>;

  /**
   * Conta administradores ativos, opcionalmente desconsiderando um usuário.
   * Usado para impedir que a oficina fique sem administrador ativo.
   */
  contarAdministradoresAtivos(excluirUsuarioId?: string): Promise<number>;

  /** Conta ordens ainda não terminais atribuídas ao mecânico. */
  contarOrdensNaoTerminaisDoMecanico(mecanicoId: string): Promise<number>;
}
