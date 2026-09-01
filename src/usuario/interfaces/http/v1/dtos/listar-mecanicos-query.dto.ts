import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginacaoDto } from '../../../../../shared/http/dtos/paginacao.dto';

/** Parâmetros de consulta da listagem de usuários mecânicos. */
export class ListarMecanicosQueryDto extends PaginacaoDto {
  @ApiPropertyOptional({
    description: 'Trecho do nome, e-mail ou ID do mecânico.',
    maxLength: 120,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(120)
  busca?: string;

  @ApiPropertyOptional({
    description: 'Filtra mecânicos pelo estado ativo ou inativo.',
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
