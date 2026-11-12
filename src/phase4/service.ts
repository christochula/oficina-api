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
import {
  Budget,
  BudgetItem,
  command,
  history,
  Order,
  RequestedPart,
} from './contracts';
import { OrderStore } from './store';
import { requestContext } from '../shared/observability/request-context';
import { TelemetryService } from '../shared/observability/telemetry.service';
import { PapelUsuario as Role } from '../usuario/domain/papel-usuario.enum';
import { AbrirOrdemServicoInput } from '../ordem-servico/application/casos-de-uso/abrir-ordem-servico.usecase';
export interface RemoteOrder {
  budget?: Budget;
  payment?: Record<string, unknown>;
  updatedAt?: string;
  diagnosis?: string | { descricao: string };
  consumptions?: unknown[];
  parts?: {
    pecaId: string;
    quantity: number;
    consumedQuantity?: number;
    description?: string;
    nome?: string;
    codigo?: string;
    filialId?: string;
  }[];
  mecanicoId?: string;
}

interface CatalogStock {
  filialId: string;
  peca: {
    id: string;
    codigo: string;
    nome: string;
    descricao?: string | null;
    ativo: boolean;
  };
}

const searchText = (value?: string) =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();

class RemoteOrderNotFound extends BadGatewayException {
  constructor(service: 'billing' | 'production') {
    super(`${service} indisponível (404)`);
  }
}

@Injectable()
export class DistributedOrders {
  constructor(
    private readonly store: OrderStore,
    private readonly prisma: PrismaService,
    private readonly telemetry: TelemetryService,
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
  private async labels(orders: Order[]): Promise<Order[]> {
    if (!orders.length) return [];
    const [clients, vehicles, mechanics, services] = await Promise.all([
      this.prisma.cliente.findMany({
        where: {
          id: { in: [...new Set(orders.map((order) => order.clienteId))] },
        },
        select: { id: true, nome: true },
      }),
      this.prisma.veiculo.findMany({
        where: {
          id: { in: [...new Set(orders.map((order) => order.veiculoId))] },
        },
        select: { id: true, placa: true, marca: true, modelo: true },
      }),
      this.prisma.usuario.findMany({
        where: {
          id: {
            in: [
              ...new Set(
                orders
                  .map((order) => order.mecanicoResponsavelId)
                  .filter((id): id is string => !!id),
              ),
            ],
          },
        },
        select: { id: true, nome: true },
      }),
      this.prisma.servicoOficina.findMany({
        where: {
          id: {
            in: [
              ...new Set(
                orders
                  .flatMap((order) => order.servicosSolicitados || [])
                  .map((service) => service.servicoId),
              ),
            ],
          },
        },
        select: { id: true, nome: true },
      }),
    ]);
    const clientById = new Map(clients.map((value) => [value.id, value]));
    const vehicleById = new Map(vehicles.map((value) => [value.id, value]));
    const mechanicById = new Map(mechanics.map((value) => [value.id, value]));
    const serviceById = new Map(services.map((value) => [value.id, value]));
    return orders.map((order) => ({
      ...order,
      clienteNome: order.clienteNome || clientById.get(order.clienteId)?.nome,
      veiculoPlaca:
        order.veiculoPlaca || vehicleById.get(order.veiculoId)?.placa,
      veiculoMarca:
        order.veiculoMarca || vehicleById.get(order.veiculoId)?.marca,
      veiculoModelo:
        order.veiculoModelo || vehicleById.get(order.veiculoId)?.modelo,
      mecanicoNome:
        mechanicById.get(order.mecanicoResponsavelId || '')?.nome ||
        order.mecanicoNome,
      servicosSolicitados: (order.servicosSolicitados || []).map((service) => ({
        ...service,
        nomeServico:
          service.nomeServico || serviceById.get(service.servicoId)?.nome,
      })),
    }));
  }
  private visible<T extends Order>(order: T, user: JwtPayload): T {
    const safe = { ...order };
    const role = user.role ?? user.papel;
    if (role === Role.CLIENTE) {
      delete safe.notasInternas;
      delete safe.failure;
      delete safe.faltasEstoque;
    } else if (role === Role.CONSULTOR_TECNICO && safe.faltasEstoque) {
      safe.faltasEstoque = safe.faltasEstoque.map(
        ({ quantidadeDisponivel: _available, ...part }) => part,
      );
    }
    return safe;
  }
  private async piece(
    pecaId: string,
    filialId: string,
  ): Promise<CatalogStock['peca']> {
    let stock: CatalogStock;
    try {
      stock = (await this.remote(
        'production',
        `/internal/inventory/${encodeURIComponent(pecaId)}?filialId=${encodeURIComponent(filialId)}`,
      )) as unknown as CatalogStock;
    } catch (error) {
      if (error instanceof RemoteOrderNotFound)
        throw new BadRequestException('Peça não encontrada na filial da OS');
      throw error;
    }
    if (
      stock.filialId !== filialId ||
      stock.peca?.id !== pecaId ||
      !stock.peca.ativo
    )
      throw new BadRequestException(
        'Peça inválida, inativa ou fora da filial da OS',
      );
    return stock.peca;
  }
  private async requestedParts(
    input: AbrirOrdemServicoInput['pecasSolicitadas'],
    filialId: string,
    user: JwtPayload,
  ): Promise<RequestedPart[]> {
    if (input === undefined || (Array.isArray(input) && !input.length))
      return [];
    if ((user.role ?? user.papel) !== Role.ADMINISTRADOR)
      throw new ForbiddenException(
        'Seu perfil não permite selecionar peças na abertura',
      );
    if (!Array.isArray(input) || input.length > 100)
      throw new BadRequestException('Informe até 100 peças');
    const quantities = new Map<string, number>();
    for (const part of input) {
      if (
        !part ||
        typeof part.pecaId !== 'string' ||
        !part.pecaId ||
        !Number.isSafeInteger(part.quantidade) ||
        part.quantidade <= 0
      )
        throw new BadRequestException(
          'Peça e quantidade inteira positiva obrigatórias',
        );
      const quantity = (quantities.get(part.pecaId) || 0) + part.quantidade;
      if (!Number.isSafeInteger(quantity))
        throw new BadRequestException('Quantidade de peças inválida');
      quantities.set(part.pecaId, quantity);
    }
    return Promise.all(
      [...quantities].map(async ([pecaId, quantidade]) => {
        const piece = await this.piece(pecaId, filialId);
        return {
          pecaId,
          quantidade,
          filialId,
          nome: piece.nome,
          codigo: piece.codigo,
          descricao: piece.descricao,
        };
      }),
    );
  }
  private async budgetIdentity(body: unknown, filialId: string) {
    const value = body as {
      items?: BudgetItem[];
      groups?: { title: string; items: BudgetItem[] }[];
    };
    if (!value || !Array.isArray(value.items))
      throw new BadRequestException('Itens do orçamento inválidos');
    const cache = new Map<string, Promise<CatalogStock['peca']>>();
    const enrich = async (item: BudgetItem): Promise<BudgetItem> => {
      if (!item || !item.pecaId) return item;
      if (typeof item.pecaId !== 'string')
        throw new BadRequestException('Identidade da peça inválida');
      if (!cache.has(item.pecaId))
        cache.set(item.pecaId, this.piece(item.pecaId, filialId));
      const part = await cache.get(item.pecaId)!;
      return { ...item, nome: part.nome, codigo: part.codigo, filialId };
    };
    return {
      ...value,
      items: await Promise.all(value.items.map(enrich)),
      ...(Array.isArray(value.groups)
        ? {
            groups: await Promise.all(
              value.groups.map(async (group) => ({
                ...group,
                items: await Promise.all(group.items.map(enrich)),
              })),
            ),
          }
        : {}),
    };
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
      if (response.status === 404) throw new RemoteOrderNotFound(service);
      if (response.status === 403)
        throw new ForbiddenException(
          'Ação não permitida pelo serviço responsável',
        );
      if (response.status === 409)
        throw new ConflictException(
          'Estado incompatível no serviço responsável',
        );
      if (response.status === 400) {
        const rejection = (await response.json().catch(() => ({}))) as Record<
          string,
          unknown
        >;
        const quantities = [
          'quantidadeSolicitada',
          'quantidadeReservada',
          'quantidadeConsumida',
          'quantidadeRestante',
        ] as const;
        if (
          rejection.code === 'QUANTITY_EXCEEDS_RESERVATION' &&
          rejection.definitive === true &&
          quantities.every(
            (key) =>
              Number.isSafeInteger(rejection[key]) &&
              Number(rejection[key]) >= 0,
          )
        ) {
          throw new BadRequestException({
            statusCode: 400,
            message: `Quantidade acima da reserva. Restam ${Number(rejection.quantidadeRestante)} unidade(s) desta peça.`,
            code: rejection.code,
            definitive: true,
            ...(typeof rejection.pecaId === 'string'
              ? { pecaId: rejection.pecaId }
              : {}),
            ...(typeof rejection.filialId === 'string'
              ? { filialId: rejection.filialId }
              : {}),
            ...Object.fromEntries(
              quantities.map((key) => [key, rejection[key]]),
            ),
          });
        }
        throw new BadRequestException('Dados inválidos no serviço responsável');
      }
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
    user: JwtPayload,
  ) {
    const filialId = input.filialId || 'filial-sp';
    const pecasSolicitadas = await this.requestedParts(
      input.pecasSolicitadas,
      filialId,
      user,
    );
    const servicosSolicitados = await Promise.all(
      (input.servicosSolicitados || []).map(async (service) => {
        const catalog = await this.prisma.servicoOficina.findUnique({
          where: { id: service.servicoId },
        });
        if (!catalog?.ativo)
          throw new BadRequestException('Serviço inválido ou inativo');
        return {
          servicoId: service.servicoId,
          nomeServico: catalog.nome,
          ...(service.observacao !== undefined
            ? { observacao: service.observacao }
            : {}),
        };
      }),
    );
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
      filialId,
      clienteId,
      veiculoId,
      clienteNome: cliente.nome,
      veiculoPlaca: veiculo.placa,
      veiculoMarca: veiculo.marca,
      veiculoModelo: veiculo.modelo,
      status: 'RECEBIDA',
      sagaId: randomUUID(),
      correlationId: requestContext.getStore()?.correlationId,
      traceparent: requestContext.getStore()?.traceparent,
      sagaState: 'AWAITING_DIAGNOSIS',
      paymentConfirmed: false,
      problemasRelatados: input.problemasRelatados || [],
      servicosSolicitados,
      pecasSolicitadas,
      notasInternas: input.notasInternas,
      notasCliente: input.notasCliente,
      criadoEm: now,
      atualizadoEm: now,
      historico: [],
    };
    history(order, 'ORDEM_ABERTA');
    const created = await this.store.create(
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
    this.telemetry.serviceOrderCreated();
    return created;
  }
  async read(id: string, user: JwtPayload) {
    const stored = await this.store.get(id);
    this.assertAccess(stored, user);
    const [order] = await this.labels([stored]);
    // Capture the committed outbox state before GET: the worker may finish
    // registration after a participant has already returned its initial 404.
    const registering =
      order.status === 'RECEBIDA' && order.sagaState === 'AWAITING_DIAGNOSIS'
        ? await this.store.pendingRegistrations(id)
        : [];
    // Remote visibility alone does not acknowledge the registration outbox.
    const pending = new Set<'billing' | 'production'>(registering);
    const snapshot = async (
      service: 'billing' | 'production',
    ): Promise<RemoteOrder> => {
      try {
        return await this.remote(
          service,
          `/internal/orders/${encodeURIComponent(id)}`,
        );
      } catch (error) {
        if (
          error instanceof RemoteOrderNotFound &&
          registering.includes(service)
        ) {
          return {};
        }
        throw error;
      }
    };
    const [billing, production] = await Promise.all([
      snapshot('billing'),
      snapshot('production'),
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
            version: budget.version,
            notasCliente: budget.notasCliente,
            ...((user.role ?? user.papel) !== Role.CLIENTE
              ? { notasInternas: budget.notasInternas }
              : {}),
            grupos: (
              budget.groups || [{ title: 'Orçamento', items: budget.items }]
            ).map((group, index) => ({
              titulo: group.title,
              ordem: index,
              total:
                group.items.reduce(
                  (sum, item) => sum + item.quantity * item.unitPriceCents,
                  0,
                ) / 100,
              linhasServico: group.items.map((item) => ({
                descricao: item.description,
                quantidade: item.quantity,
                valorUnitario: item.unitPriceCents / 100,
                subtotal: (item.quantity * item.unitPriceCents) / 100,
                tipo: item.pecaId ? 'MATERIAL' : 'SERVICO',
                pecaId: item.pecaId,
                nome: item.nome,
                codigo: item.codigo,
                filialId: item.filialId,
              })),
            })),
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
      sincronizacaoPendente: (['billing', 'production'] as const).filter(
        (service) => pending.has(service),
      ),
      preparacao: order.sagaState,
      ...((user.role ?? user.papel) !== Role.CLIENTE
        ? {
            consumosPeca: production.parts
              ? production.parts.map((part) => ({
                  pecaId: part.pecaId,
                  nome:
                    part.nome ||
                    budget?.items.find((item) => item.pecaId === part.pecaId)
                      ?.nome ||
                    part.description ||
                    'Peça',
                  codigo:
                    part.codigo ||
                    budget?.items.find((item) => item.pecaId === part.pecaId)
                      ?.codigo,
                  filialId: part.filialId || order.filialId,
                  quantidadeReservada: part.quantity,
                  quantidadeConsumida: part.consumedQuantity || 0,
                  quantidadeRestante: Math.max(
                    0,
                    part.quantity - (part.consumedQuantity || 0),
                  ),
                }))
              : production.consumptions || [],
          }
        : {}),
      mecanicoResponsavelId:
        production.mecanicoId || order.mecanicoResponsavelId,
    };
    return this.visible(result, user);
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
    orders = await this.labels(orders);
    const busca = searchText(query.busca);
    if (busca) {
      const number = /^(?:os\s*)?#?\s*(\d+)$/.exec(busca);
      orders = orders.filter((order) =>
        number
          ? order.numero === Number(number[1])
          : [
              order.clienteNome,
              order.veiculoPlaca,
              order.veiculoMarca,
              order.veiculoModelo,
              order.mecanicoNome,
              order.status,
            ].some((value) => searchText(value).includes(busca)),
      );
    }
    const pagina = Math.max(1, Number(query.pagina) || 1);
    const porPagina = Math.min(100, Math.max(1, Number(query.porPagina) || 20));
    return {
      data: orders
        .slice((pagina - 1) * porPagina, pagina * porPagina)
        .map((order) => this.visible(order, user)),
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
    if (
      order.status === 'RECEBIDA' &&
      order.sagaState === 'AWAITING_DIAGNOSIS' &&
      (await this.store.pendingRegistrations(id)).length > 0
    )
      throw new ConflictException(
        'OS aguardando sincronização inicial; tente novamente em instantes',
      );
    return this.remote(
      service,
      `/orders/${encodeURIComponent(id)}/${action}`,
      method,
      service === 'billing' && action === 'budget'
        ? await this.budgetIdentity(body, order.filialId)
        : body,
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
  async reconcile(id: string, expectedSagaId: string) {
    return this.store.mutate(id, (order) => {
      if (
        !expectedSagaId ||
        order.sagaId !== expectedSagaId ||
        order.status !== 'APROVADA' ||
        order.sagaState !== 'MANUAL_ATTENTION' ||
        order.paymentConfirmed
      )
        throw new ConflictException(
          'Reconciliação exige a Saga atual em intervenção, antes do reparo',
        );
      const reconciliationId = randomUUID();
      order.reconciliation = { id: reconciliationId, phase: 'CANCELLING' };
      order.sagaState = 'COMPENSATING';
      order.deadline = new Date(Date.now() + 60000).toISOString();
      history(order, 'RECONCILIACAO_SOLICITADA');
      return [
        {
          destination: 'PRODUCTION',
          message: command(order, 'ReconcileExecutionReservation', {
            reconciliationId,
          }),
        },
      ];
    });
  }
  async retry(id: string) {
    return this.store.mutate(id, (order) => {
      if (
        order.sagaState !== 'COMPENSATED' ||
        order.status !== 'APROVADA' ||
        order.paymentConfirmed
      )
        throw new ConflictException('Saga não compensada');
      order.sagaId = randomUUID();
      order.reconciliation = undefined;
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
