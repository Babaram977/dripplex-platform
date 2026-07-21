export const PROMOTION_AUDIT_ACTIONS = {
  CREATED: 'promotion.created',
  UPDATED: 'promotion.updated',
  DELETED: 'promotion.deleted',
  REDEEMED: 'promotion.redeemed',
} as const;

export const PROMOTION_PERMISSIONS = {
  CUSTOMER_USE: 'customer:promotions:use',
  ADMIN_MANAGE: 'admin:promotions:manage',
} as const;
