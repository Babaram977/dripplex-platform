import { PERMISSIONS_KEY } from '../common/decorators/permissions.decorator';

import { WISHLIST_PERMISSIONS } from './wishlist.constants';
import { WishlistController } from './wishlist.controller';

describe('WISHLIST_PERMISSIONS', () => {
  it('defines customer wishlist manage permission', () => {
    expect(WISHLIST_PERMISSIONS.CUSTOMER_MANAGE).toBe('customer:wishlist:manage');
  });

  it('protects wishlist creation', () => {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, WishlistController.prototype.create)).toEqual([
      WISHLIST_PERMISSIONS.CUSTOMER_MANAGE,
    ]);
  });

  it('protects item creation', () => {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, WishlistController.prototype.addItem)).toEqual([
      WISHLIST_PERMISSIONS.CUSTOMER_MANAGE,
    ]);
  });

  it('protects share endpoint', () => {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, WishlistController.prototype.share)).toEqual([
      WISHLIST_PERMISSIONS.CUSTOMER_MANAGE,
    ]);
  });

  it('protects move-to-cart endpoint', () => {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, WishlistController.prototype.moveToCart)).toEqual([
      WISHLIST_PERMISSIONS.CUSTOMER_MANAGE,
    ]);
  });
});
