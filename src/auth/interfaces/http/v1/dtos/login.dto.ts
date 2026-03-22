import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

/**
 * DTO de entrada para o endpoint de login `POST /api/v1/auth/login`.
 *
 * Recebe as credenciais do usuário em texto plano. A senha é comparada
 * com o hash bcrypt armazenado pelo {@link AuthService} — nunca é persistida.
 */
export class LoginDto {
  /** E-mail cadastrado do usuário; usado como identificador único no login. */
  @ApiProperty()
  @IsEmail()
  email: string;

  /** Senha em texto plano do usuário; será validada contra o hash bcrypt armazenado. */
  @ApiProperty()
  @IsString()
  senha: string;
}
