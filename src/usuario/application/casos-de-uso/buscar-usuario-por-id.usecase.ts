import { Inject, Injectable } from '@nestjs/common';
import { RecursoNaoEncontrado } from '../../../shared/excecoes/dominio.exception';
import { Usuario } from '../../domain/usuario.entity';
import { UsuarioId } from '../../domain/usuario-id.value-object';
import { USUARIO_REPOSITORY } from '../../domain/usuario.repository';
import type { UsuarioRepository } from '../../domain/usuario.repository';

/**
 * Caso de uso responsável por recuperar os dados de um usuário específico pelo seu ID.
 *
 * Utilizado por controllers e outros casos de uso (ex.: {@link AuthService}) que precisam
 * carregar o perfil completo de um usuário a partir do identificador único de domínio.
 */
@Injectable()
export class BuscarUsuarioPorIdUseCase {
  /**
   * @param usuarioRepository - Repositório de usuarios injetado via token {@link USUARIO_REPOSITORY}.
   */
  constructor(
    @Inject(USUARIO_REPOSITORY)
    private readonly usuarioRepository: UsuarioRepository,
  ) {}

  /**
   * Executa a busca de um usuario pelo ID informado.
   * @param id - String do ID do usuário (ULID com prefixo `us`).
   * @returns A entidade de domínio {@link Usuario} encontrada.
   * @throws {RecursoNaoEncontrado} se nenhum usuário com o ID especificado existir.
   */
  async executar(id: string): Promise<Usuario> {
    const usuario = await this.usuarioRepository.buscarPorId(UsuarioId.de(id));
    if (!usuario) throw new RecursoNaoEncontrado('Usuário', id);
    return usuario;
  }
}
