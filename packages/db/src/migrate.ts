import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type pg from 'pg';
import { MIGRATIONS_DIR } from './config';

const FILE_PATTERN = /^\d{4}_[a-z0-9_]+\.sql$/;
const ADVISORY_LOCK_KEY = 727001;

export interface MigrateResult {
  applied: string[];
  skipped: string[];
}

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

/**
 * Aplica las migraciones pendientes en orden, cada una en su propia transacción.
 *
 * Garantías:
 * - Una migración ya aplicada no se puede editar: si cambia su checksum, falla.
 * - No se aceptan migraciones "intercaladas" (una nueva con número menor a una ya aplicada).
 * - Un candado de sesión evita que dos procesos migren a la vez.
 */
export async function migrate(
  client: pg.Client,
  dir: string = MIGRATIONS_DIR,
): Promise<MigrateResult> {
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();

  const invalid = files.filter((f) => !FILE_PATTERN.test(f));
  if (invalid.length > 0) {
    throw new Error(
      `Nombres de migración inválidos (esperado NNNN_nombre.sql): ${invalid.join(', ')}`,
    );
  }

  await client.query('SELECT pg_advisory_lock($1)', [ADVISORY_LOCK_KEY]);
  try {
    await client.query('CREATE SCHEMA IF NOT EXISTS app');
    await client.query(`
      CREATE TABLE IF NOT EXISTS app.schema_migrations (
        version    text PRIMARY KEY,
        checksum   text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )`);

    const { rows } = await client.query<{ version: string; checksum: string }>(
      'SELECT version, checksum FROM app.schema_migrations',
    );
    const done = new Map(rows.map((r) => [r.version, r.checksum]));

    const missing = [...done.keys()].filter((v) => !files.includes(v));
    if (missing.length > 0) {
      throw new Error(`Hay migraciones aplicadas cuyo archivo ya no existe: ${missing.join(', ')}`);
    }

    // Primera pasada: validar TODO antes de aplicar nada. Así una migración inválida
    // (editada o fuera de orden) nunca llega a ejecutarse, ni siquiera parcialmente.
    const loaded = await Promise.all(
      files.map(async (file) => {
        const sql = await readFile(join(dir, file), 'utf8');
        return { file, sql, checksum: sha256(sql), recorded: done.get(file) };
      }),
    );

    let firstPending: string | undefined;
    for (const { file, checksum, recorded } of loaded) {
      if (recorded === undefined) {
        firstPending ??= file;
        continue;
      }
      if (firstPending !== undefined) {
        throw new Error(
          `Migración fuera de orden: ${firstPending} está pendiente pero ${file} ya fue aplicada.`,
        );
      }
      if (recorded !== checksum) {
        throw new Error(
          `La migración ${file} ya fue aplicada y su contenido cambió. No se edita: crea una nueva.`,
        );
      }
    }

    // Segunda pasada: aplicar las pendientes, cada una en su transacción.
    const result: MigrateResult = { applied: [], skipped: [] };

    for (const { file, sql, checksum, recorded } of loaded) {
      if (recorded !== undefined) {
        result.skipped.push(file);
        continue;
      }

      try {
        await client.query('BEGIN');
        await client.query('SET LOCAL search_path = app, public');
        await client.query(sql);
        await client.query(
          'INSERT INTO app.schema_migrations (version, checksum) VALUES ($1, $2)',
          [file, checksum],
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(`Falló la migración ${file}: ${reason}`);
      }
      result.applied.push(file);
    }

    return result;
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_KEY]);
  }
}
