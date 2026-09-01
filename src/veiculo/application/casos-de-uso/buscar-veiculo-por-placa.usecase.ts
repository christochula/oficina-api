import { Inject, Injectable } from '@nestjs/common';
import { RecursoNaoEncontrado } from '../../../shared/excecoes/dominio.exception';
import { Veiculo } from '../../domain/veiculo.entity';
import { VEICULO_REPOSITORY } from '../../domain/veiculo.repository';
import type { VeiculoRepository } from '../../domain/veiculo.repository';

/**
 * Caso de uso responsável por localizar um veículo pela placa de tráfego.
 * Serve como ponto de entrada para consultas da rota GET /veiculos/placa/:placa,
 * permitindo que consultores técnicos identifiquem o veículo no momento da abertura de uma OS.
 */
@Injectable()
export class BuscarVeiculoPorPlacaUseCase {
  /**
   * @param veiculoRepository - Repositório de veículos injetado via token VEICULO_REPOSITORY.
   */
  constructor(
    @Inject(VEICULO_REPOSITORY)
    private readonly veiculoRepository: VeiculoRepository,
  ) {}

  /**
   * Executa a busca do veículo pela placa informada.
   * @param placa - Placa do veículo (formato Mercosul ou padrão antigo).
   * @returns O aggregate Veiculo encontrado.
   * @throws RecursoNaoEncontrado se nenhum veículo possuir a placa informada.
   */
  async executar(placa: string): Promise<Veiculo> {
    // Normaliza antes de buscar: aceita "ABC-1234", "abc1d23" etc.
    const placaNormalizada = placa.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const veiculo =
      await this.veiculoRepository.buscarPorPlaca(placaNormalizada);
    if (!veiculo) throw new RecursoNaoEncontrado('Veículo', placaNormalizada);
    return veiculo;
  }
}
