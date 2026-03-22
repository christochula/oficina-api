import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Serviço de acesso ao banco de dados via Prisma ORM.
 *
 * Estende o `PrismaClient` e integra seu ciclo de vida ao ciclo de vida do módulo NestJS:
 * abre a conexão com o banco ao inicializar o módulo e a fecha ao destruí-lo, garantindo
 * gerenciamento adequado de conexões em ambientes de produção e testes.
 *
 * Registrado como provider global pelo `DatabaseModule`, está disponível para injeção
 * em qualquer repositório de infraestrutura sem necessidade de importação adicional.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  /**
   * Abre a conexão com o banco de dados quando o módulo NestJS é inicializado.
   * Invocado automaticamente pelo framework durante o bootstrap da aplicação.
   */
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  /**
   * Fecha a conexão com o banco de dados quando o módulo NestJS é destruído.
   * Invocado automaticamente pelo framework durante o encerramento da aplicação,
   * garantindo liberação adequada dos recursos de conexão.
   */
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
