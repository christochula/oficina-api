import { ListarOrdensServicoUseCase } from './listar-ordens-servico.usecase';
import { OrdemServico } from '../../domain/ordem-servico.entity';
import { StatusOrdemServico } from '../../domain/status-ordem-servico.enum';

const mockOsRepo = { listar: jest.fn(), buscarPorId: jest.fn() };

function criarUseCase() {
  return new ListarOrdensServicoUseCase(mockOsRepo as any);
}

describe('ListarOrdensServicoUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deve retornar lista paginada de OS', async () => {
    const osExecucao = { id: { valor: 'os_exec' } } as unknown as OrdemServico;
    const osAguardando = { id: { valor: 'os_aguard' } } as unknown as OrdemServico;

    mockOsRepo.listar.mockImplementation(async (filtros: { status?: string }) => {
      if (filtros.status === StatusOrdemServico.EM_EXECUCAO) {
        return { itens: [osExecucao], total: 1 };
      }

      if (filtros.status === StatusOrdemServico.AGUARDANDO_APROVACAO) {
        return { itens: [osAguardando], total: 1 };
      }

      return { itens: [], total: 0 };
    });

    const uc = criarUseCase();
    const resultado = await uc.executar({ pagina: 1, porPagina: 20 });

    expect(resultado.data).toHaveLength(2);
    expect(resultado.meta.total).toBe(2);
    expect(resultado.meta.pagina).toBe(1);
    expect(resultado.meta.porPagina).toBe(20);
  });

  it('deve usar valores padrão de paginação quando não fornecidos', async () => {
    mockOsRepo.listar.mockResolvedValue({ itens: [], total: 0 });

    const uc = criarUseCase();
    await uc.executar({});

    expect(mockOsRepo.listar).toHaveBeenCalledWith(
      expect.objectContaining({ status: StatusOrdemServico.EM_EXECUCAO, ordemCriacao: 'asc' }),
    );
  });

  it('deve calcular totalPaginas corretamente', async () => {
    mockOsRepo.listar.mockResolvedValue({ itens: [], total: 100 });

    const uc = criarUseCase();
    const resultado = await uc.executar({ pagina: 1, porPagina: 20 });
    expect(resultado.meta.totalPaginas).toBe(20);
  });

  it('deve retornar vazio para status fora da listagem priorizada da fase 2', async () => {
    const uc = criarUseCase();
    const resultado = await uc.executar({ status: StatusOrdemServico.ENTREGUE });

    expect(resultado.data).toHaveLength(0);
    expect(resultado.meta.total).toBe(0);
    expect(mockOsRepo.listar).not.toHaveBeenCalled();
  });
});
