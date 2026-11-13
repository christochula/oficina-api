import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Usuario } from '../usuario/domain/usuario.entity';
import { PapelUsuario as Role } from '../usuario/domain/papel-usuario.enum';
import { UsuarioRepository } from '../usuario/domain/usuario.repository';
import { AuthService } from './auth.service';
import { jwtSecret } from './jwt-config';

jest.mock('bcrypt', () => ({ compare: jest.fn(), hash: jest.fn() }));
const saved = { ...process.env };
function setup() {
  const user = Usuario.criar({
    nome: 'Demo',
    email: 'demo@example.test',
    senhaHash: 'password-hash',
    papel: Role.ADMINISTRADOR,
  });
  const repository = {
    buscarPorEmail: jest.fn().mockResolvedValue(user),
    buscarPorId: jest.fn().mockResolvedValue(user),
    salvar: jest.fn(),
  };
  const jwt = {
    signAsync: jest
      .fn()
      .mockResolvedValueOnce('new-access')
      .mockResolvedValueOnce('new-refresh'),
  };
  return {
    user,
    repository,
    jwt,
    service: new AuthService(
      repository as unknown as UsuarioRepository,
      jwt as unknown as JwtService,
    ),
  };
}
describe('operator sessions and key boundaries', () => {
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => {
    process.env = { ...saved };
  });
  it('does not issue tokens for absent accounts or an incorrect password', async () => {
    const { service, repository, jwt } = setup();
    repository.buscarPorEmail.mockResolvedValueOnce(null);
    await expect(
      service.login('absent@example.test', 'password'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    await expect(
      service.login('demo@example.test', 'wrong'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });
  it('rotates a validated refresh credential and persists only its hash', async () => {
    const { service, user, repository, jwt } = setup();
    user.atualizarRefreshToken('old-hash');
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (bcrypt.hash as jest.Mock).mockResolvedValue('new-hash');
    process.env.JWT_EXPIRATION = '10m';
    process.env.JWT_REFRESH_EXPIRATION = '1d';
    await expect(
      service.refreshTokens(user.id.valor, 'old-refresh'),
    ).resolves.toEqual({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
    });
    expect(bcrypt.compare).toHaveBeenCalledWith('old-refresh', 'old-hash');
    expect(user.refreshTokenHash).toBe('new-hash');
    expect(repository.salvar).toHaveBeenCalledWith(user);
    expect(jwt.signAsync.mock.calls[0][1]).toMatchObject({ expiresIn: '10m' });
    expect(jwt.signAsync.mock.calls[1][1]).toMatchObject({ expiresIn: '1d' });
  });
  it('rejects absent, revoked and mismatched refresh credentials', async () => {
    const { service, repository, user, jwt } = setup();
    repository.buscarPorId.mockResolvedValueOnce(null);
    await expect(
      service.refreshTokens(user.id.valor, 'token'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      service.refreshTokens(user.id.valor, 'token'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    user.atualizarRefreshToken('hash');
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    await expect(
      service.refreshTokens(user.id.valor, 'wrong'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });
  it('invalidates logout idempotently without keeping the refresh credential', async () => {
    const { service, repository, user } = setup();
    user.atualizarRefreshToken('existing-hash');
    await service.logout(user.id.valor);
    expect(user.refreshTokenHash).toBeNull();
    expect(repository.salvar).toHaveBeenCalledWith(user);
    repository.salvar.mockClear();
    repository.buscarPorId.mockResolvedValueOnce(null);
    await service.logout('already-deleted-user');
    expect(repository.salvar).not.toHaveBeenCalled();
  });
  it('does not persist a credential for an account removed while tokens were issued', async () => {
    const { service, repository } = setup();
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    repository.buscarPorId.mockResolvedValueOnce(null);
    await service.login('demo@example.test', 'password');
    expect(repository.salvar).not.toHaveBeenCalled();
  });
  it('requires independent strong access and refresh secrets outside tests', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;
    delete process.env.JWT_REFRESH_SECRET;
    expect(() => jwtSecret('JWT_SECRET')).toThrow();
    process.env.JWT_SECRET = 'short';
    expect(() => jwtSecret('JWT_SECRET')).toThrow('32 bytes');
    process.env.JWT_SECRET = 'a'.repeat(32);
    process.env.JWT_REFRESH_SECRET = 'a'.repeat(32);
    expect(() => jwtSecret('JWT_SECRET')).toThrow('different');
    process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
    expect(jwtSecret('JWT_SECRET')).toBe('a'.repeat(32));
    expect(jwtSecret('JWT_REFRESH_SECRET')).toBe('b'.repeat(32));
    delete process.env.JWT_REFRESH_SECRET;
    expect(jwtSecret('JWT_SECRET')).toBe('a'.repeat(32));
  });
  it('permits deterministic keys only under the test environment', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.JWT_SECRET;
    delete process.env.JWT_REFRESH_SECRET;
    expect(jwtSecret('JWT_SECRET')).toMatch(/^test-only-/);
    expect(jwtSecret('JWT_REFRESH_SECRET')).toMatch(/^test-only-/);
  });
});
