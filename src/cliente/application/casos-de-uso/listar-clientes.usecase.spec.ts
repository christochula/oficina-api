import { ListarClientesUseCase } from './listar-clientes.usecase';

describe('ListarClientesUseCase', () => {
  const mockRepo = {
    salvar: jest.fn(),
    buscarPorId: jest.fn(),
    buscarPorUsuarioId: jest.fn(),
    buscarPorNumeroDoc: jest.fn(),
    listar: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it('propaga paginação e filtros ao repositório', async () => {
    mockRepo.listar.mockResolvedValue({ itens: [], total: 0 });
    const useCase = new ListarClientesUseCase(mockRepo as any);

    await useCase.executar(2, 15, { busca: 'Maria', ativo: true });

    expect(mockRepo.listar).toHaveBeenCalledWith(2, 15, {
      busca: 'Maria',
      ativo: true,
    });
  });

  it('usa filtros vazios quando eles não são informados', async () => {
    mockRepo.listar.mockResolvedValue({ itens: [], total: 0 });
    const useCase = new ListarClientesUseCase(mockRepo as any);

    await useCase.executar(1, 20);

    expect(mockRepo.listar).toHaveBeenCalledWith(1, 20, {});
  });
});
