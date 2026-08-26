export const CALLS_PERMISSIONS = {
  /** Held by every party who can be on one end of a job: customers, riders and
   * drivers. Exactly like `messaging:use`, this only says "this kind of account
   * may use calling at all". Access to a SPECIFIC call is decided by
   * CallsService from the job's own parties, so holding the permission never
   * lets anyone reach somebody they are not paired with. */
  USE: 'calls:use',
} as const;

/**
 * Socket events, on the rides gateway's existing `user:{id}` rooms.
 *
 * No new transport: the gateway already authenticates on connect and joins
 * every user to their own room, so invite, ring, accept, decline and end are
 * messages on a channel that exists (DPX-MOBILE-002 §2).
 *
 * Only two events reach a client. A call either connects or it is over, and
 * the reason it is over travels on the payload rather than in the event name —
 * so a client renders one "call ended" path instead of five, and a new
 * `CallEndedReason` never needs a new event.
 */
export const CALL_EVENTS = {
  /** To the callee: someone is calling you. Carries the call, not a token —
   * the callee mints their own on accept. */
  INCOMING: 'call:incoming',
  /** To the caller: they picked up. */
  ACCEPTED: 'call:accepted',
  /** To whoever did not cause it: declined, hung up, timed out or failed. */
  ENDED: 'call:ended',
} as const;

/**
 * How long an unanswered call rings before it is recorded as MISSED.
 *
 * **This number is a default, not a founder decision.** DPX-MOBILE-002 §4 names
 * `MISSED` and `TIMEOUT` but does not say how long a call rings, and `MISSED`
 * cannot be measured without a boundary. 45 seconds is what GSM networks ring
 * for, so it is the interval both parties already have an instinct about — but
 * it is worth a deliberate answer, and it is recorded here rather than buried.
 *
 * Deliberately longer than RIDE_OFFER_TIMEOUT_MS (60s) is not: a driver holding
 * a phone decides in seconds, and a call that rings past the point of being
 * answered is just a notification that ages badly.
 */
export const CALL_RING_TIMEOUT_MS = 45_000;

/** How often unanswered calls are swept to MISSED. Matches
 * RIDE_OFFER_SWEEP_INTERVAL_MS — the same shape of problem, and a caller
 * watching a phone ring notices a five-second lag far less than a driver
 * waiting on an offer does. */
export const CALL_SWEEP_INTERVAL_MS = 5_000;
