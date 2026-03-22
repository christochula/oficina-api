import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsuarioId } from '../usuario/domain/usuario-id.value-object';
import { USUARIO_REPOSITORY } from '../usuario/domain/usuario.repository';
import type { UsuarioRepository } from '../usuario/domain/usuario.repository';
import { RespostaAuthDto } from './interfaces/http/v1/dtos/resposta-auth.dto';
import type { JwtPayload } from './strategies/jwt.strategy';

/**
 * Serviço de aplicação responsável pela autenticação de usuários na oficina.
 *
 * Implementa o fluxo completo de autenticação JWT com par de tokens:
 * - **Access token**: curta duração (padrão 15min), usado em cada requisição autenticada.
 * - **Refresh token**: longa duração (padrão 7d), usado apenas para renovar o access token.
 *
 * O refresh token é armazenado como hash bcrypt no banco de dados, permitindo
 * invalidação individual por sessão (logout). A comparação no refresh valida
 * que o token apresentado é o mesmo que foi emitido, prevenindo reutilização.
 */
@Injectable()
export class AuthService {
  /**
   * @param usuarioRepository - Repositório de usuarios para busca e persistência.
   * @param jwtService - Serviço NestJS para assinar e verificar tokens JWT.
   */
  constructor(
    @Inject(USUARIO_REPOSITORY)
    private readonly usuarioRepository: UsuarioRepository,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Autentica um usuário com e-mail e senha, retornando o par de tokens JWT.
   * A mensagem de erro é genérica para evitar enumeração de usuários.
   * @param email - E-mail do usuário a autenticar.
   * @param senha - Senha em texto plano para comparação com o hash armazenado.
   * @returns Par de tokens `{ accessToken, refreshToken }`.
   * @throws {UnauthorizedException} se o e-mail não existir ou a senha for incorreta.
   */
  async login(email: string, senha: string): Promise<RespostaAuthDto> {
    const usuario = await this.usuarioRepository.buscarPorEmail(email);
    if (!usuario) throw new UnauthorizedException('Credenciais inválidas');

    const senhaValida = await bcrypt.compare(senha, usuario.senhaHash);
    if (!senhaValida) throw new UnauthorizedException('Credenciais inválidas');

    return this.gerarTokens(usuario.id.valor, usuario.email, usuario.papel.toString());
  }

  /**
   * Renova o par de tokens usando um refresh token válido.
   * Valida que o refresh token apresentado corresponde ao hash armazenado para o usuário,
   * garantindo que sessões revogadas (logout) não possam ser reutilizadas.
   * @param usuarioId - ID do usuário extraído do payload do refresh token.
   * @param refreshToken - Token bruto para validação contra o hash no banco.
   * @returns Novo par de tokens `{ accessToken, refreshToken }`.
   * @throws {UnauthorizedException} se o usuário não existir, não tiver sessão ativa
   *   ou o token não corresponder ao hash armazenado.
   */
  async refreshTokens(usuarioId: string, refreshToken: string): Promise<RespostaAuthDto> {
    const usuario = await this.usuarioRepository.buscarPorId(UsuarioId.de(usuarioId));
    if (!usuario || !usuario.refreshTokenHash)
      throw new UnauthorizedException('Acesso negado');

    const tokenValido = await bcrypt.compare(refreshToken, usuario.refreshTokenHash);
    if (!tokenValido) throw new UnauthorizedException('Acesso negado');

    return this.gerarTokens(usuario.id.valor, usuario.email, usuario.papel.toString());
  }

  /**
   * Encerra a sessão do usuário invalidando o refresh token armazenado.
   * Após o logout, o access token ainda é válido até sua expiração natural,
   * mas não será possível renová-lo sem novo login.
   * @param usuarioId - ID do usuário que está realizando o logout.
   */
  async logout(usuarioId: string): Promise<void> {
    const usuario = await this.usuarioRepository.buscarPorId(UsuarioId.de(usuarioId));
    if (!usuario) return;
    usuario.atualizarRefreshToken(null);
    await this.usuarioRepository.salvar(usuario);
  }

  /**
   * Método privado que gera o par de tokens JWT e persiste o hash do refresh token.
   * Os segredos e expirações são lidos das variáveis de ambiente em tempo de execução,
   * permitindo configuração por ambiente sem recompilação.
   * @param sub - ID do usuário (subject do JWT).
   * @param email - E-mail do usuário para inclusão no payload.
   * @param papel - Papel do usuário para inclusão no payload.
   * @returns Par de tokens assinados `{ accessToken, refreshToken }`.
   */
  private async gerarTokens(sub: string, email: string, papel: string): Promise<RespostaAuthDto> {
    const payload = { sub, email, papel };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_SECRET,
        expiresIn: (process.env.JWT_EXPIRATION ?? '15m') as never,
      }),
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: (process.env.JWT_REFRESH_EXPIRATION ?? '7d') as never,
      }),
    ]);

    // Armazena hash do refresh token para possibilitar validação e revogação futura
    const usuario = await this.usuarioRepository.buscarPorId(UsuarioId.de(sub));
    if (usuario) {
      const hash = await bcrypt.hash(refreshToken, 10);
      usuario.atualizarRefreshToken(hash);
      await this.usuarioRepository.salvar(usuario);
    }

    return { accessToken, refreshToken };
  }
}
