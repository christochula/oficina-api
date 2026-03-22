import { Module } from '@nestjs/common';
import { AtualizarVeiculoUseCase } from './application/casos-de-uso/atualizar-veiculo.usecase';
import { BuscarVeiculoPorPlacaUseCase } from './application/casos-de-uso/buscar-veiculo-por-placa.usecase';
import { CriarVeiculoUseCase } from './application/casos-de-uso/criar-veiculo.usecase';
import { ListarVeiculosUseCase } from './application/casos-de-uso/listar-veiculos.usecase';
import { VEICULO_REPOSITORY } from './domain/veiculo.repository';
import { PrismaVeiculoRepository } from './infrastructure/persistencia/prisma-veiculo.repository';
import { VeiculoController } from './interfaces/http/v1/veiculo.controller';

/**
 * Módulo NestJS do bounded context de Veículos.
 * Registra o controller, os casos de uso e a implementação concreta do repositório.
 * Exporta o token VEICULO_REPOSITORY para que outros módulos (ex: OrdemServico)
 * possam injetar o repositório sem depender diretamente da implementação Prisma.
 */
@Module({
  controllers: [VeiculoController],
  providers: [
    CriarVeiculoUseCase,
    BuscarVeiculoPorPlacaUseCase,
    AtualizarVeiculoUseCase,
    ListarVeiculosUseCase,
    { provide: VEICULO_REPOSITORY, useClass: PrismaVeiculoRepository },
  ],
  exports: [VEICULO_REPOSITORY],
})
export class VeiculoModule {}
