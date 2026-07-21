export const ORDER_AUDIT_ACTIONS = {
  CREATED: 'order.created',
  CANCELLED: 'order.cancelled',
  INVENTORY_RESERVED: 'inventory.reserved',
  INVENTORY_RELEASED: 'inventory.released',
} as const;

export const ORDER_PERMISSIONS = {
  CHECKOUT: 'customer:checkout',
  ORDERS: 'customer:orders',
  ADMIN_READ: 'admin:orders:read',
} as const;

export const RESERVATION_TTL_MS = 30 * 60 * 1000;
export const RESERVATION_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
