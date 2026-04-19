import { Body, Controller, Get, Inject, Param, Patch, Post, Query, UseGuards, Version } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../auth/guards/jwt-auth.guard';
import { PapeisGuard } from '../../../../auth/guards/papeis.guard';
import { Papeis } from '../../../../auth/decorators/papeis.decorator';
import { PaginacaoDto } from '../../../../shared/http/dtos/paginacao.dto';
import { RespostaPaginadaDto } from '../../../../shared/http/dtos/resposta-paginada.dto';
import { PapelUsuario } from '../../../../usuario/domain/papel-usuario.enum';
import { AtualizarPecaUseCase } from '../../../application/casos-de-uso/atualizar-peca.usecase';
import { AtivarPecaUseCase } from '../../../application/casos-de-uso/ativar-peca.usecase';
import { BuscarPecaPorIdUseCase } from '../../../application/casos-de-uso/buscar-peca-por-id.usecase';
import { DarEntradaEstoqueUseCase } from '../../../application/casos-de-uso/dar-entrada-estoque.usecase';
import { DesativarPecaUseCase } from '../../../application/casos-de-uso/desativar-peca.usecase';
import { RegistrarPecaUseCase } from '../../../application/casos-de-uso/registrar-peca.usecase';
import { Estoque } from '../../../domain/estoque.entity';
import { ESTOQUE_REPOSITORY } from '../../../domain/estoque.repository';
import type { EstoqueRepository } from '../../../domain/estoque.repository';
import { AtualizarPecaDto } from './dtos/atualizar-peca.dto';

/**
 * Controller HTTP para o recurso Estoque.
 * Expõe os endpoints REST da API v1 para gerenciamento de peças e controle de estoque.
 *
 * Todos os endpoints requerem autenticação JWT e autorização por papel.
 * Rota base: `/api/v1/estoque`
 */
@ApiTags('Estoque')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PapeisGuard)
@Controller('estoque')
export class EstoqueController {
  /**
   * @param registrarPeca - Caso de uso para cadastro de novas peças.
   * @param darEntrada - Caso de uso para reposição de estoque.
   * @param estoqueRepository - Repositório de estoque (injetado para a listagem direta).
   */
  constructor(
    private readonly registrarPeca: RegistrarPecaUseCase,
    private readonly darEntrada: DarEntradaEstoqueUseCase,
    private readonly buscarPecaPorId: BuscarPecaPorIdUseCase,
    private readonly atualizarPeca: AtualizarPecaUseCase,
    private readonly desativarPeca: DesativarPecaUseCase,
    private readonly ativarPeca: AtivarPecaUseCase,
    @Inject(ESTOQUE_REPOSITORY)
    private readonly estoqueRepository: EstoqueRepository,
  ) {}

  /**
   * Cadastra uma nova peça e inicializa seu saldo no estoque.
   * Papéis permitidos: ADMINISTRADOR.
   */
  @Post('pecas')
  @Version('1')
  @Papeis(PapelUsuario.ADMINISTRADOR)
  @ApiOperation({ summary: 'Registrar nova peça no estoque' })
  async registrar(@Body() body: {
    codigo: string;
    nome: string;
    descricao?: string;
    precoVenda: number;
    quantidadeInicial?: number;
    quantidadeMinima?: number;
  }): Promise<Estoque> {
    return this.registrarPeca.executar(body);
  }

  /**
   * Busca um registro de estoque pelo ID da peça.
   * Papéis permitidos: ADMINISTRADOR, MECANICO.
   */
  @Get('pecas/:pecaId')
  @Version('1')
  @Papeis(PapelUsuario.ADMINISTRADOR, PapelUsuario.MECANICO)
  @ApiOperation({ summary: 'Buscar peça por ID' })
  async buscarPeca(@Param('pecaId') pecaId: string): Promise<Estoque> {
    return this.buscarPecaPorId.executar(pecaId);
  }

  /**
   * Atualiza os dados cadastrais de uma peça (nome, descrição, preço de venda).
   * O código da peça é imutável.
   * Papéis permitidos: ADMINISTRADOR.
   */
  @Patch('pecas/:pecaId')
  @Version('1')
  @Papeis(PapelUsuario.ADMINISTRADOR)
  @ApiOperation({ summary: 'Atualizar dados da peça (nome, descrição, preço de venda)' })
  async atualizarDadosPeca(
    @Param('pecaId') pecaId: string,
    @Body() dto: AtualizarPecaDto,
  ): Promise<Estoque> {
    return this.atualizarPeca.executar({ pecaId, ...dto });
  }

  /**
   * Adiciona unidades ao saldo disponível de uma peça existente (reposição).
   * Papéis permitidos: ADMINISTRADOR.
   */
  @Patch('pecas/:pecaId/entrada')
  @Version('1')
  @Papeis(PapelUsuario.ADMINISTRADOR)
  @ApiOperation({ summary: 'Dar entrada de quantidade no estoque' })
  async entrada(
    @Param('pecaId') pecaId: string,
    @Body() body: { quantidade: number },
  ): Promise<Estoque> {
    return this.darEntrada.executar(pecaId, body.quantidade);
  }

  @Patch('pecas/:pecaId/desativar')
  @Version('1')
  @Papeis(PapelUsuario.ADMINISTRADOR)
  @ApiOperation({ summary: 'Desativar peça do catálogo' })
  async desativar(@Param('pecaId') pecaId: string): Promise<Estoque> {
    return this.desativarPeca.executar(pecaId);
  }

  @Patch('pecas/:pecaId/ativar')
  @Version('1')
  @Papeis(PapelUsuario.ADMINISTRADOR)
  @ApiOperation({ summary: 'Ativar peça do catálogo' })
  async ativar(@Param('pecaId') pecaId: string): Promise<Estoque> {
    return this.ativarPeca.executar(pecaId);
  }

  /**
   * Lista todos os registros de estoque de forma paginada, ordenados por nome da peça.
   * Papéis permitidos: ADMINISTRADOR, MECANICO.
   */
  @Get()
  @Version('1')
  @Papeis(PapelUsuario.ADMINISTRADOR, PapelUsuario.MECANICO)
  @ApiOperation({ summary: 'Listar estoque' })
  async listar(@Query() paginacao: PaginacaoDto): Promise<RespostaPaginadaDto<Estoque>> {
    const { itens, total } = await this.estoqueRepository.listar(
      paginacao.pagina,
      paginacao.porPagina,
    );
    return new RespostaPaginadaDto(itens, total, paginacao.pagina, paginacao.porPagina);
  }
}
