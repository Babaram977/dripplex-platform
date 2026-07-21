import { ORDER_PERMISSIONS } from './order.constants';

describe('ORDER_PERMISSIONS', () => {
  it('defines customer and admin order permissions', () => {
    expect(ORDER_PERMISSIONS.CHECKOUT).toBe('customer:checkout');
    expect(ORDER_PERMISSIONS.ORDERS).toBe('customer:orders');
    expect(ORDER_PERMISSIONS.ADMIN_READ).toBe('admin:orders:read');
  });
});
