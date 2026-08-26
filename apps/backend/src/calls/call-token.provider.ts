/**
 * DPX-MOBILE-002 §3.1 — minting a LiveKit access token.
 *
 * The shape mirrors the notification centre's `PUSH_PROVIDER`: an interface, a
 * real implementation bound only when credentials resolve, and a not-configured
 * stand-in otherwise. That is what lets this ship and be tested before a
 * LiveKit deployment exists, and what makes a misconfigured environment say so
 * instead of failing at the moment a driver taps Call.
 */

/** What the client needs to join, and nothing more. */
export interface CallToken {
  /** A short-lived JWT scoped to one room and one identity. */
  token: string;
  /** The LiveKit server the client should connect to. */
  url: string;
  /** When the token stops working, for the client to reason about. */
  expiresAt: string;
}

export interface CallTokenMinter {
  /** Null when LiveKit is not configured — never a fabricated token.
   *
   * Async because `AccessToken.toJwt()` is a promise in livekit-server-sdk v2
   * (it was synchronous in v1, and code written against the old signature
   * silently produces `"[object Promise]"` as the token). */
  mint(input: { room: string; identity: string; name: string }): Promise<CallToken | null>;
  readonly configured: boolean;
}

export const CALL_TOKEN_MINTER = Symbol('CALL_TOKEN_MINTER');

/**
 * How long a joining token stays valid.
 *
 * Minutes, not hours (§3.1): a token that leaks is useless once it expires, and
 * this only has to cover the gap between requesting it and joining the room —
 * **not the length of the call.** LiveKit checks the token at join time; an
 * established session is not dropped when it expires.
 */
export const CALL_TOKEN_TTL_SECONDS = 120;

/**
 * Bound when `LIVEKIT_URL`, `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` are
 * absent. Reports itself as unconfigured rather than throwing, so the failure
 * surfaces as "calling is not available" instead of a 500.
 */
export class NotConfiguredCallTokenMinter implements CallTokenMinter {
  public readonly configured = false;

  public mint(): Promise<CallToken | null> {
    return Promise.resolve(null);
  }
}
