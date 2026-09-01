import { EntidadeBase } from '../../shared/domain/entidade-base';
import { VeiculoId } from './veiculo-id.value-object';

/**
 * Interface interna que define as propriedades necessárias
 * para construir ou reconstituir um Veículo.
 * Usada exclusivamente pelos factory methods da entidade.
 */
interface PropriedadesVeiculo {
  id?: VeiculoId;
  placa: string;
  renavam: string;
  chassi: string;
  marca: string;
  modelo: string;
  ano: number;
  cor: string;
  quilometragem?: number;
  ativo?: boolean;
  criadoEm?: Date;
  atualizadoEm?: Date;
}

/**
 * Aggregate Root que representa um veículo cadastrado na oficina.
 * Placa, RENAVAM e chassi são identificadores oficiais imutáveis após o cadastro —
 * qualquer alteração nesses dados exige recadastro do veículo.
 * O Veiculo não possui vínculo permanente com um Cliente; essa associação
 * existe apenas no contexto de uma OrdemServico específica.
 */
export class Veiculo extends EntidadeBase<VeiculoId> {
  readonly placa: string; // imutável — identificador oficial de tráfego do veículo
  readonly renavam: string; // imutável — registro nacional de veículos automotores
  readonly chassi: string; // imutável — número único gravado na estrutura do veículo
  marca: string;
  modelo: string;
  ano: number;
  cor: string; // pode mudar (repintura, personalização)
  quilometragem: number; // atualizado a cada visita à oficina
  ativo: boolean; // false indica veículo inativado (soft delete)

  /**
   * Construtor privado — use os factory methods `criar` ou `reconstituir`.
   * @param props - Propriedades completas para inicializar o aggregate.
   */
  private constructor(props: PropriedadesVeiculo) {
    super(props.id ?? VeiculoId.novo(), props.criadoEm, props.atualizadoEm);
    this.placa = props.placa;
    this.renavam = props.renavam;
    this.chassi = props.chassi;
    this.marca = props.marca;
    this.modelo = props.modelo;
    this.ano = props.ano;
    this.cor = props.cor;
    this.quilometragem = props.quilometragem ?? 0;
    this.ativo = props.ativo ?? true;
  }

  /**
   * Cria um novo veículo a partir dos dados fornecidos.
   * Gera automaticamente um novo VeiculoId e define quilometragem = 0 e ativo = true por padrão.
   * @param props - Dados obrigatórios para o registro, sem id nem timestamps.
   * @returns Nova instância de Veiculo pronta para ser persistida.
   */
  static criar(
    props: Omit<PropriedadesVeiculo, 'id' | 'criadoEm' | 'atualizadoEm'>,
  ): Veiculo {
    return new Veiculo(props);
  }

  /**
   * Reconstitui um Veiculo a partir de dados carregados da persistência.
   * Restaura o estado completo da entidade, incluindo id e timestamps originais.
   * @param props - Dados completos incluindo id, criadoEm e atualizadoEm.
   * @returns Instância de Veiculo com estado idêntico ao armazenado no banco.
   */
  static reconstituir(
    props: Required<
      Pick<PropriedadesVeiculo, 'id' | 'criadoEm' | 'atualizadoEm'>
    > &
      PropriedadesVeiculo,
  ): Veiculo {
    return new Veiculo(props);
  }

  /**
   * Atualiza os campos editáveis do veículo.
   * Placa, RENAVAM e chassi são imutáveis e não podem ser alterados por este método.
   * Atualiza automaticamente o timestamp atualizadoEm ao final.
   * @param dados - Objeto parcial com cor e/ou quilometragem a serem atualizados.
   */
  atualizar(dados: { cor?: string; quilometragem?: number }): void {
    if (dados.cor !== undefined) this.cor = dados.cor;
    if (dados.quilometragem !== undefined)
      this.quilometragem = dados.quilometragem;
    this.tocarAtualizadoEm();
  }

  /** Inativa o veículo (soft delete). */
  desativar(): void {
    this.ativo = false;
    this.tocarAtualizadoEm();
  }

  /** Reativa o veículo. */
  ativar(): void {
    this.ativo = true;
    this.tocarAtualizadoEm();
  }
}
