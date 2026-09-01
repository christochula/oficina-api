import { Module } from '@nestjs/common';
import { AtualizarClienteUseCase } from './application/casos-de-uso/atualizar-cliente.usecase';
import { AtivarClienteUseCase } from './application/casos-de-uso/ativar-cliente.usecase';
import { BuscarClientePorNumeroDocUseCase } from './application/casos-de-uso/buscar-cliente-por-cpf.usecase';
import { BuscarClientePorUsuarioUseCase } from './application/casos-de-uso/buscar-cliente-por-usuario.usecase';
import { CriarClienteUseCase } from './application/casos-de-uso/criar-cliente.usecase';
import { DesativarClienteUseCase } from './application/casos-de-uso/desativar-cliente.usecase';
import { ListarClientesUseCase } from './application/casos-de-uso/listar-clientes.usecase';
import { CLIENTE_REPOSITORY } from './domain/cliente.repository';
import { PrismaClienteRepository } from './infrastructure/persistencia/prisma-cliente.repository';
import { ClienteController } from './interfaces/http/v1/cliente.controller';
import { UsuarioModule } from '../usuario/usuario.module';

/**
 * Módulo NestJS do bounded context de Clientes.
 * Registra o controller, os casos de uso e a implementação concreta do repositório.
 * Exporta o token CLIENTE_REPOSITORY para que outros módulos (ex: OrdemServico)
 * possam injetar o repositório sem depender diretamente da implementação Prisma.
 */
@Module({
  imports: [UsuarioModule],
  controllers: [ClienteController],
  providers: [
    CriarClienteUseCase,
    BuscarClientePorNumeroDocUseCase,
    BuscarClientePorUsuarioUseCase,
    AtualizarClienteUseCase,
    DesativarClienteUseCase,
    AtivarClienteUseCase,
    ListarClientesUseCase,
    { provide: CLIENTE_REPOSITORY, useClass: PrismaClienteRepository },
  ],
  exports: [CLIENTE_REPOSITORY, BuscarClientePorUsuarioUseCase],
})
export class ClienteModule {}
