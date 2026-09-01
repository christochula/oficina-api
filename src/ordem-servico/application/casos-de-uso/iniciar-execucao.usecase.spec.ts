import { IniciarExecucaoUseCase } from './iniciar-execucao.usecase';
import { RecursoNaoEncontrado } from '../../../shared/excecoes/dominio.exception';
import { OrdemServico } from '../../domain/ordem-servico.entity';
import { Usuario } from '../../../usuario/domain/usuario.entity';
import { PapelUsuario } from '../../../usuario/domain/papel-usuario.enum';
import { TipoLinhaServico } from '../../domain/value-objects/linha-servico.vo';
import { StatusOrdemServico } from '../../domain/status-ordem-servico.enum';

const mockOsRepo = { buscarPorId: jest.fn(), salvar: jest.fn() };

function criarUseCase() {
  return new IniciarExecucaoUseCase(mockOsRepo as any);
}

function osAprovada() {
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
        titulo: 'Serviços',
        linhas: [
          {
            tipo: TipoLinhaServico.SERVICO,
            descricao: 'Serviço',
            quantidade: 1,
            valorUnitario: 100,
          },
        ],
      },
    ],
    os.mecanicoResponsavelId!,
  );
  os.aprovarOrcamento('us_cliente');
  return os;
}

describe('IniciarExecucaoUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deve lançar RecursoNaoEncontrado se OS não existir', async () => {
    mockOsRepo.buscarPorId.mockResolvedValue(null);

    const uc = criarUseCase();
    await expect(uc.executar('os_01', 'us_01')).rejects.toThrow(
      RecursoNaoEncontrado,
    );
  });

  it('deve iniciar execução e mudar status para EM_EXECUCAO', async () => {
    const os = osAprovada();
    mockOsRepo.buscarPorId.mockResolvedValue(os);
    mockOsRepo.salvar.mockResolvedValue(undefined);

    const uc = criarUseCase();
    const resultado = await uc.executar('os_01', os.mecanicoResponsavelId!);

    expect(resultado.status).toBe(StatusOrdemServico.EM_EXECUCAO);
  });

  it('deve salvar OS após iniciar execução', async () => {
    const os = osAprovada();
    mockOsRepo.buscarPorId.mockResolvedValue(os);
    mockOsRepo.salvar.mockResolvedValue(undefined);

    const uc = criarUseCase();
    await uc.executar('os_01', os.mecanicoResponsavelId!);
    expect(mockOsRepo.salvar).toHaveBeenCalledWith(os);
  });
});
