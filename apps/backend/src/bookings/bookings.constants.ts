export const BOOKING_PERMISSIONS = {
  /** Browse hotels, room types and availability. Separate from BOOK so a
   *  suspended customer can still see what a room costs. */
  CUSTOMER_READ: 'customer:bookings:read',
  CUSTOMER_BOOK: 'customer:bookings:book',
  /** A hotel managing its own rooms, calendar and bookings. */
  MERCHANT_MANAGE: 'merchant:bookings:manage',
  ADMIN_MANAGE: 'admin:bookings:manage',
} as const;

export const BOOKING_AUDIT_ACTIONS = {
  ROOM_TYPE_CREATED: 'booking.room_type_created',
  ROOM_TYPE_UPDATED: 'booking.room_type_updated',
  AVAILABILITY_SET: 'booking.availability_set',
  CREATED: 'booking.created',
  ACCEPTED: 'booking.accepted',
  REJECTED: 'booking.rejected',
  EXPIRED: 'booking.expired',
  PAID: 'booking.paid',
  CHECKED_IN: 'booking.checked_in',
  CHECKED_OUT: 'booking.checked_out',
  NO_SHOW: 'booking.no_show',
} as const;

/**
 * How long a hotel has to accept before the booking expires and the guest's
 * money is released. Founder decision 9, 2026-08-20.
 *
 * Thirty minutes was chosen over 24 hours because a guest looking for a room
 * tonight cannot wait a day to find out, and over 30 seconds because a small
 * hotel does not watch the app continuously.
 */
export const BOOKING_ACCEPT_WINDOW_MS = 30 * 60_000;

/**
 * How long a guest has to pay once the hotel has accepted. Founder decision,
 * 2026-08-22: 24 hours.
 *
 * This window exists because the payment model changed. A guest now applies
 * with **no money at stake** — no wallet hold, nothing reserved but the room
 * itself. So nothing costs them anything if they simply never pay, and without
 * a deadline one person could reserve every room in a city and abandon them
 * all.
 *
 * Twenty-four hours because a bank transfer has to be possible at any hour a
 * person is awake, including one made the following morning. The room goes
 * back on sale when it lapses, exactly as it does on a rejection.
 */
export const BOOKING_PAYMENT_WINDOW_MS = 24 * 60 * 60_000;

/** How often to look for bookings whose window has closed. Frequent enough
 *  that a guest is not left waiting materially past the promised 30 minutes,
 *  and the same sweep now also releases rooms whose 24 hours ran out. */
export const BOOKING_EXPIRY_SWEEP_INTERVAL_MS = 60_000;

/** How far ahead a stay may start. Founder decision 7: three months. */
export const BOOKING_MAX_HORIZON_DAYS = 90;

/** Founder decision 7: one night minimum, multi-night allowed. The ceiling is
 *  DrippleX's own rail against a mistyped checkout date turning into a
 *  year-long hold, not a provider rule. */
export const BOOKING_MIN_NIGHTS = 1;
export const BOOKING_MAX_NIGHTS = 30;

/** Rooms per booking. A group booking beyond this is a conversation with the
 *  hotel, not a tap in an app. */
export const BOOKING_MAX_ROOMS = 5;

/**
 * SUPERSEDED 2026-08-22 and kept only so an older booking's ledger entries can
 * still be found. No new booking places a wallet hold — payment now passes
 * through the DrippleX gateway after the hotel accepts.
 *
 * Originally: WalletLedgerEntry.referenceType for the hold that reserved a
 * guest's money while the hotel decided.
 *
 * Founder decision 8: the money is NOT taken until the hotel accepts. The
 * hold reduces the guest's available balance immediately — so the same money
 * cannot be promised to two hotels — and is either committed on acceptance or
 * released on rejection or expiry. Every exit from PENDING_HOTEL does exactly
 * one of those two things.
 */
export const BOOKING_WALLET_REFERENCE_TYPE = 'hotel_booking';

/** Commission reference, paired with the booking id. `accrue` is idempotent
 *  on this pair, so a replayed acceptance cannot charge the hotel twice. */
export const BOOKING_COMMISSION_REFERENCE_TYPE = 'booking';

/** What a guest is told when a hotel declines. Deliberately not "cancelled":
 *  nothing was ever confirmed, and the money never left their wallet. */
export const BOOKING_REJECTED_CUSTOMER_MESSAGE =
  'The hotel could not take this booking. You were never charged for it.';

/** Covers both lapses: the hotel never answered, and the guest never paid.
 *  Deliberately does not accuse — a guest who simply ran out of time should be
 *  invited to try again, not told off. */
export const BOOKING_EXPIRED_CUSTOMER_MESSAGE =
  'This booking has expired and the rooms have gone back on sale. You were never charged. You are welcome to book again.';
