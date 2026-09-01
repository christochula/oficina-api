import { UnauthorizedException } from '@nestjs/common';
import { PapelUsuario } from '../../usuario/domain/papel-usuario.enum';
import { Usuario } from '../../usuario/domain/usuario.entity';
import { JwtPayload, JwtStrategy } from './jwt.strategy';
import { Cliente, TipoDocumento } from '../../cliente/domain/cliente.entity';

const mockUsuarioRepository = {
  buscarPorId: jest.fn(),
};

const mockClienteRepository = {
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

    const strategy = new JwtStrategy(
      mockUsuarioRepository as any,
      mockClienteRepository as any,
    );
    const resultado = await strategy.validate(criarPayload(usuario.id.valor));

    expect(resultado).toEqual({
      sub: usuario.id.valor,
      email: usuario.email,
      papel: usuario.papel,
      role: usuario.papel,
      token_use: 'operator',
      scopes: [],
    });
  });

  it('rejeita token de usuário inexistente ou inativo', async () => {
    const usuario = criarUsuarioAtivo();
    usuario.desativar();
    mockUsuarioRepository.buscarPorId.mockResolvedValue(usuario);

    const strategy = new JwtStrategy(
      mockUsuarioRepository as any,
      mockClienteRepository as any,
    );
    await expect(
      strategy.validate(criarPayload(usuario.id.valor)),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('valida JWT serverless de cliente ativo sem exigir usuário e sem expor CPF', async () => {
    const cliente = Cliente.criar({
      tipoDoc: TipoDocumento.CPF,
      numeroDoc: '52998224725',
      nome: 'Cliente CPF',
      email: 'cliente@oficina.com',
      telefone: '11999999999',
    });
    mockClienteRepository.buscarPorId.mockResolvedValue(cliente);

    const strategy = new JwtStrategy(
      mockUsuarioRepository as any,
      mockClienteRepository as any,
    );
    const resultado = await strategy.validate({
      sub: cliente.id.valor,
      client_id: cliente.id.valor,
      role: PapelUsuario.CLIENTE,
      papel: PapelUsuario.CLIENTE,
      token_use: 'client',
      scope: ['orders:read:own'],
    });

    expect(resultado).toMatchObject({
      sub: cliente.id.valor,
      clienteId: cliente.id.valor,
      papel: PapelUsuario.CLIENTE,
      scopes: ['orders:read:own'],
    });
    expect(JSON.stringify(resultado)).not.toContain(cliente.numeroDoc);
  });
});
