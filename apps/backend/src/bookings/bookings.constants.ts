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

/** How often to look for bookings whose window has closed. Frequent enough
 *  that a guest is not left waiting materially past the promised 30 minutes. */
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
 * WalletLedgerEntry.referenceType for the hold that reserves a guest's money
 * while the hotel decides.
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
  'The hotel could not take this booking. Your money was never charged — it is all still in your DrippleX Wallet.';

export const BOOKING_EXPIRED_CUSTOMER_MESSAGE =
  'The hotel did not respond in time, so this booking was cancelled. Your money was never charged — it is all still in your DrippleX Wallet.';
