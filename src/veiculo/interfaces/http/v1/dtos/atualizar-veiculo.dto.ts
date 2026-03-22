import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

/**
 * DTO de entrada para a rota PATCH /veiculos/:id.
 * Expõe apenas os campos editáveis de um veículo: cor e quilometragem.
 * Placa, RENAVAM, chassi, marca, modelo e ano são propositalmente ausentes pois são imutáveis no domínio.
 * Campos omitidos na requisição preservam o valor atualmente armazenado.
 */
export class AtualizarVeiculoDto {
  /** Nova cor do veículo. Informe apenas se o veículo foi repintado ou personalizado. */
  @ApiPropertyOptional() @IsOptional() @IsString() cor?: string;
  /** Quilometragem atual do veículo. Deve ser maior ou igual a zero. */
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) quilometragem?: number;
}
