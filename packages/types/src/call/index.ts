/**
 * DPX-MOBILE-002 — one voice call between the two parties of a live job.
 *
 * These mirror the backend's own shapes (`CallsService`, `CallTokenProvider`,
 * `CALL_EVENTS`) rather than inventing a client-side view of them. DrippleX
 * owns who may call whom and what happened; LiveKit owns moving the audio, and
 * nothing about the media appears here.
 */

/** Which kind of job a call is anchored to. Matches Prisma's
 * `MessageContextType` — calling reuses chat's context, because it is the same
 * pairing of the same two people. */
export type CallContextType = 'RIDE' | 'DELIVERY';

export type CallStatus =
  | 'RINGING'
  | 'ANSWERED'
  | 'DECLINED'
  /** Rang out without being answered or declined — distinct from DECLINED,
   * because "nobody picked up" and "they said no" are different facts about a
   * driver's responsiveness. */
  | 'MISSED'
  /** Never connected: a media or network failure, not a human decision.
   * Deliberately not folded into MISSED — call completion rate is unanswerable
   * if the platform's own failures are recorded as if the callee ignored the
   * phone. */
  | 'FAILED'
  | 'ENDED';

/** Why a call stopped. Paired with the status rather than replacing it: the
 * status is what happened, this is who or what caused it. */
export type CallEndedReason =
  'CALLER_HANGUP' | 'CALLEE_HANGUP' | 'DECLINED' | 'TIMEOUT' | 'CONNECTION_FAILED';

export interface CallDto {
  id: string;
  contextType: CallContextType;
  contextId: string;
  callerId: string;
  calleeId: string;
  status: CallStatus;
  createdAt: string;
  answeredAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  endedReason: CallEndedReason | null;
}

/** Everything needed to join the room, and nothing else. */
export interface CallTokenDto {
  /** A short-lived JWT scoped to one room and one identity. */
  token: string;
  /** The LiveKit server to connect to. */
  url: string;
  /**
   * When the token stops working.
   *
   * Minutes, not hours: it only has to cover the gap between requesting it and
   * joining. **It is not the length of the call** — LiveKit checks the token at
   * join time and does not drop an established session when it expires, so a
   * client must never tear a live call down because this passed.
   */
  expiresAt: string;
}

/** What placing a call returns: the call, and the **caller's** token. The
 * callee's is minted for the callee's own request and never handed over. */
export interface InitiatedCallDto {
  call: CallDto;
  token: CallTokenDto;
}

// ── Socket events ───────────────────────────────────────────────────────────
// Delivered on the rides gateway's existing `user:{id}` rooms. Only three
// reach a client: a call either connects or it is over, and the reason it is
// over travels on the payload rather than in the event name.

/**
 * To the callee: someone is calling you.
 *
 * Carries no token, deliberately — a ringing notification sitting on a locked
 * screen must not be a credential. The callee mints their own on accept.
 */
export interface CallIncomingEvent {
  call: CallDto;
  /** When it stops ringing and becomes MISSED. */
  expiresAt: string;
}

/** To the caller: they picked up. */
export interface CallAcceptedEvent {
  callId: string;
  answeredAt: string;
}

/** To whoever did not cause it: declined, hung up, timed out or failed. */
export interface CallEndedEvent {
  callId: string;
  status: CallStatus;
  endedReason: CallEndedReason | null;
  durationSeconds: number | null;
}

/** Event names, so a client cannot mistype one into silence. */
export const CALL_EVENT_NAMES = {
  INCOMING: 'call:incoming',
  ACCEPTED: 'call:accepted',
  ENDED: 'call:ended',
} as const;

/**
 * Statuses in which there is still a call to be on.
 *
 * A client uses this to decide whether to show call UI at all — on reconnect,
 * on a late event, or when a screen mounts mid-call.
 */
export const LIVE_CALL_STATUSES: readonly CallStatus[] = ['RINGING', 'ANSWERED'];

/** Whether a call is over, whatever ended it. */
export function isCallOver(status: CallStatus): boolean {
  return !LIVE_CALL_STATUSES.includes(status);
}
