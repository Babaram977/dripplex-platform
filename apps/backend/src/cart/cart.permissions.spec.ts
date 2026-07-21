import { CART_PERMISSIONS } from './cart.constants';

describe('CART_PERMISSIONS', () => {
  it('defines customer manage and admin read', () => {
    expect(CART_PERMISSIONS.MANAGE).toBe('customer:cart:manage');
    expect(CART_PERMISSIONS.ADMIN_READ).toBe('admin:cart:read');
  });
});
