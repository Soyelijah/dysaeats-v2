/** Roles de usuario de la plataforma. Se usan en backend, web y móvil. */
export const ROLES = ['customer', 'courier', 'admin'] as const;
export type Role = (typeof ROLES)[number];

/** Estados de un pedido, en orden de avance normal. `cancelled` puede ocurrir antes de `delivered`. */
export const ORDER_STATUSES = [
  'received',
  'preparing',
  'on_the_way',
  'delivered',
  'cancelled',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}
