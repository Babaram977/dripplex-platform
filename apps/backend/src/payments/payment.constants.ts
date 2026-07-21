export const PAYMENT_AUDIT_ACTIONS = {
  INITIALIZED: 'payment.initialized',
  VERIFIED: 'payment.verified',
  FAILED: 'payment.failed',
  WEBHOOK_RECEIVED: 'payment.webhook.received',
  WEBHOOK_REJECTED: 'payment.webhook.rejected',
  INVENTORY_DEDUCTED: 'inventory.deducted',
} as const;

export const PAYMENT_PERMISSIONS = {
  PAY: 'customer:orders',
} as const;
