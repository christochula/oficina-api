import { RecursoNaoEncontrado } from '../../../shared/excecoes/dominio.exception';
import { Veiculo } from '../../domain/veiculo.entity';
import { DesativarVeiculoUseCase } from './desativar-veiculo.usecase';

const mockRepo = {
  salvar: jest.fn(),
  buscarPorId: jest.fn(),
  buscarPorPlaca: jest.fn(),
  listar: jest.fn(),
};

describe('DesativarVeiculoUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deve desativar veículo existente', async () => {
    const veiculo = Veiculo.criar({
      placa: 'ABC1234',
      renavam: '12345678901',
      chassi: '9BWZZZ377VT004251',
      marca: 'Toyota',
      modelo: 'Corolla',
      ano: 2020,
      cor: 'Prata',
    });
    mockRepo.buscarPorId.mockResolvedValue(veiculo);

    const useCase = new DesativarVeiculoUseCase(mockRepo as any);
    const resultado = await useCase.executar(veiculo.id.valor);

    expect(resultado.ativo).toBe(false);
  });

  it('deve lançar quando veículo não existir', async () => {
    mockRepo.buscarPorId.mockResolvedValue(null);
    const useCase = new DesativarVeiculoUseCase(mockRepo as any);

    await expect(useCase.executar('ve_404')).rejects.toThrow(
      RecursoNaoEncontrado,
    );
  });
});
