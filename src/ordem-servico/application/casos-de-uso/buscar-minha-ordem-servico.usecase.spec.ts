import { BuscarMinhaOrdemServicoUseCase } from './buscar-minha-ordem-servico.usecase';
import {
  AcessoNegado,
  RecursoNaoEncontrado,
} from '../../../shared/excecoes/dominio.exception';
import { OrdemServico } from '../../domain/ordem-servico.entity';

const mockOsRepo = { buscarPorId: jest.fn(), salvar: jest.fn() };
const mockBuscarClientePorUsuario = { executar: jest.fn() };

function criarUseCase() {
  return new BuscarMinhaOrdemServicoUseCase(
    mockOsRepo as any,
    mockBuscarClientePorUsuario as any,
  );
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

  it('deve lancar RecursoNaoEncontrado se OS nao existir', async () => {
    mockBuscarClientePorUsuario.executar.mockResolvedValue({
      id: { valor: 'cl_01' },
    });
    mockOsRepo.buscarPorId.mockResolvedValue(null);

    const uc = criarUseCase();
    await expect(uc.executar('os_01', 'us_01')).rejects.toThrow(
      RecursoNaoEncontrado,
    );
  });

  it('deve lancar AcessoNegado se OS nao pertencer ao cliente', async () => {
    const os = osFake('cl_outro');
    mockBuscarClientePorUsuario.executar.mockResolvedValue({
      id: { valor: 'cl_01' },
    });
    mockOsRepo.buscarPorId.mockResolvedValue(os);

    const uc = criarUseCase();
    await expect(uc.executar(os.id.valor, 'us_01')).rejects.toThrow(
      AcessoNegado,
    );
  });

  it('deve retornar a OS quando pertencer ao cliente', async () => {
    const os = osFake('cl_01');
    mockBuscarClientePorUsuario.executar.mockResolvedValue({
      id: { valor: 'cl_01' },
    });
    mockOsRepo.buscarPorId.mockResolvedValue(os);

    const uc = criarUseCase();
    const resultado = await uc.executar(os.id.valor, 'us_01');
    expect(resultado).toBe(os);
  });
});
