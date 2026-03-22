import { UnauthorizedException } from '@nestjs/common';
import { PapelUsuario } from '../../usuario/domain/papel-usuario.enum';
import { Usuario } from '../../usuario/domain/usuario.entity';
import { JwtPayload, JwtStrategy } from './jwt.strategy';

const mockUsuarioRepository = {
  buscarPorId: jest.fn(),
};

function criarPayload(sub: string): JwtPayload {
  return {
    sub,
    email: 'token@oficina.com',
    papel: PapelUsuario.CLIENTE,
  };
}

function criarUsuarioAtivo() {
  return Usuario.criar({
    nome: 'Cliente Ativo',
    email: 'cliente@oficina.com',
    senhaHash: 'hash',
    papel: PapelUsuario.CLIENTE,
  });
}

describe('JwtStrategy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('valida token de usuário ativo usando os dados atuais do repositório', async () => {
    const usuario = criarUsuarioAtivo();
    mockUsuarioRepository.buscarPorId.mockResolvedValue(usuario);

    const strategy = new JwtStrategy(mockUsuarioRepository as any);
    const resultado = await strategy.validate(criarPayload(usuario.id.valor));

    expect(resultado).toEqual({
      sub: usuario.id.valor,
      email: usuario.email,
      papel: usuario.papel,
    });
  });

  it('rejeita token de usuário inexistente ou inativo', async () => {
    const usuario = criarUsuarioAtivo();
    usuario.desativar();
    mockUsuarioRepository.buscarPorId.mockResolvedValue(usuario);

    const strategy = new JwtStrategy(mockUsuarioRepository as any);
    await expect(strategy.validate(criarPayload(usuario.id.valor))).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
