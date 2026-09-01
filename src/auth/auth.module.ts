import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsuarioModule } from '../usuario/usuario.module';
import { ClienteModule } from '../cliente/cliente.module';
import { AuthService } from './auth.service';
import { PapeisGuard } from './guards/papeis.guard';
import { AuthController } from './interfaces/http/v1/auth.controller';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';

/**
 * Módulo NestJS que encapsula toda a infraestrutura de autenticação e autorização da oficina.
 *
 * Registra as estratégias Passport JWT (access e refresh), o serviço de autenticação,
 * o guard de autorização por papéis e o controller de autenticação HTTP v1.
 * Importa {@link UsuarioModule} para acessar o repositório de usuários durante o login
 * e a renovação de tokens. Exporta {@link AuthService}, {@link PapeisGuard} e
 * {@link JwtModule} para uso em outros módulos que precisam verificar autenticação.
 */
@Module({
  imports: [
    PassportModule,
    JwtModule.register({}), // segredos injetados via options em cada signAsync — permite múltiplos segredos
    UsuarioModule,
    ClienteModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtRefreshStrategy, PapeisGuard],
  exports: [AuthService, PapeisGuard, JwtModule],
})
export class AuthModule {}
