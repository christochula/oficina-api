import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

/**
 * DTO para atualização dos dados cadastrais de uma peça.
 * O código da peça é imutável e não pode ser alterado.
 * Ao menos um campo deve ser informado.
 */
export class AtualizarPecaDto {
  @ApiPropertyOptional({ description: 'Novo nome descritivo da peça' })
  @IsOptional()
  @IsString()
  nome?: string;

  @ApiPropertyOptional({ description: 'Nova descrição da peça (null para remover)' })
  @IsOptional()
  @IsString()
  descricao?: string | null;

  @ApiPropertyOptional({ description: 'Novo preço de venda em reais', minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  precoVenda?: number;
}
