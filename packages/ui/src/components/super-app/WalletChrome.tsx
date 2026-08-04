import * as React from 'react';

import { useSuperAppFonts } from './fonts';

/**
 * Wallet's own status bar — visually close to but not identical to Ride's
 * (fuller icon set: filled signal/wifi + bordered battery, vs Ride's plain
 * "9:41" text). Ported per-module rather than force-reused, same
 * discipline already applied across the Ride slices.
 */
export function SuperAppWalletStatusBar(): React.JSX.Element {
  const { body } = useSuperAppFonts();
  return (
    <div
      className="flex items-center justify-between px-5"
      style={{ paddingTop: 14, paddingBottom: 4 }}
    >
      <span
        className={`text-[12px] font-semibold ${body}`}
        style={{ color: 'rgba(255,255,255,.9)' }}
      >
        9:41
      </span>
      <div className="flex items-center gap-1">
        <svg width="16" height="11" viewBox="0 0 16 11" fill="none">
          <rect x="0" y="7" width="3" height="4" rx=".5" fill="rgba(255,255,255,.9)" />
          <rect x="4.5" y="4.5" width="3" height="6.5" rx=".5" fill="rgba(255,255,255,.9)" />
          <rect x="9" y="2" width="3" height="9" rx=".5" fill="rgba(255,255,255,.9)" />
          <rect x="13.5" y="0" width="2.5" height="11" rx=".5" fill="rgba(255,255,255,.9)" />
        </svg>
        <svg width="15" height="11" viewBox="0 0 15 11" fill="none">
          <path d="M7.5 8.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2z" fill="rgba(255,255,255,.9)" />
          <path
            d="M4.2 6.3a4.7 4.7 0 0 1 6.6 0"
            stroke="rgba(255,255,255,.9)"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
          <path
            d="M1.5 3.5a8.2 8.2 0 0 1 12 0"
            stroke="rgba(255,255,255,.9)"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
        <div className="flex items-center gap-px">
          <div
            className="flex items-center"
            style={{
              width: 22,
              height: 11,
              border: '1.5px solid rgba(255,255,255,.7)',
              borderRadius: 3,
              padding: 1.5,
            }}
          >
            <div
              style={{
                width: '76%',
                height: '100%',
                background: 'rgba(255,255,255,.9)',
                borderRadius: 1.5,
              }}
            />
          </div>
          <div
            style={{
              width: 2,
              height: 5,
              background: 'rgba(255,255,255,.5)',
              borderRadius: '0 1px 1px 0',
            }}
          />
        </div>
      </div>
    </div>
  );
}

/** Chevron back button with an optional label, used on every Wallet sub-screen. */
export function SuperAppWalletBackButton({
  onBack,
  label,
}: {
  onBack: () => void;
  label?: string | undefined;
}): React.JSX.Element {
  const { body } = useSuperAppFonts();
  return (
    <button
      type="button"
      onClick={onBack}
      className="flex items-center gap-2"
      style={{ padding: '8px 16px 8px 16px' }}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path
          d="M12.5 15L7.5 10l5-5"
          stroke="white"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {label ? (
        <span
          className={`text-[14px] font-medium ${body}`}
          style={{ color: 'rgba(255,255,255,.8)' }}
        >
          {label}
        </span>
      ) : null}
    </button>
  );
}

/** Back-chevron + bold title header used at the top of every Wallet sub-screen. */
export function SuperAppWalletScreenHeader({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}): React.JSX.Element {
  const { heading } = useSuperAppFonts();
  return (
    <div className="flex items-center gap-2 px-2" style={{ paddingBottom: 8 }}>
      <SuperAppWalletBackButton onBack={onBack} />
      <span className={`text-[18px] font-bold text-white ${heading}`}>{title}</span>
    </div>
  );
}
