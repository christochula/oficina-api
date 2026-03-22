import { BuscarMinhaOrdemServicoUseCase } from './buscar-minha-ordem-servico.usecase';
import { RecursoNaoEncontrado, AcessoNegado } from '../../../shared/excecoes/dominio.exception';
import { OrdemServico } from '../../domain/ordem-servico.entity';

const mockOsRepo = { buscarPorId: jest.fn(), salvar: jest.fn() };

function criarUseCase() {
  return new BuscarMinhaOrdemServicoUseCase(mockOsRepo as any);
}

function osFake(clienteId = 'cl_01') {
  return OrdemServico.abrir({
    clienteId,
    veiculoId: 've_01',
    problemasRelatados: [{ descricao: 'Motor' }],
  });
}

describe('BuscarMinhaOrdemServicoUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deve lançar RecursoNaoEncontrado se OS não existir', async () => {
    mockOsRepo.buscarPorId.mockResolvedValue(null);

    const uc = criarUseCase();
    await expect(uc.executar('os_01', 'cl_01')).rejects.toThrow(RecursoNaoEncontrado);
  });

  it('deve lançar AcessoNegado se OS não pertencer ao cliente', async () => {
    const os = osFake('cl_outro');
    mockOsRepo.buscarPorId.mockResolvedValue(os);

    const uc = criarUseCase();
    await expect(uc.executar(os.id.valor, 'cl_01')).rejects.toThrow(AcessoNegado);
  });

  it('deve retornar a OS quando pertencer ao cliente', async () => {
    const os = osFake('cl_01');
    mockOsRepo.buscarPorId.mockResolvedValue(os);

    const uc = criarUseCase();
    const resultado = await uc.executar(os.id.valor, 'cl_01');
    expect(resultado).toBe(os);
  });
});
