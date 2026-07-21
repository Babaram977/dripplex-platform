export const ANALYTICS_PERMISSIONS = {
  MERCHANT_READ: 'merchant:analytics:read',
  ADMIN_READ: 'admin:analytics:read',
} as const;

export const ANALYTICS_METRIC_KEYS = {
  ORDERS_PAID: 'orders_paid',
  REVENUE: 'revenue',
  PAYMENT_FAILED: 'payment_failed',
  ORDER_CANCELLED: 'order_cancelled',
  DELIVERY_COMPLETED: 'delivery_completed',
} as const;
