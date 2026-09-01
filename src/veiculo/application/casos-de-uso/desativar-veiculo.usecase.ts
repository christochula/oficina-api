import { Inject, Injectable } from '@nestjs/common';
import { RecursoNaoEncontrado } from '../../../shared/excecoes/dominio.exception';
import { Veiculo } from '../../domain/veiculo.entity';
import { VEICULO_REPOSITORY } from '../../domain/veiculo.repository';
import type { VeiculoRepository } from '../../domain/veiculo.repository';
import { VeiculoId } from '../../domain/veiculo-id.value-object';

@Injectable()
export class DesativarVeiculoUseCase {
  constructor(
    @Inject(VEICULO_REPOSITORY)
    private readonly veiculoRepository: VeiculoRepository,
  ) {}

  async executar(id: string): Promise<Veiculo> {
    const veiculo = await this.veiculoRepository.buscarPorId(VeiculoId.de(id));
    if (!veiculo) throw new RecursoNaoEncontrado('Veículo', id);

    veiculo.desativar();
    await this.veiculoRepository.salvar(veiculo);
    return veiculo;
  }
}
