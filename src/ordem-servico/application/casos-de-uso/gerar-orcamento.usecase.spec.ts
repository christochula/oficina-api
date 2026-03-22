import { GerarOrcamentoUseCase } from './gerar-orcamento.usecase';
import { RecursoNaoEncontrado } from '../../../shared/excecoes/dominio.exception';
import { OrdemServico } from '../../domain/ordem-servico.entity';
import { Usuario } from '../../../usuario/domain/usuario.entity';
import { PapelUsuario } from '../../../usuario/domain/papel-usuario.enum';
import { TipoLinhaServico } from '../../domain/value-objects/linha-servico.vo';
import { StatusOrdemServico } from '../../domain/status-ordem-servico.enum';

const mockOsRepo = { buscarPorId: jest.fn(), salvar: jest.fn() };

function criarUseCase() {
  return new GerarOrcamentoUseCase(mockOsRepo as any);
}

function osAtribuida() {
  const os = OrdemServico.abrir({
    clienteId: 'cl_01',
    veiculoId: 've_01',
    problemasRelatados: [{ descricao: 'Motor' }],
  });
  const mecanico = Usuario.criar({
    nome: 'Mecânico',
    email: 'm@m.com',
    senhaHash: 'h',
    papel: PapelUsuario.MECANICO,
  });
  os.atribuirMecanico(mecanico);
  return os;
}

const gruposBase = [
  { titulo: 'Serviços', linhas: [{ tipo: TipoLinhaServico.SERVICO, descricao: 'Troca de óleo', quantidade: 1, valorUnitario: 150 }] },
];

describe('GerarOrcamentoUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deve lançar RecursoNaoEncontrado se OS não existir', async () => {
    mockOsRepo.buscarPorId.mockResolvedValue(null);

    const uc = criarUseCase();
    await expect(
      uc.executar({ osId: 'os_01', mecanicoId: 'us_01', grupos: gruposBase }),
    ).rejects.toThrow(RecursoNaoEncontrado);
  });

  it('deve gerar orçamento e mudar status para AGUARDANDO_APROVACAO', async () => {
    const os = osAtribuida();
    mockOsRepo.buscarPorId.mockResolvedValue(os);
    mockOsRepo.salvar.mockResolvedValue(undefined);

    const uc = criarUseCase();
    const resultado = await uc.executar({ osId: 'os_01', mecanicoId: 'us_01', grupos: gruposBase });

    expect(resultado.status).toBe(StatusOrdemServico.AGUARDANDO_APROVACAO);
    expect(resultado.orcamento?.total).toBe(150);
  });

  it('deve salvar OS após gerar orçamento', async () => {
    const os = osAtribuida();
    mockOsRepo.buscarPorId.mockResolvedValue(os);
    mockOsRepo.salvar.mockResolvedValue(undefined);

    const uc = criarUseCase();
    await uc.executar({ osId: 'os_01', mecanicoId: 'us_01', grupos: gruposBase });
    expect(mockOsRepo.salvar).toHaveBeenCalledWith(os);
  });
});
