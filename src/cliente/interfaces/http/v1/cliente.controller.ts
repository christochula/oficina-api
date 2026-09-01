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
import { PapelUsuario } from '../../../../usuario/domain/papel-usuario.enum';
import { PaginacaoDto } from '../../../../shared/http/dtos/paginacao.dto';
import { RespostaPaginadaDto } from '../../../../shared/http/dtos/resposta-paginada.dto';
import { AtualizarClienteUseCase } from '../../../application/casos-de-uso/atualizar-cliente.usecase';
import { AtivarClienteUseCase } from '../../../application/casos-de-uso/ativar-cliente.usecase';
import { BuscarClientePorNumeroDocUseCase } from '../../../application/casos-de-uso/buscar-cliente-por-cpf.usecase';
import { CriarClienteUseCase } from '../../../application/casos-de-uso/criar-cliente.usecase';
import { DesativarClienteUseCase } from '../../../application/casos-de-uso/desativar-cliente.usecase';
import { ListarClientesUseCase } from '../../../application/casos-de-uso/listar-clientes.usecase';
import { Cliente } from '../../../domain/cliente.entity';
import { AtualizarClienteDto } from './dtos/atualizar-cliente.dto';
import { CriarClienteDto } from './dtos/criar-cliente.dto';

/**
 * Controller HTTP para o aggregate Cliente.
 * Expõe as rotas da versão 1 da API para cadastro, consulta e atualização de clientes.
 * Todas as rotas exigem autenticação JWT (JwtAuthGuard).
 * Rotas disponíveis:
 *   POST   /api/v1/clientes                       — cadastrar novo cliente
 *   GET    /api/v1/clientes                       — listar clientes (paginado)
 *   GET    /api/v1/clientes/documento/:numeroDoc   — buscar por CPF ou CNPJ
 *   PATCH  /api/v1/clientes/:id                   — atualizar dados editáveis
 */
@ApiTags('Clientes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PapeisGuard)
@Papeis(PapelUsuario.ADMINISTRADOR, PapelUsuario.CONSULTOR_TECNICO)
@Controller('clientes')
export class ClienteController {
  /**
   * @param criarCliente - Caso de uso para cadastro de novo cliente.
   * @param buscarClientePorNumeroDoc - Caso de uso para consulta por documento.
   * @param atualizarCliente - Caso de uso para atualização de dados editáveis.
   */
  constructor(
    private readonly criarCliente: CriarClienteUseCase,
    private readonly listarClientes: ListarClientesUseCase,
    private readonly buscarClientePorNumeroDoc: BuscarClientePorNumeroDocUseCase,
    private readonly atualizarCliente: AtualizarClienteUseCase,
    private readonly desativarCliente: DesativarClienteUseCase,
    private readonly ativarCliente: AtivarClienteUseCase,
  ) {}

  /**
   * Cadastra um novo cliente na oficina.
   * Valida o documento (CPF ou CNPJ) e garante unicidade antes de persistir.
   * @param dto - Dados do novo cliente incluindo tipoDoc e numeroDoc.
   * @returns O aggregate Cliente recém-criado.
   */
  @Post()
  @Version('1')
  @ApiOperation({ summary: 'Criar cliente (CPF ou CNPJ)' })
  async criar(@Body() dto: CriarClienteDto): Promise<Cliente> {
    return this.criarCliente.executar(dto);
  }

  /**
   * Lista clientes de forma paginada, ordenados por nome.
   * @param paginacao - Parâmetros de paginação (pagina, porPagina).
   * @returns Lista paginada de clientes com metadados de paginação.
   */
  @Get()
  @Version('1')
  @ApiOperation({ summary: 'Listar clientes (paginado)' })
  async listar(
    @Query() paginacao: PaginacaoDto,
  ): Promise<RespostaPaginadaDto<Cliente>> {
    const { itens, total } = await this.listarClientes.executar(
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
   * Busca um cliente pelo número do documento (CPF ou CNPJ).
   * Permite que operadores da oficina localizem clientes sem conhecer o ID interno.
   * @param numeroDoc - CPF ou CNPJ sem formatação.
   * @returns O aggregate Cliente correspondente ao documento.
   */
  @Get('documento/:numeroDoc')
  @Version('1')
  @ApiOperation({ summary: 'Buscar cliente por CPF ou CNPJ' })
  async buscarPorDoc(@Param('numeroDoc') numeroDoc: string): Promise<Cliente> {
    return this.buscarClientePorNumeroDoc.executar(numeroDoc);
  }

  /**
   * Atualiza os dados editáveis de um cliente existente.
   * Os campos tipoDoc e numeroDoc não podem ser alterados por esta rota.
   * @param id - Identificador interno do cliente (ClienteId com prefixo "cl").
   * @param dto - Dados a serem atualizados (nome, email, telefone e/ou endereço).
   * @returns O aggregate Cliente com o estado atualizado.
   */
  @Patch(':id')
  @Version('1')
  @ApiOperation({
    summary: 'Atualizar dados do cliente (exceto tipoDoc e numeroDoc)',
  })
  async atualizar(
    @Param('id') id: string,
    @Body() dto: AtualizarClienteDto,
  ): Promise<Cliente> {
    return this.atualizarCliente.executar({ id, ...dto });
  }

  @Patch(':id/desativar')
  @Version('1')
  @ApiOperation({ summary: 'Desativar cliente' })
  async desativar(@Param('id') id: string): Promise<Cliente> {
    return this.desativarCliente.executar(id);
  }

  @Patch(':id/ativar')
  @Version('1')
  @ApiOperation({ summary: 'Ativar cliente' })
  async ativar(@Param('id') id: string): Promise<Cliente> {
    return this.ativarCliente.executar(id);
  }
}
