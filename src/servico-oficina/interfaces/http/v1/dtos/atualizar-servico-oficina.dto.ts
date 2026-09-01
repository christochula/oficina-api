import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

/**
 * DTO para atualização de um serviço do catálogo.
 * Ao menos um campo deve ser informado.
 */
export class AtualizarServicoOficinaDto {
  @ApiPropertyOptional({ description: 'Novo nome do serviço' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  nome?: string;

  @ApiPropertyOptional({ description: 'Nova descrição (null para remover)' })
  @IsOptional()
  @IsString()
  descricao?: string | null;

  @ApiPropertyOptional({ description: 'Nova categoria (null para remover)' })
  @IsOptional()
  @IsString()
  categoria?: string | null;
}
