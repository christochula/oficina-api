import { SetMetadata } from '@nestjs/common';
import { PapelUsuario } from '../../usuario/domain/papel-usuario.enum';

/** Chave de metadado usada internamente para registrar os papéis exigidos em uma rota. */
export const PAPEIS_KEY = 'papeis';

/**
 * Decorator de rota que define quais papéis de usuário têm permissão de acesso.
 *
 * Deve ser usado em conjunto com {@link PapeisGuard} (e {@link JwtAuthGuard}) para
 * implementar controle de acesso baseado em papéis (RBAC). Pode ser aplicado
 * em métodos de controller ou na classe inteira.
 *
 * @example
 * ```typescript
 * @Papeis(PapelUsuario.ADMINISTRADOR, PapelUsuario.CONSULTOR_TECNICO)
 * @UseGuards(JwtAuthGuard, PapeisGuard)
 * @Get()
 * listar() { ... }
 * ```
 *
 * @param papeis - Um ou mais papéis permitidos para acessar a rota decorada.
 */
export const Papeis = (...papeis: PapelUsuario[]) =>
  SetMetadata(PAPEIS_KEY, papeis);
