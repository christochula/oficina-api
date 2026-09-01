import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { DatabaseTransactionManager } from './database-transaction';
import { PrismaService } from './prisma.service';

/**
 * Gerencia transacoes Prisma com propagacao implicita via AsyncLocalStorage.
 *
 * Repositorios de infraestrutura consultam o `client` atual para decidir se
 * devem usar o Prisma raiz ou o TransactionClient da transacao ativa.
 */
@Injectable()
export class PrismaTransactionManager implements DatabaseTransactionManager {
  private readonly storage = new AsyncLocalStorage<Prisma.TransactionClient>();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retorna o client transacional atual ou o client raiz quando nao ha
   * transacao ativa no contexto assincrono corrente.
   */
  get client(): Prisma.TransactionClient | PrismaService {
    return this.storage.getStore() ?? this.prisma;
  }

  /**
   * Executa o callback em uma transacao. Se ja houver uma transacao ativa,
   * apenas reutiliza o contexto atual para evitar nesting desnecessario.
   */
  async executar<T>(callback: () => Promise<T>): Promise<T> {
    if (this.storage.getStore()) {
      return callback();
    }

    return this.prisma.$transaction((tx) => this.storage.run(tx, callback));
  }
}
