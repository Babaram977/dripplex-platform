export const DRIVER_AUDIT_ACTIONS = {
  KYC_SUBMITTED: 'driver.kyc.submitted',
  KYC_VERIFIED: 'driver.kyc.verified',
  KYC_REJECTED: 'driver.kyc.rejected',
  APPROVED: 'driver.approved',
  REJECTED: 'driver.rejected',
  SUSPENDED: 'driver.suspended',
  REACTIVATED: 'driver.reactivated',
} as const;

export const DRIVER_PERMISSIONS = {
  KYC_MANAGE: 'driver:kyc:manage',
  REVIEW: 'admin:drivers:review',
  APPROVE: 'admin:drivers:approve',
  REJECT: 'admin:drivers:reject',
  SUSPEND: 'admin:drivers:suspend',
  REACTIVATE: 'admin:drivers:reactivate',
} as const;
