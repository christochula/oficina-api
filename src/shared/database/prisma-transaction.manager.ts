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

  async executarSerializavel<T>(callback: () => Promise<T>): Promise<T> {
    if (this.storage.getStore()) return callback();

    const maxTentativas = 3;
    for (let tentativa = 1; tentativa <= maxTentativas; tentativa += 1) {
      try {
        return await this.prisma.$transaction(
          (tx) => this.storage.run(tx, callback),
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (erro) {
        if (!this.ehConflitoSerializacao(erro) || tentativa === maxTentativas) {
          throw erro;
        }
      }
    }

    throw new Error('Falha inesperada ao executar transação serializável');
  }

  async bloquear(chave: string): Promise<void> {
    const tx = this.storage.getStore();
    if (!tx) {
      throw new Error('Advisory lock solicitado fora de uma transação');
    }

    await tx.$queryRaw(
      Prisma.sql`
        SELECT pg_advisory_xact_lock(hashtext(${chave}))::text AS lock_result
      `,
    );
  }

  private ehConflitoSerializacao(erro: unknown): boolean {
    return (
      typeof erro === 'object' &&
      erro !== null &&
      'code' in erro &&
      (erro as { code?: unknown }).code === 'P2034'
    );
  }
}
