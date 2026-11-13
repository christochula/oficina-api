import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { ServicoOficina } from '../../domain/servico-oficina.entity';
import { ServicoOficinaId } from '../../domain/servico-oficina-id.value-object';
import {
  ServicoOficinaRepository,
  ServicoListFilters,
} from '../../domain/servico-oficina.repository';
import type { ServicoOficina as ServicoRecord } from '@prisma/client';
import { catalogSearchPattern } from '../../../shared/database/catalog-search';

/**
 * Implementação do repositório de ServicoOficina utilizando Prisma ORM.
 */
@Injectable()
export class PrismaServicoOficinaRepository implements ServicoOficinaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async salvar(servico: ServicoOficina): Promise<void> {
    await this.prisma.servicoOficina.upsert({
      where: { id: servico.id.valor },
      create: {
        id: servico.id.valor,
        nome: servico.nome,
        descricao: servico.descricao,
        categoria: servico.categoria,
        ativo: servico.ativo,
        criadoEm: servico.criadoEm,
        atualizadoEm: servico.atualizadoEm,
      },
      update: {
        nome: servico.nome,
        descricao: servico.descricao,
        categoria: servico.categoria,
        ativo: servico.ativo,
        atualizadoEm: servico.atualizadoEm,
      },
    });
  }

  async buscarPorId(id: ServicoOficinaId): Promise<ServicoOficina | null> {
    const registro = await this.prisma.servicoOficina.findUnique({
      where: { id: id.valor },
    });
    if (!registro) return null;
    return this.mapear(registro);
  }

  async listar(
    pagina: number,
    porPagina: number,
    filtros: ServicoListFilters = {},
  ): Promise<{ itens: ServicoOficina[]; total: number }> {
    const ativo = filtros.ativo ?? true;
    if (filtros.busca?.trim()) {
      const term = catalogSearchPattern(filtros.busca);
      const [registros, totals] = await Promise.all([
        this.prisma.$queryRaw<
          ServicoRecord[]
        >`SELECT * FROM servicos_oficina WHERE ativo = ${ativo} AND
          translate(lower(concat_ws(' ', nome, descricao, categoria)), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn') LIKE ${term}
          ORDER BY nome ASC, id ASC LIMIT ${porPagina} OFFSET ${(pagina - 1) * porPagina}`,
        this.prisma.$queryRaw<
          { total: bigint }[]
        >`SELECT count(*) AS total FROM servicos_oficina WHERE ativo = ${ativo} AND
          translate(lower(concat_ws(' ', nome, descricao, categoria)), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn') LIKE ${term}`,
      ]);
      return {
        itens: registros.map((record) => this.mapear(record)),
        total: Number(totals[0]?.total ?? 0),
      };
    }
    const [registros, total] = await Promise.all([
      this.prisma.servicoOficina.findMany({
        where: { ativo },
        orderBy: [{ nome: 'asc' }, { id: 'asc' }],
        skip: (pagina - 1) * porPagina,
        take: porPagina,
      }),
      this.prisma.servicoOficina.count({ where: { ativo } }),
    ]);
    return { itens: registros.map((r) => this.mapear(r)), total };
  }

  private mapear(r: {
    id: string;
    nome: string;
    descricao: string | null;
    categoria: string | null;
    ativo: boolean;
    criadoEm: Date;
    atualizadoEm: Date;
  }): ServicoOficina {
    return ServicoOficina.reconstituir({
      id: ServicoOficinaId.de(r.id),
      nome: r.nome,
      descricao: r.descricao,
      categoria: r.categoria,
      ativo: r.ativo,
      criadoEm: r.criadoEm,
      atualizadoEm: r.atualizadoEm,
    });
  }
}
