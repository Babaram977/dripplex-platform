export const ADDRESS_AUDIT_ACTIONS = {
  CREATED: 'customer.address.created',
  UPDATED: 'customer.address.updated',
  DELETED: 'customer.address.deleted',
  DEFAULT_CHANGED: 'customer.address.default_changed',
} as const;

export const ADDRESS_PERMISSIONS = {
  MANAGE: 'customer:addresses:manage',
  ADMIN_READ: 'admin:addresses:read',
} as const;

export const MAX_CUSTOMER_ADDRESSES = 20;
