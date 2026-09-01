import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../../shared/database/prisma.service';
import { PrismaTransactionManager } from '../../../shared/database/prisma-transaction.manager';
import { Estoque, Peca } from '../../domain/estoque.entity';
import { PecaId } from '../../domain/peca-id.value-object';
import {
  EstoqueRepository,
  EstoqueService,
} from '../../domain/estoque.repository';
import { RecursoNaoEncontrado } from '../../../shared/excecoes/dominio.exception';

@Injectable()
export class PrismaEstoqueRepository
  implements EstoqueRepository, EstoqueService
{
  constructor(private readonly transactionManager: PrismaTransactionManager) {}

  private get db(): Prisma.TransactionClient | PrismaService {
    return this.transactionManager.client;
  }

  async salvar(estoque: Estoque): Promise<void> {
    await this.transactionManager.executar(async () => {
      const db = this.db;
      const pecaExiste = await db.peca.findUnique({
        where: { id: estoque.peca.id.valor },
      });

      if (!pecaExiste) {
        await db.peca.create({
          data: {
            id: estoque.peca.id.valor,
            codigo: estoque.peca.codigo,
            nome: estoque.peca.nome,
            descricao: estoque.peca.descricao,
            precoVenda: estoque.peca.precoVenda,
            ativo: estoque.peca.ativo,
            criadoEm: estoque.peca.criadoEm,
            atualizadoEm: estoque.peca.atualizadoEm,
            estoque: {
              create: {
                quantidadeDisponivel: estoque.quantidadeDisponivel,
                quantidadeMinima: estoque.quantidadeMinima,
                atualizadoEm: estoque.atualizadoEm,
              },
            },
          },
        });
        return;
      }

      await db.peca.update({
        where: { id: estoque.peca.id.valor },
        data: {
          nome: estoque.peca.nome,
          descricao: estoque.peca.descricao,
          precoVenda: estoque.peca.precoVenda,
          ativo: estoque.peca.ativo,
          atualizadoEm: estoque.peca.atualizadoEm,
        },
      });

      await db.estoque.upsert({
        where: { pecaId: estoque.peca.id.valor },
        create: {
          pecaId: estoque.peca.id.valor,
          quantidadeDisponivel: estoque.quantidadeDisponivel,
          quantidadeMinima: estoque.quantidadeMinima,
          atualizadoEm: estoque.atualizadoEm,
        },
        update: {
          quantidadeDisponivel: estoque.quantidadeDisponivel,
          quantidadeMinima: estoque.quantidadeMinima,
          atualizadoEm: estoque.atualizadoEm,
        },
      });
    });
  }

  async buscarPorPecaId(pecaId: PecaId): Promise<Estoque | null> {
    const r = await this.db.estoque.findUnique({
      where: { pecaId: pecaId.valor },
      include: { peca: true },
    });
    if (!r) return null;
    return this.mapear(r);
  }

  async buscarPorId(id: string): Promise<Estoque | null> {
    const r = await this.db.estoque.findUnique({
      where: { pecaId: id },
      include: { peca: true },
    });
    if (!r) return null;
    return this.mapear(r);
  }

  async listar(
    pagina: number,
    porPagina: number,
  ): Promise<{ itens: Estoque[]; total: number }> {
    const db = this.db;
    const [registros, total] = await Promise.all([
      db.estoque.findMany({
        include: { peca: true },
        skip: (pagina - 1) * porPagina,
        take: porPagina,
        orderBy: { peca: { nome: 'asc' } },
      }),
      db.estoque.count(),
    ]);
    return { itens: registros.map((r) => this.mapear(r)), total };
  }

  async processarConsumoPeca(
    pecaId: string,
    quantidade: number,
  ): Promise<void> {
    const estoque = await this.buscarPorPecaId(PecaId.de(pecaId));
    if (!estoque) throw new RecursoNaoEncontrado('Estoque para peca', pecaId);

    estoque.darSaida(quantidade);
    await this.salvar(estoque);
  }

  private mapear(r: {
    pecaId: string;
    quantidadeDisponivel: unknown;
    quantidadeMinima: unknown;
    atualizadoEm: Date;
    peca: {
      id: string;
      codigo: string;
      nome: string;
      descricao: string | null;
      precoVenda: unknown;
      ativo: boolean;
      criadoEm: Date;
      atualizadoEm: Date;
    };
  }): Estoque {
    const peca: Peca = {
      id: PecaId.de(r.peca.id),
      codigo: r.peca.codigo,
      nome: r.peca.nome,
      descricao: r.peca.descricao,
      precoVenda: Number(r.peca.precoVenda),
      ativo: r.peca.ativo,
      criadoEm: r.peca.criadoEm,
      atualizadoEm: r.peca.atualizadoEm,
    };

    return Estoque.reconstituir({
      peca,
      quantidadeDisponivel: Number(r.quantidadeDisponivel),
      quantidadeMinima: Number(r.quantidadeMinima),
      atualizadoEm: r.atualizadoEm,
    });
  }
}
