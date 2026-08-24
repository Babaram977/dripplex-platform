import { ROLE_PERMISSION_GRANTS } from '../../prisma/seed-data/role-permissions';

import { AdminRidePricingController } from './controllers/admin-ride-pricing.controller';
import { AdminRidesController } from './controllers/admin-rides.controller';
import {
  CANCELLABLE_RIDE_STATUSES,
  OPERATIONS_CANCELLABLE_RIDE_STATUSES,
  RIDE_PERMISSIONS,
} from './ride.constants';

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

describe('OPERATIONS_CANCELLABLE_RIDE_STATUSES', () => {
  it('covers everything the passenger can cancel, plus a trip already under way', () => {
    for (const status of CANCELLABLE_RIDE_STATUSES) {
      expect(OPERATIONS_CANCELLABLE_RIDE_STATUSES).toContain(status);
    }
    // The stranded-ride case: nobody else can clear an IN_PROGRESS trip.
    expect(OPERATIONS_CANCELLABLE_RIDE_STATUSES).toContain('IN_PROGRESS');
  });

  it('still refuses a finished ride — that is a refund, not a cancellation', () => {
    expect(OPERATIONS_CANCELLABLE_RIDE_STATUSES).not.toContain('COMPLETED');
    expect(OPERATIONS_CANCELLABLE_RIDE_STATUSES).not.toContain('CANCELLED');
    expect(OPERATIONS_CANCELLABLE_RIDE_STATUSES).not.toContain('NO_DRIVERS_FOUND');
  });
});

describe('operations ride cancellation', () => {
  it('guards the cancel endpoint with the ride support permission', () => {
    // Read the decorator metadata, not the source: an endpoint that lets a
    // third party end someone else's trip must never silently lose its guard.
    const required: unknown = Reflect.getMetadata('permissions', AdminRidesController);

    expect(required).toEqual([RIDE_PERMISSIONS.ADMIN_SUPPORT]);
  });

  it('grants it to the operations and admin desks, and to nobody else', () => {
    for (const role of ['operations_staff', 'administrator', 'super_administrator']) {
      expect(ROLE_PERMISSION_GRANTS[role]).toContain(RIDE_PERMISSIONS.ADMIN_SUPPORT);
    }
    for (const role of ['customer', 'merchant', 'rider', 'driver']) {
      expect(ROLE_PERMISSION_GRANTS[role]).not.toContain(RIDE_PERMISSIONS.ADMIN_SUPPORT);
    }
  });
});
