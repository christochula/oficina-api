import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PapelUsuario } from '../../usuario/domain/papel-usuario.enum';
import { PAPEIS_KEY } from '../decorators/papeis.decorator';
import { JwtPayload } from '../strategies/jwt.strategy';

/**
 * Guard de autorização baseado em papéis (RBAC) para o sistema da oficina.
 *
 * Verifica se o usuário autenticado possui ao menos um dos papéis definidos
 * pelo decorator {@link Papeis} na rota ou no controller. Deve ser usado
 * em conjunto com {@link JwtAuthGuard}, pois depende de `request.user` populado
 * pela estratégia JWT. Se nenhum papel for requerido na rota, libera o acesso.
 */
@Injectable()
export class PapeisGuard implements CanActivate {
  /**
   * @param reflector - Utilitário NestJS para leitura de metadados de decorators.
   */
  constructor(private readonly reflector: Reflector) {}

  /**
   * Determina se o usuário autenticado tem permissão para acessar a rota.
   * Lê os papéis requeridos via metadado {@link PAPEIS_KEY} e compara com o
   * papel presente no payload JWT do usuário autenticado.
   * @param context - Contexto de execução da requisição HTTP.
   * @returns `true` se o usuário possui o papel necessário; `false` caso contrário.
   */
  canActivate(context: ExecutionContext): boolean {
    const papeisRequeridos = this.reflector.getAllAndOverride<PapelUsuario[]>(PAPEIS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!papeisRequeridos || papeisRequeridos.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<{ user: JwtPayload }>();
    return papeisRequeridos.includes(user.papel);
  }
}
