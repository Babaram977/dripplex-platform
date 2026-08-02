/** Small browser-API wrappers for reacting to a foreground push. Each one
 * is a best-effort enhancement — unsupported browsers/permissions are
 * silent no-ops, never a thrown error that could break the notification
 * flow itself. */

/** A short synthesized chime via Web Audio — no audio asset file exists
 * in this repo (Phase C explicitly deferred real sound files), so this
 * generates a real tone rather than referencing a file that isn't there. */
export function playNotificationChime(): void {
  if (typeof window === 'undefined') {
    return;
  }
  const windowWithWebkit = window as typeof window & { webkitAudioContext?: typeof AudioContext };
  const AudioContextCtor: typeof AudioContext | undefined =
    'AudioContext' in window ? window.AudioContext : windowWithWebkit.webkitAudioContext;
  if (!AudioContextCtor) {
    return;
  }
  try {
    const ctx = new AudioContextCtor();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.3);
    oscillator.onended = () => {
      void ctx.close();
    };
  } catch {
    // Autoplay policy or an unsupported browser — skip the chime.
  }
}

export function vibrateForNotification(): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
    return;
  }
  navigator.vibrate([80, 40, 80]);
}

interface BadgeNavigator {
  setAppBadge?: (count?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
}

/** Web App Badging API — sets the OS-level icon badge (installed PWA /
 * Capacitor-wrapped app). Unsupported in most desktop browsers today;
 * that's an expected no-op, not a bug. */
export async function setAppBadgeCount(count: number): Promise<void> {
  if (typeof navigator === 'undefined') {
    return;
  }
  const badgeNavigator = navigator as Navigator & BadgeNavigator;
  try {
    if (count > 0 && 'setAppBadge' in badgeNavigator) {
      await badgeNavigator.setAppBadge(count);
    } else if ('clearAppBadge' in badgeNavigator) {
      await badgeNavigator.clearAppBadge();
    }
  } catch {
    // Badging API not supported/permitted — nothing to fall back to.
  }
}
