import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class ProcessarAprovacaoExternaDto {
  @ApiProperty({ description: 'ID da ordem de servico' })
  @IsString()
  osId: string;

  @ApiProperty({
    description: 'Decisao externa do orcamento',
    enum: ['APROVADO', 'RECUSADO'],
  })
  @IsString()
  @IsIn(['APROVADO', 'RECUSADO'])
  decisao: 'APROVADO' | 'RECUSADO';

  @ApiPropertyOptional({ description: 'Origem da notificacao externa' })
  @IsOptional()
  @IsString()
  origem?: string;
}
