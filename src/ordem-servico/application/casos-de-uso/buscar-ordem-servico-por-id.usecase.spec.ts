import { BuscarOrdemServicoPorIdUseCase } from './buscar-ordem-servico-por-id.usecase';
import { RecursoNaoEncontrado } from '../../../shared/excecoes/dominio.exception';
import { OrdemServico } from '../../domain/ordem-servico.entity';
import { StatusOrdemServico } from '../../domain/status-ordem-servico.enum';

const mockOsRepo = { buscarPorId: jest.fn(), salvar: jest.fn() };

function criarUseCase() {
  return new BuscarOrdemServicoPorIdUseCase(mockOsRepo as any);
}

describe('BuscarOrdemServicoPorIdUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deve lançar RecursoNaoEncontrado se OS não existir', async () => {
    mockOsRepo.buscarPorId.mockResolvedValue(null);

    const uc = criarUseCase();
    await expect(uc.executar('os_01')).rejects.toThrow(RecursoNaoEncontrado);
  });

  it('deve retornar a OS quando existir', async () => {
    const os = OrdemServico.abrir({
      clienteId: 'cl_01',
      veiculoId: 've_01',
      problemasRelatados: [{ descricao: 'Motor' }],
    });
    mockOsRepo.buscarPorId.mockResolvedValue(os);

    const uc = criarUseCase();
    const resultado = await uc.executar(os.id.valor);
    expect(resultado).toBe(os);
    expect(resultado.status).toBe(StatusOrdemServico.RECEBIDA);
  });
});
