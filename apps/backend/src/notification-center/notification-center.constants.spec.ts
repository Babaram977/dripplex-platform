import {
  NOTIFICATION_CENTER_AUDIT_ACTIONS,
  NOTIFICATION_CENTER_PERMISSIONS,
} from './notification-center.constants';

describe('notification center constants', () => {
  it('defines customer and admin permission codes', () => {
    expect(NOTIFICATION_CENTER_PERMISSIONS.CUSTOMER_READ).toBe('customer:notifications:read');
    expect(NOTIFICATION_CENTER_PERMISSIONS.CUSTOMER_MANAGE).toBe('customer:notifications:manage');
    expect(NOTIFICATION_CENTER_PERMISSIONS.ADMIN_MANAGE).toBe('admin:notifications:manage');
  });

  it('defines audit action codes', () => {
    expect(NOTIFICATION_CENTER_AUDIT_ACTIONS.SENT).toBe('notification.sent');
    expect(NOTIFICATION_CENTER_AUDIT_ACTIONS.DEAD_LETTERED).toBe('notification.dead_lettered');
    expect(NOTIFICATION_CENTER_AUDIT_ACTIONS.BROADCAST).toBe('notification.broadcast');
  });
});
