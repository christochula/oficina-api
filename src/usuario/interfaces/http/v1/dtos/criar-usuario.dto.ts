import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';
import { PapelUsuario } from '../../../../domain/papel-usuario.enum';

/**
 * DTO de entrada para criação de um novo usuário no sistema da oficina.
 *
 * Utilizado pelo endpoint `POST /api/v1/usuarios`. Os dados são validados pelo
 * `ValidationPipe` global antes de chegar ao caso de uso {@link CriarUsuarioUseCase}.
 * A senha é recebida em texto plano aqui e convertida em hash bcrypt pelo caso de uso.
 */
export class CriarUsuarioDto {
  /** Nome completo do usuário para exibição no sistema. */
  @ApiProperty()
  @IsString()
  nome: string;

  /** E-mail único do usuário; usado como identificador no login. */
  @ApiProperty()
  @IsEmail()
  email: string;

  /** Senha em texto plano — mínimo de 6 caracteres; será armazenada como hash bcrypt. */
  @ApiProperty({ minLength: 6 })
  @IsString()
  @MinLength(6)
  senha: string;

  /** Papel que define as permissões do usuário dentro do sistema da oficina. */
  @ApiProperty({ enum: PapelUsuario })
  @IsEnum(PapelUsuario)
  papel: PapelUsuario;
}
