import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEmail, IsOptional, IsString, ValidateNested } from 'class-validator';

/**
 * DTO de endereço para atualização parcial.
 * Campos ausentes mantêm o valor previamente armazenado no aggregate.
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
 * DTO de entrada para a rota PATCH /clientes/:id.
 * Todos os campos são opcionais — apenas os campos enviados serão atualizados.
 * tipoDoc e numeroDoc são propositalmente ausentes pois são imutáveis no domínio.
 */
export class AtualizarClienteDto {
  @ApiPropertyOptional() @IsOptional() @IsString() nome?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() telefone?: string;

  /** Atualização parcial do endereço. Subcampos omitidos preservam o valor existente. */
  @ApiPropertyOptional({ type: EnderecoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => EnderecoDto)
  endereco?: EnderecoDto;
}
