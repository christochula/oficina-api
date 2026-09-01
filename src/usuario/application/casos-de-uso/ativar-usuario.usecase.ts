import { Inject, Injectable } from '@nestjs/common';
import {
  RecursoNaoEncontrado,
  RegraDeNegocio,
} from '../../../shared/excecoes/dominio.exception';
import { ehPapelUsuarioInterno } from '../../domain/papel-usuario.enum';
import { Usuario } from '../../domain/usuario.entity';
import { UsuarioId } from '../../domain/usuario-id.value-object';
import { USUARIO_REPOSITORY } from '../../domain/usuario.repository';
import type { UsuarioRepository } from '../../domain/usuario.repository';

/** Reativa um usuário interno. */
@Injectable()
export class AtivarUsuarioUseCase {
  constructor(
    @Inject(USUARIO_REPOSITORY)
    private readonly usuarioRepository: UsuarioRepository,
  ) {}

  async executar(id: string): Promise<Usuario> {
    const usuario = await this.usuarioRepository.buscarPorId(UsuarioId.de(id));
    if (!usuario) throw new RecursoNaoEncontrado('Usuário', id);
    if (!ehPapelUsuarioInterno(usuario.papel)) {
      throw new RegraDeNegocio(
        'Esta operação é restrita a usuários internos da oficina',
      );
    }

    usuario.ativar();
    await this.usuarioRepository.salvar(usuario);
    return usuario;
  }
}
