import { Inject, Injectable } from '@nestjs/common';
import { RecursoNaoEncontrado } from '../../../shared/excecoes/dominio.exception';
import { Cliente } from '../../domain/cliente.entity';
import { ClienteId } from '../../domain/cliente-id.value-object';
import { CLIENTE_REPOSITORY } from '../../domain/cliente.repository';
import type { ClienteRepository } from '../../domain/cliente.repository';

@Injectable()
export class AtivarClienteUseCase {
  constructor(
    @Inject(CLIENTE_REPOSITORY)
    private readonly clienteRepository: ClienteRepository,
  ) {}

  async executar(id: string): Promise<Cliente> {
    const cliente = await this.clienteRepository.buscarPorId(ClienteId.de(id));
    if (!cliente) throw new RecursoNaoEncontrado('Cliente', id);

    cliente.ativar();
    await this.clienteRepository.salvar(cliente);
    return cliente;
  }
}
