# DysaEats v2 — Plan único hacia producción

**Una sola idea:** plataforma de delivery de comida para el mercado chileno, un monolito modular, empezando con 1 restaurante piloto (el segundo después).

## Reglas de trabajo

1. Se trabaja **una fase a la vez**. No se empieza la siguiente sin cerrar la actual.
2. Cada fase termina con una **compuerta**: comandos que se ejecutan y deben pasar. Se corre `pnpm verify <n>` (n = número de fase).
3. Una fase se marca `[x]` aquí **solo** después de que su compuerta pase y esté commiteada.
4. Si algo falla, se arregla dentro de la misma fase. No se acumula deuda para "después".
5. Lo ya construido en `Soyelijah/DysaEats` se reutiliza **solo** cuando pasa la compuerta de la fase en que entra (ver `docs/ACTIVOS-REUTILIZABLES.md`).

## Stack (decidido, no se re-discute sin motivo)

| Capa          | Tecnología                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------- |
| Backend       | NestJS (TypeScript), un solo servicio                                                       |
| Base de datos | PostgreSQL 16 + PostGIS, migraciones SQL versionadas                                        |
| Caché / colas | Redis (solo cuando una fase lo necesite)                                                    |
| Tiempo real   | WebSockets (gateway NestJS)                                                                 |
| Web admin     | Next.js (`src/app`)                                                                         |
| Móvil         | Flutter (cliente, repartidor, admin)                                                        |
| Pagos         | Pendiente de decidir: Webpay Plus (Transbank) o Mercado Pago — se decide antes de la Fase 5 |
| Infra         | Docker, VPS Vultr Chile, CI en GitHub Actions                                               |

## Fases

- [x] **Fase 0 — Repo, plan y herramientas.**
      Compuerta: `pnpm verify 0` (estructura, instalación limpia, typecheck, formato).
- [ ] **Fase 1 — Base de datos.**
      Postgres + PostGIS en Docker, migraciones, seed, test de integración que conecta y hace una consulta geográfica.
      Compuerta: `pnpm verify 1`.
- [ ] **Fase 2 — Backend base y autenticación.**
      NestJS arranca, `/health` responde, registro, login y refresh con JWT, roles (cliente, repartidor, admin).
      Compuerta: tests unitarios + e2e de auth verdes, `pnpm verify 2`.
- [ ] **Fase 3 — Restaurantes y menú.**
      CRUD de restaurantes, categorías y productos; listado público. Compuerta: `pnpm verify 3`.
- [ ] **Fase 4 — Carrito y pedidos (sin pago real).**
      Crear pedido, máquina de estados (recibido, preparando, en camino, entregado, cancelado). Compuerta: `pnpm verify 4`.
- [ ] **Fase 5 — Pagos.**
      Proveedor elegido, ambiente de pruebas, confirmación y reembolso. Compuerta: `pnpm verify 5`.
- [ ] **Fase 6 — Repartidores y seguimiento en vivo.**
      Asignación por cercanía, aceptar/rechazar, ubicación por WebSocket. Compuerta: `pnpm verify 6`.
- [ ] **Fase 7 — Panel web de administración.**
      Next.js: usuarios, restaurantes, pedidos, repartidores. Compuerta: `pnpm verify 7`.
- [ ] **Fase 8 — App Flutter.**
      Tres roles sobre la API ya estable. Compuerta: `pnpm verify 8`.
- [ ] **Fase 9 — Despliegue y piloto.**
      VPS, HTTPS, respaldos, observabilidad, 1 restaurante real. Compuerta: `pnpm verify 9`.

## Pendientes que bloquean fases

- Elegir proveedor de pagos (antes de Fase 5).
- Definir si los repartidores son propios o de cada restaurante (antes de Fase 6).
- Rotar las credenciales de Supabase expuestas en el repo anterior (acción humana, antes de reutilizar cualquier dato).
