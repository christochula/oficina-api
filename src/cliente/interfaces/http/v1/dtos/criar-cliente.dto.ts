import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { IsValidDocumentForType } from '../../../../../shared/http/validators/documento-tipo.validator';
import { TipoDocumento } from '../../../../domain/cliente.entity';

/**
 * DTO de endereço utilizado tanto na criação quanto implicitamente na atualização.
 * Todos os campos são opcionais para permitir cadastro parcial de endereço.
 */
class EnderecoDto {
  @ApiPropertyOptional() @IsOptional() @IsString() logradouro?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() numero?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() complemento?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() bairro?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() cidade?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() estado?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() cep?: string;
}

/**
 * DTO de entrada para a rota POST /clientes.
 * Define e valida os dados obrigatórios para o primeiro cadastro de um cliente na oficina.
 * O campo numeroDoc é validado condicionalmente: CPF quando tipoDoc = CPF, CNPJ quando tipoDoc = CNPJ.
 * Após o cadastro, tipoDoc e numeroDoc tornam-se imutáveis no domínio.
 */
export class CriarClienteDto {
  /** Tipo de documento fiscal: CPF (pessoa física) ou CNPJ (pessoa jurídica). */
  @ApiProperty({ enum: TipoDocumento })
  @IsEnum(TipoDocumento)
  tipoDoc: TipoDocumento;

  /**
   * Número do documento sem formatação (apenas dígitos).
   * Validado como CPF se tipoDoc = CPF, como CNPJ se tipoDoc = CNPJ.
   * Deve ser único no sistema — retorna 409 se já cadastrado.
   */
  @ApiProperty({ description: 'CPF ou CNPJ sem formatação' })
  @IsString()
  @IsValidDocumentForType()
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

  @ApiPropertyOptional({
    description:
      'ID do usuario CLIENTE a ser vinculado ao cadastro (prefixo us)',
  })
  @IsOptional()
  @IsString()
  usuarioId?: string;

  /** Endereço do cliente. Todos os subcampos são opcionais. */
  @ApiPropertyOptional({ type: EnderecoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => EnderecoDto)
  endereco?: EnderecoDto;
}
