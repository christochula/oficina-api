import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { PapelUsuario } from '../../domain/papel-usuario.enum';
import { Usuario } from '../../domain/usuario.entity';
import { UsuarioId } from '../../domain/usuario-id.value-object';
import { UsuarioRepository } from '../../domain/usuario.repository';

/**
 * Implementação do {@link UsuarioRepository} utilizando Prisma ORM e PostgreSQL.
 *
 * Responsável por traduzir entre a entidade de domínio {@link Usuario} e o modelo
 * de persistência da tabela `usuarios`. Garante que tipos do Prisma não vazem
 * para a camada de domínio através do método privado `mapear`.
 */
@Injectable()
export class PrismaUsuarioRepository implements UsuarioRepository {
  /**
   * @param prisma - Serviço compartilhado de acesso ao banco de dados via Prisma.
   */
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Persiste o usuario realizando upsert: insere se novo, atualiza se já existir.
   * @param usuario - Entidade de domínio a ser salva.
   */
  async salvar(usuario: Usuario): Promise<void> {
    await this.prisma.usuario.upsert({
      where: { id: usuario.id.valor },
      create: {
        id: usuario.id.valor,
        nome: usuario.nome,
        email: usuario.email,
        senhaHash: usuario.senhaHash,
        papel: usuario.papel,
        refreshTokenHash: usuario.refreshTokenHash,
        ativo: usuario.ativo,
        criadoEm: usuario.criadoEm,
        atualizadoEm: usuario.atualizadoEm,
      },
      update: {
        nome: usuario.nome,
        email: usuario.email,
        senhaHash: usuario.senhaHash,
        papel: usuario.papel,
        refreshTokenHash: usuario.refreshTokenHash,
        ativo: usuario.ativo,
        atualizadoEm: usuario.atualizadoEm,
      },
    });
  }

  /**
   * Busca um usuario pelo seu ID único de domínio (ULID com prefixo `us`).
   * @param id - UsuarioId a ser pesquisado.
   * @returns A entidade de domínio mapeada ou `null` se não encontrada.
   */
  async buscarPorId(id: UsuarioId): Promise<Usuario | null> {
    const registro = await this.prisma.usuario.findUnique({ where: { id: id.valor } });
    if (!registro) return null;
    return this.mapear(registro);
  }

  /**
   * Busca um usuario pelo e-mail, utilizado no fluxo de autenticação e validação de unicidade.
   * @param email - E-mail do usuário a ser pesquisado.
   * @returns A entidade de domínio mapeada ou `null` se não encontrada.
   */
  async buscarPorEmail(email: string): Promise<Usuario | null> {
    const registro = await this.prisma.usuario.findUnique({ where: { email } });
    if (!registro) return null;
    return this.mapear(registro);
  }

  /**
   * Converte o registro raw do Prisma para a entidade de domínio {@link Usuario}.
   * Mantém os tipos Prisma isolados nesta camada, evitando vazamento para o domínio.
   * @param registro - Objeto plano retornado pelo Prisma.
   * @returns Entidade de domínio reconstituída.
   */
  private mapear(registro: {
    id: string;
    nome: string;
    email: string;
    senhaHash: string;
    papel: string;
    refreshTokenHash: string | null;
    ativo: boolean;
    criadoEm: Date;
    atualizadoEm: Date;
  }): Usuario {
    return Usuario.reconstituir({
      id: UsuarioId.de(registro.id),
      nome: registro.nome,
      email: registro.email,
      senhaHash: registro.senhaHash,
      papel: registro.papel as PapelUsuario,
      refreshTokenHash: registro.refreshTokenHash,
      ativo: registro.ativo,
      criadoEm: registro.criadoEm,
      atualizadoEm: registro.atualizadoEm,
    });
  }
}
