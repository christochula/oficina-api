import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PapelUsuario } from '../usuario/domain/papel-usuario.enum';
import { Usuario } from '../usuario/domain/usuario.entity';
import { AuthService } from './auth.service';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

const mockUsuarioRepository = {
  buscarPorEmail: jest.fn(),
  buscarPorId: jest.fn(),
  salvar: jest.fn(),
};

const mockJwtService = {
  signAsync: jest.fn(),
};

function criarService() {
  return new AuthService(
    mockUsuarioRepository as any,
    mockJwtService as unknown as JwtService,
  );
}

function criarUsuarioAtivo(papel = PapelUsuario.ADMINISTRADOR) {
  return Usuario.criar({
    nome: 'Matheus',
    email: 'matheus@oficina.com',
    senhaHash: 'hash-senha',
    papel,
  });
}

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('faz login de usuário ativo e persiste o refresh token hash', async () => {
    const usuario = criarUsuarioAtivo();
    mockUsuarioRepository.buscarPorEmail.mockResolvedValue(usuario);
    mockUsuarioRepository.buscarPorId.mockResolvedValue(usuario);
    mockUsuarioRepository.salvar.mockResolvedValue(undefined);
    mockJwtService.signAsync
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('refresh-token');
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (bcrypt.hash as jest.Mock).mockResolvedValue('refresh-hash');

    const service = criarService();
    const resultado = await service.login('matheus@oficina.com', 'senha');

    expect(resultado).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
    expect(usuario.refreshTokenHash).toBe('refresh-hash');
    expect(mockUsuarioRepository.salvar).toHaveBeenCalledWith(usuario);
  });

  it('rejeita login de usuário inativo', async () => {
    const usuario = criarUsuarioAtivo();
    usuario.desativar();
    mockUsuarioRepository.buscarPorEmail.mockResolvedValue(usuario);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const service = criarService();
    await expect(service.login(usuario.email, 'senha')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  it('rejeita login de CLIENTE porque clientes autenticam por CPF', async () => {
    const usuario = criarUsuarioAtivo(PapelUsuario.CLIENTE);
    mockUsuarioRepository.buscarPorEmail.mockResolvedValue(usuario);

    const service = criarService();
    await expect(service.login(usuario.email, 'senha')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(bcrypt.compare).not.toHaveBeenCalled();
    expect(mockJwtService.signAsync).not.toHaveBeenCalled();
  });

  it('rejeita refresh token de usuário inativo', async () => {
    const usuario = criarUsuarioAtivo();
    usuario.atualizarRefreshToken('refresh-hash');
    usuario.desativar();
    mockUsuarioRepository.buscarPorId.mockResolvedValue(usuario);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const service = criarService();
    await expect(
      service.refreshTokens(usuario.id.valor, 'refresh-token'),
    ).rejects.toThrow(UnauthorizedException);
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  it('rejeita refresh de CLIENTE emitido pelo fluxo legado', async () => {
    const usuario = criarUsuarioAtivo(PapelUsuario.CLIENTE);
    usuario.atualizarRefreshToken('refresh-hash');
    mockUsuarioRepository.buscarPorId.mockResolvedValue(usuario);

    const service = criarService();
    await expect(
      service.refreshTokens(usuario.id.valor, 'refresh-token'),
    ).rejects.toThrow(UnauthorizedException);
    expect(bcrypt.compare).not.toHaveBeenCalled();
    expect(mockJwtService.signAsync).not.toHaveBeenCalled();
  });
});
