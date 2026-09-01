import { Module } from '@nestjs/common';
import { BuscarUsuarioPorIdUseCase } from './application/casos-de-uso/buscar-usuario-por-id.usecase';
import { CriarUsuarioUseCase } from './application/casos-de-uso/criar-usuario.usecase';
import { USUARIO_REPOSITORY } from './domain/usuario.repository';
import { PrismaUsuarioRepository } from './infrastructure/persistencia/prisma-usuario.repository';
import { UsuarioController } from './interfaces/http/v1/usuario.controller';

/**
 * Módulo NestJS que encapsula o contexto delimitado de Usuario na oficina.
 *
 * Registra os casos de uso, o controller HTTP v1 e vincula a implementação
 * concreta {@link PrismaUsuarioRepository} ao token de injeção {@link USUARIO_REPOSITORY}.
 * Exporta o repositório e o caso de uso {@link BuscarUsuarioPorIdUseCase} para uso
 * pelo {@link AuthModule}, que precisa carregar usuários durante a autenticação.
 */
@Module({
  controllers: [UsuarioController],
  providers: [
    CriarUsuarioUseCase,
    BuscarUsuarioPorIdUseCase,
    { provide: USUARIO_REPOSITORY, useClass: PrismaUsuarioRepository },
  ],
  exports: [USUARIO_REPOSITORY, BuscarUsuarioPorIdUseCase],
})
export class UsuarioModule {}
