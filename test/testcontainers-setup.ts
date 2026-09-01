import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';

/**
 * Configuração global de Testcontainers para testes e2e
 * Cada suite de teste deve chamar startPostgres() antes e stopPostgres() depois
 */

let postgresContainer: StartedPostgreSqlContainer | null = null;

export async function startPostgres(): Promise<{
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}> {
  if (postgresContainer) {
    throw new Error(
      'PostgreSQL container já está ativo. Chame stopPostgres() primeiro.',
    );
  }

  postgresContainer = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('oficina_test')
    .withUsername('testuser')
    .withPassword('testpass123')
    .start();

  return {
    host: postgresContainer.getHost(),
    port: postgresContainer.getPort(),
    database: postgresContainer.getDatabase(),
    username: postgresContainer.getUsername(),
    password: postgresContainer.getPassword(),
  };
}

export async function stopPostgres(): Promise<void> {
  if (postgresContainer) {
    await postgresContainer.stop();
    postgresContainer = null;
  }
}

export function getDatabaseUrl(): string {
  if (!postgresContainer) {
    throw new Error(
      'PostgreSQL container não está ativo. Chame startPostgres() primeiro.',
    );
  }

  return postgresContainer.getConnectionUri();
}
