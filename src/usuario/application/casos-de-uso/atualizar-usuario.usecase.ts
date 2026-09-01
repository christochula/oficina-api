import { Inject, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import {
  DATABASE_TRANSACTION,
  type DatabaseTransactionManager,
} from '../../../shared/database/database-transaction';
import {
  ConflitoDeRecurso,
  RecursoNaoEncontrado,
  RegraDeNegocio,
} from '../../../shared/excecoes/dominio.exception';
import { senhaCompativelComBcrypt } from '../../../shared/utils/bcrypt-password';
import {
  ehPapelUsuarioInterno,
  PapelUsuario,
  PapelUsuarioInterno,
} from '../../domain/papel-usuario.enum';
import { Usuario } from '../../domain/usuario.entity';
import { UsuarioId } from '../../domain/usuario-id.value-object';
import { USUARIO_REPOSITORY } from '../../domain/usuario.repository';
import type { UsuarioRepository } from '../../domain/usuario.repository';
import {
  BLOQUEIO_ADMINISTRADORES_ATIVOS,
  bloqueioUsuario,
} from '../usuario-locks';

export interface AtualizarUsuarioInput {
  id: string;
  nome?: string;
  email?: string;
  papel?: PapelUsuarioInterno;
  senha?: string;
}

/** Atualiza campos permitidos de um usuário interno. */
@Injectable()
export class AtualizarUsuarioUseCase {
  constructor(
    @Inject(USUARIO_REPOSITORY)
    private readonly usuarioRepository: UsuarioRepository,
    @Inject(DATABASE_TRANSACTION)
    private readonly databaseTransaction: DatabaseTransactionManager,
  ) {}

  async executar(input: AtualizarUsuarioInput): Promise<Usuario> {
    this.garantirAlgumCampo(input);
    if (
      input.papel !== undefined &&
      !ehPapelUsuarioInterno(input.papel as PapelUsuario)
    ) {
      throw new RegraDeNegocio(
        'A gestão administrativa aceita somente papéis internos da oficina',
      );
    }
    if (input.senha !== undefined && !senhaCompativelComBcrypt(input.senha)) {
      throw new RegraDeNegocio('Senha deve ter no máximo 72 bytes em UTF-8');
    }
    const email = input.email?.trim().toLowerCase();

    return this.databaseTransaction.executarSerializavel(async () => {
      await this.databaseTransaction.bloquear(BLOQUEIO_ADMINISTRADORES_ATIVOS);
      await this.databaseTransaction.bloquear(bloqueioUsuario(input.id));
      return this.executarProtegido(input, email);
    });
  }

  private async executarProtegido(
    input: AtualizarUsuarioInput,
    email?: string,
  ): Promise<Usuario> {
    const usuario = await this.usuarioRepository.buscarPorId(
      UsuarioId.de(input.id),
    );
    if (!usuario) throw new RecursoNaoEncontrado('Usuário', input.id);
    if (!ehPapelUsuarioInterno(usuario.papel)) {
      throw new RegraDeNegocio(
        'Esta operação é restrita a usuários internos da oficina',
      );
    }

    await this.garantirEmailDisponivel(usuario, email);
    await this.garantirAdministradorRemanescente(usuario, input.papel);
    await this.garantirMecanicoSemOrdensAtivas(usuario, input.papel);

    let senhaHash: string | undefined;
    if (
      input.senha !== undefined &&
      !(await bcrypt.compare(input.senha, usuario.senhaHash))
    ) {
      senhaHash = await bcrypt.hash(input.senha, 10);
    }
    usuario.atualizar({
      nome: input.nome,
      email,
      papel: input.papel,
      senhaHash,
    });
    await this.usuarioRepository.salvar(usuario);
    return usuario;
  }

  private garantirAlgumCampo(input: AtualizarUsuarioInput): void {
    const temCampo =
      input.nome !== undefined ||
      input.email !== undefined ||
      input.papel !== undefined ||
      input.senha !== undefined;
    if (!temCampo) {
      throw new RegraDeNegocio(
        'Ao menos um campo deve ser informado para atualização',
      );
    }
  }

  private async garantirEmailDisponivel(
    usuario: Usuario,
    email?: string,
  ): Promise<void> {
    if (email === undefined || email === usuario.email) return;
    const existente = await this.usuarioRepository.buscarPorEmail(email);
    if (existente && existente.id.valor !== usuario.id.valor) {
      throw new ConflitoDeRecurso(`Email '${email}' já está em uso`);
    }
  }

  private async garantirAdministradorRemanescente(
    usuario: Usuario,
    novoPapel?: PapelUsuarioInterno,
  ): Promise<void> {
    const removeAdministradorAtivo =
      usuario.ativo &&
      usuario.papel === PapelUsuario.ADMINISTRADOR &&
      novoPapel !== undefined &&
      novoPapel !== PapelUsuario.ADMINISTRADOR;
    if (!removeAdministradorAtivo) return;

    const outros = await this.usuarioRepository.contarAdministradoresAtivos(
      usuario.id.valor,
    );
    if (outros === 0) {
      throw new RegraDeNegocio(
        'Não é permitido rebaixar o último administrador ativo',
      );
    }
  }

  private async garantirMecanicoSemOrdensAtivas(
    usuario: Usuario,
    novoPapel?: PapelUsuarioInterno,
  ): Promise<void> {
    const removePapelMecanico =
      usuario.papel === PapelUsuario.MECANICO &&
      novoPapel !== undefined &&
      novoPapel !== PapelUsuario.MECANICO;
    if (!removePapelMecanico) return;

    const ordensAtivas =
      await this.usuarioRepository.contarOrdensNaoTerminaisDoMecanico(
        usuario.id.valor,
      );
    if (ordensAtivas > 0) {
      throw new RegraDeNegocio(
        'Não é permitido alterar o papel de um mecânico com ordens de serviço não finalizadas',
      );
    }
  }
}
