import { ListarMinhasOrdensServicoUseCase } from './listar-minhas-ordens-servico.usecase';
import { OrdemServico } from '../../domain/ordem-servico.entity';

const mockOsRepo = { listar: jest.fn(), buscarPorId: jest.fn() };
const mockBuscarClientePorUsuario = { executar: jest.fn() };

function criarUseCase() {
  return new ListarMinhasOrdensServicoUseCase(mockOsRepo as any, mockBuscarClientePorUsuario as any);
}

describe('ListarMinhasOrdensServicoUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deve retornar lista paginada das OS do cliente', async () => {
    const os = OrdemServico.abrir({
      clienteId: 'cl_01',
      veiculoId: 've_01',
      problemasRelatados: [{ descricao: 'Motor' }],
    });
    mockBuscarClientePorUsuario.executar.mockResolvedValue({ id: { valor: 'cl_01' } });
    mockOsRepo.listar.mockResolvedValue({ itens: [os], total: 1 });

    const uc = criarUseCase();
    const resultado = await uc.executar({ usuarioId: 'us_01', pagina: 1, porPagina: 10 });

    expect(resultado.data).toHaveLength(1);
    expect(resultado.meta.total).toBe(1);
  });

  it('deve usar clienteId resolvido como filtro na listagem', async () => {
    mockBuscarClientePorUsuario.executar.mockResolvedValue({ id: { valor: 'cl_42' } });
    mockOsRepo.listar.mockResolvedValue({ itens: [], total: 0 });

    const uc = criarUseCase();
    await uc.executar({ usuarioId: 'us_42' });

    expect(mockOsRepo.listar).toHaveBeenCalledWith(
      expect.objectContaining({ clienteId: 'cl_42' }),
    );
  });

  it('deve usar paginacao padrao quando nao fornecida', async () => {
    mockBuscarClientePorUsuario.executar.mockResolvedValue({ id: { valor: 'cl_01' } });
    mockOsRepo.listar.mockResolvedValue({ itens: [], total: 0 });

    const uc = criarUseCase();
    await uc.executar({ usuarioId: 'us_01' });

    expect(mockOsRepo.listar).toHaveBeenCalledWith(
      expect.objectContaining({ pagina: 1, porPagina: 20 }),
    );
  });
});
