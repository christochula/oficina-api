import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  Version,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../auth/guards/jwt-auth.guard';
import { PapeisGuard } from '../../../../auth/guards/papeis.guard';
import { Papeis } from '../../../../auth/decorators/papeis.decorator';
import { UsuarioAtual } from '../../../../auth/decorators/usuario-atual.decorator';
import type { JwtPayload } from '../../../../auth/strategies/jwt.strategy';
import { PaginacaoDto } from '../../../../shared/http/dtos/paginacao.dto';
import { PapelUsuario } from '../../../../usuario/domain/papel-usuario.enum';
import { AbrirOrdemServicoUseCase } from '../../../application/casos-de-uso/abrir-ordem-servico.usecase';
import { AprovarOrcamentoUseCase } from '../../../application/casos-de-uso/aprovar-orcamento.usecase';
import { AtribuirOrdemServicoUseCase } from '../../../application/casos-de-uso/atribuir-ordem-servico.usecase';
import { BuscarMinhaOrdemServicoUseCase } from '../../../application/casos-de-uso/buscar-minha-ordem-servico.usecase';
import { BuscarOrdemServicoPorIdUseCase } from '../../../application/casos-de-uso/buscar-ordem-servico-por-id.usecase';
import { EntregarVeiculoUseCase } from '../../../application/casos-de-uso/entregar-veiculo.usecase';
import { FinalizarOrdemServicoUseCase } from '../../../application/casos-de-uso/finalizar-ordem-servico.usecase';
import { GerarOrcamentoUseCase } from '../../../application/casos-de-uso/gerar-orcamento.usecase';
import { IniciarExecucaoUseCase } from '../../../application/casos-de-uso/iniciar-execucao.usecase';
import { ListarMinhasOrdensServicoUseCase } from '../../../application/casos-de-uso/listar-minhas-ordens-servico.usecase';
import { ListarOrdensServicoUseCase } from '../../../application/casos-de-uso/listar-ordens-servico.usecase';
import { ListarOrdensMecanicoUseCase } from '../../../application/casos-de-uso/listar-ordens-mecanico.usecase';
import { BuscarOrdemServicoMecanicoUseCase } from '../../../application/casos-de-uso/buscar-ordem-servico-mecanico.usecase';
import { RegistrarConsumoPecaUseCase } from '../../../application/casos-de-uso/registrar-consumo-peca.usecase';
import { RegistrarDiagnosticoUseCase } from '../../../application/casos-de-uso/registrar-diagnostico.usecase';
import { RejeitarOrcamentoUseCase } from '../../../application/casos-de-uso/rejeitar-orcamento.usecase';
import { KpisOrdemServicoUseCase } from '../../../application/casos-de-uso/kpis-ordem-servico.usecase';
import { RelatorioLeadTimeUseCase } from '../../../application/casos-de-uso/relatorio-lead-time.usecase';
import { TempoCicloPersonalizadoUseCase } from '../../../application/casos-de-uso/tempo-ciclo-personalizado.usecase';
import { AbrirOrdemServicoDto } from './dtos/abrir-ordem-servico.dto';
import { GerarOrcamentoDto } from './dtos/gerar-orcamento.dto';

/**
 * Controller HTTP para o recurso Ordens de Serviço.
 * Expõe os endpoints REST da API v1 para o ciclo de vida completo das OS.
 *
 * Todos os endpoints requerem autenticação JWT e autorização por papel.
 * Os endpoints estão divididos em dois grupos:
 * - Usuários internos (ADMINISTRADOR, CONSULTOR_TECNICO, MECANICO): acesso irrestrito.
 * - CLIENTE: acesso apenas às suas próprias OS (prefixo `/minhas`).
 *
 * Rota base: `/api/v1/ordens-servico`
 */
@ApiTags('Ordens de Serviço')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PapeisGuard)
@Controller('ordens-servico')
export class OrdemServicoController {
  /**
   * Injeta todos os casos de uso necessários para o ciclo de vida das OS.
   */
  constructor(
    private readonly abrirOS: AbrirOrdemServicoUseCase,
    private readonly atribuirOS: AtribuirOrdemServicoUseCase,
    private readonly registrarDiagnostico: RegistrarDiagnosticoUseCase,
    private readonly gerarOrcamento: GerarOrcamentoUseCase,
    private readonly aprovarOrcamento: AprovarOrcamentoUseCase,
    private readonly rejeitarOrcamento: RejeitarOrcamentoUseCase,
    private readonly iniciarExecucao: IniciarExecucaoUseCase,
    private readonly registrarConsumoPeca: RegistrarConsumoPecaUseCase,
    private readonly finalizarOS: FinalizarOrdemServicoUseCase,
    private readonly entregarVeiculo: EntregarVeiculoUseCase,
    private readonly buscarOSPorId: BuscarOrdemServicoPorIdUseCase,
    private readonly listarOS: ListarOrdensServicoUseCase,
    private readonly buscarMinhaOS: BuscarMinhaOrdemServicoUseCase,
    private readonly listarMinhasOS: ListarMinhasOrdensServicoUseCase,
    private readonly listarOrdensMecanicoUseCase: ListarOrdensMecanicoUseCase,
    private readonly buscarOSMecanico: BuscarOrdemServicoMecanicoUseCase,
    private readonly relatorioLeadTime: RelatorioLeadTimeUseCase,
    private readonly kpisOS: KpisOrdemServicoUseCase,
    private readonly tempoCiclo: TempoCicloPersonalizadoUseCase,
  ) {}

  // ── Usuários internos ────────────────────────────────────────────────────────

  /**
   * Abre uma nova OS com status RECEBIDA.
   * Papéis permitidos: ADMINISTRADOR, CONSULTOR_TECNICO.
   */
  @Post()
  @Version('1')
  @Papeis(PapelUsuario.ADMINISTRADOR, PapelUsuario.CONSULTOR_TECNICO)
  @ApiOperation({ summary: 'Abrir Ordem de Serviço' })
  async abrir(@Body() dto: AbrirOrdemServicoDto, @UsuarioAtual() usuario: JwtPayload) {
    return this.abrirOS.executar({ ...dto, usuarioId: usuario.sub });
  }

  /**
   * Atribui um mecânico à OS, avançando o status para ATRIBUIDA.
   * Papéis permitidos: ADMINISTRADOR, CONSULTOR_TECNICO.
   */
  @Patch(':id/atribuir/:mecanicoId')
  @Version('1')
  @Papeis(PapelUsuario.ADMINISTRADOR, PapelUsuario.CONSULTOR_TECNICO)
  @ApiOperation({ summary: 'Atribuir mecânico à OS' })
  async atribuir(@Param('id') id: string, @Param('mecanicoId') mecanicoId: string) {
    return this.atribuirOS.executar(id, mecanicoId);
  }

  /**
   * Registra o diagnóstico técnico na OS (status EM_DIAGNOSTICO).
   * O mecânico autenticado é identificado pelo token JWT.
   * Papéis permitidos: MECANICO.
   */
  @Patch(':id/diagnostico')
  @Version('1')
  @Papeis(PapelUsuario.MECANICO)
  @ApiOperation({ summary: 'Registrar diagnóstico' })
  async diagnostico(
    @Param('id') id: string,
    @Body() body: { descricao: string },
    @UsuarioAtual() usuario: JwtPayload,
  ) {
    return this.registrarDiagnostico.executar(id, body.descricao, usuario.sub);
  }

  /**
   * Gera o orçamento da OS, avançando o status para AGUARDANDO_APROVACAO.
   * O mecânico autenticado é identificado pelo token JWT.
   * Papéis permitidos: MECANICO.
   */
  @Patch(':id/orcamento')
  @Version('1')
  @Papeis(PapelUsuario.MECANICO)
  @ApiOperation({ summary: 'Gerar orçamento' })
  async orcamento(
    @Param('id') id: string,
    @Body() dto: GerarOrcamentoDto,
    @UsuarioAtual() usuario: JwtPayload,
  ) {
    return this.gerarOrcamento.executar({
      osId: id,
      mecanicoId: usuario.sub,
      grupos: dto.grupos,
      notasInternas: dto.notasInternas,
      notasCliente: dto.notasCliente,
    });
  }

  /**
   * Aprova o orçamento da OS, avançando o status para APROVADA.
   * Papéis permitidos: ADMINISTRADOR, CLIENTE.
   */
  @Patch(':id/aprovar')
  @Version('1')
  @Papeis(PapelUsuario.CLIENTE, PapelUsuario.ADMINISTRADOR)
  @ApiOperation({ summary: 'Aprovar orçamento' })
  async aprovar(@Param('id') id: string, @UsuarioAtual() usuario: JwtPayload) {
    return this.aprovarOrcamento.executar(id, usuario.sub);
  }

  /**
   * Rejeita o orçamento da OS, avançando o status para CANCELADA.
   * Papéis permitidos: ADMINISTRADOR, CLIENTE.
   */
  @Patch(':id/rejeitar')
  @Version('1')
  @Papeis(PapelUsuario.CLIENTE, PapelUsuario.ADMINISTRADOR)
  @ApiOperation({ summary: 'Rejeitar orçamento' })
  async rejeitar(@Param('id') id: string, @UsuarioAtual() usuario: JwtPayload) {
    return this.rejeitarOrcamento.executar(id, usuario.sub);
  }

  /**
   * Inicia a execução dos serviços da OS, avançando o status para EM_EXECUCAO.
   * Papéis permitidos: MECANICO.
   */
  @Patch(':id/iniciar-execucao')
  @Version('1')
  @Papeis(PapelUsuario.MECANICO)
  @ApiOperation({ summary: 'Iniciar execução' })
  async iniciar(@Param('id') id: string, @UsuarioAtual() usuario: JwtPayload) {
    return this.iniciarExecucao.executar(id, usuario.sub);
  }

  /**
   * Registra o consumo de uma peça do estoque durante a execução da OS.
   * Dispara a baixa no aggregate Estoque via evento de domínio.
   * Papéis permitidos: MECANICO.
   */
  @Patch(':id/consumo-peca')
  @Version('1')
  @Papeis(PapelUsuario.MECANICO)
  @ApiOperation({ summary: 'Registrar consumo de peça' })
  async consumoPeca(
    @Param('id') id: string,
    @Body() body: { pecaId: string; quantidade: number },
    @UsuarioAtual() usuario: JwtPayload,
  ) {
    return this.registrarConsumoPeca.executar({
      osId: id,
      pecaId: body.pecaId,
      quantidade: body.quantidade,
      mecanicoId: usuario.sub,
    });
  }

  /**
   * Finaliza tecnicamente a OS, avançando o status para FINALIZADA.
   * Papéis permitidos: MECANICO.
   */
  @Patch(':id/finalizar')
  @Version('1')
  @Papeis(PapelUsuario.MECANICO)
  @ApiOperation({ summary: 'Finalizar OS (conclusão técnica)' })
  async finalizar(@Param('id') id: string, @UsuarioAtual() usuario: JwtPayload) {
    return this.finalizarOS.executar(id, usuario.sub);
  }

  /**
   * Registra a entrega do veículo ao cliente, avançando o status para ENTREGUE.
   * Papéis permitidos: ADMINISTRADOR, CONSULTOR_TECNICO.
   */
  @Patch(':id/entregar')
  @Version('1')
  @Papeis(PapelUsuario.ADMINISTRADOR, PapelUsuario.CONSULTOR_TECNICO)
  @ApiOperation({ summary: 'Registrar entrega do veículo' })
  async entregar(@Param('id') id: string, @UsuarioAtual() usuario: JwtPayload) {
    return this.entregarVeiculo.executar(id, usuario.sub);
  }

  /**
   * Lista todas as OS do sistema com paginação e filtro opcional por status.
   * Papéis permitidos: ADMINISTRADOR, CONSULTOR_TECNICO.
   */
  @Get()
  @Version('1')
  @Papeis(PapelUsuario.ADMINISTRADOR, PapelUsuario.CONSULTOR_TECNICO)
  @ApiOperation({ summary: 'Listar todas as OS (usuários internos)' })
  async listar(@Query() paginacao: PaginacaoDto, @Query('status') status?: string) {
    return this.listarOS.executar({ status, ...paginacao });
  }

  /**
   * Retorna o relatório de lead-time de todas as OS entregues.
   * Inclui média, mínimo, máximo e detalhamento por OS.
   * Papéis permitidos: ADMINISTRADOR, CONSULTOR_TECNICO.
   *
   * IMPORTANTE: este endpoint deve ser declarado antes de ':id'
   * para evitar que o caminho 'relatorio/lead-time' seja interpretado como um parâmetro.
   */
  @Get('relatorio/lead-time')
  @Version('1')
  @Papeis(PapelUsuario.ADMINISTRADOR, PapelUsuario.CONSULTOR_TECNICO)
  @ApiOperation({ summary: 'Relatório de lead-time das OS entregues' })
  async leadTime() {
    return this.relatorioLeadTime.executar();
  }

  /**
   * Retorna os KPIs pré-calculados de ciclo de atendimento das OS.
   * Inclui tempo de espera por atribuição, diagnóstico, aprovação, execução,
   * entrega, lead-time total, tempo técnico líquido e taxa de aprovação de orçamentos.
   * Papéis permitidos: ADMINISTRADOR, CONSULTOR_TECNICO.
   *
   * IMPORTANTE: declarado antes de ':id' para evitar conflito de rota.
   */
  @Get('relatorio/kpis')
  @Version('1')
  @Papeis(PapelUsuario.ADMINISTRADOR, PapelUsuario.CONSULTOR_TECNICO)
  @ApiOperation({ summary: 'KPIs de ciclo de atendimento das OS' })
  async kpis(@Query('osId') osId?: string | string[]) {
    const osIds = osId ? (Array.isArray(osId) ? osId : [osId]) : undefined;
    return this.kpisOS.executar({ osIds });
  }

  /**
   * Calcula o tempo de ciclo entre dois eventos quaisquer do histórico, com descontos opcionais.
   * Permite construir KPIs personalizados filtrando o tempo gasto em estados externos à equipe técnica.
   *
   * @param eventoInicio - Código do evento de início (ex: MECANICO_ATRIBUIDO)
   * @param eventoFim    - Código do evento de fim (ex: ORDEM_FINALIZADA)
   * @param descontar    - Pares de desconto no formato EVENTO_A:EVENTO_B (repetível)
   *
   * Exemplo: GET /relatorio/tempo-ciclo?eventoInicio=MECANICO_ATRIBUIDO&eventoFim=ORDEM_FINALIZADA&descontar=ORCAMENTO_GERADO:ORCAMENTO_APROVADO
   *
   * Papéis permitidos: ADMINISTRADOR, CONSULTOR_TECNICO.
   * IMPORTANTE: declarado antes de ':id' para evitar conflito de rota.
   */
  @Get('relatorio/tempo-ciclo')
  @Version('1')
  @Papeis(PapelUsuario.ADMINISTRADOR, PapelUsuario.CONSULTOR_TECNICO)
  @ApiOperation({ summary: 'Tempo de ciclo personalizado com descontos opcionais' })
  async tempoCicloPersonalizado(
    @Query('eventoInicio') eventoInicio: string,
    @Query('eventoFim') eventoFim: string,
    @Query('descontar') descontar?: string | string[],
    @Query('osId') osId?: string | string[],
  ) {
    // Query params podem vir como string simples ou array quando repetidos
    const descontarArray = descontar
      ? Array.isArray(descontar) ? descontar : [descontar]
      : [];
    const osIds = osId ? (Array.isArray(osId) ? osId : [osId]) : undefined;
    return this.tempoCiclo.executar({ eventoInicio, eventoFim, descontar: descontarArray, osIds });
  }

  /**
   * Busca uma OS específica pelo ID.
   * Papéis permitidos: ADMINISTRADOR, CONSULTOR_TECNICO.
   * Para MECANICO, usar GET mecanico/:id (valida ownership).
   */
  @Get(':id')
  @Version('1')
  @Papeis(PapelUsuario.ADMINISTRADOR, PapelUsuario.CONSULTOR_TECNICO)
  @ApiOperation({ summary: 'Buscar OS por ID (usuários internos)' })
  async buscar(@Param('id') id: string) {
    return this.buscarOSPorId.executar(id);
  }

  // ── MECÂNICO: acesso apenas às suas OS em andamento ─────────────────────────

  /**
   * Lista as OS atribuídas ao mecânico autenticado nos status em que ele atua:
   * ATRIBUIDA, EM_DIAGNOSTICO, AGUARDANDO_APROVACAO, APROVADA, EM_EXECUCAO.
   * OS finalizadas, entregues e canceladas não aparecem nesta listagem.
   * O mecanicoId é extraído automaticamente do token JWT.
   * Papéis permitidos: MECANICO.
   *
   * IMPORTANTE: declarado antes de ':id' e 'minhas/' para evitar conflito de rota.
   */
  @Get('mecanico/minhas-ordens')
  @Version('1')
  @Papeis(PapelUsuario.MECANICO)
  @ApiOperation({ summary: 'Listar minhas OS em andamento (mecânico)' })
  async listarOrdensMecanico(@UsuarioAtual() usuario: JwtPayload, @Query() paginacao: PaginacaoDto) {
    return this.listarOrdensMecanicoUseCase.executar({
      mecanicoId: usuario.sub,
      ...paginacao,
    });
  }

  /**
   * Busca os detalhes de uma OS específica do mecânico autenticado.
   * Retorna 403 se o mecânico não for o responsável pela OS.
   * Papéis permitidos: MECANICO.
   *
   * IMPORTANTE: declarado antes de ':id' para evitar conflito de rota.
   */
  @Get('mecanico/:id')
  @Version('1')
  @Papeis(PapelUsuario.MECANICO)
  @ApiOperation({ summary: 'Buscar minha OS por ID (mecânico)' })
  async buscarOrdemMecanico(@Param('id') id: string, @UsuarioAtual() usuario: JwtPayload) {
    return this.buscarOSMecanico.executar(id, usuario.sub);
  }

  // ── CLIENTE: acesso apenas às suas OS ───────────────────────────────────────

  /**
   * Lista as OS do cliente autenticado de forma paginada.
   * O clienteId é extraído automaticamente do token JWT.
   * Papéis permitidos: CLIENTE.
   */
  @Get('minhas/lista')
  @Version('1')
  @Papeis(PapelUsuario.CLIENTE)
  @ApiOperation({ summary: 'Listar minhas OS (cliente)' })
  async listarMinhas(@UsuarioAtual() usuario: JwtPayload, @Query() paginacao: PaginacaoDto) {
    return this.listarMinhasOS.executar({ usuarioId: usuario.sub, ...paginacao });
  }

  /**
   * Busca uma OS específica do cliente autenticado pelo ID.
   * Retorna erro de acesso negado se a OS não pertencer ao cliente.
   * Papéis permitidos: CLIENTE.
   */
  @Get('minhas/:id')
  @Version('1')
  @Papeis(PapelUsuario.CLIENTE)
  @ApiOperation({ summary: 'Buscar minha OS por ID (cliente)' })
  async buscarMinha(@Param('id') id: string, @UsuarioAtual() usuario: JwtPayload) {
    return this.buscarMinhaOS.executar(id, usuario.sub);
  }
}
