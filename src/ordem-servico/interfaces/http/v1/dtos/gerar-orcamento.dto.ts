import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { TipoLinhaServico } from '../../../../domain/value-objects/linha-servico.vo';

/**
 * DTO para uma linha individual dentro de um grupo do orçamento.
 */
class LinhaServicoDto {
  @ApiProperty({
    enum: TipoLinhaServico,
    description: 'MATERIAL (peça) ou SERVICO (mão de obra)',
  })
  @IsEnum(TipoLinhaServico)
  tipo: TipoLinhaServico;

  @ApiProperty({ description: 'Descrição do serviço ou material' })
  @IsString()
  descricao: string;

  @ApiProperty({ description: 'Quantidade de unidades (deve ser positiva)' })
  @IsNumber()
  @IsPositive()
  quantidade: number;

  @ApiProperty({ description: 'Valor unitário em reais (zero ou positivo)' })
  @IsNumber()
  @Min(0)
  valorUnitario: number;

  @ApiPropertyOptional({
    description: 'ID da peça do estoque (apenas para linhas MATERIAL)',
  })
  @IsOptional()
  @IsString()
  pecaId?: string;
}

/**
 * DTO para um grupo de itens dentro do orçamento.
 * O mecânico organiza o orçamento em grupos temáticos com título livre.
 * Ex: "Retífica do Motor", "Troca de Óleo", "Retífica dos Discos de Freio".
 */
class GrupoOrcamentoDto {
  @ApiProperty({
    description: 'Título descritivo do grupo (ex: "Retífica do Motor")',
  })
  @IsString()
  titulo: string;

  @ApiProperty({
    type: [LinhaServicoDto],
    description: 'Linhas de serviço do grupo (ao menos uma)',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LinhaServicoDto)
  linhas: LinhaServicoDto[];
}

/**
 * DTO para geração do orçamento de uma OS.
 *
 * O orçamento é composto por grupos temáticos (GrupoOrcamentoDto), cada um
 * com um título livre e linhas de MATERIAL e/ou SERVICO.
 *
 * Pode incluir notas internas (da equipe da oficina) e notas para o cliente.
 */
export class GerarOrcamentoDto {
  @ApiProperty({
    type: [GrupoOrcamentoDto],
    description:
      'Grupos de itens do orçamento (ao menos um grupo com ao menos uma linha)',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GrupoOrcamentoDto)
  grupos: GrupoOrcamentoDto[];

  @ApiPropertyOptional({
    description:
      'Notas internas da equipe da oficina (não visíveis ao cliente)',
  })
  @IsOptional()
  @IsString()
  notasInternas?: string;

  @ApiPropertyOptional({
    description: 'Notas enviadas ao cliente junto com o orçamento',
  })
  @IsOptional()
  @IsString()
  notasCliente?: string;
}
