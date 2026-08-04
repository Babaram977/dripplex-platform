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

  it('defines DPX-DRIVER-002 vehicle/onboarding/inspection permissions', () => {
    expect(DRIVER_PERMISSIONS.ONBOARDING_MANAGE).toBe('driver:onboarding:submit');
    expect(DRIVER_PERMISSIONS.VEHICLE_MANAGE).toBe('driver:vehicle:manage');
    expect(DRIVER_PERMISSIONS.ADMIN_VEHICLE_MANAGE).toBe('admin:drivers:vehicles:manage');
    expect(DRIVER_PERMISSIONS.INSPECTION_BOOK).toBe('driver:inspection:manage');
    expect(DRIVER_PERMISSIONS.ADMIN_INSPECTION_CENTRES_MANAGE).toBe(
      'admin:inspection-centres:manage',
    );
    expect(DRIVER_PERMISSIONS.INSPECTION_CHECKLIST_MANAGE).toBe('inspection:checklist:manage');
    expect(DRIVER_PERMISSIONS.INSPECTION_APPROVE).toBe('inspection:approve');
  });
});
