import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards, Version } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../auth/guards/jwt-auth.guard';
import { PapeisGuard } from '../../../../auth/guards/papeis.guard';
import { Papeis } from '../../../../auth/decorators/papeis.decorator';
import { PaginacaoDto } from '../../../../shared/http/dtos/paginacao.dto';
import { RespostaPaginadaDto } from '../../../../shared/http/dtos/resposta-paginada.dto';
import { PapelUsuario } from '../../../../usuario/domain/papel-usuario.enum';
import { AtualizarServicoOficinaUseCase } from '../../../application/casos-de-uso/atualizar-servico-oficina.usecase';
import { BuscarServicoOficinaPorIdUseCase } from '../../../application/casos-de-uso/buscar-servico-oficina-por-id.usecase';
import { ListarServicosOficinaUseCase } from '../../../application/casos-de-uso/listar-servicos-oficina.usecase';
import { RegistrarServicoOficinaUseCase } from '../../../application/casos-de-uso/registrar-servico-oficina.usecase';
import { ServicoOficina } from '../../../domain/servico-oficina.entity';
import { AtualizarServicoOficinaDto } from './dtos/atualizar-servico-oficina.dto';
import { RegistrarServicoOficinaDto } from './dtos/registrar-servico-oficina.dto';

/**
 * Controller HTTP para o catálogo de serviços da oficina.
 *
 * Rotas disponíveis:
 *   POST  /api/v1/servicos-oficina               — registrar serviço (ADMINISTRADOR)
 *   GET   /api/v1/servicos-oficina               — listar serviços ativos (paginado, todos os papéis)
 *   GET   /api/v1/servicos-oficina/:id           — buscar serviço por ID (todos os papéis)
 *   PATCH /api/v1/servicos-oficina/:id           — atualizar serviço (ADMINISTRADOR)
 */
@ApiTags('Catálogo de Serviços')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PapeisGuard)
@Controller('servicos-oficina')
export class ServicoOficinaController {
  constructor(
    private readonly registrar: RegistrarServicoOficinaUseCase,
    private readonly listar: ListarServicosOficinaUseCase,
    private readonly buscarPorId: BuscarServicoOficinaPorIdUseCase,
    private readonly atualizar: AtualizarServicoOficinaUseCase,
  ) {}

  /**
   * Registra um novo serviço no catálogo da oficina.
   * Apenas ADMINISTRADOR pode cadastrar serviços.
   */
  @Post()
  @Version('1')
  @Papeis(PapelUsuario.ADMINISTRADOR)
  @ApiOperation({ summary: 'Registrar serviço no catálogo' })
  async registrarServico(@Body() dto: RegistrarServicoOficinaDto): Promise<ServicoOficina> {
    return this.registrar.executar(dto);
  }

  /**
   * Lista os serviços ativos do catálogo de forma paginada, ordenados por nome.
   * Acessível a todos os papéis internos (para uso na abertura de OS).
   */
  @Get()
  @Version('1')
  @Papeis(
    PapelUsuario.ADMINISTRADOR,
    PapelUsuario.CONSULTOR_TECNICO,
    PapelUsuario.MECANICO,
  )
  @ApiOperation({ summary: 'Listar serviços do catálogo (paginado)' })
  async listarServicos(@Query() paginacao: PaginacaoDto): Promise<RespostaPaginadaDto<ServicoOficina>> {
    const { itens, total } = await this.listar.executar(paginacao.pagina, paginacao.porPagina);
    return new RespostaPaginadaDto(itens, total, paginacao.pagina, paginacao.porPagina);
  }

  /**
   * Busca um serviço do catálogo pelo ID.
   */
  @Get(':id')
  @Version('1')
  @Papeis(
    PapelUsuario.ADMINISTRADOR,
    PapelUsuario.CONSULTOR_TECNICO,
    PapelUsuario.MECANICO,
  )
  @ApiOperation({ summary: 'Buscar serviço por ID' })
  async buscarServico(@Param('id') id: string): Promise<ServicoOficina> {
    return this.buscarPorId.executar(id);
  }

  /**
   * Atualiza os dados de um serviço do catálogo.
   * Apenas ADMINISTRADOR pode atualizar serviços.
   */
  @Patch(':id')
  @Version('1')
  @Papeis(PapelUsuario.ADMINISTRADOR)
  @ApiOperation({ summary: 'Atualizar serviço do catálogo' })
  async atualizarServico(
    @Param('id') id: string,
    @Body() dto: AtualizarServicoOficinaDto,
  ): Promise<ServicoOficina> {
    return this.atualizar.executar({ id, ...dto });
  }
}
