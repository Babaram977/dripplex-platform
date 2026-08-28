import { BusinessType, KycDocumentType } from '@prisma/client';

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
 * Documents a REGISTERED business must have VERIFIED before Operations can
 * approve them.
 *
 * These are the two the merchant portal's KYC page marks "Required" (KYC_DOCS
 * in merchantScreen.tsx): the business's CAC certificate and the director's
 * NIN. Approval previously passed on ANY single verified document, so a
 * merchant could go live with the CAC alone while the portal still told them
 * the NIN was required — the check now matches what the merchant was asked
 * for. Founder decision 2026-08-15.
 */
export const REQUIRED_MERCHANT_KYC_DOCUMENT_TYPES = [
  KycDocumentType.CAC_CERTIFICATE,
  KycDocumentType.NATIONAL_ID,
] as const;

/**
 * What a SOLE TRADER must have verified instead: their NIN, and nothing else.
 *
 * A CAC certificate is proof that a business is registered with the Corporate
 * Affairs Commission, and an unregistered business cannot obtain one at any
 * price — it is not a document a sole trader has mislaid. Requiring it of
 * everyone meant the small food sellers, tailors and kiosks that make up the
 * launch market in Kano could complete every step of onboarding and then sit
 * permanently unapprovable, invisible to customers, with the portal asking for
 * a certificate that does not exist for them.
 *
 * Founder decision 2026-08-28, taken to onboard 20 Kano restaurants: relax the
 * CAC for sole traders. The NIN still identifies a real, traceable person, so
 * this narrows what we hold rather than dropping identity checks — and every
 * other structure (partnership, LLC, corporation) is registered by definition
 * and keeps the full set.
 *
 * OTHER deliberately keeps the full set: it is the "I am not sure" answer, and
 * a merchant who picks it has not told us they are a sole trader. The field
 * agent's job is to select Sole proprietorship for an unregistered business.
 */
export const REQUIRED_SOLE_TRADER_KYC_DOCUMENT_TYPES = [KycDocumentType.NATIONAL_ID] as const;

/**
 * The documents this particular business must have verified to be approved.
 *
 * Keyed on legal structure rather than on a flag an operator can set, so the
 * requirement cannot drift per merchant: a business that says it is registered
 * is held to registered-business evidence.
 */
export function requiredKycDocumentTypes(businessType: BusinessType): readonly KycDocumentType[] {
  return businessType === BusinessType.SOLE_PROPRIETORSHIP
    ? REQUIRED_SOLE_TRADER_KYC_DOCUMENT_TYPES
    : REQUIRED_MERCHANT_KYC_DOCUMENT_TYPES;
}

export const BANK_ACCOUNT_NUMBER_MIN_LENGTH = 8;
export const BANK_ACCOUNT_NUMBER_MAX_LENGTH = 20;
export const BUSINESS_NAME_MIN_LENGTH = 3;
export const BUSINESS_NAME_MAX_LENGTH = 150;
