/**
 * Token de injecao para o gerenciador de transacoes do banco.
 *
 * A camada de aplicacao depende apenas deste contrato, sem acoplamento
 * direto ao Prisma ou ao cliente especifico de persistencia.
 */
export const DATABASE_TRANSACTION = 'DATABASE_TRANSACTION';

/**
 * Contrato para execucao de uma unidade de trabalho transacional.
 */
export interface DatabaseTransactionManager {
  /**
   * Executa o callback dentro de uma transacao do banco.
   *
   * Implementacoes podem reutilizar a transacao atual quando ja existir um
   * contexto transacional em andamento.
   */
  executar<T>(callback: () => Promise<T>): Promise<T>;
}
