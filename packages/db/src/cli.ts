import pg from 'pg';
import { requireEnv } from './config';
import { migrate } from './migrate';
import { resetDatabase, seedDev } from './reset';

const COMMANDS = ['migrate', 'seed', 'reset', 'status'] as const;
type Command = (typeof COMMANDS)[number];

async function main(): Promise<void> {
  const command = process.argv[2] as Command | undefined;
  if (!command || !COMMANDS.includes(command)) {
    console.error(`Uso: db <${COMMANDS.join('|')}>`);
    process.exit(2);
  }

  const client = new pg.Client({ connectionString: requireEnv('DATABASE_URL') });
  await client.connect();
  try {
    switch (command) {
      case 'migrate': {
        const { applied, skipped } = await migrate(client);
        console.log(`Aplicadas: ${applied.length}  Ya estaban: ${skipped.length}`);
        applied.forEach((f) => console.log(`  + ${f}`));
        break;
      }
      case 'seed':
        await seedDev(client);
        console.log('Seed de desarrollo aplicado.');
        break;
      case 'reset': {
        await resetDatabase(client);
        const { applied } = await migrate(client);
        await seedDev(client);
        console.log(`Base reiniciada: ${applied.length} migraciones y seed aplicados.`);
        break;
      }
      case 'status': {
        const { rows } = await client.query(
          'SELECT version, applied_at FROM app.schema_migrations ORDER BY version',
        );
        rows.forEach((r) => console.log(`${r.version}  ${new Date(r.applied_at).toISOString()}`));
        break;
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
