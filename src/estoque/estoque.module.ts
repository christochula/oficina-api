import { Module } from '@nestjs/common';
import { AtualizarPecaUseCase } from './application/casos-de-uso/atualizar-peca.usecase';
import { BuscarPecaPorIdUseCase } from './application/casos-de-uso/buscar-peca-por-id.usecase';
import { DarEntradaEstoqueUseCase } from './application/casos-de-uso/dar-entrada-estoque.usecase';
import { RegistrarPecaUseCase } from './application/casos-de-uso/registrar-peca.usecase';
import { ESTOQUE_REPOSITORY, ESTOQUE_SERVICE } from './domain/estoque.repository';
import { PrismaEstoqueRepository } from './infrastructure/persistencia/prisma-estoque.repository';
import { EstoqueController } from './interfaces/http/v1/estoque.controller';

/**
 * Módulo NestJS do aggregate Estoque.
 *
 * Registra os casos de uso de gerenciamento de peças e estoque, o controller HTTP
 * e a implementação do repositório e serviço via Prisma.
 *
 * A classe {@link PrismaEstoqueRepository} implementa tanto EstoqueRepository
 * quanto EstoqueService, sendo registrada para os dois tokens de injeção.
 *
 * Tokens exportados:
 * - ESTOQUE_REPOSITORY: consumido por outros repositórios que precisam consultar peças.
 * - ESTOQUE_SERVICE: consumido pelo OrdemServicoModule para processar eventos ConsumoPeca.
 */
@Module({
  controllers: [EstoqueController],
  providers: [
    RegistrarPecaUseCase,
    DarEntradaEstoqueUseCase,
    BuscarPecaPorIdUseCase,
    AtualizarPecaUseCase,
    { provide: ESTOQUE_REPOSITORY, useClass: PrismaEstoqueRepository },
    { provide: ESTOQUE_SERVICE, useClass: PrismaEstoqueRepository },
  ],
  exports: [ESTOQUE_REPOSITORY, ESTOQUE_SERVICE],
})
export class EstoqueModule {}
