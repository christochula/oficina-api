import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class ProcessarStatusEmailDto {
  @ApiProperty({
    description: 'Novo status recebido da ferramenta externa de e-mail',
    enum: ['APROVADA', 'CANCELADA'],
  })
  @IsString()
  @IsIn(['APROVADA', 'CANCELADA'])
  novoStatus: 'APROVADA' | 'CANCELADA';

  @ApiPropertyOptional({
    description: 'Origem simulada da mensagem externa (ex: caixa-entrada, parser-email)',
  })
  @IsOptional()
  @IsString()
  origemMensagem?: string;

  @ApiPropertyOptional({
    description: 'Identificador da mensagem externa para rastreabilidade/idempotencia funcional',
  })
  @IsOptional()
  @IsString()
  idMensagemExterna?: string;
}