import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import type { StatusExternoOS } from '../../../../application/casos-de-uso/processar-atualizacao-status-externa.usecase';

export const STATUS_EXTERNOS_EMAIL: StatusExternoOS[] = [
  'RECEBIDA',
  'DIAGNOSTICO',
  'EM_DIAGNOSTICO',
  'AGUARDANDO_APROVACAO',
  'EXECUCAO',
  'EM_EXECUCAO',
  'FINALIZADA',
  'ENTREGUE',
  'APROVADA',
  'CANCELADA',
];

export class ProcessarStatusEmailDto {
  @ApiProperty({
    description: 'Novo status recebido da ferramenta externa de e-mail',
    enum: STATUS_EXTERNOS_EMAIL,
  })
  @IsString()
  @IsIn(STATUS_EXTERNOS_EMAIL)
  novoStatus: StatusExternoOS;

  @ApiPropertyOptional({
    description:
      'Origem simulada da mensagem externa (ex: caixa-entrada, parser-email)',
  })
  @IsOptional()
  @IsString()
  origemMensagem?: string;

  @ApiPropertyOptional({
    description:
      'Identificador da mensagem externa para rastreabilidade/idempotencia funcional',
  })
  @IsOptional()
  @IsString()
  idMensagemExterna?: string;
}
