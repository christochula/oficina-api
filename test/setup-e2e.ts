import * as dotenv from 'dotenv';
import { existsSync } from 'fs';

dotenv.config({ path: '.env', quiet: true });

function estaRodandoEmContainer(): boolean {
  return (
    existsSync('/.dockerenv') ||
    process.env.RUNNING_IN_DOCKER === 'true' ||
    process.env.DOCKER_CONTAINER === 'true'
  );
}

function ajustarDatabaseUrlParaContextoAtual(databaseUrl: string): string {
  try {
    const url = new URL(databaseUrl);
    if (url.hostname === 'db' && !estaRodandoEmContainer()) {
      url.hostname = 'localhost';
      return url.toString();
    }
  } catch {
    if (databaseUrl.includes('@db:5432') && !estaRodandoEmContainer()) {
      return databaseUrl.replace('@db:5432', '@localhost:5432');
    }
  }

  return databaseUrl;
}

if (process.env.E2E_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.E2E_DATABASE_URL;
} else if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = ajustarDatabaseUrlParaContextoAtual(process.env.DATABASE_URL);
}
