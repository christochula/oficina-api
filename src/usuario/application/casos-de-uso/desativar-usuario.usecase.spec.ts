import {
  RecursoNaoEncontrado,
  RegraDeNegocio,
} from '../../../shared/excecoes/dominio.exception';
import { PapelUsuario } from '../../domain/papel-usuario.enum';
import { Usuario } from '../../domain/usuario.entity';
import { DesativarUsuarioUseCase } from './desativar-usuario.usecase';

function usuario(papel: PapelUsuario) {
  return Usuario.criar({
    nome: 'Usuário',
    email: 'usuario@oficina.com.br',
    senhaHash: 'hash',
    papel,
    refreshTokenHash: 'refresh-ativo',
  });
}

describe('DesativarUsuarioUseCase', () => {
  const repository = {
    buscarPorId: jest.fn(),
    salvar: jest.fn(),
    contarAdministradoresAtivos: jest.fn(),
    contarOrdensNaoTerminaisDoMecanico: jest.fn(),
  };
  const transaction = {
    executarSerializavel: jest.fn(async (callback: () => Promise<unknown>) =>
      callback(),
    ),
    bloquear: jest.fn().mockResolvedValue(undefined),
  };
  const criarUseCase = () =>
    new DesativarUsuarioUseCase(repository as any, transaction as any);

  beforeEach(() => {
    jest.clearAllMocks();
    repository.contarAdministradoresAtivos.mockResolvedValue(1);
    repository.contarOrdensNaoTerminaisDoMecanico.mockResolvedValue(0);
  });

  it('bloqueia autodesativação antes de consultar o repositório', async () => {
    const useCase = criarUseCase();
    await expect(useCase.executar('us_atual', 'us_atual')).rejects.toThrow(
      'próprio usuário',
    );
    expect(repository.buscarPorId).not.toHaveBeenCalled();
    expect(transaction.executarSerializavel).not.toHaveBeenCalled();
  });

  it('lança RecursoNaoEncontrado para ID inexistente', async () => {
    repository.buscarPorId.mockResolvedValue(null);
    const useCase = criarUseCase();
    await expect(useCase.executar('us_01', 'us_admin')).rejects.toThrow(
      RecursoNaoEncontrado,
    );
  });

  it('rejeita usuário CLIENTE', async () => {
    const alvo = usuario(PapelUsuario.CLIENTE);
    repository.buscarPorId.mockResolvedValue(alvo);
    const useCase = criarUseCase();
    await expect(useCase.executar(alvo.id.valor, 'us_admin')).rejects.toThrow(
      RegraDeNegocio,
    );
  });

  it('bloqueia desativação do último administrador ativo', async () => {
    const alvo = usuario(PapelUsuario.ADMINISTRADOR);
    repository.buscarPorId.mockResolvedValue(alvo);
    repository.contarAdministradoresAtivos.mockResolvedValue(0);
    const useCase = criarUseCase();

    await expect(useCase.executar(alvo.id.valor, 'us_outro')).rejects.toThrow(
      'último administrador ativo',
    );
    expect(repository.salvar).not.toHaveBeenCalled();
  });

  it('bloqueia mecânico com OS não terminal atribuída', async () => {
    const alvo = usuario(PapelUsuario.MECANICO);
    repository.buscarPorId.mockResolvedValue(alvo);
    repository.contarOrdensNaoTerminaisDoMecanico.mockResolvedValue(1);
    const useCase = criarUseCase();

    await expect(useCase.executar(alvo.id.valor, 'us_admin')).rejects.toThrow(
      'ordens de serviço não finalizadas',
    );
    expect(repository.salvar).not.toHaveBeenCalled();
  });

  it('desativa usuário interno e revoga seu refresh token', async () => {
    const alvo = usuario(PapelUsuario.CONSULTOR_TECNICO);
    repository.buscarPorId.mockResolvedValue(alvo);
    const useCase = criarUseCase();

    const resultado = await useCase.executar(alvo.id.valor, 'us_admin');

    expect(resultado.ativo).toBe(false);
    expect(resultado.refreshTokenHash).toBeNull();
    expect(repository.salvar).toHaveBeenCalledWith(alvo);
    expect(transaction.executarSerializavel).toHaveBeenCalledTimes(1);
    expect(transaction.bloquear).toHaveBeenNthCalledWith(
      1,
      'oficina:usuarios:administradores-ativos',
    );
    expect(transaction.bloquear).toHaveBeenNthCalledWith(
      2,
      `oficina:usuario:${alvo.id.valor}`,
    );
  });
});
