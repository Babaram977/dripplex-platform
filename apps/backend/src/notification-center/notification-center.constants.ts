export const NOTIFICATION_CENTER_PERMISSIONS = {
  CUSTOMER_READ: 'customer:notifications:read',
  CUSTOMER_MANAGE: 'customer:notifications:manage',
  ADMIN_MANAGE: 'admin:notifications:manage',
} as const;

export const NOTIFICATION_CENTER_AUDIT_ACTIONS = {
  CREATED: 'notification.created',
  SENT: 'notification.sent',
  READ: 'notification.read',
  READ_ALL: 'notification.read_all',
  DELETED: 'notification.deleted',
  PREFERENCES_UPDATED: 'notification.preferences.updated',
  TEMPLATE_CREATED: 'notification.template.created',
  TEMPLATE_UPDATED: 'notification.template.updated',
  TEMPLATE_DELETED: 'notification.template.deleted',
  BROADCAST: 'notification.broadcast',
  RESENT: 'notification.resent',
  DEAD_LETTERED: 'notification.dead_lettered',
} as const;
