import { BuscarVeiculoPorPlacaUseCase } from './buscar-veiculo-por-placa.usecase';
import { RecursoNaoEncontrado } from '../../../shared/excecoes/dominio.exception';
import { Veiculo } from '../../domain/veiculo.entity';

const mockRepo = {
  buscarPorPlaca: jest.fn(),
  salvar: jest.fn(),
  buscarPorId: jest.fn(),
  listar: jest.fn(),
};

function criarUseCase() {
  return new BuscarVeiculoPorPlacaUseCase(mockRepo as any);
}

function veiculoFake() {
  return Veiculo.criar({
    placa: 'ABC1234',
    renavam: '12345678901',
    chassi: '9BWZZZ377VT004251',
    marca: 'Toyota',
    modelo: 'Corolla',
    ano: 2020,
    cor: 'Prata',
  });
}

describe('BuscarVeiculoPorPlacaUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deve normalizar a placa antes de buscar', async () => {
    mockRepo.buscarPorPlaca.mockResolvedValue(veiculoFake());

    const uc = criarUseCase();
    await uc.executar('abc-1234');
    expect(mockRepo.buscarPorPlaca).toHaveBeenCalledWith('ABC1234');
  });

  it('deve retornar o veículo encontrado', async () => {
    const veiculo = veiculoFake();
    mockRepo.buscarPorPlaca.mockResolvedValue(veiculo);

    const uc = criarUseCase();
    const resultado = await uc.executar('ABC1234');
    expect(resultado).toBe(veiculo);
  });

  it('deve lançar RecursoNaoEncontrado se veículo não existir', async () => {
    mockRepo.buscarPorPlaca.mockResolvedValue(null);

    const uc = criarUseCase();
    await expect(uc.executar('XYZ9999')).rejects.toThrow(RecursoNaoEncontrado);
  });
});
