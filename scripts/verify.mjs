#!/usr/bin/env node
// Compuertas de verificación por fase. Uso: pnpm verify <n>
// Una fase solo se da por terminada si todas sus comprobaciones pasan.
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const phase = Number(process.argv[2]);
const results = [];

function check(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (error) {
    const detail = String(error.stderr || error.stdout || error.message || error)
      .trim()
      .split('\n')
      .slice(-6)
      .join('\n');
    results.push({ name, ok: false, detail });
  }
}

function run(cmd) {
  execSync(cmd, { stdio: 'pipe', encoding: 'utf8' });
}

function requireFiles(files) {
  const missing = files.filter((f) => !existsSync(f));
  if (missing.length) throw new Error(`Faltan archivos: ${missing.join(', ')}`);
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
};

if (!Number.isInteger(phase) || !gates[phase]) {
  console.error(
    `Uso: pnpm verify <n>. Fases con compuerta definida: ${Object.keys(gates).join(', ')}`,
  );
  process.exit(2);
}

gates[phase]();

console.log(`\nCompuerta de la Fase ${phase}\n`);
for (const r of results) {
  console.log(`${r.ok ? 'PASA ' : 'FALLA'}  ${r.name}`);
  if (!r.ok) console.log(`       ${r.detail.replaceAll('\n', '\n       ')}`);
}
const failed = results.filter((r) => !r.ok).length;
console.log(
  `\n${failed === 0 ? 'Fase aprobada.' : `${failed} comprobación(es) fallaron. La fase NO está terminada.`}`,
);
process.exit(failed === 0 ? 0 : 1);
