import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { JwtPayload } from '../strategies/jwt.strategy';

/**
 * Decorator de parâmetro que injeta o payload do usuário autenticado no método do controller.
 *
 * Extrai o objeto `request.user` populado pelo Passport após a validação bem-sucedida
 * do JWT. Deve ser usado apenas em rotas protegidas por {@link JwtAuthGuard} ou
 * {@link JwtRefreshGuard}, pois depende de `request.user` estar disponível.
 *
 * @example
 * ```typescript
 * @Get('perfil')
 * @UseGuards(JwtAuthGuard)
 * perfil(@UsuarioAtual() usuario: JwtPayload) {
 *   return usuario.sub; // ID do usuário autenticado
 * }
 * ```
 */
export const UsuarioAtual = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    const req = ctx.switchToHttp().getRequest<{ user: JwtPayload }>();
    return req.user;
  },
);
