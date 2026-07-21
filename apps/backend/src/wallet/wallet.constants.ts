export const WALLET_PERMISSIONS = {
  CUSTOMER_READ: 'customer:wallet:read',
  CUSTOMER_TRANSFER: 'customer:wallet:transfer',
  MERCHANT_READ: 'merchant:wallet:read',
  RIDER_READ: 'rider:wallet:read',
  ADMIN_MANAGE: 'admin:wallet:manage',
} as const;

export const WALLET_AUDIT_ACTIONS = {
  CREDITED: 'wallet.credited',
  DEBITED: 'wallet.debited',
  TRANSFERRED: 'wallet.transferred',
  RECONCILED: 'wallet.reconciled',
} as const;

export const WALLET_DEFAULT_CURRENCY = 'NGN';
