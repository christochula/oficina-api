import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../shared/database/prisma.service';
import { Delivery, Order } from './contracts';

@Injectable()
export class OrderStore {
  constructor(private readonly prisma: PrismaService) {}
  async deliveries(tx: Prisma.TransactionClient, deliveries: Delivery[]) {
    for (const d of deliveries)
      await tx.$executeRaw`
      INSERT INTO phase4_outbox(id,destination,message) VALUES
      (${d.message.messageId},${d.destination},${JSON.stringify(d.message)}::jsonb)
      ON CONFLICT DO NOTHING`;
  }
  async create(order: Order, deliveries: Delivery[]) {
    return this.prisma.$transaction(async (tx) => {
      const [row] = await tx.$queryRaw<{ numero: number }[]>`
        INSERT INTO phase4_orders(id,data) VALUES (${order.id},${JSON.stringify(order)}::jsonb) RETURNING numero`;
      order.numero = row.numero;
      await tx.$executeRaw`UPDATE phase4_orders SET data=${JSON.stringify(order)}::jsonb WHERE id=${order.id}`;
      await this.deliveries(tx, deliveries);
      return order;
    });
  }
  async list() {
    const rows = await this.prisma.$queryRaw<
      { data: Order }[]
    >`SELECT data FROM phase4_orders ORDER BY numero DESC`;
    return rows.map((r) => r.data);
  }
  async get(id: string) {
    const [row] = await this.prisma.$queryRaw<
      { data: Order }[]
    >`SELECT data FROM phase4_orders WHERE id=${id}`;
    if (!row) throw new NotFoundException('OS não encontrada');
    return row.data;
  }
  async mutate(
    id: string,
    change: (order: Order) => Delivery[],
    messageId?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      if (messageId) {
        const inserted =
          await tx.$executeRaw`INSERT INTO phase4_inbox(message_id) VALUES(${messageId}) ON CONFLICT DO NOTHING`;
        if (!inserted) return;
      }
      const [row] = await tx.$queryRaw<
        { data: Order }[]
      >`SELECT data FROM phase4_orders WHERE id=${id} FOR UPDATE`;
      if (!row) throw new NotFoundException('OS não encontrada');
      const deliveries = change(row.data);
      await tx.$executeRaw`UPDATE phase4_orders SET data=${JSON.stringify(row.data)}::jsonb WHERE id=${id}`;
      await this.deliveries(tx, deliveries);
      return row.data;
    });
  }
}
