import { PERMISSIONS_KEY } from '../common/decorators/permissions.decorator';

import { AdminNotificationsController } from './admin-notifications.controller';
import { CustomerNotificationsController } from './customer-notifications.controller';
import { NOTIFICATION_CENTER_PERMISSIONS } from './notification-center.constants';

describe('notification center controller permissions', () => {
  it('protects customer read endpoints with read permission', () => {
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, CustomerNotificationsController.prototype.list),
    ).toEqual([NOTIFICATION_CENTER_PERMISSIONS.CUSTOMER_READ]);
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        CustomerNotificationsController.prototype.getPreferences,
      ),
    ).toEqual([NOTIFICATION_CENTER_PERMISSIONS.CUSTOMER_READ]);
  });

  it('protects customer mutations with manage permission', () => {
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, CustomerNotificationsController.prototype.markRead),
    ).toEqual([NOTIFICATION_CENTER_PERMISSIONS.CUSTOMER_MANAGE]);
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        CustomerNotificationsController.prototype.updatePreferences,
      ),
    ).toEqual([NOTIFICATION_CENTER_PERMISSIONS.CUSTOMER_MANAGE]);
  });

  it('protects admin notification endpoints with admin manage permission', () => {
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, AdminNotificationsController.prototype.broadcast),
    ).toEqual([NOTIFICATION_CENTER_PERMISSIONS.ADMIN_MANAGE]);
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, AdminNotificationsController.prototype.resend),
    ).toEqual([NOTIFICATION_CENTER_PERMISSIONS.ADMIN_MANAGE]);
  });
});
