import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

/**
 * DTO para registro de um novo serviço no catálogo da oficina.
 */
export class RegistrarServicoOficinaDto {
  @ApiProperty({
    description: 'Nome do serviço (ex: "Troca de Óleo", "Alinhamento")',
  })
  @IsString()
  @MinLength(2)
  nome: string;

  @ApiPropertyOptional({ description: 'Descrição detalhada do serviço' })
  @IsOptional()
  @IsString()
  descricao?: string;

  @ApiPropertyOptional({
    description:
      'Categoria do serviço (ex: "Manutenção Preventiva", "Diagnóstico")',
  })
  @IsOptional()
  @IsString()
  categoria?: string;
}
