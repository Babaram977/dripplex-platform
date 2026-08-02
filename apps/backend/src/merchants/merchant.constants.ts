export const MERCHANT_AUDIT_ACTIONS = {
  BUSINESS_CREATED: 'merchant.business.created',
  BUSINESS_UPDATED: 'merchant.business.updated',
  KYC_SUBMITTED: 'merchant.kyc.submitted',
  KYC_VERIFIED: 'merchant.kyc.verified',
  KYC_REJECTED: 'merchant.kyc.rejected',
  BANK_CREATED: 'merchant.bank.created',
  BANK_UPDATED: 'merchant.bank.updated',
  APPROVED: 'merchant.approved',
  REJECTED: 'merchant.rejected',
  SUSPENDED: 'merchant.suspended',
  REACTIVATED: 'merchant.reactivated',
  STORE_PAUSED: 'merchant.store_paused',
  STORE_RESUMED: 'merchant.store_resumed',
} as const;

export const MERCHANT_PERMISSIONS = {
  BUSINESS_MANAGE: 'merchant:business:manage',
  KYC_MANAGE: 'merchant:kyc:manage',
  BANK_MANAGE: 'merchant:bank:manage',
  REVIEW: 'admin:merchants:review',
  APPROVE: 'admin:merchants:approve',
  REJECT: 'admin:merchants:reject',
  SUSPEND: 'admin:merchants:suspend',
  REACTIVATE: 'admin:merchants:reactivate',
} as const;

export const BANK_ACCOUNT_NUMBER_MIN_LENGTH = 8;
export const BANK_ACCOUNT_NUMBER_MAX_LENGTH = 20;
export const BUSINESS_NAME_MIN_LENGTH = 3;
export const BUSINESS_NAME_MAX_LENGTH = 150;
