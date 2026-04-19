import { Veiculo } from '../../domain/veiculo.entity';
import { AtivarVeiculoUseCase } from './ativar-veiculo.usecase';

const mockRepo = {
  salvar: jest.fn(),
  buscarPorId: jest.fn(),
  buscarPorPlaca: jest.fn(),
  listar: jest.fn(),
};

describe('AtivarVeiculoUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deve ativar veículo', async () => {
    const veiculo = Veiculo.criar({
      placa: 'ABC1234', renavam: '12345678901', chassi: '9BWZZZ377VT004251',
      marca: 'Toyota', modelo: 'Corolla', ano: 2020, cor: 'Prata', ativo: false,
    });
    veiculo.desativar();
    mockRepo.buscarPorId.mockResolvedValue(veiculo);

    const useCase = new AtivarVeiculoUseCase(mockRepo as any);
    const resultado = await useCase.executar(veiculo.id.valor);

    expect(resultado.ativo).toBe(true);
  });
});
