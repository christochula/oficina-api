import {
  RegraDeNegocio,
  RecursoNaoEncontrado,
} from '../../../shared/excecoes/dominio.exception';
import { StatusOrdemServico } from '../../domain/status-ordem-servico.enum';
import { BuscarStatusOrdemServicoPublicoUseCase } from './buscar-status-ordem-servico-publico.usecase';

const mockOsRepo = {
  buscarPorId: jest.fn(),
  buscarPorNumero: jest.fn(),
  listar: jest.fn(),
  salvar: jest.fn(),
  buscarEntregues: jest.fn(),
  buscarTodasComHistorico: jest.fn(),
};

const mockClienteRepo = {
  salvar: jest.fn(),
  buscarPorId: jest.fn(),
  buscarPorUsuarioId: jest.fn(),
  buscarPorNumeroDoc: jest.fn(),
  listar: jest.fn(),
};

function criarUseCase() {
  return new BuscarStatusOrdemServicoPublicoUseCase(
    mockOsRepo as any,
    mockClienteRepo as any,
  );
}

describe('BuscarStatusOrdemServicoPublicoUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deve retornar status quando OS pertencer ao cliente do documento', async () => {
    const agora = new Date();
    const osMock = {
      numero: 123,
      status: StatusOrdemServico.EM_EXECUCAO,
      clienteId: 'cl_01',
      atualizadoEm: agora,
      historico: [{ criadoEm: agora }],
    };

    mockClienteRepo.buscarPorNumeroDoc.mockResolvedValue({
      id: { valor: 'cl_01' },
    });
    mockOsRepo.buscarPorNumero.mockResolvedValue(osMock);

    const useCase = criarUseCase();
    const resultado = await useCase.executar(123, '111.444.777-35');

    expect(resultado.numero).toBe(123);
    expect(resultado.status).toBe(StatusOrdemServico.EM_EXECUCAO);
    expect(resultado.statusDescricao).toBe('Execução');
    expect(mockClienteRepo.buscarPorNumeroDoc).toHaveBeenCalledWith(
      '11144477735',
    );
  });

  it('deve lançar RegraDeNegocio quando número da OS for inválido', async () => {
    const useCase = criarUseCase();

    await expect(useCase.executar(-1, '11144477735')).rejects.toThrow(
      RegraDeNegocio,
    );
  });

  it('deve lançar RecursoNaoEncontrado quando OS não pertencer ao cliente', async () => {
    mockClienteRepo.buscarPorNumeroDoc.mockResolvedValue({
      id: { valor: 'cl_02' },
    });
    mockOsRepo.buscarPorNumero.mockResolvedValue({ clienteId: 'cl_01' });

    const useCase = criarUseCase();

    await expect(useCase.executar(123, '11144477735')).rejects.toThrow(
      RecursoNaoEncontrado,
    );
  });
});
