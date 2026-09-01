import { Inject, Injectable } from '@nestjs/common';
import { Veiculo } from '../../domain/veiculo.entity';
import { VEICULO_REPOSITORY } from '../../domain/veiculo.repository';
import type { VeiculoRepository } from '../../domain/veiculo.repository';

/** Resultado paginado da listagem de veículos. */
export interface ListarVeiculosOutput {
  itens: Veiculo[];
  total: number;
}

/**
 * Caso de uso que lista veículos de forma paginada, ordenados por placa.
 * Utilizado pelo consultor técnico para localizar veículos no balcão.
 */
@Injectable()
export class ListarVeiculosUseCase {
  constructor(
    @Inject(VEICULO_REPOSITORY)
    private readonly veiculoRepository: VeiculoRepository,
  ) {}

  async executar(
    pagina: number,
    porPagina: number,
  ): Promise<ListarVeiculosOutput> {
    return this.veiculoRepository.listar(pagina, porPagina);
  }
}
