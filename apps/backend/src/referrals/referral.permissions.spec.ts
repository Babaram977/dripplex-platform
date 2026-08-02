import { PERMISSIONS_KEY } from '../common/decorators/permissions.decorator';

import { AdminReferralsController } from './admin-referrals.controller';
import { CustomerReferralsController } from './customer-referrals.controller';
import { REFERRAL_PERMISSIONS } from './referral.constants';

describe('REFERRAL_PERMISSIONS', () => {
  it('defines requested referral permissions', () => {
    expect(REFERRAL_PERMISSIONS.CUSTOMER_USE).toBe('customer:referrals:use');
    expect(REFERRAL_PERMISSIONS.ADMIN_MANAGE).toBe('admin:referrals:manage');
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
