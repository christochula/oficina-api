import { CriarVeiculoUseCase } from './criar-veiculo.usecase';
import { ConflitoDeRecurso } from '../../../shared/excecoes/dominio.exception';

const mockRepo = {
  buscarPorPlaca: jest.fn(),
  salvar: jest.fn(),
  buscarPorId: jest.fn(),
  listar: jest.fn(),
};

function criarUseCase() {
  return new CriarVeiculoUseCase(mockRepo as any);
}

const inputBase = {
  placa: 'ABC1234',
  renavam: '12345678901',
  chassi: '9BWZZZ377VT004251',
  marca: 'Toyota',
  modelo: 'Corolla',
  ano: 2020,
  cor: 'Prata',
};

describe('CriarVeiculoUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deve normalizar placa para maiúsculas e remover separadores', async () => {
    mockRepo.buscarPorPlaca.mockResolvedValue(null);
    mockRepo.salvar.mockResolvedValue(undefined);

    const uc = criarUseCase();
    await uc.executar({ ...inputBase, placa: 'abc-1234' });

    expect(mockRepo.buscarPorPlaca).toHaveBeenCalledWith('ABC1234');
  });

  it('deve lançar ConflitoDeRecurso se placa já existir', async () => {
    mockRepo.buscarPorPlaca.mockResolvedValue({ id: 've_01' });

    const uc = criarUseCase();
    await expect(uc.executar(inputBase)).rejects.toThrow(ConflitoDeRecurso);
  });

  it('deve salvar e retornar o veículo criado', async () => {
    mockRepo.buscarPorPlaca.mockResolvedValue(null);
    mockRepo.salvar.mockResolvedValue(undefined);

    const uc = criarUseCase();
    const veiculo = await uc.executar(inputBase);

    expect(mockRepo.salvar).toHaveBeenCalledTimes(1);
    expect(veiculo.placa).toBe('ABC1234');
    expect(veiculo.marca).toBe('Toyota');
  });

  it('deve normalizar placa Mercosul (minúsculas com hífen)', async () => {
    mockRepo.buscarPorPlaca.mockResolvedValue(null);
    mockRepo.salvar.mockResolvedValue(undefined);

    const uc = criarUseCase();
    await uc.executar({ ...inputBase, placa: 'abc1d23' });
    expect(mockRepo.buscarPorPlaca).toHaveBeenCalledWith('ABC1D23');
  });
});
