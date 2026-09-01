import { AtualizarVeiculoUseCase } from './atualizar-veiculo.usecase';
import { Veiculo } from '../../domain/veiculo.entity';
import { VeiculoId } from '../../domain/veiculo-id.value-object';
import { RecursoNaoEncontrado } from '../../../shared/excecoes/dominio.exception';

const mockRepo = {
  buscarPorId: jest.fn(),
  salvar: jest.fn(),
  buscarPorPlaca: jest.fn(),
  listar: jest.fn(),
};

function criarUseCase() {
  return new AtualizarVeiculoUseCase(mockRepo as any);
}

function veiculoFake() {
  return Veiculo.reconstituir({
    id: VeiculoId.novo(),
    placa: 'ABC1234',
    renavam: '12345678901',
    chassi: '9BWZZZ377VT004251',
    marca: 'Toyota',
    modelo: 'Corolla',
    ano: 2020,
    cor: 'Prata',
    quilometragem: 10000,
    criadoEm: new Date(),
    atualizadoEm: new Date(),
  });
}

describe('AtualizarVeiculoUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deve lançar RecursoNaoEncontrado se veículo não existir', async () => {
    mockRepo.buscarPorId.mockResolvedValue(null);

    const uc = criarUseCase();
    await expect(uc.executar({ id: 've_01', cor: 'Azul' })).rejects.toThrow(
      RecursoNaoEncontrado,
    );
  });

  it('deve atualizar cor do veículo e salvar', async () => {
    const veiculo = veiculoFake();
    mockRepo.buscarPorId.mockResolvedValue(veiculo);
    mockRepo.salvar.mockResolvedValue(undefined);

    const uc = criarUseCase();
    const resultado = await uc.executar({ id: veiculo.id.valor, cor: 'Azul' });

    expect(resultado.cor).toBe('Azul');
    expect(mockRepo.salvar).toHaveBeenCalledWith(veiculo);
  });

  it('deve atualizar quilometragem do veículo', async () => {
    const veiculo = veiculoFake();
    mockRepo.buscarPorId.mockResolvedValue(veiculo);
    mockRepo.salvar.mockResolvedValue(undefined);

    const uc = criarUseCase();
    const resultado = await uc.executar({
      id: veiculo.id.valor,
      quilometragem: 25000,
    });
    expect(resultado.quilometragem).toBe(25000);
  });

  it('não deve alterar placa, renavam e chassi', async () => {
    const veiculo = veiculoFake();
    mockRepo.buscarPorId.mockResolvedValue(veiculo);
    mockRepo.salvar.mockResolvedValue(undefined);

    const uc = criarUseCase();
    await uc.executar({ id: veiculo.id.valor, cor: 'Verde' });

    expect(veiculo.placa).toBe('ABC1234');
    expect(veiculo.renavam).toBe('12345678901');
    expect(veiculo.chassi).toBe('9BWZZZ377VT004251');
  });
});
