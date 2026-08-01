export const WALLET_PERMISSIONS = {
  CUSTOMER_READ: 'customer:wallet:read',
  CUSTOMER_TRANSFER: 'customer:wallet:transfer',
  MERCHANT_READ: 'merchant:wallet:read',
  RIDER_READ: 'rider:wallet:read',
  DRIVER_READ: 'driver:wallet:read',
  ADMIN_MANAGE: 'admin:wallet:manage',
} as const;

export const WALLET_AUDIT_ACTIONS = {
  CREDITED: 'wallet.credited',
  DEBITED: 'wallet.debited',
  TRANSFERRED: 'wallet.transferred',
  RECONCILED: 'wallet.reconciled',
} as const;

export const WALLET_DEFAULT_CURRENCY = 'NGN';

/**
 * Well-known fixed owner id for the single platform-owned wallet
 * (WalletOwnerType.PLATFORM). Wallet.ownerId is a UUID column, so this must
 * be a valid UUID even though it doesn't reference a real User row.
 */
export const PLATFORM_WALLET_OWNER_ID = '00000000-0000-0000-0000-000000000001';
