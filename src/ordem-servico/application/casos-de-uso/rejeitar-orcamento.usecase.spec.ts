import { RejeitarOrcamentoUseCase } from './rejeitar-orcamento.usecase';
import {
  AcessoNegado,
  RecursoNaoEncontrado,
} from '../../../shared/excecoes/dominio.exception';
import { OrdemServico } from '../../domain/ordem-servico.entity';
import { Usuario } from '../../../usuario/domain/usuario.entity';
import { PapelUsuario } from '../../../usuario/domain/papel-usuario.enum';
import { TipoLinhaServico } from '../../domain/value-objects/linha-servico.vo';
import { StatusOrdemServico } from '../../domain/status-ordem-servico.enum';

const mockOsRepo = { buscarPorId: jest.fn(), salvar: jest.fn() };
const mockBuscarClientePorUsuario = { executar: jest.fn() };

function criarUseCase() {
  return new RejeitarOrcamentoUseCase(
    mockOsRepo as any,
    mockBuscarClientePorUsuario as any,
  );
}

function osAguardandoAprovacao() {
  const os = OrdemServico.abrir({
    clienteId: 'cl_01',
    veiculoId: 've_01',
    problemasRelatados: [{ descricao: 'Motor' }],
  });
  const mecanico = Usuario.criar({
    nome: 'M',
    email: 'm@m.com',
    senhaHash: 'h',
    papel: PapelUsuario.MECANICO,
  });
  os.atribuirMecanico(mecanico);
  os.gerarOrcamento(
    [
      {
        titulo: 'Servicos',
        linhas: [
          {
            tipo: TipoLinhaServico.SERVICO,
            descricao: 'Servico',
            quantidade: 1,
            valorUnitario: 100,
          },
        ],
      },
    ],
    os.mecanicoResponsavelId!,
  );
  return os;
}

describe('RejeitarOrcamentoUseCase', () => {
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

  it('deve rejeitar orcamento e mudar status para CANCELADA', async () => {
    const os = osAguardandoAprovacao();
    mockBuscarClientePorUsuario.executar.mockResolvedValue({
      id: { valor: 'cl_01' },
    });
    mockOsRepo.buscarPorId.mockResolvedValue(os);
    mockOsRepo.salvar.mockResolvedValue(undefined);

    const uc = criarUseCase();
    const resultado = await uc.executar('os_01', 'us_cliente');

    expect(resultado.status).toBe(StatusOrdemServico.CANCELADA);
    expect(resultado.orcamento?.rejeitadoEm).toBeInstanceOf(Date);
  });

  it('deve salvar OS apos rejeicao', async () => {
    const os = osAguardandoAprovacao();
    mockBuscarClientePorUsuario.executar.mockResolvedValue({
      id: { valor: 'cl_01' },
    });
    mockOsRepo.buscarPorId.mockResolvedValue(os);
    mockOsRepo.salvar.mockResolvedValue(undefined);

    const uc = criarUseCase();
    await uc.executar('os_01', 'us_cliente');
    expect(mockOsRepo.salvar).toHaveBeenCalledWith(os);
  });

  it('deve lancar AcessoNegado se o cliente nao for o titular da OS', async () => {
    const os = osAguardandoAprovacao();
    mockBuscarClientePorUsuario.executar.mockResolvedValue({
      id: { valor: 'cl_outro' },
    });
    mockOsRepo.buscarPorId.mockResolvedValue(os);

    const uc = criarUseCase();
    await expect(uc.executar('os_01', 'us_cliente')).rejects.toThrow(
      AcessoNegado,
    );
  });
});
