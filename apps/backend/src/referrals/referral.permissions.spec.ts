import { PERMISSIONS_KEY } from '../common/decorators/permissions.decorator';

import { AdminReferralsController } from './admin-referrals.controller';
import { CustomerReferralsController } from './customer-referrals.controller';
import { DriverReferralsController } from './driver-referrals.controller';
import { REFERRAL_PERMISSIONS } from './referral.constants';

describe('REFERRAL_PERMISSIONS', () => {
  it('defines requested referral permissions', () => {
    expect(REFERRAL_PERMISSIONS.CUSTOMER_USE).toBe('customer:referrals:use');
    expect(REFERRAL_PERMISSIONS.DRIVER_USE).toBe('driver:referrals:use');
    expect(REFERRAL_PERMISSIONS.ADMIN_MANAGE).toBe('admin:referrals:manage');
  });

  // A driver's code must not sit behind the customer permission: the two
  // decide different wallets, and sharing one would let a driver be issued a
  // code whose ₦350 is filed as a customer's.
  it('protects the driver code and stats with the driver permission', () => {
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, DriverReferralsController.prototype.getMyReferral),
    ).toEqual([REFERRAL_PERMISSIONS.DRIVER_USE]);
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, DriverReferralsController.prototype.getStats),
    ).toEqual([REFERRAL_PERMISSIONS.DRIVER_USE]);
  });

  it('protects fetching my referral code', () => {
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, CustomerReferralsController.prototype.getMyReferral),
    ).toEqual([REFERRAL_PERMISSIONS.CUSTOMER_USE]);
  });

  it('protects fetching referral stats', () => {
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, CustomerReferralsController.prototype.getStats),
    ).toEqual([REFERRAL_PERMISSIONS.CUSTOMER_USE]);
  });

  it('protects admin redemption listing', () => {
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, AdminReferralsController.prototype.listRedemptions),
    ).toEqual([REFERRAL_PERMISSIONS.ADMIN_MANAGE]);
  });
});
