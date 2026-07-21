import { MERCHANT_PERMISSIONS } from './merchant.constants';

describe('MERCHANT_PERMISSIONS', () => {
  it('defines merchant self-service permissions', () => {
    expect(MERCHANT_PERMISSIONS.BUSINESS_MANAGE).toBe('merchant:business:manage');
    expect(MERCHANT_PERMISSIONS.KYC_MANAGE).toBe('merchant:kyc:manage');
    expect(MERCHANT_PERMISSIONS.BANK_MANAGE).toBe('merchant:bank:manage');
  });

  it('defines admin merchant lifecycle permissions', () => {
    expect(MERCHANT_PERMISSIONS.REVIEW).toBe('admin:merchants:review');
    expect(MERCHANT_PERMISSIONS.APPROVE).toBe('admin:merchants:approve');
    expect(MERCHANT_PERMISSIONS.REJECT).toBe('admin:merchants:reject');
    expect(MERCHANT_PERMISSIONS.SUSPEND).toBe('admin:merchants:suspend');
    expect(MERCHANT_PERMISSIONS.REACTIVATE).toBe('admin:merchants:reactivate');
  });
});

describe('merchant DTO validation constants', () => {
  it('enforces bank account number length bounds', async () => {
    const { BANK_ACCOUNT_NUMBER_MAX_LENGTH, BANK_ACCOUNT_NUMBER_MIN_LENGTH } =
      await import('./merchant.constants');
    expect(BANK_ACCOUNT_NUMBER_MIN_LENGTH).toBe(8);
    expect(BANK_ACCOUNT_NUMBER_MAX_LENGTH).toBe(20);
  });

  it('enforces business name length bounds', async () => {
    const { BUSINESS_NAME_MAX_LENGTH, BUSINESS_NAME_MIN_LENGTH } =
      await import('./merchant.constants');
    expect(BUSINESS_NAME_MIN_LENGTH).toBe(3);
    expect(BUSINESS_NAME_MAX_LENGTH).toBe(150);
  });
});
