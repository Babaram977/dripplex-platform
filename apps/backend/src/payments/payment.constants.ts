export const PAYMENT_AUDIT_ACTIONS = {
  INITIALIZED: 'payment.initialized',
  VERIFIED: 'payment.verified',
  FAILED: 'payment.failed',
  WEBHOOK_RECEIVED: 'payment.webhook.received',
  WEBHOOK_REJECTED: 'payment.webhook.rejected',
  INVENTORY_DEDUCTED: 'inventory.deducted',
  REFUNDED: 'payment.refunded',
} as const;

export const PAYMENT_PERMISSIONS = {
  PAY: 'customer:orders',
  ADMIN_REFUND: 'admin:orders:manage',
} as const;
