import { PERMISSIONS_KEY } from '../common/decorators/permissions.decorator';

import { AdminReviewsController } from './admin-reviews.controller';
import { CustomerReviewsController } from './customer-reviews.controller';
import { MerchantReviewsController } from './merchant-reviews.controller';
import { REVIEW_PERMISSIONS } from './review.constants';

describe('REVIEW_PERMISSIONS', () => {
  it('defines requested review permissions', () => {
    expect(REVIEW_PERMISSIONS.CUSTOMER_MANAGE).toBe('customer:reviews:manage');
    expect(REVIEW_PERMISSIONS.MERCHANT_REPLY).toBe('merchant:reviews:reply');
    expect(REVIEW_PERMISSIONS.ADMIN_MODERATE).toBe('admin:reviews:moderate');
  });

  it('protects customer create reviews', () => {
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, CustomerReviewsController.prototype.create),
    ).toEqual([REVIEW_PERMISSIONS.CUSTOMER_MANAGE]);
  });

  it('protects helpful votes', () => {
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, CustomerReviewsController.prototype.helpful),
    ).toEqual([REVIEW_PERMISSIONS.CUSTOMER_MANAGE]);
  });

  it('protects merchant reviews (list + reply) at the controller level', () => {
    // Both endpoints share one permission, so the decorator lives on the
    // controller class rather than each method — PermissionsGuard reads
    // via getAllAndOverride([handler, class]), so a class-level decorator
    // with no method-level override still protects every route.
    expect(Reflect.getMetadata(PERMISSIONS_KEY, MerchantReviewsController)).toEqual([
      REVIEW_PERMISSIONS.MERCHANT_REPLY,
    ]);
  });

  it('protects admin moderation', () => {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, AdminReviewsController.prototype.moderate)).toEqual(
      [REVIEW_PERMISSIONS.ADMIN_MODERATE],
    );
  });
});
