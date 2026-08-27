// ─── DrippleX voice call — the media half ─────────────────────────────────────
//
// DPX-MOBILE-002 §3.2. Everything about *who may call whom*, who answered and
// what happened lives on the backend and travels over REST and the rides
// socket. This file knows none of that. It takes a token and a URL, joins one
// room, publishes a microphone, and reports when the audio path drops.
//
// The split is deliberate: LiveKit going down must not be able to leave a call
// row open, and DrippleX deciding a call is over must not depend on a media
// server agreeing.

import type { CallTokenDto } from '@dripplex/types';

/** Why the media session ended, as far as this layer can tell. */
export type CallRoomExit = 'peer-left' | 'disconnected' | 'failed';

export interface CallRoomHandle {
  /** Mute or unmute the microphone. Resolves once the change is published. */
  setMuted(muted: boolean): Promise<void>;
  /**
   * Whether the browser will actually play the remote audio.
   *
   * False means autoplay was refused and the person is listening to silence
   * while everything else looks connected — a UI must offer a tap that calls
   * `resumeAudio()` rather than let them think the line is dead.
   */
  canPlayAudio(): boolean;
  /** Retry blocked playback. Must be called from a user gesture. */
  resumeAudio(): Promise<void>;
  /** Leave. Idempotent, and never throws. */
  leave(): Promise<void>;
}

export interface JoinCallRoomOptions {
  token: CallTokenDto;
  /**
   * Called once when the far side is audible — both parties in the room with
   * an audio track flowing. This, not "connected", is when a caller should
   * stop hearing a ring.
   */
  onPeerAudible?: () => void;
  /**
   * Called once when the media session ends for a reason this layer saw
   * first — the peer's client vanished, or the connection failed.
   *
   * **Not authoritative.** The call is over when DrippleX says it is over
   * (`call:ended`, or the response to your own hang-up). This is a hint that
   * something went wrong with the audio, and a caller should end the call
   * properly rather than just tear down its own UI.
   */
  onExit?: (reason: CallRoomExit) => void;
}

/**
 * Warm the WebRTC chunk without joining anything.
 *
 * Call it where a call has become *possible* — a chat screen for a live job —
 * so the download happens while somebody is reading messages rather than in
 * the seconds after they tap Call. Failure is silence: this is an
 * optimisation, and `joinCallRoom` awaits the same import anyway.
 */
export function prefetchCallRoom(): void {
  void import('livekit-client').catch(() => undefined);
}

/**
 * Join the room for one call.
 *
 * Rejects if the microphone is refused or the room will not connect — the
 * caller is expected to end the call on the backend in that case, so the other
 * party stops ringing instead of waiting for a timeout.
 */
export async function joinCallRoom(options: JoinCallRoomOptions): Promise<CallRoomHandle> {
  // Loaded here rather than at the top of the file. A WebRTC stack is most of
  // a megabyte, and every DrippleX user pays for it on first load — on mobile
  // data, in the launch market — while almost none of them will place a call
  // in that session. Fetched on the tap instead, over the connection they are
  // about to hold a call on.
  const { ConnectionState, Room, RoomEvent } = await import('livekit-client');

  const room = new Room({
    // Voice only. Adaptive stream and dynacast are video features and cost a
    // little bookkeeping per participant for nothing here.
    adaptiveStream: false,
    dynacast: false,
    audioCaptureDefaults: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  let exited = false;
  const exit = (reason: CallRoomExit): void => {
    if (exited) return;
    exited = true;
    options.onExit?.(reason);
  };

  let announcedAudible = false;
  const announceAudible = (): void => {
    if (announcedAudible) return;
    announcedAudible = true;
    options.onPeerAudible?.();
  };

  room.on(RoomEvent.TrackSubscribed, () => {
    // livekit-client plays remote audio itself; there is no element to attach.
    // What this tells us is that there is now something to hear.
    announceAudible();
  });

  room.on(RoomEvent.ParticipantDisconnected, () => {
    if (room.numParticipants === 0) exit('peer-left');
  });

  room.on(RoomEvent.Disconnected, () => {
    exit('disconnected');
  });

  room.on(RoomEvent.ConnectionStateChanged, (state) => {
    // `Reconnecting` is not a failure — LiveKit recovers from a network
    // change on its own, and tearing the call down on a passing tunnel would
    // be worse than the silence.
    if (state === ConnectionState.Disconnected) exit('disconnected');
  });

  try {
    await room.connect(options.token.url, options.token.token);
    // After connect, not before: publishing to a room you have not joined
    // queues the track and hides a connect failure behind a microphone prompt.
    await room.localParticipant.setMicrophoneEnabled(true);
  } catch (error) {
    exited = true; // The caller is being told by the rejection; don't also call onExit.
    await room.disconnect().catch(() => undefined);
    throw error;
  }

  // Autoplay may already be permitted — this joined from a tap, and
  // getUserMedia has just run. Ask anyway; it is free when it is allowed.
  await room.startAudio().catch(() => undefined);

  // The peer may already have been in the room when we joined, in which case
  // TrackSubscribed for their microphone has fired before these handlers could
  // matter. Check once, now.
  if (room.numParticipants > 0) announceAudible();

  return {
    async setMuted(muted: boolean) {
      await room.localParticipant.setMicrophoneEnabled(!muted);
    },
    canPlayAudio: () => room.canPlaybackAudio,
    resumeAudio: () => room.startAudio(),
    async leave() {
      exited = true; // Leaving on purpose is not an exit to report back.
      await room.disconnect().catch(() => undefined);
    },
  };
}
