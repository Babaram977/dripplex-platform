import { DRIVER_PERMISSIONS } from './driver.constants';

describe('DRIVER_PERMISSIONS', () => {
  it('defines driver self-service permissions', () => {
    expect(DRIVER_PERMISSIONS.KYC_MANAGE).toBe('driver:kyc:manage');
  });

  it('defines admin driver lifecycle permissions', () => {
    expect(DRIVER_PERMISSIONS.REVIEW).toBe('admin:drivers:review');
    expect(DRIVER_PERMISSIONS.APPROVE).toBe('admin:drivers:approve');
    expect(DRIVER_PERMISSIONS.REJECT).toBe('admin:drivers:reject');
    expect(DRIVER_PERMISSIONS.SUSPEND).toBe('admin:drivers:suspend');
    expect(DRIVER_PERMISSIONS.REACTIVATE).toBe('admin:drivers:reactivate');
  });
});
