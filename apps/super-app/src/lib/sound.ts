/**
 * Notification sounds.
 *
 * Founder request (2026-08-18): every activity that needs attention — a new
 * order, a delivery, a ride request, a successful payment — should make a
 * sound, with an on/off switch and a choice of sounds.
 *
 * ── Why the sounds are synthesised, not audio files ────────────────────────
 * Each sound below is generated with the Web Audio API rather than shipped as
 * an mp3. That is deliberate: no binary assets to add to the bundle, nothing to
 * fetch at the moment it needs to play (a driver on a weak Kano connection
 * would otherwise hear the alert late or not at all), and the sounds work
 * offline. If the founder later commissions real audio, `play()` is the one
 * place that changes.
 *
 * ── Why the preference is device-local ─────────────────────────────────────
 * The backend has a NotificationPreference model, but it is channel × type
 * (push/email/sms × event) — about whether to *send* you something. Which
 * sound your handset makes, and whether it makes one at all, is a property of
 * the handset: a driver may want alerts loud on the work phone and silent on
 * the one at home. So this lives in localStorage, per device. If the founder
 * wants it to follow the account across devices, that is a backend field and a
 * deliberate change, not an oversight.
 *
 * ── Autoplay ───────────────────────────────────────────────────────────────
 * Browsers refuse to play audio until the user has interacted with the page.
 * `unlock()` is called on the first touch or click and resumes the context;
 * until then `play()` is a no-op rather than an error. `isBlocked()` lets a
 * settings screen tell the truth about it instead of showing a toggle that
 * silently does nothing.
 */

export type SoundId = 'chime' | 'ping' | 'bell' | 'alert' | 'drop';

/** What happened. Kept as intent rather than sound name so a caller never has
 * to know which tone the user picked — and so an urgent event can be made
 * louder or longer later without touching every call site. */
export type SoundEvent = 'new-request' | 'status-change' | 'success' | 'warning';

interface ToneStep {
  /** Hz. */
  frequency: number;
  /** Seconds from the start of the sound. */
  at: number;
  /** Seconds. */
  duration: number;
  type?: OscillatorType;
}

export interface SoundDefinition {
  id: SoundId;
  label: string;
  description: string;
  steps: ToneStep[];
}

/**
 * Five deliberately distinguishable sounds. They differ in shape, not only
 * pitch — a rising pair, a single blip, a struck bell, an insistent triple,
 * and a falling pair — because someone glancing away needs to tell an incoming
 * job from a completed payment by ear alone.
 */
export const SOUND_LIBRARY: SoundDefinition[] = [
  {
    id: 'chime',
    label: 'Chime',
    description: 'Two rising notes — the default',
    steps: [
      { frequency: 784, at: 0, duration: 0.16 },
      { frequency: 1047, at: 0.14, duration: 0.28 },
    ],
  },
  {
    id: 'ping',
    label: 'Ping',
    description: 'One short, bright blip',
    steps: [{ frequency: 1319, at: 0, duration: 0.16 }],
  },
  {
    id: 'bell',
    label: 'Bell',
    description: 'A struck bell with a long tail',
    steps: [
      { frequency: 880, at: 0, duration: 0.7 },
      { frequency: 1760, at: 0, duration: 0.35 },
    ],
  },
  {
    id: 'alert',
    label: 'Alert',
    description: 'Three insistent tones — hardest to miss',
    steps: [
      { frequency: 988, at: 0, duration: 0.12, type: 'square' },
      { frequency: 988, at: 0.18, duration: 0.12, type: 'square' },
      { frequency: 988, at: 0.36, duration: 0.16, type: 'square' },
    ],
  },
  {
    id: 'drop',
    label: 'Drop',
    description: 'Two falling notes — quiet and low',
    steps: [
      { frequency: 659, at: 0, duration: 0.16 },
      { frequency: 440, at: 0.14, duration: 0.3 },
    ],
  },
];

export const DEFAULT_SOUND: SoundId = 'chime';

export interface SoundPreference {
  enabled: boolean;
  sound: SoundId;
}

const STORAGE_KEY = 'dx_sound_pref';

function isSoundId(value: unknown): value is SoundId {
  return SOUND_LIBRARY.some((definition) => definition.id === value);
}

export function readSoundPreference(): SoundPreference {
  // On by default. A driver who misses a job because the platform decided to
  // start silent has been failed by the default, not by their settings.
  const fallback: SoundPreference = { enabled: true, sound: DEFAULT_SOUND };
  if (typeof localStorage === 'undefined') return fallback;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return fallback;
    const record = parsed as { enabled?: unknown; sound?: unknown };
    return {
      enabled: typeof record.enabled === 'boolean' ? record.enabled : true,
      sound: isSoundId(record.sound) ? record.sound : DEFAULT_SOUND,
    };
  } catch {
    // A corrupt preference must not take the sound system down with it.
    return fallback;
  }
}

export function writeSoundPreference(preference: SoundPreference): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preference));
  } catch {
    // Private-mode storage quotas — the sound still plays this session.
  }
}

// ── Audio engine ────────────────────────────────────────────────────────────

type AudioContextConstructor = new () => AudioContext;

let context: AudioContext | null = null;
let unlocked = false;

function audioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === 'undefined') return null;
  const scope = window as unknown as {
    AudioContext?: AudioContextConstructor;
    webkitAudioContext?: AudioContextConstructor;
  };
  return scope.AudioContext ?? scope.webkitAudioContext ?? null;
}

/** True when the browser supports audio at all. Distinct from `isBlocked()` —
 * a browser with no Web Audio can never play, whatever the user does. */
export function isSupported(): boolean {
  return audioContextConstructor() !== null;
}

/**
 * Whether sounds are still waiting on a first interaction.
 *
 * Surfaced so a settings screen can say "tap anything to enable" rather than
 * present a working-looking toggle that produces silence.
 */
export function isBlocked(): boolean {
  return isSupported() && !unlocked;
}

/**
 * Resume the audio context. Safe to call repeatedly; call it from the first
 * user gesture. Returns whether audio is now usable.
 */
export function unlock(): boolean {
  const Ctor = audioContextConstructor();
  if (!Ctor) return false;

  context ??= new Ctor();
  if (context.state === 'suspended') {
    void context.resume().catch(() => undefined);
  }
  unlocked = context.state !== 'suspended';
  return unlocked;
}

/** Attaches the one-time unlock to the first pointer or key event. Returns a
 * teardown so a caller can detach it. */
export function installUnlockListener(): () => void {
  if (typeof window === 'undefined') return () => undefined;

  const handler = (): void => {
    unlock();
  };
  window.addEventListener('pointerdown', handler, { once: false, passive: true });
  window.addEventListener('keydown', handler, { once: false, passive: true });
  return () => {
    window.removeEventListener('pointerdown', handler);
    window.removeEventListener('keydown', handler);
  };
}

function playDefinition(definition: SoundDefinition, volume: number): void {
  const Ctor = audioContextConstructor();
  if (!Ctor) return;
  context ??= new Ctor();
  if (context.state === 'suspended') {
    // Not yet unlocked. Silence beats an unhandled rejection every time a job
    // arrives before the driver has touched the screen.
    void context.resume().catch(() => undefined);
    if (context.state === 'suspended') return;
  }
  unlocked = true;

  const now = context.currentTime;
  for (const step of definition.steps) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = step.type ?? 'sine';
    oscillator.frequency.value = step.frequency;

    // A short attack and an exponential decay: a raw square wave switched on
    // and off clicks audibly, which reads as a fault rather than an alert.
    const start = now + step.at;
    const end = start + step.duration;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(end + 0.02);
  }
}

/** Volume per event. A new job is the one a driver must not miss; a status
 * change is a nudge, not an interruption. */
const VOLUME_BY_EVENT: Record<SoundEvent, number> = {
  'new-request': 0.22,
  'status-change': 0.12,
  success: 0.16,
  warning: 0.2,
};

/**
 * Play the user's chosen sound for an event.
 *
 * Never throws. A notification sound failing must never take down the screen
 * that was trying to tell somebody their driver had arrived.
 */
export function playNotificationSound(event: SoundEvent = 'new-request'): void {
  try {
    const preference = readSoundPreference();
    if (!preference.enabled) return;
    const definition =
      SOUND_LIBRARY.find((entry) => entry.id === preference.sound) ?? SOUND_LIBRARY[0];
    if (!definition) return;
    playDefinition(definition, VOLUME_BY_EVENT[event]);
  } catch {
    // Deliberately swallowed — see above.
  }
}

/** Plays one sound by id at a fixed volume, for the picker. Ignores the
 * enabled flag: previewing is how you decide whether to turn it on. */
export function previewSound(id: SoundId): void {
  try {
    const definition = SOUND_LIBRARY.find((entry) => entry.id === id);
    if (definition) playDefinition(definition, 0.2);
  } catch {
    // As above.
  }
}
