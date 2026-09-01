import { Inject, Injectable } from '@nestjs/common';
import {
  DATABASE_TRANSACTION,
  type DatabaseTransactionManager,
} from '../../../shared/database/database-transaction';
import {
  RecursoNaoEncontrado,
  RegraDeNegocio,
} from '../../../shared/excecoes/dominio.exception';
import {
  ehPapelUsuarioInterno,
  PapelUsuario,
} from '../../domain/papel-usuario.enum';
import { Usuario } from '../../domain/usuario.entity';
import { UsuarioId } from '../../domain/usuario-id.value-object';
import { USUARIO_REPOSITORY } from '../../domain/usuario.repository';
import type { UsuarioRepository } from '../../domain/usuario.repository';
import {
  BLOQUEIO_ADMINISTRADORES_ATIVOS,
  bloqueioUsuario,
} from '../usuario-locks';

/** Desativa um usuário interno preservando ao menos um administrador ativo. */
@Injectable()
export class DesativarUsuarioUseCase {
  constructor(
    @Inject(USUARIO_REPOSITORY)
    private readonly usuarioRepository: UsuarioRepository,
    @Inject(DATABASE_TRANSACTION)
    private readonly databaseTransaction: DatabaseTransactionManager,
  ) {}

  async executar(id: string, usuarioAtualId: string): Promise<Usuario> {
    if (id === usuarioAtualId) {
      throw new RegraDeNegocio('Não é permitido desativar o próprio usuário');
    }

    return this.databaseTransaction.executarSerializavel(async () => {
      await this.databaseTransaction.bloquear(BLOQUEIO_ADMINISTRADORES_ATIVOS);
      await this.databaseTransaction.bloquear(bloqueioUsuario(id));
      return this.executarProtegido(id);
    });
  }

  private async executarProtegido(id: string): Promise<Usuario> {
    const usuario = await this.usuarioRepository.buscarPorId(UsuarioId.de(id));
    if (!usuario) throw new RecursoNaoEncontrado('Usuário', id);
    if (!ehPapelUsuarioInterno(usuario.papel)) {
      throw new RegraDeNegocio(
        'Esta operação é restrita a usuários internos da oficina',
      );
    }

    if (usuario.ativo && usuario.papel === PapelUsuario.MECANICO) {
      const ordensAtivas =
        await this.usuarioRepository.contarOrdensNaoTerminaisDoMecanico(
          usuario.id.valor,
        );
      if (ordensAtivas > 0) {
        throw new RegraDeNegocio(
          'Não é permitido desativar um mecânico com ordens de serviço não finalizadas',
        );
      }
    }

    if (usuario.ativo && usuario.papel === PapelUsuario.ADMINISTRADOR) {
      const outros = await this.usuarioRepository.contarAdministradoresAtivos(
        usuario.id.valor,
      );
      if (outros === 0) {
        throw new RegraDeNegocio(
          'Não é permitido desativar o último administrador ativo',
        );
      }
    }

    usuario.desativar();
    await this.usuarioRepository.salvar(usuario);
    return usuario;
  }
}
