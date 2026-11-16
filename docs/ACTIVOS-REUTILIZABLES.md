# Activos reutilizables de `Soyelijah/DysaEats`

Inventario hecho el 2026-11-16 sobre la rama `backup/pre-ui-placeholders`. Nada se copia a este repo hasta la fase indicada y hasta que pase su compuerta.

| Activo en el repo anterior                                               | Se evalúa en                 | Notas                                                                                                  |
| ------------------------------------------------------------------------ | ---------------------------- | ------------------------------------------------------------------------------------------------------ |
| `database/migrations/000..011_*.sql` (12 migraciones)                    | Fase 1 — **reescritas**      | Se aplican sin errores, pero no se portaron. Ver "Decisión de la Fase 1" abajo.                        |
| `database/seeds/dev.sql`                                                 | Fase 1 — **reescrito**       | Nuevo seed idempotente, sin credenciales, con repartidores a distancias conocidas para probar PostGIS. |
| `docker/docker-compose.dev.yml` y `docker/postgres/init.sql`             | Fase 1 — **adaptado**        | Misma imagen `postgis/postgis:16-3.4`. Se quitaron Redis, Mailpit y pgAdmin (no se usan aún).          |
| `apps/backend/src/modules/{auth,restaurants,cart,checkout,orders,users}` | Fases 2 a 4                  | Se reescribe o se porta módulo a módulo con sus tests.                                                 |
| `apps/dashboard-web`, `client-web`, `courier-web`                        | Fase 7                       | Dependen de Supabase Auth (57 llamadas en 23 archivos); hay que migrarlas.                             |
| `apps/mobile-flutter` (32 archivos Dart)                                 | Fase 8                       | Usa Supabase para refrescar tokens.                                                                    |
| `packages/{types,theme,ui,utils}`                                        | Cuando una fase los necesite |                                                                                                        |

## Decisión de la Fase 1: esquema reescrito, no portado

Se aplicaron las 12 migraciones antiguas a una base PostGIS real: todas corren. Aun así no se portaron, por estos defectos:

| Defecto en el esquema antiguo                                                                                                                                     | Esquema nuevo                                                                      |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Todas las fechas son `timestamp without time zone`                                                                                                                | `timestamptz` en todas las tablas                                                  |
| Ubicaciones como `point` y como `latitude/longitude numeric`: no sirven para índices espaciales ni para ordenar por cercanía real                                 | `geography(Point, 4326)` con índices GiST                                          |
| `users.auth_id` ("Supabase auth ID") más una tabla `auth.users` aparte: identidad duplicada                                                                       | Una sola tabla `users` con autenticación propia                                    |
| `courier_profiles` con 51 columnas y campos repetidos (`is_online`, `is_available`, `current_status`; `home_base`, `home_location`; `vehicle_*` y `vehicle_info`) | 8 columnas: un solo estado y una sola ubicación                                    |
| QR, alias de repartidor, traducciones i18n, avalista: fuera del alcance del plan                                                                                  | No incluidos. Si una fase los necesita, se agregan en una migración nueva          |
| Sin validación de datos chilenos                                                                                                                                  | RUT con dígito verificador (módulo 11), teléfono `+56` E.164, dinero en CLP entero |

Lo que sí se conservó de la idea original: el enfoque en Chile (RUT, comunas), el dinero en pesos enteros y la separación entre pedido y líneas de pedido.

## No se reutiliza

- Cualquier credencial, `.env` o token del repo anterior.
- Los badges y afirmaciones de "100% production ready" del README anterior.
