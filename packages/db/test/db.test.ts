import assert from 'node:assert/strict';
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import pg from 'pg';
import { MIGRATIONS_DIR, requireEnv } from '../src/config';
import { migrate } from '../src/migrate';
import { resetDatabase, seedDev } from '../src/reset';

// IDs fijos del seed (database/seeds/dev.sql)
const RESTAURANT = '00000000-0000-4000-8000-0000000000d1';
const CUSTOMER_1 = '00000000-0000-4000-8000-0000000000b1';
const COURIER_1 = '00000000-0000-4000-8000-0000000000c1';
const COURIER_2 = '00000000-0000-4000-8000-0000000000c2';
const ITEM_BURGER = '00000000-0000-4000-8000-0000000000f1';
const ORDER_1 = '00000000-0000-4000-8000-00000000aa01';

const POINT = 'ST_SetSRID(ST_MakePoint(-70.61, -33.42), 4326)::geography';

let client: pg.Client;

/** Ejecuta `fn` dentro de una transacción que siempre se revierte. */
async function rolledBack<T>(fn: () => Promise<T>): Promise<T> {
  await client.query('BEGIN');
  try {
    return await fn();
  } finally {
    await client.query('ROLLBACK');
  }
}

/** Afirma que la consulta falla con el código SQLSTATE indicado y no deja nada guardado. */
async function expectDbError(sql: string, code: string, params: unknown[] = []): Promise<void> {
  await client.query('BEGIN');
  try {
    await client.query(sql, params);
    assert.fail(`Se esperaba el error ${code} pero la consulta tuvo éxito: ${sql}`);
  } catch (error) {
    assert.equal((error as { code?: string }).code, code, `${(error as Error).message}`);
  } finally {
    await client.query('ROLLBACK');
  }
}

async function count(table: string): Promise<number> {
  const { rows } = await client.query<{ n: string }>(`SELECT count(*) AS n FROM ${table}`);
  return Number(rows[0]?.n);
}

before(async () => {
  client = new pg.Client({ connectionString: requireEnv('TEST_DATABASE_URL') });
  await client.connect();
  await resetDatabase(client);
  await migrate(client);
  await seedDev(client);
});

after(async () => {
  await client.end();
});

describe('migraciones', () => {
  it('aplican desde cero las 5 migraciones y quedan registradas', async () => {
    const { rows } = await client.query<{ version: string }>(
      'SELECT version FROM app.schema_migrations ORDER BY version',
    );
    assert.equal(rows.length, 5);
    assert.equal(rows[0]?.version, '0001_extensions_and_helpers.sql');
  });

  it('son idempotentes: una segunda ejecución no aplica nada', async () => {
    const result = await migrate(client);
    assert.deepEqual(result.applied, []);
    assert.equal(result.skipped.length, 5);
  });

  it('rechazan que se edite una migración ya aplicada (checksum)', async () => {
    const version = '0002_users_and_sessions.sql';
    const { rows } = await client.query<{ checksum: string }>(
      'SELECT checksum FROM app.schema_migrations WHERE version = $1',
      [version],
    );
    const original = rows[0]?.checksum;
    assert.ok(original);

    await client.query('UPDATE app.schema_migrations SET checksum = $2 WHERE version = $1', [
      version,
      'alterado',
    ]);
    try {
      await assert.rejects(() => migrate(client), /su contenido cambió/);
    } finally {
      await client.query('UPDATE app.schema_migrations SET checksum = $2 WHERE version = $1', [
        version,
        original,
      ]);
    }
  });

  it('rechazan una migración intercalada con número menor a una ya aplicada', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'migr-'));
    try {
      await cp(MIGRATIONS_DIR, dir, { recursive: true });
      await writeFile(
        join(dir, '0003_intercalada.sql'),
        'CREATE TABLE app.no_debe_existir (id int);',
      );
      await assert.rejects(() => migrate(client, dir), /fuera de orden/);
      // La migración rechazada no debe haberse ejecutado ni registrado, ni siquiera en parte.
      assert.equal(await count('app.schema_migrations'), 5);
      const { rows } = await client.query("SELECT to_regclass('app.no_debe_existir') AS t");
      assert.equal(rows[0]?.t, null);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('hacen rollback completo si una migración falla', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'migr-'));
    try {
      await cp(MIGRATIONS_DIR, dir, { recursive: true });
      await writeFile(
        join(dir, '0006_rota.sql'),
        'CREATE TABLE app.deberia_desaparecer (id int); SELECT esto_no_existe();',
      );
      await assert.rejects(() => migrate(client, dir), /Falló la migración 0006_rota\.sql/);
      const { rows } = await client.query("SELECT to_regclass('app.deberia_desaparecer') AS t");
      assert.equal(rows[0]?.t, null);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('se niegan a borrar una base que no termina en _dev o _test', async () => {
    const other = new pg.Client({
      connectionString: requireEnv('TEST_DATABASE_URL').replace(/\/[^/]+$/, '/postgres'),
    });
    await other.connect();
    try {
      await assert.rejects(() => resetDatabase(other), /Me niego a borrar/);
    } finally {
      await other.end();
    }
  });
});

describe('extensiones y seed', () => {
  it('PostGIS y citext están instalados', async () => {
    const { rows } = await client.query<{ extname: string }>(
      "SELECT extname FROM pg_extension WHERE extname IN ('postgis', 'citext') ORDER BY 1",
    );
    assert.deepEqual(
      rows.map((r) => r.extname),
      ['citext', 'postgis'],
    );
  });

  it('el seed carga los datos esperados', async () => {
    assert.equal(await count('app.users'), 7);
    assert.equal(await count('app.restaurants'), 1);
    assert.equal(await count('app.menu_items'), 6);
    assert.equal(await count('app.courier_profiles'), 4);
    assert.equal(await count('app.orders'), 1);
    assert.equal(await count('app.order_items'), 2);
  });

  it('el seed es idempotente', async () => {
    await seedDev(client);
    assert.equal(await count('app.users'), 7);
    assert.equal(await count('app.order_items'), 2);
  });

  it('el seed no deja contraseñas utilizables', async () => {
    const { rows } = await client.query<{ n: string }>(
      "SELECT count(*) AS n FROM app.users WHERE password_hash <> '!locked'",
    );
    assert.equal(Number(rows[0]?.n), 0);
  });

  it('el pedido sembrado es coherente con sus líneas', async () => {
    const { rows } = await client.query<{ subtotal_clp: number; lines: string }>(
      `SELECT o.subtotal_clp, sum(i.line_total_clp) AS lines
         FROM app.orders o JOIN app.order_items i ON i.order_id = o.id
        WHERE o.id = $1 GROUP BY o.subtotal_clp`,
      [ORDER_1],
    );
    assert.equal(Number(rows[0]?.lines), rows[0]?.subtotal_clp);
  });
});

describe('RUT chileno', () => {
  const valid = ['11111111-1', '12345678-5', '6-K'];
  const invalid = ['12345678-9', '11111111-K', '1234567', '12.345.678-5', '12345678-k', 'abc'];

  for (const rut of valid) {
    it(`acepta ${rut}`, async () => {
      const { rows } = await client.query('SELECT app.is_valid_rut($1) AS ok', [rut]);
      assert.equal(rows[0]?.ok, true);
    });
  }
  for (const rut of invalid) {
    it(`rechaza ${rut}`, async () => {
      const { rows } = await client.query('SELECT app.is_valid_rut($1) AS ok', [rut]);
      assert.equal(rows[0]?.ok, false);
    });
  }

  it('la tabla users rechaza un RUT con dígito verificador incorrecto', async () => {
    await expectDbError(
      `INSERT INTO app.users (email, password_hash, full_name, rut) VALUES ('x@dysaeats.test', '!', 'X', '12345678-9')`,
      '23514',
    );
  });
});

describe('integridad de datos', () => {
  it('el email es único sin distinguir mayúsculas', async () => {
    await expectDbError(
      `INSERT INTO app.users (email, password_hash, full_name) VALUES ('ADMIN@dysaeats.test', '!', 'Duplicado')`,
      '23505',
    );
  });

  it('rechaza un teléfono que no es chileno E.164', async () => {
    await expectDbError(
      `INSERT INTO app.users (email, password_hash, full_name, phone) VALUES ('t@dysaeats.test', '!', 'T', '912345678')`,
      '23514',
    );
  });

  it('rechaza un rol inexistente', async () => {
    await expectDbError(
      `INSERT INTO app.users (email, password_hash, full_name, role) VALUES ('r@dysaeats.test', '!', 'R', 'superuser')`,
      '22P02',
    );
  });

  it('rechaza precios de producto no positivos', async () => {
    await expectDbError(
      `INSERT INTO app.menu_items (restaurant_id, name, price_clp) VALUES ('${RESTAURANT}', 'Gratis', 0)`,
      '23514',
    );
  });

  it('un producto no puede usar una categoría de otro restaurante', async () => {
    await rolledBack(async () => {
      await client.query(
        `INSERT INTO app.restaurants (id, name, slug, address, commune, location)
         VALUES ('00000000-0000-4000-8000-0000000000d2', 'Otro', 'otro', 'Calle 1', 'Ñuñoa', ${POINT})`,
      );
      await client.query('SAVEPOINT s');
      await assert.rejects(
        () =>
          client.query(
            `INSERT INTO app.menu_items (restaurant_id, category_id, name, price_clp)
             VALUES ('00000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-0000000000e1', 'Cruzado', 1000)`,
          ),
        (error: { code?: string }) => error.code === '23503',
      );
    });
  });

  it('borrar una categoría deja los productos sin categoría y no los borra', async () => {
    await rolledBack(async () => {
      await client.query(
        "DELETE FROM app.menu_categories WHERE id = '00000000-0000-4000-8000-0000000000e1'",
      );
      const { rows } = await client.query(
        'SELECT category_id, restaurant_id FROM app.menu_items WHERE id = $1',
        [ITEM_BURGER],
      );
      assert.equal(rows[0]?.category_id, null);
      assert.equal(rows[0]?.restaurant_id, RESTAURANT);
    });
  });

  it('un pedido no admite un total distinto de subtotal + envío + propina', async () => {
    await expectDbError(
      `INSERT INTO app.orders (customer_id, restaurant_id, subtotal_clp, delivery_fee_clp, total_clp,
                              delivery_address, delivery_commune, delivery_location)
       VALUES ('${CUSTOMER_1}', '${RESTAURANT}', 10000, 2000, 99999, 'Calle 1', 'Providencia', ${POINT})`,
      '23514',
    );
  });

  it('un pedido en camino exige repartidor asignado', async () => {
    await expectDbError(
      `UPDATE app.orders SET status = 'on_the_way' WHERE id = '${ORDER_1}'`,
      '23514',
    );
  });

  it('un pedido entregado exige fecha de entrega, y un cancelado fecha de cancelación', async () => {
    await expectDbError(
      `UPDATE app.orders SET status = 'delivered', courier_id = '${COURIER_1}' WHERE id = '${ORDER_1}'`,
      '23514',
    );
    await expectDbError(
      `UPDATE app.orders SET status = 'cancelled' WHERE id = '${ORDER_1}'`,
      '23514',
    );
  });

  it('un pedido bien formado pasa por todos los estados válidos', async () => {
    await rolledBack(async () => {
      await client.query(`UPDATE app.orders SET status = 'preparing' WHERE id = $1`, [ORDER_1]);
      await client.query(
        `UPDATE app.orders SET status = 'on_the_way', courier_id = $2 WHERE id = $1`,
        [ORDER_1, COURIER_1],
      );
      await client.query(
        `UPDATE app.orders SET status = 'delivered', delivered_at = now() WHERE id = $1`,
        [ORDER_1],
      );
      const { rows } = await client.query('SELECT status FROM app.orders WHERE id = $1', [ORDER_1]);
      assert.equal(rows[0]?.status, 'delivered');
    });
  });

  it('las líneas de un pedido conservan nombre y precio si el producto se borra', async () => {
    await rolledBack(async () => {
      await client.query('DELETE FROM app.menu_items WHERE id = $1', [ITEM_BURGER]);
      const { rows } = await client.query(
        `SELECT menu_item_id, name, unit_price_clp FROM app.order_items WHERE order_id = $1 AND name = 'Burger Clásica'`,
        [ORDER_1],
      );
      assert.equal(rows[0]?.menu_item_id, null);
      assert.equal(rows[0]?.unit_price_clp, 6500);
    });
  });

  it('cada pedido recibe un número correlativo único', async () => {
    await rolledBack(async () => {
      const insert = `INSERT INTO app.orders (customer_id, restaurant_id, subtotal_clp, delivery_fee_clp, total_clp,
                        delivery_address, delivery_commune, delivery_location)
                      VALUES ($1, $2, 1000, 0, 1000, 'Calle 1', 'Providencia', ${POINT}) RETURNING order_number`;
      const a = await client.query<{ order_number: string }>(insert, [CUSTOMER_1, RESTAURANT]);
      const b = await client.query<{ order_number: string }>(insert, [CUSTOMER_1, RESTAURANT]);
      assert.match(a.rows[0]?.order_number ?? '', /^DE-\d{6}$/);
      assert.notEqual(a.rows[0]?.order_number, b.rows[0]?.order_number);
    });
  });

  it('solo un usuario con rol courier puede tener perfil de repartidor', async () => {
    await expectDbError(
      `INSERT INTO app.courier_profiles (user_id, vehicle_type) VALUES ('${CUSTOMER_1}', 'bicycle')`,
      '23514',
    );
  });

  it('un repartidor conectado debe tener ubicación', async () => {
    await expectDbError(
      `UPDATE app.courier_profiles SET status = 'available', current_location = NULL WHERE user_id = '${COURIER_1}'`,
      '23514',
    );
  });

  it('solo puede haber una dirección predeterminada por usuario', async () => {
    await expectDbError(
      `INSERT INTO app.user_addresses (user_id, label, street, commune, is_default)
       VALUES ('${CUSTOMER_1}', 'Trabajo', 'Calle 2', 'Las Condes', true)`,
      '23505',
    );
  });

  it('updated_at se actualiza solo en cada UPDATE', async () => {
    await rolledBack(async () => {
      await client.query(
        "UPDATE app.users SET updated_at = now() - interval '1 day' WHERE id = $1",
        [CUSTOMER_1],
      );
      await client.query("UPDATE app.users SET full_name = 'Nombre Nuevo' WHERE id = $1", [
        CUSTOMER_1,
      ]);
      const { rows } = await client.query<{ fresh: boolean }>(
        "SELECT updated_at > now() - interval '1 minute' AS fresh FROM app.users WHERE id = $1",
        [CUSTOMER_1],
      );
      assert.equal(rows[0]?.fresh, true);
    });
  });
});

describe('PostGIS: asignación de repartidores por cercanía', () => {
  const nearest = `
    SELECT c.user_id, round(ST_Distance(c.current_location, r.location))::int AS meters
      FROM app.courier_profiles c, app.restaurants r
     WHERE r.id = $1 AND c.status = 'available'
     ORDER BY c.current_location <-> r.location`;

  it('ordena a los disponibles por distancia y excluye ocupados y desconectados', async () => {
    const { rows } = await client.query<{ user_id: string; meters: number }>(nearest, [RESTAURANT]);
    assert.deepEqual(
      rows.map((r) => r.user_id),
      [COURIER_1, COURIER_2],
    );
  });

  it('calcula distancias en metros reales (≈300 m y ≈1,5 km)', async () => {
    const { rows } = await client.query<{ meters: number }>(nearest, [RESTAURANT]);
    assert.ok(Math.abs((rows[0]?.meters ?? 0) - 300) < 15, `c1 a ${rows[0]?.meters} m`);
    assert.ok(Math.abs((rows[1]?.meters ?? 0) - 1500) < 50, `c2 a ${rows[1]?.meters} m`);
  });

  it('ST_DWithin filtra por radio de entrega en metros', async () => {
    const { rows } = await client.query<{ n: string }>(
      `SELECT count(*) AS n FROM app.courier_profiles c, app.restaurants r
        WHERE r.id = $1 AND c.status = 'available' AND ST_DWithin(c.current_location, r.location, 1000)`,
      [RESTAURANT],
    );
    assert.equal(Number(rows[0]?.n), 1);
  });

  it('el índice espacial de repartidores disponibles es utilizable', async () => {
    await rolledBack(async () => {
      await client.query('SET LOCAL enable_seqscan = off');
      const { rows } = await client.query<{ 'QUERY PLAN': string }>(
        `EXPLAIN SELECT user_id FROM app.courier_profiles
          WHERE status = 'available' ORDER BY current_location <-> ${POINT} LIMIT 3`,
      );
      const plan = rows.map((r) => r['QUERY PLAN']).join('\n');
      assert.match(plan, /courier_profiles_available_location_gist/);
    });
  });

  it('el índice espacial de restaurantes es utilizable', async () => {
    await rolledBack(async () => {
      await client.query('SET LOCAL enable_seqscan = off');
      const { rows } = await client.query<{ 'QUERY PLAN': string }>(
        `EXPLAIN SELECT id FROM app.restaurants WHERE ST_DWithin(location, ${POINT}, 5000)`,
      );
      const plan = rows.map((r) => r['QUERY PLAN']).join('\n');
      assert.match(plan, /restaurants_location_gist/);
    });
  });
});
