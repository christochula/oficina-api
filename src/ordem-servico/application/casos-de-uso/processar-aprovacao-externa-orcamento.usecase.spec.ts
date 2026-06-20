import { OrdemServico } from '../../domain/ordem-servico.entity';
import { StatusOrdemServico } from '../../domain/status-ordem-servico.enum';
import { TipoLinhaServico } from '../../domain/value-objects/linha-servico.vo';
import { PapelUsuario } from '../../../usuario/domain/papel-usuario.enum';
import { Usuario } from '../../../usuario/domain/usuario.entity';
import { ProcessarAprovacaoExternaOrcamentoUseCase } from './processar-aprovacao-externa-orcamento.usecase';

const mockOsRepo = { buscarPorId: jest.fn(), salvar: jest.fn() };

function criarUseCase() {
  return new ProcessarAprovacaoExternaOrcamentoUseCase(mockOsRepo as any);
}

function osAguardandoAprovacao() {
  const os = OrdemServico.abrir({
    clienteId: 'cl_01',
    veiculoId: 've_01',
    problemasRelatados: [{ descricao: 'Motor falhando' }],
  });

  const mecanico = Usuario.criar({
    nome: 'Mecanico teste',
    email: 'mecanico.teste@oficina.com',
    senhaHash: 'hash',
    papel: PapelUsuario.MECANICO,
  });

  os.atribuirMecanico(mecanico);
  os.iniciarDiagnostico(mecanico.id.valor);
  os.registrarDiagnostico('Falha na ignicao', mecanico.id.valor);
  os.gerarOrcamento(
    [
      {
        titulo: 'Servicos',
        linhas: [
          {
            tipo: TipoLinhaServico.SERVICO,
            descricao: 'Troca de velas',
            quantidade: 1,
            valorUnitario: 200,
          },
        ],
      },
    ],
    mecanico.id.valor,
  );

  return os;
}

describe('ProcessarAprovacaoExternaOrcamentoUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deve aprovar orçamento quando decisão for APROVADO', async () => {
    const os = osAguardandoAprovacao();
    mockOsRepo.buscarPorId.mockResolvedValue(os);

    const uc = criarUseCase();
    const resultado = await uc.executar({ osId: 'os_01', decisao: 'APROVADO', origem: 'gateway-x' });

    expect(resultado.status).toBe(StatusOrdemServico.APROVADA);
    expect(mockOsRepo.salvar).toHaveBeenCalledWith(os);
  });

  it('deve rejeitar orçamento quando decisão for RECUSADO', async () => {
    const os = osAguardandoAprovacao();
    mockOsRepo.buscarPorId.mockResolvedValue(os);

    const uc = criarUseCase();
    const resultado = await uc.executar({ osId: 'os_01', decisao: 'RECUSADO' });

    expect(resultado.status).toBe(StatusOrdemServico.CANCELADA);
    expect(mockOsRepo.salvar).toHaveBeenCalledWith(os);
  });

  it('deve ser idempotente para APROVADO quando OS ja estiver aprovada', async () => {
    const os = osAguardandoAprovacao();
    os.aprovarOrcamento('us_cliente_01');
    mockOsRepo.buscarPorId.mockResolvedValue(os);

    const uc = criarUseCase();
    const resultado = await uc.executar({ osId: 'os_01', decisao: 'APROVADO' });

    expect(resultado.status).toBe(StatusOrdemServico.APROVADA);
    expect(mockOsRepo.salvar).not.toHaveBeenCalled();
  });
});
