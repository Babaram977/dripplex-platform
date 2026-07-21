export const WISHLIST_AUDIT_ACTIONS = {
  CREATED: 'wishlist.created',
  UPDATED: 'wishlist.updated',
  DELETED: 'wishlist.deleted',
  ITEM_ADDED: 'wishlist.item_added',
  ITEM_UPDATED: 'wishlist.item_updated',
  ITEM_REMOVED: 'wishlist.item_removed',
  SHARED: 'wishlist.shared',
  MOVED_TO_CART: 'wishlist.moved_to_cart',
} as const;

export const WISHLIST_PERMISSIONS = {
  CUSTOMER_MANAGE: 'customer:wishlist:manage',
} as const;
