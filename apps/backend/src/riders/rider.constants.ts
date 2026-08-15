// DPX-RIDER-001 — delivery-rider approval workflow. Mirrors the driver
// approval constants.
//
// DPX-RIDER-003: riders DO have a KYC gate (added by DPX-RIDER-002, which let a
// rider submit an identity document) — the note that they don't predates it.
// The admin review half was never built, so submitted documents were shown as
// "KYC Pending" in the Operations Console with no way to verify or reject them.
// The KYC_VERIFIED/KYC_REJECTED audit actions below close that gap.

export const RIDER_AUDIT_ACTIONS = {
  APPROVED: 'rider.approved',
  REJECTED: 'rider.rejected',
  SUSPENDED: 'rider.suspended',
  REACTIVATED: 'rider.reactivated',
  // DPX-RIDER-002 — self-service actions.
  KYC_SUBMITTED: 'rider.kyc_submitted',
  PROFILE_UPDATED: 'rider.profile_updated',
  // DPX-RIDER-003 — admin review of a submitted rider KYC document. Riders could
  // submit KYC but operations had no way to act on it, so documents sat as
  // "KYC Pending" forever. Mirrors the driver KYC review actions.
  KYC_VERIFIED: 'rider.kyc_verified',
  KYC_REJECTED: 'rider.kyc_rejected',
} as const;

/**
 * DPX-RIDER-002 — rider self-service permissions. `rider:kyc:manage` mirrors
 * `driver:kyc:manage`; granted to the `rider` role (and super_administrator)
 * in the RBAC seed. Also gates uploads to the `kyc-documents` folder.
 */
export const RIDER_SELF_PERMISSIONS = {
  KYC_MANAGE: 'rider:kyc:manage',
} as const;

/**
 * `admin:riders:*` mirrors `admin:drivers:*`. Granted to operations_staff,
 * administrator and super_administrator in seed-rbac — the same roles that
 * already hold the driver/merchant approval permissions, so rider approvals
 * surface in the Operations Console exactly like driver/merchant ones.
 */
export const RIDER_PERMISSIONS = {
  REVIEW: 'admin:riders:review',
  APPROVE: 'admin:riders:approve',
  REJECT: 'admin:riders:reject',
  SUSPEND: 'admin:riders:suspend',
  REACTIVATE: 'admin:riders:reactivate',
} as const;
