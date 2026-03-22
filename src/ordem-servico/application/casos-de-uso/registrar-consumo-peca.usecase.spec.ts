import { RegistrarConsumoPecaUseCase } from './registrar-consumo-peca.usecase';
import { RecursoNaoEncontrado } from '../../../shared/excecoes/dominio.exception';
import { OrdemServico } from '../../domain/ordem-servico.entity';
import { Usuario } from '../../../usuario/domain/usuario.entity';
import { PapelUsuario } from '../../../usuario/domain/papel-usuario.enum';
import { TipoLinhaServico } from '../../domain/value-objects/linha-servico.vo';

const mockOsRepo = { buscarPorId: jest.fn(), salvar: jest.fn() };
const mockEstoqueService = { processarConsumoPeca: jest.fn() };
const mockDatabaseTransaction = { executar: jest.fn() };

function criarUseCase() {
  mockDatabaseTransaction.executar.mockImplementation(async (callback: () => Promise<unknown>) => callback());
  return new RegistrarConsumoPecaUseCase(
    mockOsRepo as any,
    mockEstoqueService as any,
    mockDatabaseTransaction as any,
  );
}

function osEmExecucao() {
  const os = OrdemServico.abrir({
    clienteId: 'cl_01',
    veiculoId: 've_01',
    problemasRelatados: [{ descricao: 'Motor' }],
  });
  const mecanico = Usuario.criar({ nome: 'M', email: 'm@m.com', senhaHash: 'h', papel: PapelUsuario.MECANICO });
  os.atribuirMecanico(mecanico);
  os.gerarOrcamento(
    [{ titulo: 'Servicos', linhas: [{ tipo: TipoLinhaServico.SERVICO, descricao: 'Servico', quantidade: 1, valorUnitario: 100 }] }],
    'us_01',
  );
  os.aprovarOrcamento('us_cliente');
  os.iniciarExecucao('us_01');
  return os;
}

describe('RegistrarConsumoPecaUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deve lancar RecursoNaoEncontrado se OS nao existir', async () => {
    mockOsRepo.buscarPorId.mockResolvedValue(null);

    const uc = criarUseCase();
    await expect(
      uc.executar({ osId: 'os_01', pecaId: 'pc_01', quantidade: 2, mecanicoId: 'us_01' }),
    ).rejects.toThrow(RecursoNaoEncontrado);
  });

  it('deve registrar consumo de peca e chamar EstoqueService dentro da transacao', async () => {
    const os = osEmExecucao();
    mockOsRepo.buscarPorId.mockResolvedValue(os);
    mockEstoqueService.processarConsumoPeca.mockResolvedValue(undefined);
    mockOsRepo.salvar.mockResolvedValue(undefined);

    const uc = criarUseCase();
    await uc.executar({ osId: 'os_01', pecaId: 'pc_01', quantidade: 2, mecanicoId: 'us_01' });

    expect(mockDatabaseTransaction.executar).toHaveBeenCalledTimes(1);
    expect(mockEstoqueService.processarConsumoPeca).toHaveBeenCalledWith('pc_01', 2);
  });

  it('deve limpar eventos apos processamento bem-sucedido', async () => {
    const os = osEmExecucao();
    mockOsRepo.buscarPorId.mockResolvedValue(os);
    mockEstoqueService.processarConsumoPeca.mockResolvedValue(undefined);
    mockOsRepo.salvar.mockResolvedValue(undefined);

    const uc = criarUseCase();
    await uc.executar({ osId: 'os_01', pecaId: 'pc_01', quantidade: 2, mecanicoId: 'us_01' });

    expect(os.eventos).toHaveLength(0);
  });

  it('deve salvar OS apos registrar consumo', async () => {
    const os = osEmExecucao();
    mockOsRepo.buscarPorId.mockResolvedValue(os);
    mockEstoqueService.processarConsumoPeca.mockResolvedValue(undefined);
    mockOsRepo.salvar.mockResolvedValue(undefined);

    const uc = criarUseCase();
    await uc.executar({ osId: 'os_01', pecaId: 'pc_01', quantidade: 2, mecanicoId: 'us_01' });

    expect(mockOsRepo.salvar).toHaveBeenCalledWith(os);
  });

  it('deve adicionar peca consumida a OS', async () => {
    const os = osEmExecucao();
    mockOsRepo.buscarPorId.mockResolvedValue(os);
    mockEstoqueService.processarConsumoPeca.mockResolvedValue(undefined);
    mockOsRepo.salvar.mockResolvedValue(undefined);

    const uc = criarUseCase();
    const resultado = await uc.executar({ osId: 'os_01', pecaId: 'pc_01', quantidade: 3, mecanicoId: 'us_01' });

    expect(resultado.consumosPeca).toHaveLength(1);
    expect(resultado.consumosPeca[0].pecaId).toBe('pc_01');
    expect(resultado.consumosPeca[0].quantidade).toBe(3);
  });

  it('nao deve limpar eventos se a transacao falhar', async () => {
    const os = osEmExecucao();
    mockOsRepo.buscarPorId.mockResolvedValue(os);
    mockEstoqueService.processarConsumoPeca.mockRejectedValue(new Error('falha no estoque'));

    const uc = criarUseCase();

    await expect(
      uc.executar({ osId: 'os_01', pecaId: 'pc_01', quantidade: 2, mecanicoId: 'us_01' }),
    ).rejects.toThrow('falha no estoque');

    expect(os.eventos).toHaveLength(1);
    expect(mockOsRepo.salvar).not.toHaveBeenCalled();
  });
});
