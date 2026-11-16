#!/usr/bin/env node
// Compuertas de verificación por fase. Uso: pnpm verify <n>
// Es acumulativa: `verify 2` ejecuta también las comprobaciones de las fases 0 y 1,
// así una fase nueva no puede romper en silencio lo que ya estaba terminado.
// Una fase solo se da por terminada si todas sus comprobaciones pasan.
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const target = Number(process.argv[2]);
const results = [];
let currentPhase = 0;

function check(name, fn) {
  try {
    fn();
    results.push({ phase: currentPhase, name, ok: true });
  } catch (error) {
    const raw = [error.stdout, error.stderr, error.message].filter(Boolean).join('\n');
    const detail = String(raw).trim().split('\n').slice(-14).join('\n');
    results.push({ phase: currentPhase, name, ok: false, detail });
  }
}

function run(cmd) {
  return execSync(cmd, { stdio: 'pipe', encoding: 'utf8' });
}

function requireFiles(files) {
  const missing = files.filter((f) => !existsSync(f));
  if (missing.length) throw new Error(`Faltan archivos: ${missing.join(', ')}`);
}

/** Variable de entorno o, si no está, la del archivo .env (que nunca se versiona). */
function envVar(name) {
  if (process.env[name]) return process.env[name];
  try {
    process.loadEnvFile('.env');
  } catch {
    // sin .env
  }
  return process.env[name];
}

const gates = {
  0: () => {
    check('Existen los archivos base del repo', () =>
      requireFiles([
        'PLAN.md',
        'README.md',
        'package.json',
        'pnpm-workspace.yaml',
        'tsconfig.base.json',
        '.gitignore',
        'docs/ACTIVOS-REUTILIZABLES.md',
        'packages/shared/src/index.ts',
        '.github/workflows/ci.yml',
      ]),
    );
    check('Typecheck de todos los paquetes', () => run('pnpm typecheck'));
    check('Formato correcto (prettier)', () => run('pnpm format:check'));
    check('Ningún archivo de secretos está versionado', () => {
      const tracked = execSync('git ls-files', { encoding: 'utf8' }).split('\n');
      const bad = tracked.filter(
        (f) => /(^|\/)\.env($|\.(?!example$))/.test(f) || /\.(pem|key)$/.test(f),
      );
      if (bad.length) throw new Error(`Archivos sensibles versionados: ${bad.join(', ')}`);
    });
  },

  1: () => {
    check('Existen los archivos de la base de datos', () =>
      requireFiles([
        'database/migrations/0001_extensions_and_helpers.sql',
        'database/migrations/0005_orders.sql',
        'database/seeds/dev.sql',
        'docker/docker-compose.yml',
        'docker/initdb/01-create-test-db.sql',
        'packages/db/src/migrate.ts',
        'packages/db/test/db.test.ts',
        '.env.example',
      ]),
    );
    check('TEST_DATABASE_URL está definida (la compuerta no se salta sin base de datos)', () => {
      if (!envVar('TEST_DATABASE_URL')) {
        throw new Error(
          'Define TEST_DATABASE_URL en .env o en el entorno, apuntando a una base que termine en _test.',
        );
      }
    });
    check('Tests de base de datos: migraciones, seed, integridad y PostGIS', () => {
      const out = run('pnpm test:db');
      const total = Number(/^# tests (\d+)/m.exec(out)?.[1] ?? 0);
      const failed = Number(/^# fail (\d+)/m.exec(out)?.[1] ?? 0);
      if (total < 30)
        throw new Error(`Se ejecutaron solo ${total} tests; se esperaban al menos 30.`);
      if (failed > 0) throw new Error(`${failed} tests fallaron.\n${out}`);
    });
  },
};

if (!Number.isInteger(target) || !gates[target]) {
  console.error(
    `Uso: pnpm verify <n>. Fases con compuerta definida: ${Object.keys(gates).join(', ')}`,
  );
  process.exit(2);
}

for (let phase = 0; phase <= target; phase++) {
  currentPhase = phase;
  gates[phase]();
}

console.log(`\nCompuerta de la Fase ${target} (incluye las fases anteriores)\n`);
for (const r of results) {
  console.log(`${r.ok ? 'PASA ' : 'FALLA'}  [F${r.phase}] ${r.name}`);
  if (!r.ok) console.log(`       ${r.detail.replaceAll('\n', '\n       ')}`);
}
const failed = results.filter((r) => !r.ok).length;
console.log(
  `\n${failed === 0 ? 'Fase aprobada.' : `${failed} comprobación(es) fallaron. La fase NO está terminada.`}`,
);
process.exit(failed === 0 ? 0 : 1);
