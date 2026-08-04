import * as React from 'react';

import { useSuperAppFonts } from './fonts';

/**
 * Shared top-chrome primitives for every Ride screen, ported from the
 * locked Figma source's `ride-ui.tsx` (RideStatusBar/BackArrow/SafetyChip/
 * RideHeader). Kept as one file since they're always composed together at
 * the top of a screen — splitting them further would just add import
 * noise across 20+ Ride screens for no reuse benefit.
 */
export function SuperAppRideStatusBar(): React.JSX.Element {
  const { body } = useSuperAppFonts();
  return (
    <div
      className={`relative z-10 flex w-full items-center justify-between px-5 pt-[52px] text-[11px] ${body}`}
      style={{ color: 'rgba(255,255,255,.55)' }}
    >
      <span>9:41</span>
    </div>
  );
}

export function SuperAppRideBackArrow({ onClick }: { onClick: () => void }): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-10 w-10 items-center justify-center rounded-2xl transition-all active:scale-95"
      style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)' }}
      aria-label="Back"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ color: 'rgba(255,255,255,.7)' }}
      >
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
    </button>
  );
}

export function SuperAppRideSafetyChip(): React.JSX.Element {
  const { body } = useSuperAppFonts();
  return (
    <div
      className="flex items-center gap-1.5 rounded-full px-3 py-1.5"
      style={{ background: 'rgba(43,172,82,.12)', border: '1px solid rgba(43,172,82,.2)' }}
    >
      <span className={`text-[11px] font-semibold ${body}`} style={{ color: '#47CF72' }}>
        DrippleX Safe
      </span>
    </div>
  );
}

/**
 * Top chrome shared by every full-bleed Ride screen: status bar, an
 * optional back arrow, and optional right-side content (SafetyChip, close
 * button, etc). Centralizing it means a spacing tweak happens once, not on
 * 20+ screens.
 */
export function SuperAppRideHeader({
  onBack,
  title,
  right,
  floating,
}: {
  onBack?: (() => void) | undefined;
  title?: string | undefined;
  right?: React.ReactNode;
  /** Overlays a transparent header on top of a map/hero instead of a solid one. */
  floating?: boolean | undefined;
}): React.JSX.Element {
  const { heading } = useSuperAppFonts();
  return (
    <div className={floating ? 'absolute inset-x-0 top-0' : 'relative'}>
      <SuperAppRideStatusBar />
      <div className="mt-3 flex items-center justify-between px-5">
        <div className="flex items-center gap-3">
          {onBack ? <SuperAppRideBackArrow onClick={onBack} /> : null}
          {title ? <p className={`text-[17px] font-bold text-white ${heading}`}>{title}</p> : null}
        </div>
        <div>{right}</div>
      </div>
    </div>
  );
}
