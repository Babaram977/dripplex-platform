import { DELIVERY_PERMISSIONS } from './delivery.constants';

describe('DELIVERY_PERMISSIONS', () => {
  it('defines customer, rider, and admin delivery permissions', () => {
    expect(DELIVERY_PERMISSIONS.CUSTOMER_READ).toBe('customer:delivery:read');
    expect(DELIVERY_PERMISSIONS.RIDER_MANAGE).toBe('rider:delivery:manage');
    expect(DELIVERY_PERMISSIONS.ADMIN_MANAGE).toBe('admin:delivery:manage');
  });
});
