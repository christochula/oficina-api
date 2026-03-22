import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PapelUsuario } from '../../usuario/domain/papel-usuario.enum';

/**
 * Formato do payload contido no JWT de acesso (access token).
 *
 * - `sub`: ID do usuário (ULID com prefixo `us`) — sujeito do token.
 * - `email`: E-mail do usuário para rastreabilidade nos logs.
 * - `papel`: Papel do usuário para autorização baseada em papéis via {@link PapeisGuard}.
 */
export interface JwtPayload {
  sub: string;
  email: string;
  papel: PapelUsuario;
}

/**
 * Estratégia Passport para validação do JWT de acesso (access token).
 *
 * Registrada com o nome `jwt` e utilizada pelo {@link JwtAuthGuard} para proteger
 * rotas que requerem autenticação. Extrai o token do header `Authorization: Bearer <token>`,
 * valida a assinatura com `JWT_SECRET` e rejeita tokens expirados.
 * O payload validado é injetado em `request.user` para uso nos controllers.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false, // Tokens expirados são rejeitados automaticamente
      secretOrKey: process.env.JWT_SECRET ?? 'secret',
    });
  }

  /**
   * Callback chamado após a validação bem-sucedida da assinatura e expiração do JWT.
   * Retorna o payload que será atribuído a `request.user` na requisição.
   * @param payload - Dados decodificados do token JWT.
   */
  validate(payload: JwtPayload): JwtPayload {
    return payload;
  }
}
