import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ClienteId } from '../../cliente/domain/cliente-id.value-object';
import { CLIENTE_REPOSITORY } from '../../cliente/domain/cliente.repository';
import type { ClienteRepository } from '../../cliente/domain/cliente.repository';
import { PapelUsuario } from '../../usuario/domain/papel-usuario.enum';
import { UsuarioId } from '../../usuario/domain/usuario-id.value-object';
import { USUARIO_REPOSITORY } from '../../usuario/domain/usuario.repository';
import type { UsuarioRepository } from '../../usuario/domain/usuario.repository';
import { JWT_AUDIENCE, JWT_ISSUER, jwtSecret } from '../jwt-config';

export interface JwtPayload {
  sub: string;
  email?: string;
  papel: PapelUsuario;
  role?: PapelUsuario;
  token_use?: string;
  client_id?: string;
  clienteId?: string;
  scope?: string | string[];
  scopes?: string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    @Inject(USUARIO_REPOSITORY)
    private readonly usuarioRepository: UsuarioRepository,
    @Inject(CLIENTE_REPOSITORY)
    private readonly clienteRepository: ClienteRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret('JWT_SECRET'),
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithms: ['HS256'],
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const role = payload.role ?? payload.papel;
    const isClientToken =
      payload.token_use === 'client' || role === PapelUsuario.CLIENTE;

    if (
      isClientToken &&
      (payload.client_id || payload.token_use === 'client')
    ) {
      const clienteId = payload.client_id ?? payload.sub;
      const cliente = await this.clienteRepository.buscarPorId(
        ClienteId.de(clienteId),
      );
      if (!cliente || !cliente.ativo)
        throw new UnauthorizedException('Acesso negado');

      return {
        sub: cliente.usuarioId ?? cliente.id.valor,
        email: cliente.email,
        papel: PapelUsuario.CLIENTE,
        role: PapelUsuario.CLIENTE,
        token_use: 'client',
        clienteId: cliente.id.valor,
        scopes: this.normalizeScopes(payload.scopes ?? payload.scope),
      };
    }

    const usuario = await this.usuarioRepository.buscarPorId(
      UsuarioId.de(payload.sub),
    );
    if (!usuario || !usuario.ativo)
      throw new UnauthorizedException('Acesso negado');

    return {
      sub: usuario.id.valor,
      email: usuario.email,
      papel: usuario.papel,
      role: usuario.papel,
      token_use: 'operator',
      scopes: this.normalizeScopes(payload.scopes ?? payload.scope),
    };
  }

  private normalizeScopes(scope: string | string[] | undefined): string[] {
    if (Array.isArray(scope)) return scope;
    if (typeof scope === 'string') return scope.split(' ').filter(Boolean);
    return [];
  }
}
