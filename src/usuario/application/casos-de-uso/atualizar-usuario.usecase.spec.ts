import * as bcrypt from 'bcrypt';
import {
  ConflitoDeRecurso,
  RecursoNaoEncontrado,
  RegraDeNegocio,
} from '../../../shared/excecoes/dominio.exception';
import { PapelUsuario } from '../../domain/papel-usuario.enum';
import { Usuario } from '../../domain/usuario.entity';
import { AtualizarUsuarioUseCase } from './atualizar-usuario.usecase';

jest.mock('bcrypt', () => ({ hash: jest.fn(), compare: jest.fn() }));

function usuario(papel: PapelUsuario, email = 'usuario@oficina.com.br') {
  return Usuario.criar({
    nome: 'Usuário Oficina',
    email,
    senhaHash: 'hash-antigo',
    papel,
    refreshTokenHash: 'refresh-ativo',
  });
}

describe('AtualizarUsuarioUseCase', () => {
  const repository = {
    buscarPorId: jest.fn(),
    buscarPorEmail: jest.fn(),
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
    new AtualizarUsuarioUseCase(repository as any, transaction as any);

  beforeEach(() => {
    jest.clearAllMocks();
    (bcrypt.hash as jest.Mock).mockResolvedValue('hash-novo');
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    repository.buscarPorEmail.mockResolvedValue(null);
    repository.contarAdministradoresAtivos.mockResolvedValue(1);
    repository.contarOrdensNaoTerminaisDoMecanico.mockResolvedValue(0);
  });

  it('rejeita PATCH vazio', async () => {
    const useCase = criarUseCase();
    await expect(useCase.executar({ id: 'us_01' })).rejects.toThrow(
      'Ao menos um campo deve ser informado',
    );
    expect(repository.buscarPorId).not.toHaveBeenCalled();
  });

  it('lança RecursoNaoEncontrado para ID inexistente', async () => {
    repository.buscarPorId.mockResolvedValue(null);
    const useCase = criarUseCase();
    await expect(
      useCase.executar({ id: 'us_01', nome: 'Novo Nome' }),
    ).rejects.toThrow(RecursoNaoEncontrado);
  });

  it('não permite converter usuário CLIENTE em interno', async () => {
    repository.buscarPorId.mockResolvedValue(usuario(PapelUsuario.CLIENTE));
    const useCase = criarUseCase();
    await expect(
      useCase.executar({
        id: 'us_01',
        papel: PapelUsuario.MECANICO,
      }),
    ).rejects.toThrow(RegraDeNegocio);
    expect(repository.salvar).not.toHaveBeenCalled();
  });

  it('não permite converter usuário interno em CLIENTE', async () => {
    const useCase = criarUseCase();
    await expect(
      useCase.executar({
        id: 'us_01',
        papel: PapelUsuario.CLIENTE as any,
      }),
    ).rejects.toThrow('somente papéis internos');
    expect(repository.buscarPorId).not.toHaveBeenCalled();
  });

  it('normaliza e-mail e retorna 409 quando pertence a outro usuário', async () => {
    const alvo = usuario(PapelUsuario.MECANICO);
    repository.buscarPorId.mockResolvedValue(alvo);
    repository.buscarPorEmail.mockResolvedValue(
      usuario(PapelUsuario.CONSULTOR_TECNICO, 'novo@oficina.com.br'),
    );
    const useCase = criarUseCase();

    await expect(
      useCase.executar({
        id: alvo.id.valor,
        email: ' NOVO@OFICINA.COM.BR ',
      }),
    ).rejects.toThrow(ConflitoDeRecurso);
    expect(repository.buscarPorEmail).toHaveBeenCalledWith(
      'novo@oficina.com.br',
    );
  });

  it('gera bcrypt para senha nova e revoga o refresh token', async () => {
    const alvo = usuario(PapelUsuario.CONSULTOR_TECNICO);
    repository.buscarPorId.mockResolvedValue(alvo);
    const useCase = criarUseCase();

    const resultado = await useCase.executar({
      id: alvo.id.valor,
      senha: 'novaSenha123',
    });

    expect(bcrypt.hash).toHaveBeenCalledWith('novaSenha123', 10);
    expect(resultado.senhaHash).toBe('hash-novo');
    expect(resultado.refreshTokenHash).toBeNull();
    expect(repository.salvar).toHaveBeenCalledWith(alvo);
  });

  it('não troca hash nem revoga refresh quando a senha é a mesma', async () => {
    const alvo = usuario(PapelUsuario.CONSULTOR_TECNICO);
    repository.buscarPorId.mockResolvedValue(alvo);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    const useCase = criarUseCase();

    const resultado = await useCase.executar({
      id: alvo.id.valor,
      senha: 'senhaAtual123',
    });

    expect(bcrypt.compare).toHaveBeenCalledWith('senhaAtual123', 'hash-antigo');
    expect(bcrypt.hash).not.toHaveBeenCalled();
    expect(resultado.senhaHash).toBe('hash-antigo');
    expect(resultado.refreshTokenHash).toBe('refresh-ativo');
  });

  it('rejeita senha acima de 72 bytes mesmo por chamada direta', async () => {
    const useCase = criarUseCase();
    await expect(
      useCase.executar({
        id: 'us_01',
        senha: 'á'.repeat(37),
      }),
    ).rejects.toThrow('72 bytes');
    expect(transaction.executarSerializavel).not.toHaveBeenCalled();
  });

  it('bloqueia o rebaixamento do último administrador ativo', async () => {
    const alvo = usuario(PapelUsuario.ADMINISTRADOR);
    repository.buscarPorId.mockResolvedValue(alvo);
    repository.contarAdministradoresAtivos.mockResolvedValue(0);
    const useCase = criarUseCase();

    await expect(
      useCase.executar({
        id: alvo.id.valor,
        papel: PapelUsuario.CONSULTOR_TECNICO,
      }),
    ).rejects.toThrow('último administrador ativo');
    expect(repository.salvar).not.toHaveBeenCalled();
  });

  it('permite rebaixar administrador quando existe outro ativo', async () => {
    const alvo = usuario(PapelUsuario.ADMINISTRADOR);
    repository.buscarPorId.mockResolvedValue(alvo);
    repository.contarAdministradoresAtivos.mockResolvedValue(1);
    const useCase = criarUseCase();

    await useCase.executar({
      id: alvo.id.valor,
      papel: PapelUsuario.CONSULTOR_TECNICO,
    });

    expect(alvo.papel).toBe(PapelUsuario.CONSULTOR_TECNICO);
    expect(repository.salvar).toHaveBeenCalledWith(alvo);
  });

  it('bloqueia troca de papel do mecânico com OS não terminal', async () => {
    const alvo = usuario(PapelUsuario.MECANICO);
    repository.buscarPorId.mockResolvedValue(alvo);
    repository.contarOrdensNaoTerminaisDoMecanico.mockResolvedValue(2);
    const useCase = criarUseCase();

    await expect(
      useCase.executar({
        id: alvo.id.valor,
        papel: PapelUsuario.CONSULTOR_TECNICO,
      }),
    ).rejects.toThrow('ordens de serviço não finalizadas');
    expect(repository.salvar).not.toHaveBeenCalled();
  });

  it('permite editar dados do mecânico sem consultar suas ordens', async () => {
    const alvo = usuario(PapelUsuario.MECANICO);
    repository.buscarPorId.mockResolvedValue(alvo);
    const useCase = criarUseCase();

    await useCase.executar({ id: alvo.id.valor, nome: 'Carlos Lima' });

    expect(alvo.nome).toBe('Carlos Lima');
    expect(
      repository.contarOrdensNaoTerminaisDoMecanico,
    ).not.toHaveBeenCalled();
    expect(alvo.refreshTokenHash).toBe('refresh-ativo');
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
