import { Inject, Injectable } from '@nestjs/common';
import { ConflitoDeRecurso, RecursoNaoEncontrado, RegraDeNegocio } from '../../../shared/excecoes/dominio.exception';
import { PapelUsuario } from '../../../usuario/domain/papel-usuario.enum';
import { UsuarioId } from '../../../usuario/domain/usuario-id.value-object';
import { USUARIO_REPOSITORY } from '../../../usuario/domain/usuario.repository';
import type { UsuarioRepository } from '../../../usuario/domain/usuario.repository';
import { Cliente } from '../../domain/cliente.entity';
import { ClienteId } from '../../domain/cliente-id.value-object';
import { CLIENTE_REPOSITORY } from '../../domain/cliente.repository';
import type { ClienteRepository } from '../../domain/cliente.repository';

/**
 * DTO de entrada para o caso de uso de atualização de cliente.
 * Contém apenas os campos permitidos para edição.
 * tipoDoc e numeroDoc são intencionalmente omitidos pois são imutáveis.
 */
export interface AtualizarClienteInput {
  /** Identificador interno do cliente (ClienteId com prefixo "cl"). */
  id: string;
  nome?: string;
  email?: string;
  telefone?: string;
  /** Vinculo opcional com usuario autenticavel. Use null para remover o vinculo. */
  usuarioId?: string | null;
  /** Campos de endereço que serão atualizados; campos ausentes mantêm o valor existente. */
  endereco?: {
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    estado?: string;
    cep?: string;
  };
}

/**
 * Caso de uso responsável por atualizar os dados editáveis de um cliente existente.
 * Aplica a regra de negócio de que tipoDoc e numeroDoc são imutáveis —
 * esses campos não fazem parte do input e não são alterados pela entidade.
 */
@Injectable()
export class AtualizarClienteUseCase {
  /**
   * @param clienteRepository - Repositório de clientes injetado via token CLIENTE_REPOSITORY.
   */
  constructor(
    @Inject(CLIENTE_REPOSITORY)
    private readonly clienteRepository: ClienteRepository,
    @Inject(USUARIO_REPOSITORY)
    private readonly usuarioRepository: UsuarioRepository,
  ) {}

  /**
   * Localiza o cliente, aplica as alterações permitidas e persiste o resultado.
   * @param input - Dados de atualização, incluindo o id do cliente e campos opcionais.
   * @returns O aggregate Cliente com o estado atualizado.
   * @throws RecursoNaoEncontrado se nenhum cliente for encontrado com o id informado.
   */
  async executar(input: AtualizarClienteInput): Promise<Cliente> {
    const cliente = await this.clienteRepository.buscarPorId(ClienteId.de(input.id));
    if (!cliente) throw new RecursoNaoEncontrado('Cliente', input.id);

    const usuarioId = await this.resolverUsuarioAssociado(cliente, input);
    cliente.atualizar({
      nome: input.nome,
      email: input.email,
      telefone: input.telefone,
      usuarioId,
      endereco: input.endereco,
    });

    await this.clienteRepository.salvar(cliente);
    return cliente;
  }

  private async resolverUsuarioAssociado(
    cliente: Cliente,
    input: AtualizarClienteInput,
  ): Promise<string | null | undefined> {
    if (input.usuarioId === null) return null;

    if (input.usuarioId) {
      const usuario = await this.usuarioRepository.buscarPorId(UsuarioId.de(input.usuarioId));
      if (!usuario) throw new RecursoNaoEncontrado('Usuário', input.usuarioId);
      if (usuario.papel !== PapelUsuario.CLIENTE) {
        throw new RegraDeNegocio('Apenas usuários com papel CLIENTE podem ser vinculados a clientes.');
      }

      const clienteExistente = await this.clienteRepository.buscarPorUsuarioId(input.usuarioId);
      if (clienteExistente && clienteExistente.id.valor !== cliente.id.valor) {
        throw new ConflitoDeRecurso(`Usuário '${input.usuarioId}' já está vinculado a outro cliente.`);
      }
      return usuario.id.valor;
    }

    if (cliente.usuarioId) return undefined;

    const email = input.email ?? cliente.email;
    const usuario = await this.usuarioRepository.buscarPorEmail(email);
    if (!usuario || usuario.papel !== PapelUsuario.CLIENTE) return undefined;

    const clienteExistente = await this.clienteRepository.buscarPorUsuarioId(usuario.id.valor);
    if (clienteExistente && clienteExistente.id.valor !== cliente.id.valor) return undefined;
    return usuario.id.valor;
  }
}
