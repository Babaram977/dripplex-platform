/**
 * DPX-FLEET — a company that supplies riders and drivers to DrippleX.
 *
 * Founder decision, 2026-08-30, after comparing Talabat: almost all of
 * Talabat's ~20,000 riders work for fleet partners rather than the platform.
 * DrippleX takes the same shape — the fleet owns the vehicles, employs the
 * riders and agrees their pay privately; DrippleX supplies the demand and
 * charges the fleet commission on it.
 */

/**
 * The Fleet DX number an owner reads down the phone to Operations.
 *
 * `DX-FL-0001`, not a UUID, because that is how it will actually be used —
 * spoken, written on a form, typed into a search box by someone who has been
 * told it once. Zero-padded so the numbers sort and read consistently, and
 * prefixed so it can never be confused with an order number or a plate.
 */
export const FLEET_NUMBER_PREFIX = 'DX-FL-';
export const FLEET_NUMBER_PAD = 4;

export function formatFleetNumber(sequence: number): string {
  return `${FLEET_NUMBER_PREFIX}${String(sequence).padStart(FLEET_NUMBER_PAD, '0')}`;
}

/** Accepts the number in any case and tolerates surrounding whitespace. */
export function normaliseFleetNumber(input: string): string {
  return input.trim().toUpperCase();
}

export const FLEET_NUMBER_PATTERN = /^DX-FL-\d{4,}$/;

/**
 * Commission is charged on the delivery fee, not the basket.
 *
 * Founder decision, 2026-08-30: "dx rider picks and deliver dx have 8% of the
 * delivery fee the system charge". The merchant's own 10% on the goods is a
 * separate arrangement with the merchant and is unaffected by who delivered.
 */
export const FLEET_COMMISSION_BASE = 'DELIVERY_FEE' as const;

/** Reference type recorded on the commission ledger entry for a settled month. */
export const FLEET_COMMISSION_REFERENCE_TYPE = 'fleet_commission_period';

export const FLEET_AUDIT_ACTIONS = {
  CREATED: 'fleet.created',
  /** An owner registering their own company online, not Operations creating it. */
  REGISTERED: 'fleet.registered',
  APPROVED: 'fleet.approved',
  APPLICATION_REJECTED: 'fleet.application_rejected',
  UPDATED: 'fleet.updated',
  SUSPENDED: 'fleet.suspended',
  REINSTATED: 'fleet.reinstated',
  MEMBER_ADDED: 'fleet.member.added',
  /** A rider quoted this fleet's DX number during their own onboarding. */
  MEMBER_REQUESTED: 'fleet.member.requested',
  MEMBER_REQUEST_APPROVED: 'fleet.member.request_approved',
  MEMBER_REQUEST_REJECTED: 'fleet.member.request_rejected',
  MEMBER_DEACTIVATED: 'fleet.member.deactivated',
  MEMBER_REACTIVATED: 'fleet.member.reactivated',
  MEMBER_REMOVED: 'fleet.member.removed',
  TIERS_UPDATED: 'fleet.commission.tiers_updated',
  RATE_NEGOTIATED: 'fleet.commission.rate_negotiated',
  PERIOD_SETTLED: 'fleet.commission.period_settled',
} as const;

/**
 * The role granted to an owner when Operations creates their fleet.
 *
 * Must match the `fleet_owner` seeded in `seed-rbac.cjs` — it is what carries
 * `fleet:own:read` and `fleet:own:manage`, and therefore the only thing that
 * makes the owner's console reachable at all.
 */
export const FLEET_OWNER_ROLE = 'fleet_owner';

export const FLEET_PERMISSIONS = {
  /** The owner's own console: his fleet, his people, his numbers. */
  OWN_READ: 'fleet:own:read',
  /** The owner deactivating, reactivating and removing his own riders. */
  OWN_MANAGE: 'fleet:own:manage',
  /** Operations creating fleets and attaching people to a Fleet DX number. */
  ADMIN_MANAGE: 'admin:fleets:manage',
  /** Operations editing the commission tier table and settling a month. */
  ADMIN_COMMISSION_MANAGE: 'admin:fleets:commission:manage',
} as const;
