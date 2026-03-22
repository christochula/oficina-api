import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

/**
 * DTO de parâmetros de paginação para endpoints que retornam listas.
 *
 * Encapsula os parâmetros de query `pagina` e `porPagina`, ambos opcionais,
 * com valores padrão que garantem comportamento previsível quando omitidos.
 * Deve ser extendido ou composto por DTOs de filtro específicos de cada endpoint
 * que suporte paginação.
 *
 * Os valores são transformados automaticamente de string (query param) para número
 * inteiro pelo `class-transformer`, e validados pelo `class-validator`.
 */
export class PaginacaoDto {
  /**
   * Número da página desejada, base 1.
   * Padrão: 1 (primeira página).
   */
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina: number = 1;

  /**
   * Quantidade de registros por página.
   * Padrão: 20 itens por página.
   */
  @ApiPropertyOptional({ default: 20, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  porPagina: number = 20;
}
