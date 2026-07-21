export const FRAUD_PERMISSIONS = {
  ADMIN_MANAGE: 'admin:fraud:manage',
  ADMIN_CONFIGURE: 'admin:fraud:configure',
  SUPPORT_REVIEW: 'support:fraud:review',
} as const;

export const FRAUD_AUDIT_ACTIONS = {
  SIGNAL_REVIEWED: 'fraud.signal.reviewed',
  SIGNAL_CLEARED: 'fraud.signal.cleared',
  SIGNAL_CONFIRMED: 'fraud.signal.confirmed',
  THRESHOLD_UPDATED: 'fraud.threshold.updated',
  LIST_ENTRY_CREATED: 'fraud.list_entry.created',
  LIST_ENTRY_UPDATED: 'fraud.list_entry.updated',
  LIST_ENTRY_DELETED: 'fraud.list_entry.deleted',
} as const;

export const FRAUD_THRESHOLD_DEFAULTS = {
  high_value_order_amount: 500000,
  failed_payment_velocity_count: 3,
  order_velocity_count: 5,
  device_velocity_count: 4,
  velocity_window_minutes: 60,
  score_medium: 40,
  score_high: 70,
  score_critical: 90,
} as const;
