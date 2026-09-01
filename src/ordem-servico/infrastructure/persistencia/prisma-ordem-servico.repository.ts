import { Injectable } from '@nestjs/common';
import { $Enums, Prisma } from '@prisma/client';
import type { PrismaService } from '../../../shared/database/prisma.service';
import { PrismaTransactionManager } from '../../../shared/database/prisma-transaction.manager';
import { OrdemServico } from '../../domain/ordem-servico.entity';
import { OrdemServicoId } from '../../domain/ordem-servico-id.value-object';
import {
  FiltrosListagemOS,
  OrdemServicoRepository,
  RepositorioListagem,
} from '../../domain/ordem-servico.repository';
import { StatusOrdemServico } from '../../domain/status-ordem-servico.enum';
import { GrupoOrcamento } from '../../domain/value-objects/grupo-orcamento.vo';
import {
  LinhaServico,
  TipoLinhaServico,
} from '../../domain/value-objects/linha-servico.vo';
import { Orcamento } from '../../domain/value-objects/orcamento.vo';
import { TelemetryService } from '../../../shared/observability/telemetry.service';

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

type OrdemServicoRaw = Prisma.OrdemServicoGetPayload<{
  include: typeof INCLUDE_COMPLETO;
}>;

@Injectable()
export class PrismaOrdemServicoRepository implements OrdemServicoRepository {
  constructor(
    private readonly transactionManager: PrismaTransactionManager,
    private readonly telemetry: TelemetryService,
  ) {}

  private get db(): Prisma.TransactionClient | PrismaService {
    return this.transactionManager.client;
  }

  async salvar(os: OrdemServico): Promise<void> {
    const novasEntradas = os.historico.filter((h) => !h.id);
    let ordemCriada = false;

    try {
      await this.transactionManager.executar(async () => {
        const db = this.db;
        const existente = await db.ordemServico.findUnique({
          where: { id: os.id.valor },
        });

        if (!existente) {
          await db.ordemServico.create({
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
                create: os.problemasRelatados.map((p) => ({
                  descricao: p.descricao,
                })),
              },
              servicosSolicitados: {
                create: os.servicosSolicitados.map((s) => ({
                  servicoId: s.servicoId,
                  nomeServico: s.nomeServico,
                  observacao: s.observacao,
                })),
              },
              historico: {
                create: novasEntradas.map((h) => ({
                  evento: h.evento as $Enums.EventoHistoricoOS,
                  descricao: h.descricao,
                  usuarioId: h.usuarioId,
                  statusAnterior: (h.statusAnterior ??
                    null) as $Enums.StatusOrdemServico | null,
                  statusNovo: (h.statusNovo ??
                    null) as $Enums.StatusOrdemServico | null,
                  criadoEm: h.criadoEm ?? new Date(),
                })),
              },
            },
          });
          ordemCriada = true;
          return;
        }

        await db.ordemServico.update({
          where: { id: os.id.valor },
          data: {
            status: os.status,
            mecanicoResponsavelId: os.mecanicoResponsavelId,
            notasInternas: os.notasInternas,
            notasCliente: os.notasCliente,
            atualizadoEm: os.atualizadoEm,
          },
        });

        if (os.diagnostico) {
          await db.diagnostico.upsert({
            where: { ordemServicoId: os.id.valor },
            create: {
              ordemServicoId: os.id.valor,
              descricao: os.diagnostico.descricao,
            },
            update: { descricao: os.diagnostico.descricao },
          });
        }

        if (os.orcamento) {
          const orcamentoExistente = await db.orcamento.findUnique({
            where: { ordemServicoId: os.id.valor },
          });

          if (!orcamentoExistente) {
            await db.orcamento.create({
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
            await db.orcamento.update({
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

        if (novasEntradas.length > 0) {
          await db.historicoOS.createMany({
            data: novasEntradas.map((h) => ({
              ordemServicoId: os.id.valor,
              evento: h.evento as $Enums.EventoHistoricoOS,
              descricao: h.descricao,
              usuarioId: h.usuarioId,
              statusAnterior: (h.statusAnterior ??
                null) as $Enums.StatusOrdemServico | null,
              statusNovo: (h.statusNovo ??
                null) as $Enums.StatusOrdemServico | null,
              criadoEm: h.criadoEm ?? new Date(),
            })),
          });
        }

        const novosConsumos = os.consumosPeca.filter((c) => !c.id);
        if (novosConsumos.length > 0) {
          await db.consumoPeca.createMany({
            data: novosConsumos.map((c) => ({
              ordemServicoId: os.id.valor,
              pecaId: c.pecaId,
              quantidade: c.quantidade,
              criadoEm: c.criadoEm ?? new Date(),
            })),
          });
        }
      });
    } catch (error) {
      this.telemetry.serviceOrderProcessingFailure('repository_save');
      throw error;
    }

    if (ordemCriada) this.telemetry.serviceOrderCreated();
    this.emitTransitionMetrics(os, novasEntradas);
  }

  private emitTransitionMetrics(
    os: OrdemServico,
    novasEntradas: OrdemServico['historico'],
  ): void {
    const historicoOrdenado = [...os.historico].sort(
      (a, b) => (a.criadoEm?.getTime() ?? 0) - (b.criadoEm?.getTime() ?? 0),
    );

    for (const entrada of novasEntradas) {
      if (entrada.statusNovo)
        this.telemetry.serviceOrderTransition(entrada.statusNovo);
      if (
        !entrada.statusAnterior ||
        entrada.statusAnterior === entrada.statusNovo
      )
        continue;

      const timestampSaida = entrada.criadoEm?.getTime() ?? Date.now();
      const entradaNoStatus = [...historicoOrdenado]
        .reverse()
        .find(
          (item) =>
            item !== entrada &&
            item.statusNovo === entrada.statusAnterior &&
            (item.criadoEm?.getTime() ?? 0) <= timestampSaida,
        );

      if (entradaNoStatus?.criadoEm) {
        this.telemetry.serviceOrderStatusDuration(
          entrada.statusAnterior,
          Math.max(0, timestampSaida - entradaNoStatus.criadoEm.getTime()),
        );
      }
    }
  }

  async buscarPorId(id: OrdemServicoId): Promise<OrdemServico | null> {
    const registro = await this.db.ordemServico.findUnique({
      where: { id: id.valor },
      include: INCLUDE_COMPLETO,
    });
    if (!registro) return null;
    return this.mapear(registro);
  }

  async buscarPorNumero(numero: number): Promise<OrdemServico | null> {
    const registro = await this.db.ordemServico.findUnique({
      where: { numero },
      include: INCLUDE_COMPLETO,
    });
    if (!registro) return null;
    return this.mapear(registro);
  }

  async listar(filtros: FiltrosListagemOS): Promise<RepositorioListagem> {
    const where: Prisma.OrdemServicoWhereInput = {};
    if (filtros.statusIn?.length)
      where.status = { in: filtros.statusIn as $Enums.StatusOrdemServico[] };
    else if (filtros.status)
      where.status = filtros.status as $Enums.StatusOrdemServico;
    if (filtros.clienteId) where.clienteId = filtros.clienteId;
    if (filtros.mecanicoResponsavelId)
      where.mecanicoResponsavelId = filtros.mecanicoResponsavelId;

    const pagina = filtros.pagina;
    const porPagina = filtros.porPagina;
    const db = this.db;

    const queryBase = {
      where,
      include: INCLUDE_COMPLETO,
      orderBy: { criadoEm: filtros.ordemCriacao ?? 'desc' },
    };

    const findManyArgs =
      typeof pagina === 'number' && typeof porPagina === 'number'
        ? { ...queryBase, skip: (pagina - 1) * porPagina, take: porPagina }
        : queryBase;

    const [registros, total] = await Promise.all([
      db.ordemServico.findMany(findManyArgs),
      db.ordemServico.count({ where }),
    ]);

    return { itens: registros.map((r) => this.mapear(r)), total };
  }

  async buscarEntregues(): Promise<OrdemServico[]> {
    const registros = await this.db.ordemServico.findMany({
      where: { status: 'ENTREGUE' },
      include: INCLUDE_COMPLETO,
      orderBy: { criadoEm: 'asc' },
    });
    return registros.map((r) => this.mapear(r));
  }

  async buscarTodasComHistorico(osIds?: string[]): Promise<OrdemServico[]> {
    const registros = await this.db.ordemServico.findMany({
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
        statusAnterior: (h.statusAnterior as StatusOrdemServico | null) ?? null,
        statusNovo: (h.statusNovo as StatusOrdemServico | null) ?? null,
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
