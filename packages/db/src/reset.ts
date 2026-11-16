import type pg from 'pg';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SEEDS_DIR } from './config';

/** Solo bases de datos de desarrollo o prueba pueden borrarse. Nunca una de producción. */
const RESETTABLE = /_(dev|test)$/;

export async function resetDatabase(client: pg.Client): Promise<void> {
  const { rows } = await client.query<{ db: string }>('SELECT current_database() AS db');
  const db = rows[0]?.db ?? '';
  if (!RESETTABLE.test(db)) {
    throw new Error(
      `Me niego a borrar la base "${db}": solo se permiten bases cuyo nombre termina en _dev o _test.`,
    );
  }
  await client.query('DROP SCHEMA IF EXISTS app CASCADE');
}

export async function seedDev(client: pg.Client): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('El seed de desarrollo no se ejecuta con NODE_ENV=production.');
  }
  const sql = await readFile(join(SEEDS_DIR, 'dev.sql'), 'utf8');
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}
