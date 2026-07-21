import { ADDRESS_PERMISSIONS, MAX_CUSTOMER_ADDRESSES } from './address.constants';

describe('address permissions and limits', () => {
  it('defines customer manage and admin read permissions', () => {
    expect(ADDRESS_PERMISSIONS.MANAGE).toBe('customer:addresses:manage');
    expect(ADDRESS_PERMISSIONS.ADMIN_READ).toBe('admin:addresses:read');
  });

  it('caps saved addresses at 20', () => {
    expect(MAX_CUSTOMER_ADDRESSES).toBe(20);
  });
});
