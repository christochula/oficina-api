import { Inject, Injectable } from '@nestjs/common';
import { ConflitoDeRecurso } from '../../../shared/excecoes/dominio.exception';
import { Veiculo } from '../../domain/veiculo.entity';
import { VEICULO_REPOSITORY } from '../../domain/veiculo.repository';
import type { VeiculoRepository } from '../../domain/veiculo.repository';

/**
 * DTO de entrada para o caso de uso de registro de veículo.
 * Contém todos os dados necessários para o primeiro cadastro,
 * incluindo placa, RENAVAM e chassi que serão imutáveis após a criação.
 */
export interface CriarVeiculoInput {
  /** Placa do veículo (formato Mercosul ou padrão antigo). Imutável após o cadastro. */
  placa: string;
  /** Registro Nacional de Veículos Automotores — número oficial de licenciamento. Imutável após o cadastro. */
  renavam: string;
  /** Número de identificação único gravado na estrutura do veículo. Imutável após o cadastro. */
  chassi: string;
  marca: string;
  modelo: string;
  /** Ano de fabricação do veículo. Mínimo: 1900. */
  ano: number;
  cor: string;
  /** Quilometragem atual do veículo. Padrão: 0 se não informado. */
  quilometragem?: number;
}

/**
 * Caso de uso responsável pelo registro de novos veículos na oficina.
 * Garante a unicidade pela placa antes de persistir.
 * Retorna 409 Conflict se já existir um veículo com a mesma placa.
 */
@Injectable()
export class CriarVeiculoUseCase {
  /**
   * @param veiculoRepository - Repositório de veículos injetado via token VEICULO_REPOSITORY.
   */
  constructor(
    @Inject(VEICULO_REPOSITORY)
    private readonly veiculoRepository: VeiculoRepository,
  ) {}

  /**
   * Executa o registro de um novo veículo após verificar unicidade da placa.
   * @param input - Dados do novo veículo, incluindo placa, RENAVAM e chassi.
   * @returns O aggregate Veiculo recém-criado e persistido.
   * @throws ConflitoDeRecurso se já existir um veículo com a mesma placa.
   */
  async executar(input: CriarVeiculoInput): Promise<Veiculo> {
    // Normaliza a placa: uppercase e remove qualquer separador (ex: "abc-1234" → "ABC1234").
    // O front-end é responsável por aplicar máscaras de exibição.
    const placaNormalizada = input.placa.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const inputNormalizado = { ...input, placa: placaNormalizada };

    const existente = await this.veiculoRepository.buscarPorPlaca(placaNormalizada);
    if (existente) {
      throw new ConflitoDeRecurso(`Já existe um veículo com a placa '${placaNormalizada}'`);
    }

    const veiculo = Veiculo.criar(inputNormalizado);
    await this.veiculoRepository.salvar(veiculo);
    return veiculo;
  }
}
