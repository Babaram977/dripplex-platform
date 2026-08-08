export const KYC_AUDIT_ACTIONS = {
  CUSTOMER_KYC_STARTED: 'kyc.customer.started',
  CUSTOMER_KYC_SUBMITTED: 'kyc.customer.submitted',
  CUSTOMER_KYC_VERIFIED: 'kyc.customer.verified',
  CUSTOMER_KYC_REJECTED: 'kyc.customer.rejected',
  CUSTOMER_KYC_RESUBMISSION_REQUESTED: 'kyc.customer.resubmission_requested',
} as const;

export const KYC_PERMISSIONS = {
  CUSTOMER_MANAGE: 'customer:kyc:manage',
  ADMIN_REVIEW: 'admin:customer-kyc:review',
} as const;
