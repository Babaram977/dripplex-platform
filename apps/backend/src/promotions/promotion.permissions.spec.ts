import { PERMISSIONS_KEY } from '../common/decorators/permissions.decorator';

import { AdminPromotionsController } from './admin-promotions.controller';
import { CustomerPromotionsController } from './customer-promotions.controller';
import { PROMOTION_PERMISSIONS } from './promotion.constants';

describe('PROMOTION_PERMISSIONS', () => {
  it('defines requested promotion permissions', () => {
    expect(PROMOTION_PERMISSIONS.CUSTOMER_USE).toBe('customer:promotions:use');
    expect(PROMOTION_PERMISSIONS.ADMIN_MANAGE).toBe('admin:promotions:manage');
  });

  it('protects active customer promotions', () => {
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, CustomerPromotionsController.prototype.active),
    ).toEqual([PROMOTION_PERMISSIONS.CUSTOMER_USE]);
  });

  it('protects coupon validation', () => {
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, CustomerPromotionsController.prototype.validate),
    ).toEqual([PROMOTION_PERMISSIONS.CUSTOMER_USE]);
  });

  it('protects admin creation', () => {
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, AdminPromotionsController.prototype.create),
    ).toEqual([PROMOTION_PERMISSIONS.ADMIN_MANAGE]);
  });

  it('protects admin updates', () => {
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, AdminPromotionsController.prototype.update),
    ).toEqual([PROMOTION_PERMISSIONS.ADMIN_MANAGE]);
  });

  it.each([
    'pause',
    'resume',
    'archive',
    'forceExpire',
    'clone',
    'analytics',
    'topCampaigns',
    'exportCsv',
  ] as const)('protects admin lifecycle/analytics endpoint %s', (method) => {
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, AdminPromotionsController.prototype[method]),
    ).toEqual([PROMOTION_PERMISSIONS.ADMIN_MANAGE]);
  });
});
