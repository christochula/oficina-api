import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from './jwt.strategy';
import { JWT_AUDIENCE, JWT_ISSUER, jwtSecret } from '../jwt-config';

/**
 * Payload enriquecido do refresh token, que além dos campos base do {@link JwtPayload}
 * carrega o token bruto extraído do header, necessário para a validação do hash armazenado.
 */
export interface JwtRefreshPayload extends JwtPayload {
  refreshToken: string; // Token bruto em texto plano para comparação com o hash no banco
}

/**
 * Estratégia Passport para validação do JWT de renovação (refresh token).
 *
 * Registrada com o nome `jwt-refresh` e utilizada pelo {@link JwtRefreshGuard} no
 * endpoint `POST /api/v1/auth/refresh`. Assina com `JWT_REFRESH_SECRET` (diferente
 * do access token), extrai o token bruto do header para que o {@link AuthService}
 * possa comparar com o hash armazenado no banco de dados, prevenindo reutilização
 * de tokens revogados.
 */
@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false, // Refresh tokens expirados são rejeitados automaticamente
      algorithms: ['HS256'],
      secretOrKey: jwtSecret('JWT_REFRESH_SECRET'),
      issuer: JWT_ISSUER,
      audience: `${JWT_AUDIENCE}:refresh`,
      passReqToCallback: true, // Necessário para acessar o token bruto via req.headers
    });
  }

  /**
   * Callback chamado após a validação do refresh token.
   * Extrai o token bruto do header Authorization e o anexa ao payload retornado.
   * @param req - Objeto da requisição HTTP para extração do token bruto.
   * @param payload - Dados decodificados do refresh token JWT.
   * @returns Payload enriquecido com o campo `refreshToken` para validação do hash.
   */
  validate(req: Request, payload: JwtPayload): JwtRefreshPayload {
    const authHeader = req.get('Authorization') ?? '';
    const refreshToken = authHeader.replace('Bearer', '').trim();
    return { ...payload, refreshToken };
  }
}
