import { EntregarVeiculoUseCase } from './entregar-veiculo.usecase';
import { RecursoNaoEncontrado } from '../../../shared/excecoes/dominio.exception';
import { OrdemServico } from '../../domain/ordem-servico.entity';
import { Usuario } from '../../../usuario/domain/usuario.entity';
import { PapelUsuario } from '../../../usuario/domain/papel-usuario.enum';
import { TipoLinhaServico } from '../../domain/value-objects/linha-servico.vo';
import { StatusOrdemServico } from '../../domain/status-ordem-servico.enum';

const mockOsRepo = { buscarPorId: jest.fn(), salvar: jest.fn() };
const mockClienteRepo = { buscarPorId: jest.fn() };
const mockNotificacaoStatus = { enviarAtualizacaoStatus: jest.fn() };

function criarUseCase() {
  return new EntregarVeiculoUseCase(mockOsRepo as any, mockClienteRepo as any, mockNotificacaoStatus as any);
}

function osFinalizada() {
  const os = OrdemServico.abrir({
    clienteId: 'cl_01',
    veiculoId: 've_01',
    problemasRelatados: [{ descricao: 'Motor' }],
  });
  const mecanico = Usuario.criar({ nome: 'M', email: 'm@m.com', senhaHash: 'h', papel: PapelUsuario.MECANICO });
  os.atribuirMecanico(mecanico);
  os.gerarOrcamento(
    [{ titulo: 'Serviços', linhas: [{ tipo: TipoLinhaServico.SERVICO, descricao: 'Serviço', quantidade: 1, valorUnitario: 100 }] }],
    'us_01',
  );
  os.aprovarOrcamento('us_cliente');
  os.iniciarExecucao('us_01');
  os.finalizar('us_01');
  return os;
}

describe('EntregarVeiculoUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deve lançar RecursoNaoEncontrado se OS não existir', async () => {
    mockOsRepo.buscarPorId.mockResolvedValue(null);

    const uc = criarUseCase();
    await expect(uc.executar('os_01', 'us_consultor')).rejects.toThrow(RecursoNaoEncontrado);
  });

  it('deve entregar veículo e mudar status para ENTREGUE', async () => {
    const os = osFinalizada();
    mockOsRepo.buscarPorId.mockResolvedValue(os);
    mockOsRepo.salvar.mockResolvedValue(undefined);

    const uc = criarUseCase();
    const resultado = await uc.executar('os_01', 'us_consultor');

    expect(resultado.status).toBe(StatusOrdemServico.ENTREGUE);
  });

  it('deve salvar OS após entrega', async () => {
    const os = osFinalizada();
    mockOsRepo.buscarPorId.mockResolvedValue(os);
    mockOsRepo.salvar.mockResolvedValue(undefined);

    const uc = criarUseCase();
    await uc.executar('os_01', 'us_consultor');
    expect(mockOsRepo.salvar).toHaveBeenCalledWith(os);
  });
});
