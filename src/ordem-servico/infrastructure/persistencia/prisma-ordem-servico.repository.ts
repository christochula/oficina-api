import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../shared/database/prisma.service';
import { OrdemServico } from '../../domain/ordem-servico.entity';
import { OrdemServicoId } from '../../domain/ordem-servico-id.value-object';
import {
  FiltrosListagemOS,
  OrdemServicoRepository,
  RepositorioListagem,
} from '../../domain/ordem-servico.repository';
import { StatusOrdemServico } from '../../domain/status-ordem-servico.enum';
import { GrupoOrcamento } from '../../domain/value-objects/grupo-orcamento.vo';
import { LinhaServico, TipoLinhaServico } from '../../domain/value-objects/linha-servico.vo';
import { Orcamento } from '../../domain/value-objects/orcamento.vo';

/**
 * Include completo para carregar uma OS com todas as relações necessárias.
 */
const INCLUDE_COMPLETO = {
  problemasRelatados: true,
  servicosSolicitados: true,
  diagnostico: true,
  orcamento: {
    include: {
      grupos: {
        include: { linhasServico: true },
        orderBy: { ordem: 'asc' as const },
      },
    },
  },
  historico: { orderBy: { criadoEm: 'asc' as const } },
  consumosPeca: true,
} satisfies Prisma.OrdemServicoInclude;

type OrdemServicoRaw = Prisma.OrdemServicoGetPayload<{ include: typeof INCLUDE_COMPLETO }>;

/**
 * Implementação do repositório de OrdemServico utilizando Prisma ORM.
 */
@Injectable()
export class PrismaOrdemServicoRepository implements OrdemServicoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async salvar(os: OrdemServico): Promise<void> {
    const existente = await this.prisma.ordemServico.findUnique({ where: { id: os.id.valor } });

    if (!existente) {
      await this.prisma.ordemServico.create({
        data: {
          id: os.id.valor,
          status: os.status,
          clienteId: os.clienteId,
          veiculoId: os.veiculoId,
          mecanicoResponsavelId: os.mecanicoResponsavelId,
          notasInternas: os.notasInternas,
          notasCliente: os.notasCliente,
          criadoEm: os.criadoEm,
          atualizadoEm: os.atualizadoEm,
          problemasRelatados: {
            create: os.problemasRelatados.map((p) => ({ descricao: p.descricao })),
          },
          servicosSolicitados: {
            create: os.servicosSolicitados.map((s) => ({
              servicoId: s.servicoId,
              nomeServico: s.nomeServico,
              observacao: s.observacao,
            })),
          },
        },
      });
      return;
    }

    await this.prisma.ordemServico.update({
      where: { id: os.id.valor },
      data: {
        status: os.status,
        mecanicoResponsavelId: os.mecanicoResponsavelId,
        notasInternas: os.notasInternas,
        notasCliente: os.notasCliente,
        atualizadoEm: os.atualizadoEm,
      },
    });

    // Sincroniza diagnóstico
    if (os.diagnostico) {
      await this.prisma.diagnostico.upsert({
        where: { ordemServicoId: os.id.valor },
        create: { ordemServicoId: os.id.valor, descricao: os.diagnostico.descricao },
        update: { descricao: os.diagnostico.descricao },
      });
    }

    // Sincroniza orçamento com grupos
    if (os.orcamento) {
      const orcamentoExistente = await this.prisma.orcamento.findUnique({
        where: { ordemServicoId: os.id.valor },
      });

      if (!orcamentoExistente) {
        await this.prisma.orcamento.create({
          data: {
            ordemServicoId: os.id.valor,
            total: os.orcamento.total,
            notasInternas: os.orcamento.notasInternas,
            notasCliente: os.orcamento.notasCliente,
            aprovadoEm: os.orcamento.aprovadoEm,
            rejeitadoEm: os.orcamento.rejeitadoEm,
            criadoEm: os.orcamento.criadoEm,
            grupos: {
              create: os.orcamento.grupos.map((g) => ({
                titulo: g.titulo,
                total: g.total,
                ordem: g.ordem,
                linhasServico: {
                  create: g.linhasServico.map((l) => ({
                    tipo: l.tipo,
                    descricao: l.descricao,
                    quantidade: l.quantidade,
                    valorUnitario: l.valorUnitario,
                    subtotal: l.subtotal,
                    pecaId: l.pecaId,
                  })),
                },
              })),
            },
          },
        });
      } else {
        await this.prisma.orcamento.update({
          where: { ordemServicoId: os.id.valor },
          data: {
            total: os.orcamento.total,
            notasInternas: os.orcamento.notasInternas,
            notasCliente: os.orcamento.notasCliente,
            aprovadoEm: os.orcamento.aprovadoEm,
            rejeitadoEm: os.orcamento.rejeitadoEm,
          },
        });
      }
    }

    // Sincroniza histórico — adiciona apenas entradas sem id (novas)
    const novasEntradas = os.historico.filter((h) => !h.id);
    if (novasEntradas.length > 0) {
      await this.prisma.historicoOS.createMany({
        data: novasEntradas.map((h) => ({
          ordemServicoId: os.id.valor,
          evento: h.evento as never,
          descricao: h.descricao,
          usuarioId: h.usuarioId,
          criadoEm: h.criadoEm ?? new Date(),
        })),
      });
    }

    // Sincroniza consumos de peça — adiciona apenas entradas sem id (novas)
    const novosConsumos = os.consumosPeca.filter((c) => !c.id);
    if (novosConsumos.length > 0) {
      await this.prisma.consumoPeca.createMany({
        data: novosConsumos.map((c) => ({
          ordemServicoId: os.id.valor,
          pecaId: c.pecaId,
          quantidade: c.quantidade,
          criadoEm: c.criadoEm ?? new Date(),
        })),
      });
    }
  }

  async buscarPorId(id: OrdemServicoId): Promise<OrdemServico | null> {
    const registro = await this.prisma.ordemServico.findUnique({
      where: { id: id.valor },
      include: INCLUDE_COMPLETO,
    });
    if (!registro) return null;
    return this.mapear(registro);
  }

  async listar(filtros: FiltrosListagemOS): Promise<RepositorioListagem> {
    const where: Prisma.OrdemServicoWhereInput = {};
    if (filtros.status) where.status = filtros.status as never;
    if (filtros.clienteId) where.clienteId = filtros.clienteId;
    if (filtros.mecanicoResponsavelId) where.mecanicoResponsavelId = filtros.mecanicoResponsavelId;

    const pagina = filtros.pagina ?? 1;
    const porPagina = filtros.porPagina ?? 20;

    const [registros, total] = await Promise.all([
      this.prisma.ordemServico.findMany({
        where,
        include: INCLUDE_COMPLETO,
        orderBy: { criadoEm: 'desc' },
        skip: (pagina - 1) * porPagina,
        take: porPagina,
      }),
      this.prisma.ordemServico.count({ where }),
    ]);

    return { itens: registros.map((r) => this.mapear(r)), total };
  }

  async buscarEntregues(): Promise<OrdemServico[]> {
    const registros = await this.prisma.ordemServico.findMany({
      where: { status: 'ENTREGUE' },
      include: INCLUDE_COMPLETO,
      orderBy: { criadoEm: 'asc' },
    });
    return registros.map((r) => this.mapear(r));
  }

  async buscarTodasComHistorico(osIds?: string[]): Promise<OrdemServico[]> {
    const registros = await this.prisma.ordemServico.findMany({
      where: osIds?.length ? { id: { in: osIds } } : undefined,
      include: INCLUDE_COMPLETO,
      orderBy: { criadoEm: 'asc' },
    });
    return registros.map((r) => this.mapear(r));
  }

  private mapear(r: OrdemServicoRaw): OrdemServico {
    const orcamento = r.orcamento
      ? new Orcamento({
          id: r.orcamento.id,
          grupos: r.orcamento.grupos.map(
            (g) =>
              new GrupoOrcamento({
                id: g.id,
                titulo: g.titulo,
                ordem: g.ordem,
                linhasServico: g.linhasServico.map(
                  (l) =>
                    new LinhaServico({
                      id: l.id,
                      tipo: l.tipo as TipoLinhaServico,
                      descricao: l.descricao,
                      quantidade: Number(l.quantidade),
                      valorUnitario: Number(l.valorUnitario),
                      pecaId: l.pecaId,
                    }),
                ),
              }),
          ),
          notasInternas: r.orcamento.notasInternas,
          notasCliente: r.orcamento.notasCliente,
          aprovadoEm: r.orcamento.aprovadoEm,
          rejeitadoEm: r.orcamento.rejeitadoEm,
          criadoEm: r.orcamento.criadoEm,
        })
      : null;

    return OrdemServico.reconstituir({
      id: OrdemServicoId.de(r.id),
      numero: r.numero,
      status: r.status as StatusOrdemServico,
      clienteId: r.clienteId,
      veiculoId: r.veiculoId,
      mecanicoResponsavelId: r.mecanicoResponsavelId,
      notasInternas: r.notasInternas,
      notasCliente: r.notasCliente,
      problemasRelatados: r.problemasRelatados,
      servicosSolicitados: r.servicosSolicitados.map((s) => ({
        id: s.id,
        servicoId: s.servicoId,
        nomeServico: s.nomeServico,
        observacao: s.observacao,
      })),
      diagnostico: r.diagnostico ?? null,
      orcamento,
      historico: r.historico.map((h) => ({
        id: h.id,
        evento: h.evento,
        descricao: h.descricao ?? undefined,
        usuarioId: h.usuarioId ?? undefined,
        criadoEm: h.criadoEm,
      })),
      consumosPeca: r.consumosPeca.map((c) => ({
        id: c.id,
        pecaId: c.pecaId,
        quantidade: Number(c.quantidade),
        criadoEm: c.criadoEm,
      })),
      criadoEm: r.criadoEm,
      atualizadoEm: r.atualizadoEm,
    });
  }
}
