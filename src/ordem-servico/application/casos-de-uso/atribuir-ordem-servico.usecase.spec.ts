import { AtribuirOrdemServicoUseCase } from './atribuir-ordem-servico.usecase';
import { RecursoNaoEncontrado } from '../../../shared/excecoes/dominio.exception';
import { OrdemServico } from '../../domain/ordem-servico.entity';
import { Usuario } from '../../../usuario/domain/usuario.entity';
import { PapelUsuario } from '../../../usuario/domain/papel-usuario.enum';
import { StatusOrdemServico } from '../../domain/status-ordem-servico.enum';

const mockOsRepo = { buscarPorId: jest.fn(), salvar: jest.fn() };
const mockUsuarioRepo = { buscarPorId: jest.fn(), salvar: jest.fn() };
const mockDatabaseTransaction = {
  executarSerializavel: jest.fn(async (callback: () => Promise<unknown>) =>
    callback(),
  ),
  bloquear: jest.fn().mockResolvedValue(undefined),
};

function criarUseCase() {
  return new AtribuirOrdemServicoUseCase(
    mockOsRepo as any,
    mockUsuarioRepo as any,
    mockDatabaseTransaction as any,
  );
}

function osFake() {
  return OrdemServico.abrir({
    clienteId: 'cl_01',
    veiculoId: 've_01',
    problemasRelatados: [{ descricao: 'Problema' }],
  });
}

function mecanicoFake() {
  return Usuario.criar({
    nome: 'Mecânico',
    email: 'mecanico@oficina.com',
    senhaHash: 'hash',
    papel: PapelUsuario.MECANICO,
  });
}

function consultorFake() {
  return Usuario.criar({
    nome: 'Consultor',
    email: 'consultor@oficina.com',
    senhaHash: 'hash',
    papel: PapelUsuario.CONSULTOR_TECNICO,
  });
}

describe('AtribuirOrdemServicoUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deve lançar RecursoNaoEncontrado se OS não existir', async () => {
    mockOsRepo.buscarPorId.mockResolvedValue(null);

    const uc = criarUseCase();
    await expect(uc.executar('os_01', 'us_01')).rejects.toThrow(
      RecursoNaoEncontrado,
    );
  });

  it('deve lançar RecursoNaoEncontrado se mecânico não existir', async () => {
    mockOsRepo.buscarPorId.mockResolvedValue(osFake());
    mockUsuarioRepo.buscarPorId.mockResolvedValue(null);

    const uc = criarUseCase();
    await expect(uc.executar('os_01', 'us_01')).rejects.toThrow(
      RecursoNaoEncontrado,
    );
  });

  it('deve atribuir mecânico e mudar status para ATRIBUIDA', async () => {
    const os = osFake();
    const mecanico = mecanicoFake();
    mockOsRepo.buscarPorId.mockResolvedValue(os);
    mockUsuarioRepo.buscarPorId.mockResolvedValue(mecanico);
    mockOsRepo.salvar.mockResolvedValue(undefined);

    const uc = criarUseCase();
    const resultado = await uc.executar('os_01', mecanico.id.valor);

    expect(resultado.status).toBe(StatusOrdemServico.ATRIBUIDA);
    expect(resultado.mecanicoResponsavelId).toBe(mecanico.id.valor);
  });

  it('deve lançar RegraDeNegocio se usuário não for mecânico', async () => {
    const os = osFake();
    const consultor = consultorFake();
    mockOsRepo.buscarPorId.mockResolvedValue(os);
    mockUsuarioRepo.buscarPorId.mockResolvedValue(consultor);

    const uc = criarUseCase();
    await expect(uc.executar('os_01', consultor.id.valor)).rejects.toThrow();
  });

  it('deve salvar a OS após atribuição', async () => {
    const os = osFake();
    const mecanico = mecanicoFake();
    mockOsRepo.buscarPorId.mockResolvedValue(os);
    mockUsuarioRepo.buscarPorId.mockResolvedValue(mecanico);
    mockOsRepo.salvar.mockResolvedValue(undefined);

    const uc = criarUseCase();
    await uc.executar('os_01', mecanico.id.valor);
    expect(mockOsRepo.salvar).toHaveBeenCalledWith(os);
    expect(mockDatabaseTransaction.executarSerializavel).toHaveBeenCalledTimes(
      1,
    );
    expect(mockDatabaseTransaction.bloquear).toHaveBeenCalledWith(
      `oficina:usuario:${mecanico.id.valor}`,
    );
  });
});
