// ─── "Call this person" — the request, not the call ───────────────────────────
//
// A call can be placed from a chat header, a trip screen or a job card, and it
// is answered by one overlay mounted once at the root of the app. Threading a
// callback from that overlay down through every screen that might place a call
// would mean touching the whole screen map to add the next one.
//
// So screens announce an intention and the overlay picks it up. Nothing here
// talks to the backend: this is a doorbell, not a call.

import type { CallContextType } from '@dripplex/types';

export interface CallRequest {
  contextType: CallContextType;
  contextId: string;
  /** The other person's name, for the ringing screen. */
  peerName: string;
}

type Listener = (request: CallRequest) => void;

const listeners = new Set<Listener>();

/**
 * Ask for a call to be placed.
 *
 * A no-op when nothing is listening — the overlay lives inside the signed-in
 * shell, and a screen rendered outside it (the shared-trip page) has no call
 * to place. Silence is the right answer there, not a crash.
 */
export function requestCall(request: CallRequest): void {
  // Copied before iterating: a listener that unsubscribes itself while being
  // called would otherwise skip the next one.
  for (const listener of [...listeners]) listener(request);
}

export function onCallRequested(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Whether anything would answer a `requestCall`. Lets a screen hide its call
 * button rather than offer one that does nothing. */
export function callsAreAvailable(): boolean {
  return listeners.size > 0;
}

// ── The other direction: a call announced by a push ──────────────────────────
//
// DPX-MOBILE-002 Stage 2. `call:incoming` reaches a socket, and a socket needs
// an open app — which is exactly what a ringing phone in a pocket does not
// have. The push is what rings it, and tapping the push is how the app first
// learns the call exists, so the notification's own deep link has to carry
// enough to show a ringing screen and answer from it.

export interface IncomingCallAnnouncement {
  callId: string;
  /** Null when the link did not say. The ringing screen loses a line of
   * context; nothing else depends on it. */
  contextType: CallContextType | null;
  expiresAt: string | null;
}

/**
 * Read a call out of a notification's deep link.
 *
 * Returns null for any link that is not a call, and — the point of the
 * `expires` parameter — for a call that has already stopped ringing.
 * FCM's TTL is the first guard against a late ring and this is the second: the
 * TTL stops a *delivery* that is too late, and this stops a *tap* that is. A
 * push can sit on a lock screen for an hour before somebody notices it.
 *
 * Never throws. A malformed link is not a reason to take down the app that was
 * opened by tapping it.
 */
export function incomingCallFromDeepLink(
  deepLink: string,
  now: number = Date.now(),
): IncomingCallAnnouncement | null {
  let url: URL;
  try {
    // A base is required because the link is a path. Its host is irrelevant and
    // never read — only the pathname and the query matter.
    url = new URL(deepLink, 'https://app.dripplex.com');
  } catch {
    return null;
  }

  const match = /^\/call\/([A-Za-z0-9-]{8,64})\/?$/.exec(url.pathname);
  const callId = match?.[1];
  if (!callId) return null;

  const expiresAt = url.searchParams.get('expires');
  if (expiresAt !== null) {
    const expiryMs = Date.parse(expiresAt);
    // An unparseable expiry rings: better a screen that closes itself a moment
    // later than a missed call thrown away over a malformed timestamp.
    if (!Number.isNaN(expiryMs) && expiryMs <= now) return null;
  }

  const context = url.searchParams.get('context');
  return {
    callId,
    contextType: context === 'RIDE' || context === 'DELIVERY' ? context : null,
    expiresAt,
  };
}

const announcementListeners = new Set<(announcement: IncomingCallAnnouncement) => void>();

/** Tell the overlay that a push says this call is ringing. */
export function announceIncomingCall(announcement: IncomingCallAnnouncement): void {
  for (const listener of [...announcementListeners]) listener(announcement);
}

export function onIncomingCallAnnounced(
  listener: (announcement: IncomingCallAnnouncement) => void,
): () => void {
  announcementListeners.add(listener);
  return () => {
    announcementListeners.delete(listener);
  };
}
