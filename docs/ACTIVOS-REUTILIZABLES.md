# Activos reutilizables de `Soyelijah/DysaEats`

Inventario hecho el 2026-11-16 sobre la rama `backup/pre-ui-placeholders`. Nada se copia a este repo hasta la fase indicada y hasta que pase su compuerta.

| Activo en el repo anterior                                               | Se evalúa en                 | Notas                                                                                                        |
| ------------------------------------------------------------------------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `database/migrations/000..011_*.sql` (12 migraciones)                    | Fase 1                       | Auth, usuarios, restaurantes, menú, pedidos, repartidores, direcciones. Revisar que no dependan de Supabase. |
| `database/seeds/dev.sql`                                                 | Fase 1                       | 8 usuarios, 2 restaurantes, 10 productos, 2 pedidos. Contraseñas deben generarse nuevas.                     |
| `docker/docker-compose.dev.yml` y `docker/postgres/init.sql`             | Fase 1                       | Postgres 16 + PostGIS 3.4.                                                                                   |
| `apps/backend/src/modules/{auth,restaurants,cart,checkout,orders,users}` | Fases 2 a 4                  | Se reescribe o se porta módulo a módulo con sus tests.                                                       |
| `apps/dashboard-web`, `client-web`, `courier-web`                        | Fase 7                       | Dependen de Supabase Auth (57 llamadas en 23 archivos); hay que migrarlas.                                   |
| `apps/mobile-flutter` (32 archivos Dart)                                 | Fase 8                       | Usa Supabase para refrescar tokens.                                                                          |
| `packages/{types,theme,ui,utils}`                                        | Cuando una fase los necesite |                                                                                                              |

## No se reutiliza

- Cualquier credencial, `.env` o token del repo anterior.
- Los badges y afirmaciones de "100% production ready" del README anterior.
