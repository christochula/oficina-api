import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

/** DTO para um problema relatado pelo cliente ao abrir a OS. */
class ProblemaRelatadoDto {
  @ApiProperty({ description: 'Descrição do problema ou sintoma em texto livre' })
  @IsString()
  descricao: string;
}

/**
 * DTO para um serviço solicitado pelo cliente ao abrir a OS.
 * Referencia um serviço do catálogo da oficina.
 */
class ServicoSolicitadoDto {
  @ApiProperty({ description: 'ID do serviço no catálogo da oficina' })
  @IsString()
  servicoId: string;

  @ApiPropertyOptional({
    description: 'Contexto adicional do cliente (ex: "última troca há 10.000 km")',
  })
  @IsOptional()
  @IsString()
  observacao?: string;
}

/**
 * DTO para abertura de uma nova Ordem de Serviço.
 * Ao menos um problema relatado ou um serviço solicitado deve ser informado.
 */
export class AbrirOrdemServicoDto {
  @ApiProperty({ description: 'ID do cliente que solicita o atendimento' })
  @IsString()
  clienteId: string;

  @ApiProperty({ description: 'ID do veículo a ser atendido' })
  @IsString()
  veiculoId: string;

  @ApiPropertyOptional({
    type: [ProblemaRelatadoDto],
    description: 'Problemas relatados em texto livre (ao menos um entre este e servicosSolicitados)',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProblemaRelatadoDto)
  problemasRelatados?: ProblemaRelatadoDto[];

  @ApiPropertyOptional({
    type: [ServicoSolicitadoDto],
    description: 'Serviços do catálogo solicitados pelo cliente (ao menos um entre este e problemasRelatados)',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServicoSolicitadoDto)
  servicosSolicitados?: ServicoSolicitadoDto[];

  @ApiPropertyOptional({ description: 'Notas internas da oficina (não visíveis ao cliente)' })
  @IsOptional()
  @IsString()
  notasInternas?: string;

  @ApiPropertyOptional({ description: 'Notas visíveis ao cliente' })
  @IsOptional()
  @IsString()
  notasCliente?: string;
}
