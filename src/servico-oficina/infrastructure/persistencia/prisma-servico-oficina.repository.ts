import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { ServicoOficina } from '../../domain/servico-oficina.entity';
import { ServicoOficinaId } from '../../domain/servico-oficina-id.value-object';
import { ServicoOficinaRepository } from '../../domain/servico-oficina.repository';

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
    const registro = await this.prisma.servicoOficina.findUnique({ where: { id: id.valor } });
    if (!registro) return null;
    return this.mapear(registro);
  }

  async listar(pagina: number, porPagina: number): Promise<{ itens: ServicoOficina[]; total: number }> {
    const [registros, total] = await Promise.all([
      this.prisma.servicoOficina.findMany({
        where: { ativo: true },
        orderBy: { nome: 'asc' },
        skip: (pagina - 1) * porPagina,
        take: porPagina,
      }),
      this.prisma.servicoOficina.count({ where: { ativo: true } }),
    ]);
    return { itens: registros.map((r) => this.mapear(r)), total };
  }

  private mapear(r: { id: string; nome: string; descricao: string | null; categoria: string | null; ativo: boolean; criadoEm: Date; atualizadoEm: Date }): ServicoOficina {
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
