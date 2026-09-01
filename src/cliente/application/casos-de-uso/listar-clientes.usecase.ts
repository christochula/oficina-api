import { Inject, Injectable } from '@nestjs/common';
import { Cliente } from '../../domain/cliente.entity';
import { CLIENTE_REPOSITORY } from '../../domain/cliente.repository';
import type { ClienteRepository } from '../../domain/cliente.repository';

/** Resultado paginado da listagem de clientes. */
export interface ListarClientesOutput {
  itens: Cliente[];
  total: number;
}

/**
 * Caso de uso que lista clientes de forma paginada, ordenados por nome.
 * Utilizado pelo consultor técnico para localizar clientes no balcão.
 */
@Injectable()
export class ListarClientesUseCase {
  constructor(
    @Inject(CLIENTE_REPOSITORY)
    private readonly clienteRepository: ClienteRepository,
  ) {}

  async executar(
    pagina: number,
    porPagina: number,
  ): Promise<ListarClientesOutput> {
    return this.clienteRepository.listar(pagina, porPagina);
  }
}
