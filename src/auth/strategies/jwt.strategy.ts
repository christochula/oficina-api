import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PapelUsuario } from '../../usuario/domain/papel-usuario.enum';
import { UsuarioId } from '../../usuario/domain/usuario-id.value-object';
import { USUARIO_REPOSITORY } from '../../usuario/domain/usuario.repository';
import type { UsuarioRepository } from '../../usuario/domain/usuario.repository';

export interface JwtPayload {
  sub: string;
  email: string;
  papel: PapelUsuario;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    @Inject(USUARIO_REPOSITORY)
    private readonly usuarioRepository: UsuarioRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'secret',
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const usuario = await this.usuarioRepository.buscarPorId(UsuarioId.de(payload.sub));
    if (!usuario || !usuario.ativo) {
      throw new UnauthorizedException('Acesso negado');
    }

    return {
      sub: usuario.id.valor,
      email: usuario.email,
      papel: usuario.papel,
    };
  }
}
