import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard de autenticação para rotas protegidas por JWT de acesso (access token).
 *
 * Delega a validação à {@link JwtStrategy} (estratégia `jwt`). Deve ser aplicado
 * via `@UseGuards(JwtAuthGuard)` em controllers ou métodos que exigem que o
 * usuário esteja autenticado. Retorna 401 Unauthorized se o token for inválido
 * ou estiver ausente.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
