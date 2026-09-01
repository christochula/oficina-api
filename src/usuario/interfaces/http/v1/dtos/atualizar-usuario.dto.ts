import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { PAPEIS_USUARIO_INTERNOS } from '../../../../domain/papel-usuario.enum';
import type { PapelUsuarioInterno } from '../../../../domain/papel-usuario.enum';
import { MaxBcryptPasswordBytes } from '../../../../../shared/http/validators/bcrypt-password.validator';

/** Campos permitidos na atualização administrativa de um usuário interno. */
export class AtualizarUsuarioDto {
  @ApiPropertyOptional({ minLength: 2, maxLength: 120 })
  @ValidateIf((_obj, value) => value !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nome?: string;

  @ApiPropertyOptional({ maxLength: 254 })
  @ValidateIf((_obj, value) => value !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @ApiPropertyOptional({ enum: PAPEIS_USUARIO_INTERNOS })
  @ValidateIf((_obj, value) => value !== undefined)
  @IsIn([...PAPEIS_USUARIO_INTERNOS])
  papel?: PapelUsuarioInterno;

  @ApiPropertyOptional({
    description: 'Nova senha; será armazenada somente como hash bcrypt.',
    minLength: 6,
    maxLength: 72,
  })
  @ValidateIf((_obj, value) => value !== undefined)
  @IsString()
  @MinLength(6)
  @MaxLength(72)
  @MaxBcryptPasswordBytes()
  senha?: string;
}
