import { RegraDeNegocio } from '../../../shared/excecoes/dominio.exception';
import { PapelUsuario } from '../../../usuario/domain/papel-usuario.enum';
import { Usuario } from '../../../usuario/domain/usuario.entity';
import { OrdemServico } from '../../domain/ordem-servico.entity';
import { StatusOrdemServico } from '../../domain/status-ordem-servico.enum';
import { TipoLinhaServico } from '../../domain/value-objects/linha-servico.vo';
import { ProcessarAtualizacaoStatusExternaUseCase } from './processar-atualizacao-status-externa.usecase';

const mockOsRepo = { buscarPorId: jest.fn(), salvar: jest.fn() };

function criarUseCase() {
  return new ProcessarAtualizacaoStatusExternaUseCase(mockOsRepo as any);
}

function mecanicoFake() {
  return Usuario.criar({
    nome: 'Mecanico teste',
    email: 'mecanico.status@oficina.com',
    senhaHash: 'hash',
    papel: PapelUsuario.MECANICO,
  });
}

function osAguardandoAprovacao() {
  const os = OrdemServico.abrir({
    clienteId: 'cl_01',
    veiculoId: 've_01',
    problemasRelatados: [{ descricao: 'Motor falhando' }],
  });

  const mecanico = mecanicoFake();
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

function osEmExecucao() {
  const os = osAguardandoAprovacao();
  os.aprovarOrcamento('us_cliente_01');
  os.iniciarExecucao(mecanicoFake().id.valor);
  return os;
}

describe('ProcessarAtualizacaoStatusExternaUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deve atualizar status operacional recebido por e-mail', async () => {
    const os = osEmExecucao();
    mockOsRepo.buscarPorId.mockResolvedValue(os);

    const useCase = criarUseCase();
    const resultado = await useCase.executar({
      osId: 'os_01',
      novoStatus: 'FINALIZADA',
      origem: 'caixa-entrada-oficina',
      idMensagemExterna: 'msg-123',
    });

    expect(resultado.status).toBe(StatusOrdemServico.FINALIZADA);
    expect(resultado.historico[resultado.historico.length - 1]).toEqual(
      expect.objectContaining({
        evento: 'ORDEM_FINALIZADA',
        usuarioId: 'externo:caixa-entrada-oficina',
        statusNovo: StatusOrdemServico.FINALIZADA,
      }),
    );
    expect(mockOsRepo.salvar).toHaveBeenCalledWith(os);
  });

  it('deve preservar compatibilidade com atualizacao externa APROVADA', async () => {
    const os = osAguardandoAprovacao();
    mockOsRepo.buscarPorId.mockResolvedValue(os);

    const useCase = criarUseCase();
    const resultado = await useCase.executar({
      osId: 'os_01',
      novoStatus: 'APROVADA',
      origem: 'email',
    });

    expect(resultado.status).toBe(StatusOrdemServico.APROVADA);
    expect(mockOsRepo.salvar).toHaveBeenCalledWith(os);
  });

  it('deve rejeitar retrocesso de status por ferramenta externa', async () => {
    const os = osEmExecucao();
    mockOsRepo.buscarPorId.mockResolvedValue(os);

    const useCase = criarUseCase();
    await expect(
      useCase.executar({
        osId: 'os_01',
        novoStatus: 'DIAGNOSTICO',
        origem: 'email',
      }),
    ).rejects.toThrow(RegraDeNegocio);
  });
});
