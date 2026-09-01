import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
  Version,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from '../../../auth.service';
import { UsuarioAtual } from '../../../decorators/usuario-atual.decorator';
import { JwtRefreshGuard } from '../../../guards/jwt-refresh.guard';
import { JwtAuthGuard } from '../../../guards/jwt-auth.guard';
import type { JwtRefreshPayload } from '../../../strategies/jwt-refresh.strategy';
import type { JwtPayload } from '../../../strategies/jwt.strategy';
import { LoginDto } from './dtos/login.dto';
import { RespostaAuthDto } from './dtos/resposta-auth.dto';

/**
 * Controller HTTP v1 que expõe os endpoints de autenticação da oficina.
 *
 * Gerencia o ciclo de vida da sessão do usuário:
 * - `POST /api/v1/auth/login` — autentica e emite os tokens (público).
 * - `POST /api/v1/auth/refresh` — renova o access token usando o refresh token.
 * - `POST /api/v1/auth/logout` — invalida a sessão ativa do usuário autenticado.
 */
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  /**
   * @param authService - Serviço de aplicação responsável pela lógica de autenticação.
   */
  constructor(private readonly authService: AuthService) {}

  /**
   * Autentica o usuário com e-mail e senha.
   * Endpoint público — não requer autenticação prévia.
   * Retorna 401 Unauthorized se as credenciais forem inválidas.
   * @param dto - Credenciais de acesso do usuário.
   */
  @Post('login')
  @Version('1')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login — retorna access e refresh token' })
  async login(@Body() dto: LoginDto): Promise<RespostaAuthDto> {
    return this.authService.login(dto.email, dto.senha);
  }

  /**
   * Renova o par de tokens usando o refresh token vigente.
   * Requer o refresh token no header `Authorization: Bearer <refreshToken>`.
   * Retorna 401 Unauthorized se o token for inválido, expirado ou a sessão tiver sido revogada.
   * @param usuario - Payload do refresh token injetado pelo {@link JwtRefreshGuard}.
   */
  @Post('refresh')
  @Version('1')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtRefreshGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Renovar access token usando refresh token' })
  async refresh(
    @UsuarioAtual() usuario: JwtRefreshPayload,
  ): Promise<RespostaAuthDto> {
    return this.authService.refreshTokens(usuario.sub, usuario.refreshToken);
  }

  /**
   * Encerra a sessão do usuário autenticado, invalidando o refresh token armazenado.
   * Requer access token válido no header `Authorization: Bearer <accessToken>`.
   * Retorna 204 No Content em caso de sucesso.
   * @param usuario - Payload do access token injetado pelo {@link JwtAuthGuard}.
   */
  @Post('logout')
  @Version('1')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout — invalida o refresh token' })
  async logout(@UsuarioAtual() usuario: JwtPayload): Promise<void> {
    await this.authService.logout(usuario.sub);
  }
}
