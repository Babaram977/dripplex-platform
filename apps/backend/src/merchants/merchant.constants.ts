import { KycDocumentType } from '@prisma/client';

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

/**
 * Documents a merchant must have VERIFIED before Operations can approve them.
 *
 * These are exactly the two the merchant portal's KYC page marks "Required"
 * (KYC_DOCS in merchantScreen.tsx): the business's CAC certificate and the
 * director's NIN. Approval previously passed on ANY single verified document,
 * so a merchant could go live with the CAC alone while the portal still told
 * them the NIN was required — the check now matches what the merchant was
 * asked for. Founder decision 2026-08-15.
 */
export const REQUIRED_MERCHANT_KYC_DOCUMENT_TYPES = [
  KycDocumentType.CAC_CERTIFICATE,
  KycDocumentType.NATIONAL_ID,
] as const;

export const BANK_ACCOUNT_NUMBER_MIN_LENGTH = 8;
export const BANK_ACCOUNT_NUMBER_MAX_LENGTH = 20;
export const BUSINESS_NAME_MIN_LENGTH = 3;
export const BUSINESS_NAME_MAX_LENGTH = 150;
