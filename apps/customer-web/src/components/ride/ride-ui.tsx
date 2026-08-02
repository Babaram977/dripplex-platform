'use client';

import * as React from 'react';

/**
 * Shared visual primitives ported from the real Figma Make source
 * (docs/reference/rideScreen-figma-make-source.tsx) — colors, spacing, and
 * typography preserved exactly. Do not redesign; only extend when a new
 * screen genuinely needs a new primitive.
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

export function GreenButton({
  label,
  onClick,
  disabled,
  loading,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}): React.JSX.Element {
  const inactive = Boolean(disabled) || Boolean(loading);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={inactive}
      className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold transition-all duration-200 active:scale-[.97]"
      style={{
        fontFamily: "'Poppins',sans-serif",
        background: inactive
          ? 'rgba(255,255,255,.06)'
          : 'linear-gradient(135deg,#176B30 0%,#2BAC52 52%,#47CF72 100%)',
        color: inactive ? 'rgba(255,255,255,.22)' : '#fff',
        boxShadow: inactive
          ? 'none'
          : '0 10px 36px rgba(43,172,82,.36),0 0 0 1px rgba(43,172,82,.24)',
      }}
    >
      {loading ? 'Please wait…' : label}
    </button>
  );
}

export function BottomSheet({
  children,
  title,
  peek,
}: {
  children: React.ReactNode;
  title?: string;
  peek?: boolean;
}): React.JSX.Element {
  return (
    <div
      className="relative z-10 flex flex-1 flex-col"
      style={{
        background: '#0A1628',
        borderRadius: peek ? '28px 28px 0 0' : 0,
        boxShadow: peek ? '0 -24px 80px rgba(0,0,0,.7)' : 'none',
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
 * Decorative route illustration — NOT a real map. The real Figma Make
 * source's own implementation notes call for "Replace MapCanvas SVG with
 * Google Maps SDK", but no Maps SDK key/integration exists anywhere in this
 * codebase (capability gap, not silently faked). Kept as the same
 * decorative SVG the design specifies until real map integration lands.
 */
export function MapCanvas({
  variant = 'default',
}: {
  variant?: 'default' | 'finding' | 'assigned';
}): React.JSX.Element {
  const routes: Record<
    'default' | 'finding' | 'assigned',
    { cx: number; cy: number; dx: number; dy: number }
  > = {
    default: { cx: 100, cy: 240, dx: 290, dy: 100 },
    finding: { cx: 100, cy: 220, dx: 290, dy: 120 },
    assigned: { cx: 80, cy: 250, dx: 300, dy: 90 },
  };
  const r = routes[variant];
  const midX = (r.cx + r.dx) / 2;
  const midY = (r.cy + r.dy) / 2 - 60;
  const pathD = `M${String(r.cx)},${String(r.cy)} Q${String(midX)},${String(midY)} ${String(r.dx)},${String(r.dy)}`;
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
