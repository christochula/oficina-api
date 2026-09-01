import {
  Prisma,
  StatusOrdemServico as StatusOrdemServicoPrisma,
} from '@prisma/client';
import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { PrismaTransactionManager } from '../../../shared/database/prisma-transaction.manager';
import { ConflitoDeRecurso } from '../../../shared/excecoes/dominio.exception';
import {
  PAPEIS_USUARIO_INTERNOS,
  PapelUsuario,
} from '../../domain/papel-usuario.enum';
import { Usuario } from '../../domain/usuario.entity';
import { UsuarioId } from '../../domain/usuario-id.value-object';
import {
  FiltrosListagemMecanicos,
  FiltrosListagemUsuarios,
  UsuarioRepository,
} from '../../domain/usuario.repository';

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
  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    private readonly transactionManager?: PrismaTransactionManager,
  ) {}

  private get db(): Prisma.TransactionClient | PrismaService {
    return this.transactionManager?.client ?? this.prisma;
  }

  /**
   * Persiste o usuario realizando upsert: insere se novo, atualiza se já existir.
   * @param usuario - Entidade de domínio a ser salva.
   */
  async salvar(usuario: Usuario): Promise<void> {
    try {
      await this.db.usuario.upsert({
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
    } catch (erro) {
      if (
        typeof erro === 'object' &&
        erro !== null &&
        'code' in erro &&
        (erro as { code?: unknown }).code === 'P2002'
      ) {
        throw new ConflitoDeRecurso(`Email '${usuario.email}' já está em uso`);
      }
      throw erro;
    }
  }

  /**
   * Busca um usuario pelo seu ID único de domínio (ULID com prefixo `us`).
   * @param id - UsuarioId a ser pesquisado.
   * @returns A entidade de domínio mapeada ou `null` se não encontrada.
   */
  async buscarPorId(id: UsuarioId): Promise<Usuario | null> {
    const registro = await this.db.usuario.findUnique({
      where: { id: id.valor },
    });
    if (!registro) return null;
    return this.mapear(registro);
  }

  /**
   * Busca um usuario pelo e-mail, utilizado no fluxo de autenticação e validação de unicidade.
   * @param email - E-mail do usuário a ser pesquisado.
   * @returns A entidade de domínio mapeada ou `null` se não encontrada.
   */
  async buscarPorEmail(email: string): Promise<Usuario | null> {
    const registro = await this.db.usuario.findFirst({
      where: {
        email: {
          equals: email.trim(),
          mode: 'insensitive',
        },
      },
    });
    if (!registro) return null;
    return this.mapear(registro);
  }

  /** Lista exclusivamente usuários mecânicos com paginação e busca textual. */
  async listarMecanicos(
    pagina: number,
    porPagina: number,
    filtros: FiltrosListagemMecanicos = {},
  ): Promise<{ itens: Usuario[]; total: number }> {
    const where = this.criarFiltroListagemMecanicos(filtros);
    const [registros, total] = await Promise.all([
      this.db.usuario.findMany({
        where,
        orderBy: [{ nome: 'asc' }, { id: 'asc' }],
        skip: (pagina - 1) * porPagina,
        take: porPagina,
      }),
      this.db.usuario.count({ where }),
    ]);

    return { itens: registros.map((registro) => this.mapear(registro)), total };
  }

  /** Lista exclusivamente os papéis internos gerenciáveis pela oficina. */
  async listarInternos(
    pagina: number,
    porPagina: number,
    filtros: FiltrosListagemUsuarios = {},
  ): Promise<{ itens: Usuario[]; total: number }> {
    const where = this.criarFiltroListagemInternos(filtros);
    const [registros, total] = await Promise.all([
      this.db.usuario.findMany({
        where,
        orderBy: [{ nome: 'asc' }, { id: 'asc' }],
        skip: (pagina - 1) * porPagina,
        take: porPagina,
      }),
      this.db.usuario.count({ where }),
    ]);

    return { itens: registros.map((registro) => this.mapear(registro)), total };
  }

  async contarAdministradoresAtivos(
    excluirUsuarioId?: string,
  ): Promise<number> {
    const where: Prisma.UsuarioWhereInput = {
      papel: PapelUsuario.ADMINISTRADOR,
      ativo: true,
    };
    if (excluirUsuarioId) where.id = { not: excluirUsuarioId };
    return this.db.usuario.count({ where });
  }

  async contarOrdensNaoTerminaisDoMecanico(
    mecanicoId: string,
  ): Promise<number> {
    return this.db.ordemServico.count({
      where: {
        mecanicoResponsavelId: mecanicoId,
        status: {
          in: [
            StatusOrdemServicoPrisma.ATRIBUIDA,
            StatusOrdemServicoPrisma.EM_DIAGNOSTICO,
            StatusOrdemServicoPrisma.AGUARDANDO_APROVACAO,
            StatusOrdemServicoPrisma.APROVADA,
            StatusOrdemServicoPrisma.EM_EXECUCAO,
          ],
        },
      },
    });
  }

  /** Monta uma única cláusula reutilizada na consulta e na contagem. */
  private criarFiltroListagemMecanicos(
    filtros: FiltrosListagemMecanicos,
  ): Prisma.UsuarioWhereInput {
    const busca = filtros.busca?.trim() ?? '';
    const where: Prisma.UsuarioWhereInput = {
      papel: PapelUsuario.MECANICO,
    };

    if (filtros.ativo !== undefined) where.ativo = filtros.ativo;
    if (!busca) return where;

    where.OR = [
      { nome: { contains: busca, mode: 'insensitive' } },
      { email: { contains: busca, mode: 'insensitive' } },
      { id: { contains: busca, mode: 'insensitive' } },
    ];
    return where;
  }

  private criarFiltroListagemInternos(
    filtros: FiltrosListagemUsuarios,
  ): Prisma.UsuarioWhereInput {
    const busca = filtros.busca?.trim() ?? '';
    const where: Prisma.UsuarioWhereInput = {
      papel: filtros.papel ?? { in: [...PAPEIS_USUARIO_INTERNOS] },
    };

    if (filtros.ativo !== undefined) where.ativo = filtros.ativo;
    if (!busca) return where;

    where.OR = [
      { nome: { contains: busca, mode: 'insensitive' } },
      { email: { contains: busca, mode: 'insensitive' } },
      { id: { contains: busca, mode: 'insensitive' } },
    ];
    return where;
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
