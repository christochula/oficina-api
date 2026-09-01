import { Inject, Injectable } from '@nestjs/common';
import { RecursoNaoEncontrado } from '../../../shared/excecoes/dominio.exception';
import { Veiculo } from '../../domain/veiculo.entity';
import { VeiculoId } from '../../domain/veiculo-id.value-object';
import { VEICULO_REPOSITORY } from '../../domain/veiculo.repository';
import type { VeiculoRepository } from '../../domain/veiculo.repository';

/**
 * DTO de entrada para o caso de uso de atualização de veículo.
 * Contém apenas os campos permitidos para edição — cor e quilometragem.
 * Placa, RENAVAM e chassi são intencionalmente omitidos pois são imutáveis.
 */
export interface AtualizarVeiculoInput {
  /** Identificador interno do veículo (VeiculoId com prefixo "ve"). */
  id: string;
  /** Nova cor do veículo, caso tenha sido repintado ou personalizado. */
  cor?: string;
  /** Quilometragem atual do veículo, atualizada a cada visita à oficina. */
  quilometragem?: number;
}

/**
 * Caso de uso responsável por atualizar os dados editáveis de um veículo existente.
 * Aplica a regra de negócio de que placa, RENAVAM e chassi são imutáveis —
 * esses campos não fazem parte do input e não são alterados pela entidade.
 */
@Injectable()
export class AtualizarVeiculoUseCase {
  /**
   * @param veiculoRepository - Repositório de veículos injetado via token VEICULO_REPOSITORY.
   */
  constructor(
    @Inject(VEICULO_REPOSITORY)
    private readonly veiculoRepository: VeiculoRepository,
  ) {}

  /**
   * Localiza o veículo, aplica as alterações permitidas e persiste o resultado.
   * @param input - Dados de atualização, incluindo o id do veículo e campos opcionais.
   * @returns O aggregate Veiculo com o estado atualizado.
   * @throws RecursoNaoEncontrado se nenhum veículo for encontrado com o id informado.
   */
  async executar(input: AtualizarVeiculoInput): Promise<Veiculo> {
    const veiculo = await this.veiculoRepository.buscarPorId(
      VeiculoId.de(input.id),
    );
    if (!veiculo) throw new RecursoNaoEncontrado('Veículo', input.id);

    veiculo.atualizar({ cor: input.cor, quilometragem: input.quilometragem });
    await this.veiculoRepository.salvar(veiculo);
    return veiculo;
  }
}
