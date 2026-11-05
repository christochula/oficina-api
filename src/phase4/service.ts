import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../shared/database/prisma.service';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { Budget, command, history, Order } from './contracts';
import { OrderStore } from './store';
import { requestContext } from '../shared/observability/request-context';
import { PapelUsuario as Role } from '../usuario/domain/papel-usuario.enum';
import { AbrirOrdemServicoInput } from '../ordem-servico/application/casos-de-uso/abrir-ordem-servico.usecase';
export interface RemoteOrder {
  budget?: Budget;
  payment?: Record<string, unknown>;
  updatedAt?: string;
  diagnosis?: string | { descricao: string };
  consumptions?: unknown[];
  mecanicoId?: string;
}

@Injectable()
export class DistributedOrders {
  constructor(
    private readonly store: OrderStore,
    private readonly prisma: PrismaService,
  ) {}
  assertAccess(order: Order, user: JwtPayload) {
    const role = user.role ?? user.papel;
    if (
      role === Role.CLIENTE &&
      order.clienteId !== (user.clienteId ?? user.client_id ?? user.sub)
    )
      throw new ForbiddenException('OS fora do seu escopo');
    if (role === Role.MECANICO && order.mecanicoResponsavelId !== user.sub)
      throw new ForbiddenException('OS atribuída a outro mecânico');
  }
  async remote(
    service: 'billing' | 'production',
    path: string,
    method = 'GET',
    body?: unknown,
    authorization?: string,
  ) {
    const base =
      process.env[
        service === 'billing' ? 'BILLING_SERVICE_URL' : 'PRODUCTION_SERVICE_URL'
      ];
    if (!base)
      throw new BadGatewayException(
        `Configure ${service.toUpperCase()}_SERVICE_URL`,
      );
    const response = await fetch(
      `${base.replace(/\/$/, '')}/api/v1/${service}${path}`,
      {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(authorization
            ? { Authorization: authorization }
            : {
                'X-Internal-Token': process.env.AUTH_CLIENT_LOOKUP_TOKEN || '',
              }),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!response.ok) {
      if (response.status === 403)
        throw new ForbiddenException(
          'Ação não permitida pelo serviço responsável',
        );
      if (response.status === 409)
        throw new ConflictException(
          'Estado incompatível no serviço responsável',
        );
      if (response.status === 400)
        throw new BadRequestException('Dados inválidos no serviço responsável');
      throw new BadGatewayException(
        `${service} indisponível (${response.status})`,
      );
    }
    const result = (await response.json()) as RemoteOrder & {
      data?: RemoteOrder;
    };
    return result.data ?? result;
  }
  async open(
    input: AbrirOrdemServicoInput & { filialId?: string },
    _user: JwtPayload,
  ) {
    let clienteId = input.clienteId;
    if (!clienteId && input.cliente) {
      const c = input.cliente;
      const numeroDoc = String(c.numeroDoc || '').replace(/\D/g, '');
      const existing = await this.prisma.cliente.findUnique({
        where: { numeroDoc },
      });
      clienteId =
        existing?.id ??
        (
          await this.prisma.cliente.create({
            data: {
              id: `cl${randomUUID()}`,
              tipoDoc: c.tipoDoc,
              numeroDoc,
              nome: c.nome,
              email: c.email,
              telefone: c.telefone,
              ...(c.endereco || {}),
            },
          })
        ).id;
    }
    let veiculoId = input.veiculoId;
    if (!veiculoId && input.veiculo) {
      const v = input.veiculo;
      const existing = await this.prisma.veiculo.findUnique({
        where: { placa: v.placa },
      });
      veiculoId =
        existing?.id ??
        (
          await this.prisma.veiculo.create({
            data: {
              ...v,
              id: `ve${randomUUID()}`,
            },
          })
        ).id;
    }
    if (!clienteId || !veiculoId)
      throw new BadRequestException('Informe cliente e veículo');
    const [cliente, veiculo] = await Promise.all([
      this.prisma.cliente.findUnique({ where: { id: clienteId } }),
      this.prisma.veiculo.findUnique({ where: { id: veiculoId } }),
    ]);
    if (!cliente?.ativo || !veiculo?.ativo)
      throw new BadRequestException('Cliente ou veículo inválido/inativo');
    const now = new Date().toISOString();
    const order: Order = {
      id: `os${randomUUID()}`,
      numero: 0,
      filialId: input.filialId || 'filial-sp',
      clienteId,
      veiculoId,
      status: 'RECEBIDA',
      sagaId: randomUUID(),
      correlationId: requestContext.getStore()?.correlationId,
      traceparent: requestContext.getStore()?.traceparent,
      sagaState: 'AWAITING_DIAGNOSIS',
      paymentConfirmed: false,
      problemasRelatados: input.problemasRelatados || [],
      servicosSolicitados: input.servicosSolicitados || [],
      notasInternas: input.notasInternas,
      notasCliente: input.notasCliente,
      criadoEm: now,
      atualizadoEm: now,
      historico: [],
    };
    history(order, 'ORDEM_ABERTA');
    return this.store.create(
      order,
      ['BILLING', 'PRODUCTION'].map((destination) => ({
        destination: `REGISTER_${destination}` as
          | 'REGISTER_BILLING'
          | 'REGISTER_PRODUCTION',
        message: command(order, 'RegisterOrder', {
          osId: order.id,
          filialId: order.filialId,
          clienteId: order.clienteId,
        }),
      })),
    );
  }
  async read(id: string, user: JwtPayload) {
    const order = await this.store.get(id);
    this.assertAccess(order, user);
    const [billing, production] = await Promise.all([
      this.remote('billing', `/internal/orders/${encodeURIComponent(id)}`),
      this.remote('production', `/internal/orders/${encodeURIComponent(id)}`),
    ]);
    const budget = billing.budget;
    const result = {
      ...order,
      orcamento: budget
        ? {
            id: id,
            total: budget.totalCents / 100,
            aprovadoEm: budget.approved
              ? billing.updatedAt || order.atualizadoEm
              : null,
            grupos: [
              {
                titulo: 'Serviços aprovados',
                ordem: 0,
                total: budget.totalCents / 100,
                linhasServico: budget.items.map((item) => ({
                  descricao: item.description,
                  quantidade: item.quantity,
                  valorUnitario: item.unitPriceCents / 100,
                  subtotal: (item.quantity * item.unitPriceCents) / 100,
                  tipo: item.pecaId ? 'MATERIAL' : 'SERVICO',
                  pecaId: item.pecaId,
                })),
              },
            ],
          }
        : null,
      diagnostico: production.diagnosis
        ? {
            descricao:
              typeof production.diagnosis === 'string'
                ? production.diagnosis
                : production.diagnosis.descricao,
          }
        : null,
      pagamento: billing.payment,
      preparacao: order.sagaState,
      consumosPeca: production.consumptions || [],
      mecanicoResponsavelId:
        production.mecanicoId || order.mecanicoResponsavelId,
    };
    if ((user.role ?? user.papel) === Role.CLIENTE) {
      delete result.notasInternas;
      delete result.failure;
    }
    return result;
  }
  async list(user: JwtPayload, query: Record<string, string>) {
    let orders = await this.store.list();
    orders = orders
      .filter((order) => {
        try {
          this.assertAccess(order, user);
          return true;
        } catch {
          return false;
        }
      })
      .filter(
        (order) =>
          (!query.status || order.status === query.status) &&
          (!query.filialId || order.filialId === query.filialId),
      );
    const pagina = Math.max(1, Number(query.pagina) || 1);
    const porPagina = Math.min(100, Math.max(1, Number(query.porPagina) || 20));
    return {
      data: orders
        .slice((pagina - 1) * porPagina, pagina * porPagina)
        .map((order) => {
          if ((user.role ?? user.papel) !== Role.CLIENTE) return order;
          const { notasInternas: _notes, failure: _failure, ...safe } = order;
          return safe;
        }),
      meta: {
        pagina,
        porPagina,
        total: orders.length,
        totalPaginas: Math.ceil(orders.length / porPagina),
      },
    };
  }
  async forward(
    id: string,
    user: JwtPayload,
    auth: string,
    service: 'billing' | 'production',
    action: string,
    body?: unknown,
    method = 'POST',
  ) {
    const order = await this.store.get(id);
    this.assertAccess(order, user);
    return this.remote(
      service,
      `/orders/${encodeURIComponent(id)}/${action}`,
      method,
      body,
      auth,
    );
  }
  async deliver(id: string, user: JwtPayload) {
    return this.store.mutate(id, (order) => {
      this.assertAccess(order, user);
      if (!order.paymentConfirmed || order.status !== 'PRONTA_PARA_ENTREGA')
        throw new ConflictException('A entrega exige pagamento confirmado');
      history(order, 'VEICULO_ENTREGUE', 'ENTREGUE');
      return [];
    });
  }
  async retry(id: string) {
    return this.store.mutate(id, (order) => {
      if (order.sagaState !== 'COMPENSATED')
        throw new ConflictException('Saga não compensada');
      order.sagaId = randomUUID();
      order.sagaState = 'PREPARING_BUDGET';
      order.failure = undefined;
      order.deadline = new Date(Date.now() + 60000).toISOString();
      return [
        {
          destination: 'BILLING',
          message: command(order, 'PrepareApprovedBudget'),
        },
      ];
    });
  }
}
