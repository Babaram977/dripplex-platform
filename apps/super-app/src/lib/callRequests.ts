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
