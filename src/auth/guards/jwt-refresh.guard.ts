import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard de autenticação exclusivo para o endpoint de renovação de tokens.
 *
 * Delega a validação à {@link JwtRefreshStrategy} (estratégia `jwt-refresh`).
 * Deve ser aplicado apenas no endpoint `POST /api/v1/auth/refresh`. Retorna 401
 * Unauthorized se o refresh token for inválido, expirado ou não corresponder
 * ao hash armazenado no banco de dados.
 */
@Injectable()
export class JwtRefreshGuard extends AuthGuard('jwt-refresh') {}
