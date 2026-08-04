export const CART_AUDIT_ACTIONS = {
  CREATED: 'cart.created',
  ITEM_ADDED: 'cart.item_added',
  ITEM_UPDATED: 'cart.item_updated',
  ITEM_REMOVED: 'cart.item_removed',
  CLEARED: 'cart.cleared',
  RECALCULATED: 'cart.recalculated',
} as const;

export const CART_PERMISSIONS = {
  MANAGE: 'customer:cart:manage',
  ADMIN_READ: 'admin:cart:read',
} as const;

export const CART_CURRENCY_DEFAULT = 'NGN';
