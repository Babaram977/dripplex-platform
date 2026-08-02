import * as React from 'react';

/**
 * Decorative route illustration — NOT a real map. Ported from
 * customer-web's identical component (components/ride/ride-ui.tsx), which
 * documents the real gap: no Google Maps SDK key/integration exists
 * anywhere in this codebase. Kept as a placeholder with the same container/
 * framing contract so a real map is a drop-in replacement later, not a
 * redesign. Real navigation for the driver is handled separately via a
 * device-Maps deep link (see lib/maps.ts), which needs no SDK key.
 */
export function MapCanvas({
  variant = 'assigned',
  progress = 0,
}: {
  variant?: 'assigned' | 'arrived' | 'inprogress';
  /** 0-1, draws a partial route to represent trip completion so far. */
  progress?: number;
}): React.JSX.Element {
  const routes: Record<
    'assigned' | 'arrived' | 'inprogress',
    { cx: number; cy: number; dx: number; dy: number }
  > = {
    assigned: { cx: 80, cy: 250, dx: 300, dy: 90 },
    arrived: { cx: 100, cy: 240, dx: 100, dy: 240 },
    inprogress: { cx: 60, cy: 260, dx: 320, dy: 80 },
  };
  const r = routes[variant];
  const midX = (r.cx + r.dx) / 2;
  const midY = (r.cy + r.dy) / 2 - 60;
  const pathD = `M${String(r.cx)},${String(r.cy)} Q${String(midX)},${String(midY)} ${String(r.dx)},${String(r.dy)}`;
  const filled = Math.round(280 * Math.max(0, Math.min(1, progress)));

  return (
    <svg
      viewBox="0 0 390 320"
      preserveAspectRatio="xMidYMid slice"
      className="h-full w-full"
      style={{ display: 'block' }}
    >
      <rect width="390" height="320" fill="#0D1B2E" />
      <line x1="0" y1="180" x2="390" y2="180" stroke="rgba(255,255,255,.07)" strokeWidth="2.5" />
      <line x1="195" y1="0" x2="195" y2="320" stroke="rgba(255,255,255,.07)" strokeWidth="2.5" />
      {variant !== 'arrived' ? (
        <>
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
        </>
      ) : null}
      <circle cx={r.cx} cy={r.cy} r="10" fill="#2BAC52" opacity=".2" />
      <circle cx={r.cx} cy={r.cy} r="5" fill="#2BAC52" />
      <circle cx={r.cx} cy={r.cy} r="3" fill="#fff" />
      {variant !== 'arrived' ? (
        <>
          <circle cx={r.dx} cy={r.dy} r="14" fill="rgba(43,172,82,.15)" />
          <circle cx={r.dx} cy={r.dy} r="8" fill="#2BAC52" />
          <circle cx={r.dx} cy={r.dy} r="4" fill="#fff" />
          <rect x={r.dx - 1.5} y={r.dy - 28} width="3" height="20" rx="1.5" fill="#2BAC52" />
        </>
      ) : null}
      <defs>
        <linearGradient id="driverMapFade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0A1628" stopOpacity="0" />
          <stop offset="100%" stopColor="#0A1628" stopOpacity="1" />
        </linearGradient>
      </defs>
      <rect width="390" height="320" fill="url(#driverMapFade)" />
    </svg>
  );
}
