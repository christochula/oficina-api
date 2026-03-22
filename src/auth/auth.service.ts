import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { StringValue } from 'ms';
import { UsuarioId } from '../usuario/domain/usuario-id.value-object';
import { USUARIO_REPOSITORY } from '../usuario/domain/usuario.repository';
import type { UsuarioRepository } from '../usuario/domain/usuario.repository';
import { RespostaAuthDto } from './interfaces/http/v1/dtos/resposta-auth.dto';

@Injectable()
export class AuthService {
  constructor(
    @Inject(USUARIO_REPOSITORY)
    private readonly usuarioRepository: UsuarioRepository,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, senha: string): Promise<RespostaAuthDto> {
    const usuario = await this.usuarioRepository.buscarPorEmail(email);
    if (!usuario || !usuario.ativo) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senhaHash);
    if (!senhaValida) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    return this.gerarTokens(usuario.id.valor, usuario.email, usuario.papel.toString());
  }

  async refreshTokens(usuarioId: string, refreshToken: string): Promise<RespostaAuthDto> {
    const usuario = await this.usuarioRepository.buscarPorId(UsuarioId.de(usuarioId));
    if (!usuario || !usuario.ativo || !usuario.refreshTokenHash) {
      throw new UnauthorizedException('Acesso negado');
    }

    const tokenValido = await bcrypt.compare(refreshToken, usuario.refreshTokenHash);
    if (!tokenValido) {
      throw new UnauthorizedException('Acesso negado');
    }

    return this.gerarTokens(usuario.id.valor, usuario.email, usuario.papel.toString());
  }

  async logout(usuarioId: string): Promise<void> {
    const usuario = await this.usuarioRepository.buscarPorId(UsuarioId.de(usuarioId));
    if (!usuario) return;

    usuario.atualizarRefreshToken(null);
    await this.usuarioRepository.salvar(usuario);
  }

  private async gerarTokens(sub: string, email: string, papel: string): Promise<RespostaAuthDto> {
    const payload = { sub, email, papel };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_SECRET,
        expiresIn: (process.env.JWT_EXPIRATION ?? '15m') as StringValue,
      }),
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: (process.env.JWT_REFRESH_EXPIRATION ?? '7d') as StringValue,
      }),
    ]);

    const usuario = await this.usuarioRepository.buscarPorId(UsuarioId.de(sub));
    if (usuario) {
      const hash = await bcrypt.hash(refreshToken, 10);
      usuario.atualizarRefreshToken(hash);
      await this.usuarioRepository.salvar(usuario);
    }

    return { accessToken, refreshToken };
  }
}
