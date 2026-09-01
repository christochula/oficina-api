import { Global, Module } from '@nestjs/common';
import { DATABASE_TRANSACTION } from './database-transaction';
import { PrismaService } from './prisma.service';
import { PrismaTransactionManager } from './prisma-transaction.manager';

/**
 * Módulo global de banco de dados.
 *
 * Registra e exporta o `PrismaService` como provider global da aplicação.
 * Por ser decorado com `@Global()`, este módulo precisa ser importado apenas
 * no `AppModule` — todos os demais módulos poderão injetar o `PrismaService`
 * diretamente sem declarar importação adicional.
 *
 * Centraliza a configuração de acesso à camada de persistência, facilitando
 * substituições futuras de ORM ou estratégia de conexão sem impacto nos módulos de negócio.
 */
@Global()
@Module({
  providers: [
    PrismaService,
    PrismaTransactionManager,
    { provide: DATABASE_TRANSACTION, useExisting: PrismaTransactionManager },
  ],
  exports: [PrismaService, PrismaTransactionManager, DATABASE_TRANSACTION],
})
export class DatabaseModule {}
