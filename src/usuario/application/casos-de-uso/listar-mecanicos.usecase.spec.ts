import { ListarMecanicosUseCase } from './listar-mecanicos.usecase';

describe('ListarMecanicosUseCase', () => {
  const mockRepo = {
    salvar: jest.fn(),
    buscarPorId: jest.fn(),
    buscarPorEmail: jest.fn(),
    listarMecanicos: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it('propaga paginação e filtros ao repositório', async () => {
    mockRepo.listarMecanicos.mockResolvedValue({ itens: [], total: 0 });
    const useCase = new ListarMecanicosUseCase(mockRepo as any);

    await useCase.executar(2, 10, { busca: 'Carlos', ativo: true });

    expect(mockRepo.listarMecanicos).toHaveBeenCalledWith(2, 10, {
      busca: 'Carlos',
      ativo: true,
    });
  });

  it('usa filtros vazios quando eles não são informados', async () => {
    mockRepo.listarMecanicos.mockResolvedValue({ itens: [], total: 0 });
    const useCase = new ListarMecanicosUseCase(mockRepo as any);

    await useCase.executar(1, 20);

    expect(mockRepo.listarMecanicos).toHaveBeenCalledWith(1, 20, {});
  });
});
