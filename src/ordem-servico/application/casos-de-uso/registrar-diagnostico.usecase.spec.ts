import { RecursoNaoEncontrado } from '../../../shared/excecoes/dominio.exception';
import { Usuario } from '../../../usuario/domain/usuario.entity';
import { PapelUsuario } from '../../../usuario/domain/papel-usuario.enum';
import { OrdemServico } from '../../domain/ordem-servico.entity';
import { StatusOrdemServico } from '../../domain/status-ordem-servico.enum';
import { RegistrarDiagnosticoUseCase } from './registrar-diagnostico.usecase';

const mockOsRepo = { buscarPorId: jest.fn(), salvar: jest.fn() };

function criarUseCase() {
  return new RegistrarDiagnosticoUseCase(mockOsRepo as any);
}

function osAtribuida() {
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
  return os;
}

function osEmDiagnostico() {
  const os = osAtribuida();
  os.iniciarDiagnostico(os.mecanicoResponsavelId!);
  return os;
}

describe('RegistrarDiagnosticoUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deve lançar RecursoNaoEncontrado se OS não existir', async () => {
    mockOsRepo.buscarPorId.mockResolvedValue(null);

    const uc = criarUseCase();
    await expect(uc.executar('os_01', 'Diagnóstico', 'us_01')).rejects.toThrow(
      RecursoNaoEncontrado,
    );
  });

  it('deve registrar diagnóstico na OS partindo de ATRIBUIDA', async () => {
    const os = osAtribuida();
    mockOsRepo.buscarPorId.mockResolvedValue(os);
    mockOsRepo.salvar.mockResolvedValue(undefined);

    const uc = criarUseCase();
    const resultado = await uc.executar(
      'os_01',
      'Motor com desgaste nos anéis',
      os.mecanicoResponsavelId!,
    );

    expect(resultado.diagnostico?.descricao).toBe(
      'Motor com desgaste nos anéis',
    );
    expect(resultado.status).toBe(StatusOrdemServico.EM_DIAGNOSTICO);
  });

  it('deve salvar OS após registrar diagnóstico', async () => {
    const os = osEmDiagnostico();
    mockOsRepo.buscarPorId.mockResolvedValue(os);
    mockOsRepo.salvar.mockResolvedValue(undefined);

    const uc = criarUseCase();
    await uc.executar('os_01', 'Diagnóstico', os.mecanicoResponsavelId!);

    expect(mockOsRepo.salvar).toHaveBeenCalledWith(os);
  });
});
