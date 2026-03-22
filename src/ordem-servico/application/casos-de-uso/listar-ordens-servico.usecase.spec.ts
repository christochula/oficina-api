import { ListarOrdensServicoUseCase } from './listar-ordens-servico.usecase';
import { OrdemServico } from '../../domain/ordem-servico.entity';

const mockOsRepo = { listar: jest.fn(), buscarPorId: jest.fn() };

function criarUseCase() {
  return new ListarOrdensServicoUseCase(mockOsRepo as any);
}

describe('ListarOrdensServicoUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deve retornar lista paginada de OS', async () => {
    const os = OrdemServico.abrir({
      clienteId: 'cl_01',
      veiculoId: 've_01',
      problemasRelatados: [{ descricao: 'Motor' }],
    });
    mockOsRepo.listar.mockResolvedValue({ itens: [os], total: 1 });

    const uc = criarUseCase();
    const resultado = await uc.executar({ pagina: 1, porPagina: 20 });

    expect(resultado.data).toHaveLength(1);
    expect(resultado.meta.total).toBe(1);
    expect(resultado.meta.pagina).toBe(1);
    expect(resultado.meta.porPagina).toBe(20);
  });

  it('deve usar valores padrão de paginação quando não fornecidos', async () => {
    mockOsRepo.listar.mockResolvedValue({ itens: [], total: 0 });

    const uc = criarUseCase();
    await uc.executar({});

    expect(mockOsRepo.listar).toHaveBeenCalledWith(
      expect.objectContaining({ pagina: 1, porPagina: 20 }),
    );
  });

  it('deve calcular totalPaginas corretamente', async () => {
    mockOsRepo.listar.mockResolvedValue({ itens: [], total: 100 });

    const uc = criarUseCase();
    const resultado = await uc.executar({ pagina: 1, porPagina: 20 });
    expect(resultado.meta.totalPaginas).toBe(5);
  });
});
