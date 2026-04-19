import { Module } from '@nestjs/common';
import { ClienteModule } from '../cliente/cliente.module';
import { EstoqueModule } from '../estoque/estoque.module';
import { ServicoOficinaModule } from '../servico-oficina/servico-oficina.module';
import { UsuarioModule } from '../usuario/usuario.module';
import { VeiculoModule } from '../veiculo/veiculo.module';
import { AbrirOrdemServicoUseCase } from './application/casos-de-uso/abrir-ordem-servico.usecase';
import { AprovarOrcamentoUseCase } from './application/casos-de-uso/aprovar-orcamento.usecase';
import { AtribuirOrdemServicoUseCase } from './application/casos-de-uso/atribuir-ordem-servico.usecase';
import { BuscarMinhaOrdemServicoUseCase } from './application/casos-de-uso/buscar-minha-ordem-servico.usecase';
import { BuscarStatusOrdemServicoPublicoUseCase } from './application/casos-de-uso/buscar-status-ordem-servico-publico.usecase';
import { BuscarOrdemServicoPorIdUseCase } from './application/casos-de-uso/buscar-ordem-servico-por-id.usecase';
import { EntregarVeiculoUseCase } from './application/casos-de-uso/entregar-veiculo.usecase';
import { FinalizarOrdemServicoUseCase } from './application/casos-de-uso/finalizar-ordem-servico.usecase';
import { GerarOrcamentoUseCase } from './application/casos-de-uso/gerar-orcamento.usecase';
import { IniciarExecucaoUseCase } from './application/casos-de-uso/iniciar-execucao.usecase';
import { ListarMinhasOrdensServicoUseCase } from './application/casos-de-uso/listar-minhas-ordens-servico.usecase';
import { ListarOrdensServicoUseCase } from './application/casos-de-uso/listar-ordens-servico.usecase';
import { ListarOrdensMecanicoUseCase } from './application/casos-de-uso/listar-ordens-mecanico.usecase';
import { BuscarOrdemServicoMecanicoUseCase } from './application/casos-de-uso/buscar-ordem-servico-mecanico.usecase';
import { RegistrarConsumoPecaUseCase } from './application/casos-de-uso/registrar-consumo-peca.usecase';
import { RegistrarDiagnosticoUseCase } from './application/casos-de-uso/registrar-diagnostico.usecase';
import { RejeitarOrcamentoUseCase } from './application/casos-de-uso/rejeitar-orcamento.usecase';
import { KpisOrdemServicoUseCase } from './application/casos-de-uso/kpis-ordem-servico.usecase';
import { RelatorioLeadTimeUseCase } from './application/casos-de-uso/relatorio-lead-time.usecase';
import { TempoCicloPersonalizadoUseCase } from './application/casos-de-uso/tempo-ciclo-personalizado.usecase';
import { NOTIFICACAO_ORCAMENTO_GATEWAY } from './domain/notificacao-orcamento.gateway';
import { ORDEM_SERVICO_REPOSITORY } from './domain/ordem-servico.repository';
import { ConsoleNotificacaoOrcamentoGateway } from './infrastructure/notificacao/console-notificacao-orcamento.gateway';
import { PrismaOrdemServicoRepository } from './infrastructure/persistencia/prisma-ordem-servico.repository';
import { OrdemServicoPublicoController } from './interfaces/http/v1/ordem-servico-publico.controller';
import { OrdemServicoController } from './interfaces/http/v1/ordem-servico.controller';

/**
 * Módulo NestJS do aggregate OrdemServico.
 *
 * Registra todos os casos de uso do ciclo de vida das OS, o controller HTTP
 * e a implementação do repositório via Prisma.
 *
 * Dependências externas importadas:
 * - UsuarioModule: para buscar mecânicos no caso de uso de atribuição.
 * - ClienteModule: para validar existência do cliente ao abrir OS.
 * - VeiculoModule: para validar existência do veículo ao abrir OS.
 * - EstoqueModule: para processar eventos ConsumoPeca e dar baixa no estoque.
 */
@Module({
  imports: [UsuarioModule, ClienteModule, VeiculoModule, EstoqueModule, ServicoOficinaModule],
  controllers: [OrdemServicoController, OrdemServicoPublicoController],
  providers: [
    AbrirOrdemServicoUseCase,
    AtribuirOrdemServicoUseCase,
    RegistrarDiagnosticoUseCase,
    GerarOrcamentoUseCase,
    AprovarOrcamentoUseCase,
    RejeitarOrcamentoUseCase,
    IniciarExecucaoUseCase,
    RegistrarConsumoPecaUseCase,
    FinalizarOrdemServicoUseCase,
    EntregarVeiculoUseCase,
    BuscarOrdemServicoPorIdUseCase,
    BuscarStatusOrdemServicoPublicoUseCase,
    ListarOrdensServicoUseCase,
    BuscarMinhaOrdemServicoUseCase,
    ListarMinhasOrdensServicoUseCase,
    ListarOrdensMecanicoUseCase,
    BuscarOrdemServicoMecanicoUseCase,
    RelatorioLeadTimeUseCase,
    KpisOrdemServicoUseCase,
    TempoCicloPersonalizadoUseCase,
    { provide: ORDEM_SERVICO_REPOSITORY, useClass: PrismaOrdemServicoRepository },
    { provide: NOTIFICACAO_ORCAMENTO_GATEWAY, useClass: ConsoleNotificacaoOrcamentoGateway },
  ],
})
export class OrdemServicoModule {}
