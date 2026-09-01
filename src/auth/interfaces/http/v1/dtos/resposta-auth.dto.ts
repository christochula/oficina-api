import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO de saída retornado pelos endpoints de autenticação (`login` e `refresh`).
 *
 * Contém o par de tokens JWT emitidos pelo {@link AuthService}:
 * - `accessToken`: token de curta duração (padrão 15min) para autenticar requisições.
 * - `refreshToken`: token de longa duração (padrão 7d) para renovar o access token
 *   sem exigir novo login. Deve ser armazenado com segurança pelo cliente.
 */
export class RespostaAuthDto {
  /** JWT de acesso de curta duração; enviado no header `Authorization: Bearer <token>`. */
  @ApiProperty()
  accessToken: string;

  /** JWT de renovação de longa duração; usado exclusivamente no endpoint `POST /auth/refresh`. */
  @ApiProperty()
  refreshToken: string;
}
