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
import { Papeis } from '../../../../auth/decorators/papeis.decorator';
import { UsuarioAtual } from '../../../../auth/decorators/usuario-atual.decorator';
import { JwtAuthGuard } from '../../../../auth/guards/jwt-auth.guard';
import { PapeisGuard } from '../../../../auth/guards/papeis.guard';
import type { JwtPayload } from '../../../../auth/strategies/jwt.strategy';
import { PapelUsuario } from '../../../domain/papel-usuario.enum';
import { BuscarUsuarioPorIdUseCase } from '../../../application/casos-de-uso/buscar-usuario-por-id.usecase';
import { CriarUsuarioUseCase } from '../../../application/casos-de-uso/criar-usuario.usecase';
import { ListarMecanicosUseCase } from '../../../application/casos-de-uso/listar-mecanicos.usecase';
import { ListarUsuariosUseCase } from '../../../application/casos-de-uso/listar-usuarios.usecase';
import { AtualizarUsuarioUseCase } from '../../../application/casos-de-uso/atualizar-usuario.usecase';
import { AtivarUsuarioUseCase } from '../../../application/casos-de-uso/ativar-usuario.usecase';
import { DesativarUsuarioUseCase } from '../../../application/casos-de-uso/desativar-usuario.usecase';
import { RespostaPaginadaDto } from '../../../../shared/http/dtos/resposta-paginada.dto';
import { CriarUsuarioDto } from './dtos/criar-usuario.dto';
import { AtualizarUsuarioDto } from './dtos/atualizar-usuario.dto';
import { ListarMecanicosQueryDto } from './dtos/listar-mecanicos-query.dto';
import { ListarUsuariosQueryDto } from './dtos/listar-usuarios-query.dto';
import { RespostaUsuarioDto } from './dtos/resposta-usuario.dto';

/**
 * Controller HTTP v1 para o recurso de usuários da oficina.
 *
 * Expõe criação, consulta e gestão de usuários internos sob `/api/v1/usuarios`.
 * A gestão geral é restrita a ADMINISTRADOR; a listagem de mecânicos também
 * permite CONSULTOR_TECNICO, pois ambos podem atribuir ordens de serviço.
 */
@ApiTags('Usuários')
@Controller('usuarios')
@UseGuards(JwtAuthGuard, PapeisGuard)
@Papeis(PapelUsuario.ADMINISTRADOR)
@ApiBearerAuth()
export class UsuarioController {
  /**
   * @param criarUsuario - Caso de uso para criação de novos usuários.
   * @param buscarUsuarioPorId - Caso de uso para recuperação de usuário pelo ID.
   * @param listarMecanicos - Caso de uso para pesquisa paginada de mecânicos.
   * @param listarUsuarios - Caso de uso para gestão paginada de usuários internos.
   * @param atualizarUsuario - Caso de uso para edição de usuários internos.
   * @param ativarUsuario - Caso de uso para reativação de usuários internos.
   * @param desativarUsuario - Caso de uso para desativação segura de usuários internos.
   */
  constructor(
    private readonly criarUsuario: CriarUsuarioUseCase,
    private readonly buscarUsuarioPorId: BuscarUsuarioPorIdUseCase,
    private readonly listarMecanicos: ListarMecanicosUseCase,
    private readonly listarUsuarios: ListarUsuariosUseCase,
    private readonly atualizarUsuario: AtualizarUsuarioUseCase,
    private readonly ativarUsuario: AtivarUsuarioUseCase,
    private readonly desativarUsuario: DesativarUsuarioUseCase,
  ) {}

  /**
   * Cria um novo usuário no sistema.
   * Restrito a ADMINISTRADOR.
   * Retorna 409 Conflict se o e-mail já estiver cadastrado.
   * @param dto - Dados do usuário a ser criado.
   */
  @Post()
  @Version('1')
  @ApiOperation({ summary: 'Criar usuário' })
  async criar(@Body() dto: CriarUsuarioDto): Promise<RespostaUsuarioDto> {
    const usuario = await this.criarUsuario.executar(dto);
    return RespostaUsuarioDto.de(usuario);
  }

  /** Lista usuários internos para gestão administrativa. */
  @Get()
  @Version('1')
  @ApiOperation({ summary: 'Listar usuários internos (paginado)' })
  async listar(
    @Query() consulta: ListarUsuariosQueryDto,
  ): Promise<RespostaPaginadaDto<RespostaUsuarioDto>> {
    const { pagina, porPagina, busca, papel, ativo } = consulta;
    const { itens, total } = await this.listarUsuarios.executar(
      pagina,
      porPagina,
      { busca, papel, ativo },
    );
    return new RespostaPaginadaDto(
      itens.map((usuario) => RespostaUsuarioDto.de(usuario)),
      total,
      pagina,
      porPagina,
    );
  }

  /** Lista mecânicos para atribuição de ordens de serviço. */
  @Get('mecanicos')
  @Version('1')
  @Papeis(PapelUsuario.ADMINISTRADOR, PapelUsuario.CONSULTOR_TECNICO)
  @ApiOperation({ summary: 'Listar mecânicos (paginado)' })
  async listarMecanicosDisponiveis(
    @Query() consulta: ListarMecanicosQueryDto,
  ): Promise<RespostaPaginadaDto<RespostaUsuarioDto>> {
    const { pagina, porPagina, busca, ativo } = consulta;
    const { itens, total } = await this.listarMecanicos.executar(
      pagina,
      porPagina,
      { busca, ativo },
    );

    return new RespostaPaginadaDto(
      itens.map((usuario) => RespostaUsuarioDto.de(usuario)),
      total,
      pagina,
      porPagina,
    );
  }

  @Patch(':id/ativar')
  @Version('1')
  @ApiOperation({ summary: 'Ativar usuário interno' })
  async ativar(@Param('id') id: string): Promise<RespostaUsuarioDto> {
    const usuario = await this.ativarUsuario.executar(id);
    return RespostaUsuarioDto.de(usuario);
  }

  @Patch(':id/desativar')
  @Version('1')
  @ApiOperation({ summary: 'Desativar usuário interno' })
  async desativar(
    @Param('id') id: string,
    @UsuarioAtual() usuarioAtual: JwtPayload,
  ): Promise<RespostaUsuarioDto> {
    const usuario = await this.desativarUsuario.executar(id, usuarioAtual.sub);
    return RespostaUsuarioDto.de(usuario);
  }

  @Patch(':id')
  @Version('1')
  @ApiOperation({ summary: 'Atualizar usuário interno' })
  async atualizar(
    @Param('id') id: string,
    @Body() dto: AtualizarUsuarioDto,
  ): Promise<RespostaUsuarioDto> {
    const usuario = await this.atualizarUsuario.executar({ id, ...dto });
    return RespostaUsuarioDto.de(usuario);
  }

  /**
   * Busca um usuário pelo seu ID único de domínio.
   * Restrito a ADMINISTRADOR.
   * Retorna 404 Not Found se o usuário não existir.
   * @param id - ID do usuário no formato ULID com prefixo `us`.
   */
  @Get(':id')
  @Version('1')
  @ApiOperation({ summary: 'Buscar usuário por ID' })
  async buscar(@Param('id') id: string): Promise<RespostaUsuarioDto> {
    const usuario = await this.buscarUsuarioPorId.executar(id);
    return RespostaUsuarioDto.de(usuario);
  }
}
