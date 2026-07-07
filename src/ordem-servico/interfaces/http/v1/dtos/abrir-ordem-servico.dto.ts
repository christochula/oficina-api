import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  Min,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { TipoDocumento } from '../../../../../cliente/domain/cliente.entity';

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

/** DTO para uma peça informada na abertura da OS. */
class PecaSolicitadaDto {
  @ApiProperty({ description: 'ID da peça no estoque' })
  @IsString()
  pecaId: string;

  @ApiProperty({ description: 'Quantidade solicitada da peça' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantidade: number;
}

class EnderecoClienteAberturaDto {
  @ApiPropertyOptional() @IsOptional() @IsString() logradouro?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() numero?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() complemento?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() bairro?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() cidade?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() estado?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() cep?: string;
}

class ClienteAberturaDto {
  @ApiProperty({ enum: TipoDocumento })
  @IsEnum(TipoDocumento)
  tipoDoc: TipoDocumento;

  @ApiProperty({ description: 'CPF ou CNPJ do cliente' })
  @IsString()
  numeroDoc: string;

  @ApiProperty()
  @IsString()
  nome: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  telefone: string;

  @ApiPropertyOptional({ type: EnderecoClienteAberturaDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => EnderecoClienteAberturaDto)
  endereco?: EnderecoClienteAberturaDto;
}

class VeiculoAberturaDto {
  @ApiProperty()
  @IsString()
  placa: string;

  @ApiProperty()
  @IsString()
  renavam: string;

  @ApiProperty()
  @IsString()
  chassi: string;

  @ApiProperty()
  @IsString()
  marca: string;

  @ApiProperty()
  @IsString()
  modelo: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  ano: number;

  @ApiProperty()
  @IsString()
  cor: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  quilometragem?: number;
}

/**
 * DTO para abertura de uma nova Ordem de Serviço.
 * Ao menos um problema relatado ou um serviço solicitado deve ser informado.
 */
export class AbrirOrdemServicoDto {
  @ApiPropertyOptional({ description: 'ID do cliente que solicita o atendimento' })
  @IsOptional()
  @IsString()
  clienteId?: string;

  @ApiPropertyOptional({ description: 'ID do veículo a ser atendido' })
  @IsOptional()
  @IsString()
  veiculoId?: string;

  @ApiPropertyOptional({
    type: ClienteAberturaDto,
    description: 'Dados do cliente para abertura direta da OS quando clienteId não for informado',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ClienteAberturaDto)
  cliente?: ClienteAberturaDto;

  @ApiPropertyOptional({
    type: VeiculoAberturaDto,
    description: 'Dados do veículo para abertura direta da OS quando veiculoId não for informado',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => VeiculoAberturaDto)
  veiculo?: VeiculoAberturaDto;

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

  @ApiPropertyOptional({
    type: [PecaSolicitadaDto],
    description: 'Peças mencionadas já na abertura da OS',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PecaSolicitadaDto)
  pecasSolicitadas?: PecaSolicitadaDto[];

  @ApiPropertyOptional({ description: 'Notas visíveis ao cliente' })
  @IsOptional()
  @IsString()
  notasCliente?: string;
}
