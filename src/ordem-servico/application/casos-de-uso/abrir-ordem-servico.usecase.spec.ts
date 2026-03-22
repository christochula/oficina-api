import { AbrirOrdemServicoUseCase } from './abrir-ordem-servico.usecase';
import { RecursoNaoEncontrado } from '../../../shared/excecoes/dominio.exception';
import { Cliente, TipoDocumento } from '../../../cliente/domain/cliente.entity';
import { Veiculo } from '../../../veiculo/domain/veiculo.entity';
import { StatusOrdemServico } from '../../domain/status-ordem-servico.enum';

const mockOsRepo = { salvar: jest.fn(), buscarPorId: jest.fn(), listar: jest.fn(), buscarEntregues: jest.fn() };
const mockClienteRepo = { buscarPorId: jest.fn(), salvar: jest.fn(), buscarPorNumeroDoc: jest.fn() };
const mockVeiculoRepo = { buscarPorId: jest.fn(), salvar: jest.fn(), buscarPorPlaca: jest.fn() };
const mockServicoRepo = { buscarPorId: jest.fn(), salvar: jest.fn(), listar: jest.fn() };

function criarUseCase() {
  return new AbrirOrdemServicoUseCase(
    mockOsRepo as any,
    mockClienteRepo as any,
    mockVeiculoRepo as any,
    mockServicoRepo as any,
  );
}

function clienteFake() {
  return Cliente.criar({
    tipoDoc: TipoDocumento.CPF,
    numeroDoc: '11144477735',
    nome: 'João',
    email: 'j@j.com',
    telefone: '11999',
  });
}

function veiculoFake() {
  return Veiculo.criar({
    placa: 'ABC1234',
    renavam: '12345678901',
    chassi: '9BWZZZ377VT004251',
    marca: 'Toyota',
    modelo: 'Corolla',
    ano: 2020,
    cor: 'Prata',
  });
}

describe('AbrirOrdemServicoUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deve lançar RecursoNaoEncontrado se cliente não existir', async () => {
    mockClienteRepo.buscarPorId.mockResolvedValue(null);

    const uc = criarUseCase();
    await expect(
      uc.executar({
        clienteId: 'cl_01',
        veiculoId: 've_01',
        problemasRelatados: [{ descricao: 'Motor' }],
      }),
    ).rejects.toThrow(RecursoNaoEncontrado);
  });

  it('deve lançar RecursoNaoEncontrado se veículo não existir', async () => {
    mockClienteRepo.buscarPorId.mockResolvedValue(clienteFake());
    mockVeiculoRepo.buscarPorId.mockResolvedValue(null);

    const uc = criarUseCase();
    await expect(
      uc.executar({
        clienteId: 'cl_01',
        veiculoId: 've_01',
        problemasRelatados: [{ descricao: 'Motor' }],
      }),
    ).rejects.toThrow(RecursoNaoEncontrado);
  });

  it('deve criar OS com status RECEBIDA quando cliente e veículo existem', async () => {
    mockClienteRepo.buscarPorId.mockResolvedValue(clienteFake());
    mockVeiculoRepo.buscarPorId.mockResolvedValue(veiculoFake());
    mockOsRepo.salvar.mockResolvedValue(undefined);

    const uc = criarUseCase();
    const os = await uc.executar({
      clienteId: 'cl_01',
      veiculoId: 've_01',
      problemasRelatados: [{ descricao: 'Motor falhando' }],
    });

    expect(os.status).toBe(StatusOrdemServico.RECEBIDA);
    expect(os.clienteId).toBe('cl_01');
    expect(os.veiculoId).toBe('ve_01');
  });

  it('deve salvar a OS após criar', async () => {
    mockClienteRepo.buscarPorId.mockResolvedValue(clienteFake());
    mockVeiculoRepo.buscarPorId.mockResolvedValue(veiculoFake());
    mockServicoRepo.buscarPorId.mockResolvedValue({ nome: 'Serviço Teste' });
    mockOsRepo.salvar.mockResolvedValue(undefined);

    const uc = criarUseCase();
    await uc.executar({
      clienteId: 'cl_01',
      veiculoId: 've_01',
      servicosSolicitados: [{ servicoId: 'sv_01', observacao: 'Última troca há 10.000 km' }],
    });

    expect(mockOsRepo.salvar).toHaveBeenCalledTimes(1);
  });
});
