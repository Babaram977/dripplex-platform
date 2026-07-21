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

/** Default Nigeria VAT rate (7.5%). */
export const DEFAULT_VAT_RATE = 0.075;

/** Default flat delivery fee in NGN. */
export const DEFAULT_FLAT_DELIVERY_FEE = 1500;

export const CART_CURRENCY_DEFAULT = 'NGN';
