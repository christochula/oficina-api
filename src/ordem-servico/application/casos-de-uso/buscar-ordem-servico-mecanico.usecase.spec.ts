import { BuscarOrdemServicoMecanicoUseCase } from './buscar-ordem-servico-mecanico.usecase';
import { OrdemServico } from '../../domain/ordem-servico.entity';
import {
  AcessoNegado,
  RecursoNaoEncontrado,
} from '../../../shared/excecoes/dominio.exception';
import { PapelUsuario } from '../../../usuario/domain/papel-usuario.enum';
import { Usuario } from '../../../usuario/domain/usuario.entity';

const mockOsRepo = { buscarPorId: jest.fn() };

function criarUseCase() {
  return new BuscarOrdemServicoMecanicoUseCase(mockOsRepo as any);
}

function criarMecanico(): Usuario {
  return Usuario.criar({
    nome: 'Carlos Mecânico',
    email: 'carlos@oficina.com',
    senhaHash: 'hash',
    papel: PapelUsuario.MECANICO,
  });
}

function criarOsAtribuida(mecanico: Usuario): OrdemServico {
  const os = OrdemServico.abrir({
    clienteId: 'cl_01',
    veiculoId: 've_01',
    problemasRelatados: [{ descricao: 'Motor' }],
  });
  os.atribuirMecanico(mecanico);
  return os;
}

describe('BuscarOrdemServicoMecanicoUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deve retornar a OS quando o mecânico é o responsável', async () => {
    const mecanico = criarMecanico();
    const os = criarOsAtribuida(mecanico);
    mockOsRepo.buscarPorId.mockResolvedValue(os);

    const uc = criarUseCase();
    const resultado = await uc.executar('os_01', mecanico.id.valor);

    expect(resultado).toBe(os);
  });

  it('deve lançar RecursoNaoEncontrado quando a OS não existe', async () => {
    mockOsRepo.buscarPorId.mockResolvedValue(null);

    const uc = criarUseCase();
    await expect(uc.executar('os_inexistente', 'us_mec01')).rejects.toThrow(
      RecursoNaoEncontrado,
    );
  });

  it('deve lançar AcessoNegado quando o mecânico não é o responsável', async () => {
    const mecanicoResponsavel = criarMecanico();
    const os = criarOsAtribuida(mecanicoResponsavel);
    mockOsRepo.buscarPorId.mockResolvedValue(os);

    const outroMecanico = Usuario.criar({
      nome: 'José Outro',
      email: 'jose@oficina.com',
      senhaHash: 'hash',
      papel: PapelUsuario.MECANICO,
    });

    const uc = criarUseCase();
    await expect(uc.executar('os_01', outroMecanico.id.valor)).rejects.toThrow(
      AcessoNegado,
    );
  });

  it('deve lançar AcessoNegado quando a OS ainda não tem mecânico atribuído', async () => {
    const os = OrdemServico.abrir({
      clienteId: 'cl_01',
      veiculoId: 've_01',
      problemasRelatados: [{ descricao: 'Motor' }],
    });
    mockOsRepo.buscarPorId.mockResolvedValue(os);

    const uc = criarUseCase();
    await expect(uc.executar('os_01', 'us_mec01')).rejects.toThrow(
      AcessoNegado,
    );
  });
});
