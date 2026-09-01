import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PapelUsuario } from '../../../../domain/papel-usuario.enum';
import { MaxBcryptPasswordBytes } from '../../../../../shared/http/validators/bcrypt-password.validator';

/**
 * DTO de entrada para criação de um novo usuário no sistema da oficina.
 *
 * Utilizado pelo endpoint `POST /api/v1/usuarios`. Os dados são validados pelo
 * `ValidationPipe` global antes de chegar ao caso de uso {@link CriarUsuarioUseCase}.
 * A senha é recebida em texto plano aqui e convertida em hash bcrypt pelo caso de uso.
 */
export class CriarUsuarioDto {
  /** Nome completo do usuário para exibição no sistema. */
  @ApiProperty({ minLength: 2, maxLength: 120 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nome: string;

  /** E-mail único do usuário; usado como identificador no login. */
  @ApiProperty({ maxLength: 254 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email: string;

  /** Senha em texto plano — mínimo de 6 caracteres; será armazenada como hash bcrypt. */
  @ApiProperty({ minLength: 6, maxLength: 72 })
  @IsString()
  @MinLength(6)
  @MaxLength(72)
  @MaxBcryptPasswordBytes()
  senha: string;

  /** Papel que define as permissões do usuário dentro do sistema da oficina. */
  @ApiProperty({ enum: PapelUsuario })
  @IsEnum(PapelUsuario)
  papel: PapelUsuario;
}
