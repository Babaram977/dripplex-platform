import { DeliveryStatus, OrderStatus, RideStatus } from '@prisma/client';

/**
 * DPX-OPS — Operations deleting an account.
 *
 * Founder decision 2026-08-28: Operations needs a way to remove a merchant,
 * driver, rider or customer rather than leaving abandoned half-finished
 * signups sitting in the console for ever. Most of what accumulates is someone
 * who started onboarding, never produced their documents, and never came back.
 */

/**
 * Where a deleted account's email is parked.
 *
 * `User.email` is a required, unique column and `User.phone` a unique one, so a
 * soft delete that leaves them in place holds that person's email address and
 * phone number hostage: they cannot re-register, and the duplicate check at
 * registration would not even tell them why. It filters on `deletedAt: null`,
 * so the address looks free right up until the database rejects the insert on
 * the unique index, and the caller gets "A record with the same unique field
 * already exists" from the global P2002 handler.
 *
 * That is exactly backwards for the accounts this feature exists to clear. An
 * abandoned signup is the case MOST likely to come back and try again properly
 * — a driver who could not photograph their licence in the app, a restaurant
 * owner who ran out of time. Deleting them must not lock them out of their own
 * phone number.
 *
 * So deletion moves the identifiers aside instead of keeping them: the email is
 * rewritten into this domain and the phone is cleared, which frees both unique
 * indexes. The row itself stays — rides, orders, ledger entries and audit
 * records all reference `User.id`, and removing it would tear history out from
 * under them.
 *
 * A DIFFERENT domain from SYNTHETIC_EMAIL_DOMAIN, deliberately. That one marks
 * a phone-only registration, and `activateIfVerificationsComplete` and
 * `login.service` both read it as "email is auto-verified, nothing to confirm".
 * A deleted account borrowing that meaning would be a deleted account that
 * looks verified.
 */
export const DELETED_EMAIL_DOMAIN = 'deleted.users.dripplex.internal';

/**
 * The parked address for a given user. Keyed on the user id, which is unique
 * and immutable, so this cannot collide with another deleted account — and
 * cannot be reversed into the address it replaced. The original is preserved in
 * the audit record instead, where it is readable by whoever is entitled to.
 */
export function makeDeletedEmail(userId: string): string {
  return `${userId}@${DELETED_EMAIL_DOMAIN}`;
}

export function isDeletedEmail(email: string): boolean {
  return email.toLowerCase().endsWith(`@${DELETED_EMAIL_DOMAIN}`);
}

/**
 * A trip that is still someone's problem.
 *
 * Deleting an account mid-trip strands the person at the other end of it: a
 * passenger watching for a car that will never arrive, or a driver on their way
 * to a pickup that no longer exists. Both sides of a ride are checked, because
 * the account being deleted may be either one.
 */
export const IN_FLIGHT_RIDE_STATUSES: RideStatus[] = [
  RideStatus.REQUESTED,
  RideStatus.SEARCHING,
  RideStatus.DRIVER_ASSIGNED,
  RideStatus.ARRIVED,
  RideStatus.IN_PROGRESS,
];

/** A delivery a rider is still carrying, or one still waiting to be picked up. */
export const IN_FLIGHT_DELIVERY_STATUSES: DeliveryStatus[] = [
  DeliveryStatus.PENDING,
  DeliveryStatus.ASSIGNED,
  DeliveryStatus.ACCEPTED,
  DeliveryStatus.PICKED_UP,
  DeliveryStatus.ON_THE_WAY,
  DeliveryStatus.ARRIVED,
];

/**
 * An order that has not finished.
 *
 * DISPUTED is in the list and is not an oversight: a dispute is an open
 * argument about money, and deleting either party mid-argument destroys the
 * only account that can answer for it. Resolve it, then delete.
 *
 * DELIVERED is NOT here — it is terminal for the merchant's obligation, and the
 * completion sweep moves it to COMPLETED on its own.
 */
export const IN_FLIGHT_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.DRIVER_ASSIGNED,
  OrderStatus.PICKED_UP,
  OrderStatus.IN_TRANSIT,
  OrderStatus.DISPUTED,
];

export const USER_AUDIT_ACTIONS = {
  ACCOUNT_DELETED: 'user.account.deleted',
} as const;
