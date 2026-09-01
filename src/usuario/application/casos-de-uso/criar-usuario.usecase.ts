import { Inject, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { ConflitoDeRecurso } from '../../../shared/excecoes/dominio.exception';
import { senhaCompativelComBcrypt } from '../../../shared/utils/bcrypt-password';
import { RegraDeNegocio } from '../../../shared/excecoes/dominio.exception';
import { PapelUsuario } from '../../domain/papel-usuario.enum';
import { Usuario } from '../../domain/usuario.entity';
import { USUARIO_REPOSITORY } from '../../domain/usuario.repository';
import type { UsuarioRepository } from '../../domain/usuario.repository';

/**
 * Dados de entrada necessários para criar um novo usuário no sistema.
 */
export interface CriarUsuarioInput {
  nome: string;
  email: string;
  senha: string; // Senha em texto plano — será convertida em hash antes de persistir
  papel: PapelUsuario;
}

/**
 * Caso de uso responsável por criar um novo usuário no sistema da oficina.
 *
 * Verifica unicidade do e-mail antes de persistir, rejeitando com 409 Conflict
 * caso o e-mail já esteja em uso. Aplica hash bcrypt (salt 10) na senha antes
 * de delegar a persistência ao repositório.
 */
@Injectable()
export class CriarUsuarioUseCase {
  /**
   * @param usuarioRepository - Repositório de usuarios injetado via token {@link USUARIO_REPOSITORY}.
   */
  constructor(
    @Inject(USUARIO_REPOSITORY)
    private readonly usuarioRepository: UsuarioRepository,
  ) {}

  /**
   * Executa a criação de um novo usuario.
   * @param input - Dados do usuário a ser criado.
   * @returns A entidade de domínio {@link Usuario} recém-criada e persistida.
   * @throws {ConflitoDeRecurso} se o e-mail informado já estiver em uso.
   */
  async executar(input: CriarUsuarioInput): Promise<Usuario> {
    if (!senhaCompativelComBcrypt(input.senha)) {
      throw new RegraDeNegocio('Senha deve ter no máximo 72 bytes em UTF-8');
    }
    const email = input.email.trim().toLowerCase();
    const existente = await this.usuarioRepository.buscarPorEmail(email);
    if (existente) {
      throw new ConflitoDeRecurso(`Email '${email}' já está em uso`);
    }

    const senhaHash = await bcrypt.hash(input.senha, 10);
    const usuario = Usuario.criar({
      nome: input.nome,
      email,
      senhaHash,
      papel: input.papel,
    });

    await this.usuarioRepository.salvar(usuario);
    return usuario;
  }
}
