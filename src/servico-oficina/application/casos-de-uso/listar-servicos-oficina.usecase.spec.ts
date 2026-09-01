import { ListarServicosOficinaUseCase } from './listar-servicos-oficina.usecase';

describe('ListarServicosOficinaUseCase', () => {
  const mockRepo = {
    salvar: jest.fn(),
    buscarPorId: jest.fn(),
    listar: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it('deve delegar listagem paginada ao repositório', async () => {
    mockRepo.listar.mockResolvedValue({
      itens: [{ id: { valor: 'sv_01' }, nome: 'Alinhamento' }],
      total: 1,
    });

    const useCase = new ListarServicosOficinaUseCase(mockRepo as any);
    const resultado = await useCase.executar(1, 10);

    expect(resultado.total).toBe(1);
    expect(mockRepo.listar).toHaveBeenCalledWith(1, 10);
  });
});
