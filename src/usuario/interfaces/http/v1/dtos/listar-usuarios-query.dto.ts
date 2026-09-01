import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginacaoDto } from '../../../../../shared/http/dtos/paginacao.dto';
import { PAPEIS_USUARIO_INTERNOS } from '../../../../domain/papel-usuario.enum';
import type { PapelUsuarioInterno } from '../../../../domain/papel-usuario.enum';

/** Parâmetros da listagem administrativa de usuários internos. */
export class ListarUsuariosQueryDto extends PaginacaoDto {
  @ApiPropertyOptional({
    description: 'Trecho do nome, e-mail ou ID do usuário.',
    maxLength: 120,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(120)
  busca?: string;

  @ApiPropertyOptional({ enum: PAPEIS_USUARIO_INTERNOS })
  @IsOptional()
  @IsIn([...PAPEIS_USUARIO_INTERNOS])
  papel?: PapelUsuarioInterno;

  @ApiPropertyOptional({
    description: 'Filtra usuários pelo estado ativo ou inativo.',
    type: Boolean,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return value;
  })
  @IsBoolean({ message: 'ativo deve ser true ou false.' })
  ativo?: boolean;
}
