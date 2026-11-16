# DysaEats v2

Plataforma de delivery de comida para Chile. Se construye por fases; el avance real está en [`PLAN.md`](./PLAN.md).

## Requisitos

- Node 22 o superior
- pnpm 10
- Docker (para la base de datos local)

## Primeros pasos

```bash
pnpm install
cp .env.example .env     # y cambia la contraseña en .env
pnpm db:up               # levanta Postgres + PostGIS (crea dysaeats_dev y dysaeats_test)
pnpm db:reset            # migra y carga datos de ejemplo en dysaeats_dev
pnpm verify 1            # compuerta de la Fase 1 (incluye la Fase 0)
```

## Comandos

```bash
pnpm verify <n>       # compuerta de la fase n, incluye las anteriores
pnpm typecheck        # typecheck de todos los paquetes
pnpm format:check     # revisa formato
pnpm db:migrate       # aplica migraciones pendientes
pnpm db:seed          # carga datos de ejemplo (idempotente)
pnpm db:reset         # borra, migra y siembra (solo bases _dev o _test)
pnpm db:status        # migraciones aplicadas
pnpm test:db          # tests de la base de datos (requiere TEST_DATABASE_URL)
pnpm db:down          # apaga la base local
```

## Cómo se trabaja

Una fase a la vez. Una fase se da por terminada solo cuando `pnpm verify <n>` pasa y queda commiteada. Ver las reglas completas en `PLAN.md`.
