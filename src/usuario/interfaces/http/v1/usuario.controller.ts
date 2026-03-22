import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  Version,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Papeis } from '../../../../auth/decorators/papeis.decorator';
import { JwtAuthGuard } from '../../../../auth/guards/jwt-auth.guard';
import { PapeisGuard } from '../../../../auth/guards/papeis.guard';
import { PapelUsuario } from '../../../domain/papel-usuario.enum';
import { BuscarUsuarioPorIdUseCase } from '../../../application/casos-de-uso/buscar-usuario-por-id.usecase';
import { CriarUsuarioUseCase } from '../../../application/casos-de-uso/criar-usuario.usecase';
import { CriarUsuarioDto } from './dtos/criar-usuario.dto';
import { RespostaUsuarioDto } from './dtos/resposta-usuario.dto';

/**
 * Controller HTTP v1 para o recurso de usuários da oficina.
 *
 * Expõe os endpoints de criação e consulta de usuários sob o prefixo `/api/v1/usuarios`.
 * Ambos os endpoints são restritos ao papel ADMINISTRADOR.
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
   */
  constructor(
    private readonly criarUsuario: CriarUsuarioUseCase,
    private readonly buscarUsuarioPorId: BuscarUsuarioPorIdUseCase,
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
