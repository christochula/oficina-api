import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

/**
 * DTO de entrada para a rota POST /veiculos.
 * Define e valida os dados obrigatórios para o registro de um veículo na oficina.
 * Placa, RENAVAM e chassi são campos imutáveis no domínio após o cadastro.
 * O ano mínimo aceito é 1900 para cobrir veículos históricos/clássicos.
 */
export class CriarVeiculoDto {
  /** Placa do veículo. Deve ser única no sistema — retorna 409 se já cadastrada. */
  @ApiProperty() @IsString() placa: string;
  /** Registro Nacional de Veículos Automotores (11 dígitos). */
  @ApiProperty() @IsString() renavam: string;
  /** Número do chassi gravado na estrutura do veículo (17 caracteres no padrão internacional). */
  @ApiProperty() @IsString() chassi: string;
  @ApiProperty() @IsString() marca: string;
  @ApiProperty() @IsString() modelo: string;
  /** Ano de fabricação. Deve ser igual ou superior a 1900. */
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1900) ano: number;
  @ApiProperty() @IsString() cor: string;
  /** Quilometragem atual. Se não informado, o veículo é cadastrado com 0 km. */
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) quilometragem?: number;
}
