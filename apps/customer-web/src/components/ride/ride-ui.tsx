'use client';

import * as React from 'react';

/**
 * Shared visual primitives for every Ride screen — ported from the real
 * Figma Make source (docs/reference/rideScreen-figma-make-source.tsx) where
 * a screen was received, or extended from that same design language where
 * one wasn't (see docs/RIDE-003-GENERATED-SCREENS.md). Colors, spacing, and
 * typography are locked; do not redesign. Screen components should compose
 * these rather than re-implement card/button/sheet markup inline — that's
 * what keeps 31 screens feeling like one product instead of a pile of
 * one-off pages.
 */

export function RideStatusBar(): React.JSX.Element {
  return (
    <div
      className="relative z-10 flex w-full items-center justify-between px-5 pt-[52px]"
      style={{ fontFamily: "'Inter',sans-serif", fontSize: 11, color: 'rgba(255,255,255,.55)' }}
    >
      <span>9:41</span>
    </div>
  );
}

export function BackArrow({ onClick }: { onClick: () => void }): React.JSX.Element {
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

export function SafetyChip(): React.JSX.Element {
  return (
    <div
      className="flex items-center gap-1.5 rounded-full px-3 py-1.5"
      style={{ background: 'rgba(43,172,82,.12)', border: '1px solid rgba(43,172,82,.2)' }}
    >
      <span
        style={{
          fontFamily: "'Inter',sans-serif",
          fontSize: 11,
          color: '#47CF72',
          fontWeight: 600,
        }}
      >
        DrippleX Safe
      </span>
    </div>
  );
}

/**
 * Top chrome shared by every full-bleed Ride screen: status bar, an
 * optional back arrow, and optional right-side content (SafetyChip, close
 * button, etc). Screens previously hand-rolled this positioning; centralizing
 * it means a spacing tweak happens once, not on 20+ screens.
 */
export function RideHeader({
  onBack,
  title,
  right,
  floating,
}: {
  onBack?: () => void;
  title?: string;
  right?: React.ReactNode;
  /** Overlays a transparent header on top of a map/hero instead of a solid one. */
  floating?: boolean;
}): React.JSX.Element {
  return (
    <div className={floating ? 'absolute inset-x-0 top-0' : 'relative'}>
      <RideStatusBar />
      <div className="mt-3 flex items-center justify-between px-5">
        <div className="flex items-center gap-3">
          {onBack ? <BackArrow onClick={onBack} /> : null}
          {title ? (
            <p
              className="text-[17px] font-bold"
              style={{ fontFamily: "'Poppins',sans-serif", color: '#fff' }}
            >
              {title}
            </p>
          ) : null}
        </div>
        <div>{right}</div>
      </div>
    </div>
  );
}

export function ActionButton({
  label,
  onClick,
  disabled,
  loading,
  variant = 'primary',
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
}): React.JSX.Element {
  const inactive = Boolean(disabled) || Boolean(loading);
  const styles: Record<string, React.CSSProperties> = {
    primary: {
      background: inactive
        ? 'rgba(255,255,255,.06)'
        : 'linear-gradient(135deg,#176B30 0%,#2BAC52 52%,#47CF72 100%)',
      color: inactive ? 'rgba(255,255,255,.22)' : '#fff',
      boxShadow: inactive
        ? 'none'
        : '0 10px 36px rgba(43,172,82,.36),0 0 0 1px rgba(43,172,82,.24)',
      border: 'none',
    },
    secondary: {
      background: '#112238',
      color: inactive ? 'rgba(255,255,255,.22)' : 'rgba(255,255,255,.8)',
      border: '1px solid rgba(255,255,255,.08)',
      boxShadow: 'none',
    },
    danger: {
      background: 'rgba(239,68,68,.08)',
      color: inactive ? 'rgba(239,68,68,.3)' : '#EF4444',
      border: '1px solid rgba(239,68,68,.2)',
      boxShadow: 'none',
    },
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={inactive}
      className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold transition-all duration-200 active:scale-[.97]"
      style={{ fontFamily: "'Poppins',sans-serif", ...styles[variant] }}
    >
      {loading ? 'Please wait…' : label}
    </button>
  );
}

/** Compact icon-over-label button used in 2-4 button quick-action rows (Call/Chat/Cancel/Share/SOS). */
export function QuickActionButton({
  icon,
  label,
  onClick,
  disabled,
  tone = 'neutral',
}: {
  icon: string;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  tone?: 'neutral' | 'danger';
}): React.JSX.Element {
  const danger = tone === 'danger';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled ?? !onClick}
      className="flex flex-1 flex-col items-center gap-1 rounded-2xl py-2.5 disabled:opacity-40"
      style={{
        background: danger ? 'rgba(239,68,68,.08)' : '#112238',
        border: `1px solid ${danger ? 'rgba(239,68,68,.15)' : 'rgba(255,255,255,.08)'}`,
      }}
    >
      <span style={{ fontSize: 16 }}>{icon}</span>
      <p
        className="text-[11px]"
        style={{
          fontFamily: "'Inter',sans-serif",
          color: danger ? '#EF4444' : 'rgba(255,255,255,.6)',
        }}
      >
        {label}
      </p>
    </button>
  );
}

export function RideBottomSheet({
  children,
  title,
  peek,
  anchored,
}: {
  children: React.ReactNode;
  title?: string;
  peek?: boolean;
  /** Fixed to the bottom over a full-bleed map instead of filling the rest of the screen. */
  anchored?: boolean;
}): React.JSX.Element {
  return (
    <div
      className={
        anchored ? 'absolute inset-x-0 bottom-0 z-10' : 'relative z-10 flex flex-1 flex-col'
      }
      style={{
        background: '#0A1628',
        borderRadius: '28px 28px 0 0',
        boxShadow: '0 -24px 80px rgba(0,0,0,.7)',
      }}
    >
      {peek ? (
        <div className="flex justify-center pb-1 pt-3">
          <div className="h-1 w-10 rounded-full" style={{ background: 'rgba(255,255,255,.15)' }} />
        </div>
      ) : null}
      {title ? (
        <p
          className="px-5 pb-2 pt-4 text-[17px] font-bold"
          style={{ fontFamily: "'Poppins',sans-serif", color: '#fff' }}
        >
          {title}
        </p>
      ) : null}
      {children}
    </div>
  );
}

export function StatusBanner({
  title,
  subtitle,
  tone = 'neutral',
}: {
  title: string;
  subtitle?: string;
  tone?: 'neutral' | 'success' | 'error';
}): React.JSX.Element {
  const titleColor = tone === 'success' ? '#47CF72' : tone === 'error' ? '#EF4444' : '#fff';
  return (
    <div className="text-center">
      <p
        className="mb-1 text-[20px] font-bold"
        style={{ fontFamily: "'Poppins',sans-serif", color: titleColor }}
      >
        {title}
      </p>
      {subtitle ? (
        <p
          className="text-[14px]"
          style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.38)' }}
        >
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

export function ETAChip({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div
      className="flex flex-col items-center gap-1 rounded-2xl px-3 py-2"
      style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
    >
      <p
        className="text-[13px] font-bold"
        style={{ fontFamily: "'Poppins',sans-serif", color: '#47CF72' }}
      >
        {value}
      </p>
      <p
        className="text-[10px]"
        style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.38)' }}
      >
        {label}
      </p>
    </div>
  );
}

export function FareBreakdown({
  baseFare,
  distanceFare,
  timeFare,
  totalFare,
}: {
  baseFare: number;
  distanceFare: number;
  timeFare: number;
  totalFare: number;
}): React.JSX.Element {
  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
    >
      {(
        [
          ['Base fare', baseFare],
          ['Distance', distanceFare],
          ['Time', timeFare],
        ] as const
      ).map(([labelText, amount]) => (
        <div key={labelText} className="mb-2 flex justify-between">
          <p
            className="text-[13px]"
            style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.6)' }}
          >
            {labelText}
          </p>
          <p
            className="text-[13px] font-medium"
            style={{ fontFamily: "'Inter',sans-serif", color: '#fff' }}
          >
            ₦{amount.toLocaleString()}
          </p>
        </div>
      ))}
      <div className="my-2 h-px" style={{ background: 'rgba(255,255,255,.08)' }} />
      <div className="flex justify-between">
        <p
          className="text-[14px] font-bold"
          style={{ fontFamily: "'Poppins',sans-serif", color: '#fff' }}
        >
          Total
        </p>
        <p
          className="text-[18px] font-bold"
          style={{ fontFamily: "'Poppins',sans-serif", color: '#47CF72' }}
        >
          ₦{totalFare.toLocaleString()}
        </p>
      </div>
    </div>
  );
}

/**
 * Driver identity card — deliberately honest about a real capability gap.
 * The real backend has no customer-facing driver-profile endpoint and no
 * vehicle make/model/color/plate/photo fields anywhere in its schema (only
 * `admin` and the driver's own `driver` controller can read DriverProfileDto
 * — see docs/RIDE-003-INTEGRATION-MAP.md and docs/RIDE-003-SLICE-2.md).
 * The only real data for an active ride is `RideDto.driverId` (an opaque
 * id) and live location over the socket. This card shows that honestly
 * instead of fabricating a name, photo, rating, or vehicle like the mock
 * data does — it is a documented integration placeholder, not a dead end:
 * every field below activates the moment the backend exposes it.
 */
export function DriverCard({ onViewProfile }: { onViewProfile?: () => void }): React.JSX.Element {
  const content = (
    <div className="flex items-center gap-4">
      <div
        className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl text-2xl"
        style={{ background: 'rgba(43,172,82,.12)' }}
      >
        🚗
      </div>
      <div className="flex-1">
        <p
          className="text-[15px] font-bold"
          style={{ fontFamily: "'Poppins',sans-serif", color: '#fff' }}
        >
          Your driver
        </p>
        <p
          className="text-[12px]"
          style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.38)' }}
        >
          Name, photo, and vehicle details aren&apos;t available yet — pending a backend
          driver-profile endpoint
        </p>
      </div>
    </div>
  );
  if (!onViewProfile) {
    return (
      <div
        className="rounded-2xl p-4"
        style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
      >
        {content}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onViewProfile}
      className="w-full rounded-2xl p-4 text-left"
      style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
    >
      {content}
    </button>
  );
}

/**
 * Decorative route illustration — NOT a real map. The real Figma Make
 * source's own implementation notes call for "Replace MapCanvas SVG with
 * Google Maps SDK", but no Maps SDK key/integration exists anywhere in this
 * codebase (capability gap, not silently faked). Kept as the same
 * decorative SVG the design specifies until real map integration lands —
 * the container, camera framing, and marker placement are preserved so
 * swapping in a real map later is a drop-in replacement, not a redesign.
 */
export function MapCanvas({
  variant = 'default',
  progress = 0,
}: {
  variant?: 'default' | 'finding' | 'assigned' | 'inprogress';
  /** 0-1, draws a partial route to represent trip completion so far. */
  progress?: number;
}): React.JSX.Element {
  const routes: Record<
    'default' | 'finding' | 'assigned' | 'inprogress',
    { cx: number; cy: number; dx: number; dy: number }
  > = {
    default: { cx: 100, cy: 240, dx: 290, dy: 100 },
    finding: { cx: 100, cy: 220, dx: 290, dy: 120 },
    assigned: { cx: 80, cy: 250, dx: 300, dy: 90 },
    inprogress: { cx: 60, cy: 260, dx: 320, dy: 80 },
  };
  const r = routes[variant];
  const midX = (r.cx + r.dx) / 2;
  const midY = (r.cy + r.dy) / 2 - 60;
  const pathD = `M${String(r.cx)},${String(r.cy)} Q${String(midX)},${String(midY)} ${String(r.dx)},${String(r.dy)}`;
  const filled = Math.round(280 * Math.max(0, Math.min(1, progress)));
  return (
    <svg width="390" height="320" viewBox="0 0 390 320" style={{ display: 'block' }}>
      <rect width="390" height="320" fill="#0D1B2E" />
      <line x1="0" y1="180" x2="390" y2="180" stroke="rgba(255,255,255,.07)" strokeWidth="2.5" />
      <line x1="195" y1="0" x2="195" y2="320" stroke="rgba(255,255,255,.07)" strokeWidth="2.5" />
      <path
        d={pathD}
        fill="none"
        stroke="rgba(43,172,82,.12)"
        strokeWidth="12"
        strokeLinecap="round"
      />
      <path
        d={pathD}
        fill="none"
        stroke="rgba(43,172,82,.25)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray="8 4"
      />
      {progress > 0 ? (
        <path
          d={pathD}
          fill="none"
          stroke="#2BAC52"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${String(filled)} 280`}
        />
      ) : null}
      <circle cx={r.cx} cy={r.cy} r="10" fill="#2BAC52" opacity=".2" />
      <circle cx={r.cx} cy={r.cy} r="5" fill="#2BAC52" />
      <circle cx={r.cx} cy={r.cy} r="3" fill="#fff" />
      <circle cx={r.dx} cy={r.dy} r="14" fill="rgba(43,172,82,.15)" />
      <circle cx={r.dx} cy={r.dy} r="8" fill="#2BAC52" />
      <circle cx={r.dx} cy={r.dy} r="4" fill="#fff" />
      <rect x={r.dx - 1.5} y={r.dy - 28} width="3" height="20" rx="1.5" fill="#2BAC52" />
      <defs>
        <linearGradient id="mapFade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0A1628" stopOpacity="0" />
          <stop offset="100%" stopColor="#0A1628" stopOpacity="1" />
        </linearGradient>
      </defs>
      <rect width="390" height="320" fill="url(#mapFade)" />
    </svg>
  );
}
