import { Module } from '@nestjs/common';
import { AtivarServicoOficinaUseCase } from './application/casos-de-uso/ativar-servico-oficina.usecase';
import { AtualizarServicoOficinaUseCase } from './application/casos-de-uso/atualizar-servico-oficina.usecase';
import { BuscarServicoOficinaPorIdUseCase } from './application/casos-de-uso/buscar-servico-oficina-por-id.usecase';
import { DesativarServicoOficinaUseCase } from './application/casos-de-uso/desativar-servico-oficina.usecase';
import { ListarServicosOficinaUseCase } from './application/casos-de-uso/listar-servicos-oficina.usecase';
import { RegistrarServicoOficinaUseCase } from './application/casos-de-uso/registrar-servico-oficina.usecase';
import { SERVICO_OFICINA_REPOSITORY } from './domain/servico-oficina.repository';
import { PrismaServicoOficinaRepository } from './infrastructure/persistencia/prisma-servico-oficina.repository';
import { ServicoOficinaController } from './interfaces/http/v1/servico-oficina.controller';

/**
 * Módulo NestJS do catálogo de serviços da oficina.
 *
 * Exporta SERVICO_OFICINA_REPOSITORY para que outros módulos
 * (ex: OrdemServicoModule) possam validar servicoIds ao abrir uma OS.
 */
@Module({
  controllers: [ServicoOficinaController],
  providers: [
    RegistrarServicoOficinaUseCase,
    ListarServicosOficinaUseCase,
    BuscarServicoOficinaPorIdUseCase,
    AtualizarServicoOficinaUseCase,
    DesativarServicoOficinaUseCase,
    AtivarServicoOficinaUseCase,
    { provide: SERVICO_OFICINA_REPOSITORY, useClass: PrismaServicoOficinaRepository },
  ],
  exports: [SERVICO_OFICINA_REPOSITORY],
})
export class ServicoOficinaModule {}
