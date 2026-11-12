import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginacaoDto } from './paginacao.dto';

export class CatalogQueryDto extends PaginacaoDto {
  @ApiPropertyOptional({
    description:
      'Busca global por identificação e descrição, sem distinguir caixa ou acentos.',
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
    type: Boolean,
    description: 'Filtra cadastros ativos ou inativos.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean({ message: 'ativo deve ser true ou false.' })
  ativo?: boolean;
}
