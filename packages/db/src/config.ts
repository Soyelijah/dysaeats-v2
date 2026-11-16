import { fileURLToPath } from 'node:url';

const ROOT = new URL('../../../', import.meta.url);

export const MIGRATIONS_DIR = fileURLToPath(new URL('database/migrations/', ROOT));
export const SEEDS_DIR = fileURLToPath(new URL('database/seeds/', ROOT));

/** Carga `.env` de la raíz si existe. No pisa variables que ya estén definidas. */
function loadRootEnv(): void {
  try {
    process.loadEnvFile(fileURLToPath(new URL('.env', ROOT)));
  } catch {
    // Sin .env: se usan solo las variables del entorno.
  }
}

export function requireEnv(name: string): string {
  loadRootEnv();
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable ${name}. Copia .env.example a .env o expórtala.`);
  }
  return value;
}
