import { ListarOrdensMecanicoUseCase } from './listar-ordens-mecanico.usecase';
import { OrdemServico } from '../../domain/ordem-servico.entity';
import { StatusOrdemServico } from '../../domain/status-ordem-servico.enum';
import { PapelUsuario } from '../../../usuario/domain/papel-usuario.enum';
import { Usuario } from '../../../usuario/domain/usuario.entity';

const mockOsRepo = { listar: jest.fn() };

function criarUseCase() {
  return new ListarOrdensMecanicoUseCase(mockOsRepo as any);
}

function criarMecanico(): Usuario {
  return Usuario.criar({
    nome: 'Carlos Mecânico',
    email: 'carlos@oficina.com',
    senhaHash: 'hash',
    papel: PapelUsuario.MECANICO,
  });
}

function criarOsAtribuida(): OrdemServico {
  const os = OrdemServico.abrir({
    clienteId: 'cl_01',
    veiculoId: 've_01',
    problemasRelatados: [{ descricao: 'Motor' }],
  });
  os.atribuirMecanico(criarMecanico());
  return os;
}

describe('ListarOrdensMecanicoUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deve retornar lista paginada das OS do mecânico', async () => {
    const os = criarOsAtribuida();
    mockOsRepo.listar.mockResolvedValue({ itens: [os], total: 1 });

    const uc = criarUseCase();
    const resultado = await uc.executar({ mecanicoId: 'us_mec01', pagina: 1, porPagina: 10 });

    expect(resultado.data).toHaveLength(1);
    expect(resultado.meta.total).toBe(1);
  });

  it('deve filtrar por mecanicoResponsavelId', async () => {
    mockOsRepo.listar.mockResolvedValue({ itens: [], total: 0 });

    const uc = criarUseCase();
    await uc.executar({ mecanicoId: 'us_mec42' });

    expect(mockOsRepo.listar).toHaveBeenCalledWith(
      expect.objectContaining({ mecanicoResponsavelId: 'us_mec42' }),
    );
  });

  it('deve filtrar pelos cinco status ativos do mecânico via statusIn', async () => {
    mockOsRepo.listar.mockResolvedValue({ itens: [], total: 0 });

    const uc = criarUseCase();
    await uc.executar({ mecanicoId: 'us_mec01' });

    const chamada = mockOsRepo.listar.mock.calls[0][0];
    expect(chamada.statusIn).toEqual(
      expect.arrayContaining([
        StatusOrdemServico.ATRIBUIDA,
        StatusOrdemServico.EM_DIAGNOSTICO,
        StatusOrdemServico.AGUARDANDO_APROVACAO,
        StatusOrdemServico.APROVADA,
        StatusOrdemServico.EM_EXECUCAO,
      ]),
    );
    expect(chamada.statusIn).toHaveLength(5);
  });

  it('não deve incluir status finais no filtro', async () => {
    mockOsRepo.listar.mockResolvedValue({ itens: [], total: 0 });

    const uc = criarUseCase();
    await uc.executar({ mecanicoId: 'us_mec01' });

    const { statusIn } = mockOsRepo.listar.mock.calls[0][0];
    expect(statusIn).not.toContain(StatusOrdemServico.RECEBIDA);
    expect(statusIn).not.toContain(StatusOrdemServico.FINALIZADA);
    expect(statusIn).not.toContain(StatusOrdemServico.ENTREGUE);
    expect(statusIn).not.toContain(StatusOrdemServico.CANCELADA);
  });

  it('deve usar paginação padrão quando não fornecida', async () => {
    mockOsRepo.listar.mockResolvedValue({ itens: [], total: 0 });

    const uc = criarUseCase();
    await uc.executar({ mecanicoId: 'us_mec01' });

    expect(mockOsRepo.listar).toHaveBeenCalledWith(
      expect.objectContaining({ pagina: 1, porPagina: 20 }),
    );
  });

  it('deve retornar lista vazia quando mecânico não tem OS ativas', async () => {
    mockOsRepo.listar.mockResolvedValue({ itens: [], total: 0 });

    const uc = criarUseCase();
    const resultado = await uc.executar({ mecanicoId: 'us_mec99' });

    expect(resultado.data).toHaveLength(0);
    expect(resultado.meta.total).toBe(0);
  });
});
