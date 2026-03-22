import { Veiculo } from './veiculo.entity';
import { VeiculoId } from './veiculo-id.value-object';

/**
 * Token de injeção de dependência para o repositório de veículos.
 * Usado com @Inject(VEICULO_REPOSITORY) nos casos de uso para desacoplar
 * a camada de aplicação da implementação de persistência concreta.
 */
export const VEICULO_REPOSITORY = 'VEICULO_REPOSITORY';

/**
 * Interface do repositório de veículos — contrato da camada de domínio.
 * Define as operações de persistência necessárias sem depender de tecnologia específica.
 * A implementação concreta fica na camada de infraestrutura (PrismaVeiculoRepository).
 */
export interface VeiculoRepository {
  /**
   * Persiste um veículo (inserção ou atualização via upsert).
   * @param veiculo - Aggregate Veiculo com estado atualizado a ser salvo.
   */
  salvar(veiculo: Veiculo): Promise<void>;

  /**
   * Busca um veículo pelo seu identificador interno.
   * @param id - VeiculoId do veículo desejado.
   * @returns O Veiculo encontrado ou null se não existir.
   */
  buscarPorId(id: VeiculoId): Promise<Veiculo | null>;

  /**
   * Busca um veículo pela placa oficial de tráfego.
   * Usado para verificar duplicidade no cadastro e para consultas rápidas no balcão da oficina.
   * @param placa - Placa do veículo (formato padrão Mercosul ou antigo).
   * @returns O Veiculo encontrado ou null se não existir.
   */
  buscarPorPlaca(placa: string): Promise<Veiculo | null>;

  /**
   * Lista veículos de forma paginada, ordenados por placa (ASC).
   * @param pagina - Número da página (base 1).
   * @param porPagina - Quantidade de registros por página.
   * @returns Lista de veículos da página e total geral de registros.
   */
  listar(pagina: number, porPagina: number): Promise<{ itens: Veiculo[]; total: number }>;
}
