# DysaEats v2

Plataforma de delivery de comida para Chile. Se construye por fases; el avance real está en [`PLAN.md`](./PLAN.md).

## Requisitos

- Node 22 o superior
- pnpm 10
- Docker (desde la Fase 1)

## Comandos

```bash
pnpm install          # instala dependencias
pnpm verify 0         # corre la compuerta de la fase indicada
pnpm typecheck        # typecheck de todos los paquetes
pnpm format:check     # revisa formato
```

## Cómo se trabaja

Una fase a la vez. Una fase se da por terminada solo cuando `pnpm verify <n>` pasa y queda commiteada. Ver las reglas completas en `PLAN.md`.
