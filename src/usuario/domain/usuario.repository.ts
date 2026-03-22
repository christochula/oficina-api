import { Usuario } from './usuario.entity';
import { UsuarioId } from './usuario-id.value-object';

/** Token de injeção de dependência para o repositório de usuários no contêiner NestJS. */
export const USUARIO_REPOSITORY = 'USUARIO_REPOSITORY';

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
}
