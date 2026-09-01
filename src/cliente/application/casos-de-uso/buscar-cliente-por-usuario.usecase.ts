import { Inject, Injectable } from '@nestjs/common';
import { AcessoNegado } from '../../../shared/excecoes/dominio.exception';
import { Cliente } from '../../domain/cliente.entity';
import { CLIENTE_REPOSITORY } from '../../domain/cliente.repository';
import type { ClienteRepository } from '../../domain/cliente.repository';
import { ClienteId } from '../../domain/cliente-id.value-object';

/**
 * Resolve o aggregate Cliente associado ao usuário autenticado com papel CLIENTE.
 * Centraliza a validação do vínculo persistido entre Usuario e Cliente.
 */
@Injectable()
export class BuscarClientePorUsuarioUseCase {
  constructor(
    @Inject(CLIENTE_REPOSITORY)
    private readonly clienteRepository: ClienteRepository,
  ) {}

  /**
   * Busca o cliente associado ao usuário autenticado.
   * @param usuarioId - ID do usuário autenticado (prefixo "us").
   * @returns Cliente associado e ativo.
   * @throws AcessoNegado se não houver vínculo ou se o cliente estiver inativo.
   */
  async executar(usuarioOuClienteId: string): Promise<Cliente> {
    const cliente = usuarioOuClienteId.startsWith('cl')
      ? await this.clienteRepository.buscarPorId(
          ClienteId.de(usuarioOuClienteId),
        )
      : await this.clienteRepository.buscarPorUsuarioId(usuarioOuClienteId);
    if (!cliente || !cliente.ativo) {
      throw new AcessoNegado(
        'Identidade CLIENTE não está vinculada a um cliente ativo.',
      );
    }
    return cliente;
  }
}
