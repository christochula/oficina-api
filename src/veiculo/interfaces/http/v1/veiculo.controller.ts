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
import { AtivarVeiculoUseCase } from '../../../application/casos-de-uso/ativar-veiculo.usecase';
import { JwtAuthGuard } from '../../../../auth/guards/jwt-auth.guard';
import { PapeisGuard } from '../../../../auth/guards/papeis.guard';
import { Papeis } from '../../../../auth/decorators/papeis.decorator';
import { PapelUsuario } from '../../../../usuario/domain/papel-usuario.enum';
import { PaginacaoDto } from '../../../../shared/http/dtos/paginacao.dto';
import { RespostaPaginadaDto } from '../../../../shared/http/dtos/resposta-paginada.dto';
import { AtualizarVeiculoUseCase } from '../../../application/casos-de-uso/atualizar-veiculo.usecase';
import { BuscarVeiculoPorPlacaUseCase } from '../../../application/casos-de-uso/buscar-veiculo-por-placa.usecase';
import { CriarVeiculoUseCase } from '../../../application/casos-de-uso/criar-veiculo.usecase';
import { DesativarVeiculoUseCase } from '../../../application/casos-de-uso/desativar-veiculo.usecase';
import { ListarVeiculosUseCase } from '../../../application/casos-de-uso/listar-veiculos.usecase';
import { Veiculo } from '../../../domain/veiculo.entity';
import { AtualizarVeiculoDto } from './dtos/atualizar-veiculo.dto';
import { CriarVeiculoDto } from './dtos/criar-veiculo.dto';

/**
 * Controller HTTP para o aggregate Veiculo.
 * Expõe as rotas da versão 1 da API para registro, consulta e atualização de veículos.
 * Todas as rotas exigem autenticação JWT (JwtAuthGuard).
 * Rotas disponíveis:
 *   POST   /api/v1/veiculos                   — registrar novo veículo
 *   GET    /api/v1/veiculos/placa/:placa       — buscar por placa
 *   PATCH  /api/v1/veiculos/:id               — atualizar cor e/ou quilometragem
 */
@ApiTags('Veículos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PapeisGuard)
@Papeis(PapelUsuario.ADMINISTRADOR, PapelUsuario.CONSULTOR_TECNICO)
@Controller('veiculos')
export class VeiculoController {
  /**
   * @param criarVeiculo - Caso de uso para registro de novo veículo.
   * @param buscarVeiculoPorPlaca - Caso de uso para consulta por placa.
   * @param atualizarVeiculo - Caso de uso para atualização de dados editáveis.
   */
  constructor(
    private readonly criarVeiculo: CriarVeiculoUseCase,
    private readonly buscarVeiculoPorPlaca: BuscarVeiculoPorPlacaUseCase,
    private readonly atualizarVeiculo: AtualizarVeiculoUseCase,
    private readonly desativarVeiculo: DesativarVeiculoUseCase,
    private readonly ativarVeiculo: AtivarVeiculoUseCase,
    private readonly listarVeiculos: ListarVeiculosUseCase,
  ) {}

  /**
   * Lista veículos de forma paginada, ordenados por placa.
   * @param paginacao - Parâmetros de paginação (pagina, porPagina).
   * @returns Lista paginada de veículos com metadados de paginação.
   */
  @Get()
  @Version('1')
  @ApiOperation({ summary: 'Listar veículos (paginado)' })
  async listar(
    @Query() paginacao: PaginacaoDto,
  ): Promise<RespostaPaginadaDto<Veiculo>> {
    const { itens, total } = await this.listarVeiculos.executar(
      paginacao.pagina,
      paginacao.porPagina,
    );
    return new RespostaPaginadaDto(
      itens,
      total,
      paginacao.pagina,
      paginacao.porPagina,
    );
  }

  /**
   * Registra um novo veículo na oficina.
   * Verifica unicidade pela placa antes de persistir.
   * @param dto - Dados do novo veículo incluindo placa, RENAVAM e chassi.
   * @returns O aggregate Veiculo recém-registrado.
   */
  @Post()
  @Version('1')
  @ApiOperation({ summary: 'Registrar veículo' })
  async criar(@Body() dto: CriarVeiculoDto): Promise<Veiculo> {
    return this.criarVeiculo.executar(dto);
  }

  /**
   * Busca um veículo pela placa de tráfego.
   * Utilizado no balcão da oficina para identificar o veículo rapidamente ao abrir uma OS.
   * @param placa - Placa do veículo (formato Mercosul ou padrão antigo).
   * @returns O aggregate Veiculo correspondente à placa.
   */
  @Get('placa/:placa')
  @Version('1')
  @ApiOperation({ summary: 'Buscar veículo por placa' })
  async buscarPorPlaca(@Param('placa') placa: string): Promise<Veiculo> {
    return this.buscarVeiculoPorPlaca.executar(placa);
  }

  /**
   * Atualiza os dados editáveis de um veículo existente.
   * Apenas cor e quilometragem podem ser alterados por esta rota.
   * Placa, RENAVAM, chassi, marca, modelo e ano não podem ser alterados.
   * @param id - Identificador interno do veículo (VeiculoId com prefixo "ve").
   * @param dto - Dados a serem atualizados (cor e/ou quilometragem).
   * @returns O aggregate Veiculo com o estado atualizado.
   */
  @Patch(':id')
  @Version('1')
  @ApiOperation({ summary: 'Atualizar cor e/ou quilometragem do veículo' })
  async atualizar(
    @Param('id') id: string,
    @Body() dto: AtualizarVeiculoDto,
  ): Promise<Veiculo> {
    return this.atualizarVeiculo.executar({ id, ...dto });
  }

  @Patch(':id/desativar')
  @Version('1')
  @ApiOperation({ summary: 'Desativar veículo' })
  async desativar(@Param('id') id: string): Promise<Veiculo> {
    return this.desativarVeiculo.executar(id);
  }

  @Patch(':id/ativar')
  @Version('1')
  @ApiOperation({ summary: 'Ativar veículo' })
  async ativar(@Param('id') id: string): Promise<Veiculo> {
    return this.ativarVeiculo.executar(id);
  }
}
