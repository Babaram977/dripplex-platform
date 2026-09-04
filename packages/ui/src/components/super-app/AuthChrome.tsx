import * as React from 'react';

import { SuperAppStatusBarIcons } from './StatusBarIcons';

/**
 * Ported from the locked Figma Make `shared.tsx`'s `Ambient` — the soft
 * radial-glow + faint grid background used behind every Auth screen
 * (Splash/Welcome/Register/OTP/...). Ported per-module rather than force-
 * reused across screens that don't share it, same discipline as Ride/Wallet.
 */
export function SuperAppAuthAmbient(): React.JSX.Element {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div
        className="absolute -right-28 -top-28 h-80 w-80 rounded-full"
        style={{
          background: 'radial-gradient(circle,#2BAC52 0%,transparent 70%)',
          opacity: 0.14,
        }}
      />
      <div
        className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full"
        style={{
          background: 'radial-gradient(circle,#176B30 0%,transparent 70%)',
          opacity: 0.1,
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          opacity: 0.027,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
    </div>
  );
}

/**
 * Ported from `shared.tsx`'s `StatusBar` -- reuses the already-ported
 * `SuperAppStatusBarIcons` signal/wifi/battery group (see that file's note
 * on the source's own sizing inconsistency between `shared.tsx` and
 * `homeScreen.tsx`; Auth screens use the `shared.tsx` values, which is what
 * this component renders at their original, unscaled size).
 */
export function SuperAppAuthStatusBar(): React.JSX.Element {
  return (
    <div
      className="relative z-10 flex w-full items-center justify-between px-7 pt-[52px]"
      style={{ fontSize: 11, color: 'rgba(255,255,255,.28)' }}
    >
      <SuperAppStatusBarIcons />
    </div>
  );
}

/** Chevron + "Back" label, top-left of every Auth screen below the status bar. */
export function SuperAppAuthBackButton({
  onBack,
  label = 'Back',
}: {
  onBack: () => void;
  label?: string;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onBack}
      className="flex items-center gap-2 text-sm transition-all active:scale-95"
      style={{ color: 'rgba(255,255,255,.38)', minHeight: 48 }}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
      {label}
    </button>
  );
}
