import { ROLE_PERMISSION_GRANTS } from '../../prisma/seed-data/role-permissions';

import { AdminRidePricingController } from './controllers/admin-ride-pricing.controller';
import { CANCELLABLE_RIDE_STATUSES, RIDE_PERMISSIONS } from './ride.constants';

describe('RIDE_PERMISSIONS', () => {
  it('defines the customer ride self-service permission', () => {
    expect(RIDE_PERMISSIONS.MANAGE).toBe('customer:ride:manage');
  });

  it('defines the driver ride self-service permission', () => {
    expect(RIDE_PERMISSIONS.DRIVER_MANAGE).toBe('driver:ride:manage');
  });

  describe('pricing console', () => {
    it('guards the pricing controller with its own permission, not ride support', () => {
      // Read off the controller's decorator metadata rather than trusting the
      // source to still say what it said — an endpoint that quietly loses its
      // guard is the failure this is here to catch.
      const required: unknown = Reflect.getMetadata('permissions', AdminRidePricingController);

      expect(required).toEqual([RIDE_PERMISSIONS.ADMIN_PRICING]);
      expect(required).not.toContain(RIDE_PERMISSIONS.ADMIN_SUPPORT);
    });

    it('grants pricing to administrators but not to operations staff', () => {
      // Refunding a trip and repricing the platform are different powers.
      // operations_staff holds admin:rides:support and must not hold this.
      expect(ROLE_PERMISSION_GRANTS['administrator']).toContain(RIDE_PERMISSIONS.ADMIN_PRICING);
      expect(ROLE_PERMISSION_GRANTS['super_administrator']).toContain(
        RIDE_PERMISSIONS.ADMIN_PRICING,
      );

      expect(ROLE_PERMISSION_GRANTS['operations_staff']).toContain(RIDE_PERMISSIONS.ADMIN_SUPPORT);
      expect(ROLE_PERMISSION_GRANTS['operations_staff']).not.toContain(
        RIDE_PERMISSIONS.ADMIN_PRICING,
      );
    });

    it('keeps pricing out of every non-admin role', () => {
      for (const role of ['customer', 'merchant', 'rider', 'driver']) {
        expect(ROLE_PERMISSION_GRANTS[role]).not.toContain(RIDE_PERMISSIONS.ADMIN_PRICING);
      }
    });
  });
});

describe('CANCELLABLE_RIDE_STATUSES', () => {
  it('allows cancellation before a trip is in progress', () => {
    expect(CANCELLABLE_RIDE_STATUSES).toEqual(
      expect.arrayContaining(['REQUESTED', 'SEARCHING', 'DRIVER_ASSIGNED', 'ARRIVED']),
    );
  });

  it('does not allow cancellation once a trip is in progress or finished', () => {
    expect(CANCELLABLE_RIDE_STATUSES).not.toContain('IN_PROGRESS');
    expect(CANCELLABLE_RIDE_STATUSES).not.toContain('COMPLETED');
    expect(CANCELLABLE_RIDE_STATUSES).not.toContain('CANCELLED');
  });
});
