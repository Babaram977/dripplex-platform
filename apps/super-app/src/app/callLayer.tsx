import React, { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '../lib/api';
import { onCallRequested, onIncomingCallAnnounced } from '../lib/callRequests';
import { joinCallRoom } from '../lib/callRoom';
import { startIncomingCallRing, stopIncomingCallRing } from '../lib/sound';
import { ws } from '../lib/ws';

import type { CallRequest } from '../lib/callRequests';
import type { CallRoomHandle } from '../lib/callRoom';
import type { CallContextType, CallEndedEvent } from '@dripplex/types';

/**
 * DPX-MOBILE-002 — the one place in the app where a voice call is shown.
 *
 * Mounted once, at the root of the signed-in shell, because a call is not a
 * screen. It arrives while a driver is looking at a map and while a passenger
 * is looking at a receipt, and it has to cover whichever of those is on the
 * glass at the time.
 *
 * DrippleX is authoritative about the call: this closes on what the backend
 * says (`call:ended`, or the response to its own hang-up), never on what the
 * media layer thinks. LiveKit dropping is a reason to hang up, not a reason to
 * pretend the call is already over.
 */

const PP = "'Poppins',sans-serif";
const IT = "'Inter',sans-serif";
const NAVY_BASE = '#0A1628';
const NAVY_SURFACE = '#112238';
const BORDER = 'rgba(255,255,255,.08)';
const MUTED = 'rgba(255,255,255,.42)';
const G0 = '#176B30';
const G2 = '#2BAC52';
const RED = '#DC2626';
const WHITE = '#FFFFFF';

/**
 * When a caller stops waiting for the server to tell it the call rang out.
 *
 * The server's own timeout is the real one — it writes MISSED and emits
 * `call:ended`. This is only the fallback for a client whose socket died
 * during the ring, which would otherwise sit on "Ringing…" for ever. Longer
 * than the server's window on purpose, so the ordinary path stays the
 * server's.
 */
const RING_GIVE_UP_MS = 60_000;

/** How long the outcome ("Call ended · 2:14") stays up before clearing. */
const OUTCOME_MS = 2_600;

/**
 * Phases carry a call **id**, not a `CallDto`.
 *
 * A call reaches this component two ways and only one of them brings a DTO:
 * the socket sends the whole record, and a tapped push sends a deep link with
 * an id, an expiry and a context. Everything below needs the id; the two
 * cosmetic fields are optional because the push path genuinely does not have
 * one of them.
 */
type Phase =
  | { kind: 'idle' }
  | { kind: 'placing'; peerName: string }
  | { kind: 'outgoing'; callId: string; peerName: string }
  | {
      kind: 'incoming';
      callId: string;
      contextType: CallContextType | null;
      /** Null when the call arrived by push — the deep link carries no name. */
      callerName: string | null;
      /** Null only for a malformed link; the local give-up timer covers it. */
      expiresAt: string | null;
    }
  | { kind: 'answering'; callId: string }
  | { kind: 'active'; callId: string; peerName: string; startedAt: number }
  | { kind: 'closed'; headline: string; detail: string | null };

function messageOf(error: unknown): string | null {
  const message = (error as { message?: string } | null)?.message;
  return typeof message === 'string' && message.length > 0 ? message : null;
}

/** m:ss. Calls on this platform are minutes long; an hours field would be dead
 * weight on every one of them. */
export function formatCallDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

/** What a `call:ended` should say, taken from the server's own status rather
 * than from whatever this client last thought was happening. */
export function outcomeOf(event: Pick<CallEndedEvent, 'status' | 'durationSeconds'>): {
  headline: string;
  detail: string | null;
} {
  switch (event.status) {
    case 'DECLINED':
      return { headline: 'Call declined', detail: null };
    case 'MISSED':
      return { headline: 'No answer', detail: null };
    case 'FAILED':
      return { headline: 'Call failed', detail: 'The connection could not be made.' };
    default:
      return {
        headline: 'Call ended',
        detail: event.durationSeconds === null ? null : formatCallDuration(event.durationSeconds),
      };
  }
}

export function CallLayer() {
  const [phase, setPhaseState] = useState<Phase>({ kind: 'idle' });
  const [muted, setMuted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [audioBlocked, setAudioBlocked] = useState(false);

  // Phase is mirrored into a ref and read from there by everything
  // asynchronous. Socket events and awaited responses both land outside
  // React's render cycle, and a handler that reads `phase` from a closure — or
  // decides inside a `setState` updater, which React may run twice — is
  // deciding on the wrong call.
  const phaseRef = useRef<Phase>(phase);
  const setPhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhaseState(next);
  }, []);

  // The live media session, and the id of the call it belongs to.
  const roomRef = useRef<CallRoomHandle | null>(null);
  const callIdRef = useRef<string | null>(null);

  /**
   * Bumped every time a call finishes. Anything that was awaiting when that
   * happened compares its captured value and abandons its result — without
   * it, hanging up during a connect leaves the room joined and the microphone
   * open behind a closed screen.
   */
  const generationRef = useRef(0);

  const close = useCallback(
    (headline: string, detail: string | null) => {
      generationRef.current += 1;
      stopIncomingCallRing();
      const room = roomRef.current;
      roomRef.current = null;
      void room?.leave();
      callIdRef.current = null;
      setMuted(false);
      setElapsed(0);
      setAudioBlocked(false);
      setPhase({ kind: 'closed', headline, detail });
    },
    [setPhase],
  );

  /** Join the room for a call, honouring a hang-up that happened while we were
   * connecting. Returns false when the call is already over. */
  const enterRoom = useCallback(
    async (callId: string, token: Awaited<ReturnType<typeof api.calls.token>>) => {
      const generation = generationRef.current;
      let handle: CallRoomHandle;
      try {
        handle = await joinCallRoom({
          token,
          onExit: () => {
            if (generationRef.current !== generation) return;
            // The audio path died. End the call properly so the other side
            // stops ringing, rather than just closing this screen.
            void api.calls.end(callId).catch(() => undefined);
            close('Call failed', 'The connection dropped.');
          },
        });
      } catch (error) {
        if (generationRef.current !== generation) return false;
        void api.calls.end(callId).catch(() => undefined);
        close('Could not connect', messageOf(error) ?? 'Check your microphone permission.');
        return false;
      }

      if (generationRef.current !== generation) {
        void handle.leave();
        return false;
      }
      roomRef.current = handle;
      setAudioBlocked(!handle.canPlayAudio());
      return true;
    },
    [close],
  );

  // ── Placing a call ────────────────────────────────────────────────────────
  const place = useCallback(
    async (request: CallRequest) => {
      generationRef.current += 1;
      const generation = generationRef.current;
      setPhase({ kind: 'placing', peerName: request.peerName });

      let initiated;
      try {
        initiated =
          request.contextType === 'RIDE'
            ? await api.calls.startForRide(request.contextId)
            : await api.calls.startForDelivery(request.contextId);
      } catch (error) {
        if (generationRef.current !== generation) return;
        // "Calling is not available", "This job has ended", "Nobody is
        // assigned to this job yet" — each is the backend saying something
        // true and actionable, so show it rather than a generic failure.
        close('Could not call', messageOf(error) ?? 'Please try again.');
        return;
      }

      if (generationRef.current !== generation) {
        // Cancelled while the request was in flight. The call exists and the
        // other phone is ringing — end it.
        void api.calls.end(initiated.call.id).catch(() => undefined);
        return;
      }

      callIdRef.current = initiated.call.id;
      setPhase({ kind: 'outgoing', callId: initiated.call.id, peerName: request.peerName });

      // Join now, on the tap that placed the call, rather than waiting for the
      // answer. The microphone prompt then happens during a user gesture, and
      // the far side is audible the instant they accept instead of after a
      // connect. Nobody can hear it in the meantime: the room belongs to this
      // call alone, and the only other token that will ever be minted for it
      // is the callee's, on accept.
      await enterRoom(initiated.call.id, initiated.token);
    },
    [close, enterRoom, setPhase],
  );

  useEffect(() => onCallRequested((request) => void place(request)), [place]);

  // ── Answering ─────────────────────────────────────────────────────────────
  const answer = useCallback(
    async (callId: string, peerName: string | null) => {
      stopIncomingCallRing();
      const generation = generationRef.current;
      setPhase({ kind: 'answering', callId });

      let token;
      try {
        token = await api.calls.accept(callId);
      } catch (error) {
        if (generationRef.current !== generation) return;
        // Lost the race to a hang-up or to the ring timeout.
        close('Call ended', messageOf(error));
        return;
      }
      if (generationRef.current !== generation) return;

      if (!(await enterRoom(callId, token))) return;
      setPhase({
        kind: 'active',
        callId,
        peerName: peerName ?? 'On call',
        startedAt: Date.now(),
      });
    },
    [close, enterRoom, setPhase],
  );

  const decline = useCallback(
    (callId: string) => {
      void api.calls.decline(callId).catch(() => undefined);
      close('Call declined', null);
    },
    [close],
  );

  /** Hang up, from either side, ringing or answered. */
  const hangUp = useCallback(() => {
    const callId = callIdRef.current;
    if (callId) void api.calls.end(callId).catch(() => undefined);
    close('Call ended', null);
  }, [close]);

  // ── Socket ────────────────────────────────────────────────────────────────

  useEffect(
    () =>
      ws.onCallIncoming((event) => {
        const current = phaseRef.current;
        if (current.kind !== 'idle' && current.kind !== 'closed') {
          // Already on a call. Decline rather than stack a second ringing
          // screen over the first: the caller gets an answer instead of
          // silence, and the person talking is not interrupted.
          void api.calls.decline(event.call.id).catch(() => undefined);
          return;
        }
        generationRef.current += 1;
        callIdRef.current = event.call.id;
        startIncomingCallRing();
        setPhase({
          kind: 'incoming',
          callId: event.call.id,
          contextType: event.call.contextType,
          callerName: event.callerName,
          expiresAt: event.expiresAt,
        });
      }),
    [setPhase],
  );

  // DPX-MOBILE-002 Stage 2 — the same call, arriving the other way.
  //
  // A tapped push is how the callee learns about a call their app was closed
  // for: the socket event went out while nothing was connected to receive it.
  // The deep link has already been checked for expiry by the time this fires.
  useEffect(
    () =>
      onIncomingCallAnnounced((announcement) => {
        const current = phaseRef.current;
        if (current.kind === 'incoming' && current.callId === announcement.callId) {
          // Already ringing from the socket — the app was open after all, and
          // the push arrived alongside. Restarting would reset the ring.
          return;
        }
        if (current.kind !== 'idle' && current.kind !== 'closed') {
          void api.calls.decline(announcement.callId).catch(() => undefined);
          return;
        }
        generationRef.current += 1;
        callIdRef.current = announcement.callId;
        startIncomingCallRing();
        setPhase({
          kind: 'incoming',
          callId: announcement.callId,
          contextType: announcement.contextType,
          // The notification said who it was; the deep link does not repeat it.
          callerName: null,
          expiresAt: announcement.expiresAt,
        });
      }),
    [setPhase],
  );

  useEffect(
    () =>
      ws.onCallAccepted((event) => {
        const current = phaseRef.current;
        if (current.kind !== 'outgoing' || current.callId !== event.callId) return;
        setAudioBlocked(roomRef.current?.canPlayAudio() === false);
        setPhase({
          kind: 'active',
          callId: current.callId,
          peerName: current.peerName,
          // The server's answeredAt is the billable truth; this clock is only
          // the display, and starting it here rather than parsing that
          // timestamp keeps a skewed device clock from showing a negative
          // duration.
          startedAt: Date.now(),
        });
      }),
    [setPhase],
  );

  useEffect(
    () =>
      ws.onCallEnded((event) => {
        if (callIdRef.current !== event.callId) return;
        const outcome = outcomeOf(event);
        close(outcome.headline, outcome.detail);
      }),
    [close],
  );

  // ── Timers ────────────────────────────────────────────────────────────────

  // Ring timeout, both directions. The server closes the call itself; these
  // only stop a client whose socket died from ringing for ever.
  useEffect(() => {
    if (phase.kind === 'outgoing') {
      const callId = phase.callId;
      const timer = setTimeout(() => {
        void api.calls.end(callId).catch(() => undefined);
        close('No answer', null);
      }, RING_GIVE_UP_MS);
      return () => clearTimeout(timer);
    }
    if (phase.kind === 'incoming') {
      // The server said exactly when it stops ringing. Trust that over a local
      // constant, plus a second so the server's own `call:ended` normally wins
      // the race and gets to record it as MISSED. Falls back to the local
      // constant only when the expiry was missing or unreadable.
      const remaining =
        phase.expiresAt === null ? NaN : Date.parse(phase.expiresAt) - Date.now() + 1_000;
      const delay = Number.isFinite(remaining) ? Math.max(1_000, remaining) : RING_GIVE_UP_MS;
      const timer = setTimeout(() => close('Missed call', null), delay);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [phase, close]);

  useEffect(() => {
    if (phase.kind !== 'active') return undefined;
    const startedAt = phase.startedAt;
    setElapsed(0);
    const timer = setInterval(
      () => setElapsed(Math.round((Date.now() - startedAt) / 1_000)),
      1_000,
    );
    return () => clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (phase.kind !== 'closed') return undefined;
    const timer = setTimeout(() => setPhase({ kind: 'idle' }), OUTCOME_MS);
    return () => clearTimeout(timer);
  }, [phase, setPhase]);

  // Leaving the app mid-call must not leave the room joined and the microphone
  // live. Runs on unmount only — the ref is stable.
  useEffect(
    () => () => {
      void roomRef.current?.leave();
      roomRef.current = null;
    },
    [],
  );

  const toggleMute = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    setMuted((was) => {
      const next = !was;
      void room.setMuted(next).catch(() => undefined);
      return next;
    });
  }, []);

  if (phase.kind === 'idle') return null;

  const ringing = phase.kind === 'incoming';
  const title =
    phase.kind === 'incoming'
      ? // The name when the server sent one, which is the socket path. A push
        // deep link carries no name — the notification itself said who it was,
        // and repeating it in the URL would put it in a place it is not needed.
        (phase.callerName ?? 'Incoming call')
      : phase.kind === 'closed'
        ? phase.headline
        : phase.kind === 'answering'
          ? 'Connecting…'
          : phase.peerName;
  const subtitle =
    phase.kind === 'placing'
      ? 'Calling…'
      : phase.kind === 'outgoing'
        ? 'Ringing…'
        : phase.kind === 'incoming'
          ? incomingSubtitle(phase.callerName !== null, phase.contextType)
          : phase.kind === 'answering'
            ? null
            : phase.kind === 'active'
              ? formatCallDuration(elapsed)
              : phase.detail;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: 'fixed',
        inset: 0,
        // Above every screen, the phone frame, and the driver's ride-offer
        // sheet. A call that renders behind the thing it interrupts is worse
        // than no call at all.
        zIndex: 9999,
        background: `radial-gradient(ellipse at 50% 0%,${NAVY_SURFACE} 0%,${NAVY_BASE} 60%,#05090F 100%)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '96px 24px 64px',
      }}
    >
      <style>{`@keyframes dxCallPulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.08);opacity:.82}}`}</style>

      <div style={{ textAlign: 'center' }}>
        <div
          aria-hidden
          style={{
            width: 96,
            height: 96,
            borderRadius: '50%',
            margin: '0 auto 24px',
            background: `linear-gradient(135deg,${G0},${G2})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 38,
            animation: ringing ? 'dxCallPulse 1.4s ease-in-out infinite' : undefined,
          }}
        >
          📞
        </div>
        <p style={{ fontFamily: PP, fontSize: 22, fontWeight: 700, color: WHITE }}>{title}</p>
        {subtitle && (
          <p style={{ fontFamily: IT, fontSize: 14, color: MUTED, marginTop: 6 }}>{subtitle}</p>
        )}
      </div>

      {audioBlocked && phase.kind === 'active' ? (
        <button
          onClick={() => {
            void roomRef.current
              ?.resumeAudio()
              .then(() => setAudioBlocked(roomRef.current?.canPlayAudio() === false))
              .catch(() => undefined);
          }}
          style={{
            fontFamily: IT,
            fontSize: 13,
            color: WHITE,
            background: NAVY_SURFACE,
            border: `1px solid ${BORDER}`,
            borderRadius: 12,
            padding: '10px 16px',
            cursor: 'pointer',
          }}
        >
          Tap to hear the call
        </button>
      ) : (
        <div />
      )}

      <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
        {phase.kind === 'incoming' && (
          <>
            <RoundButton label="Decline" tone={RED} onClick={() => decline(phase.callId)}>
              ✕
            </RoundButton>
            <RoundButton
              label="Accept"
              tone={G2}
              onClick={() => void answer(phase.callId, phase.callerName)}
            >
              ✓
            </RoundButton>
          </>
        )}

        {phase.kind === 'active' && (
          <RoundButton
            label={muted ? 'Unmute' : 'Mute'}
            tone={muted ? '#334155' : NAVY_SURFACE}
            onClick={toggleMute}
          >
            {muted ? '🔇' : '🎙'}
          </RoundButton>
        )}

        {(phase.kind === 'placing' ||
          phase.kind === 'outgoing' ||
          phase.kind === 'answering' ||
          phase.kind === 'active') && (
          <RoundButton label="Hang up" tone={RED} onClick={hangUp}>
            ✕
          </RoundButton>
        )}

        {phase.kind === 'closed' && (
          <RoundButton label="Close" tone={NAVY_SURFACE} onClick={() => setPhase({ kind: 'idle' })}>
            ✕
          </RoundButton>
        )}
      </div>
    </div>
  );
}

/**
 * The line under the name on a ringing screen.
 *
 * When the name is the headline, this says what the call is about. When there
 * is no name — a call opened from a push — the headline is already "Incoming
 * call", so this says what little the deep link knew, and nothing at all when
 * it knew nothing.
 */
export function incomingSubtitle(
  named: boolean,
  contextType: CallContextType | null,
): string | null {
  if (contextType === 'RIDE') return 'About your trip';
  if (contextType === 'DELIVERY') return 'About your delivery';
  // Nothing to say about the job. With a name above it, "Incoming call" is the
  // line that makes the screen readable; without one it is already the
  // headline, and repeating it would be the whole screen saying it twice.
  return named ? 'Incoming call' : null;
}

function RoundButton({
  label,
  tone,
  onClick,
  children,
}: {
  label: string;
  tone: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{
        width: 68,
        height: 68,
        borderRadius: '50%',
        border: `1px solid ${BORDER}`,
        background: tone,
        color: WHITE,
        fontSize: 24,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </button>
  );
}
