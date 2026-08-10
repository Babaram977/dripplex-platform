import React from 'react';
import { G0, G2, G3, MUTED, NAVY_CARD, BORDER } from '../../tokens/colors';
import { ELEVATION } from '../../tokens/elevation';

// ─── EmptyState ───────────────────────────────────────────────────────────────
interface EmptyStateProps {
  emoji?: string;
  title: string;
  description?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  onPrimary?: () => void;
  onSecondary?: () => void;
}

export function EmptyState({
  emoji = '📭',
  title,
  description,
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center px-8 py-10 text-center">
      <div
        className="mb-4 flex h-20 w-20 items-center justify-center rounded-full"
        style={{ background: 'rgba(43,172,82,.08)', border: '1.5px solid rgba(43,172,82,.2)' }}
      >
        <span style={{ fontSize: 38 }}>{emoji}</span>
      </div>
      <p
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: '#FFF',
          fontFamily: "'Poppins',sans-serif",
          marginBottom: 8,
        }}
      >
        {title}
      </p>
      {description && (
        <p
          style={{
            fontSize: 12,
            color: MUTED,
            fontFamily: "'Inter',sans-serif",
            lineHeight: 1.6,
            marginBottom: 24,
          }}
        >
          {description}
        </p>
      )}
      {(primaryLabel || secondaryLabel) && (
        <div className="flex w-full gap-3">
          {secondaryLabel && (
            <button
              onClick={onSecondary}
              className="h-11 flex-1 rounded-2xl text-[12px] font-semibold transition-all active:scale-95"
              style={{
                background: 'rgba(255,255,255,.07)',
                color: 'rgba(255,255,255,.7)',
                border: `1px solid ${BORDER}`,
                fontFamily: "'Inter',sans-serif",
              }}
            >
              {secondaryLabel}
            </button>
          )}
          {primaryLabel && (
            <button
              onClick={onPrimary}
              className="h-11 flex-1 rounded-2xl text-[12px] font-semibold transition-all active:scale-95"
              style={{
                background: `linear-gradient(135deg,${G0},${G2})`,
                color: '#FFF',
                fontFamily: "'Inter',sans-serif",
                boxShadow: ELEVATION.brand,
              }}
            >
              {primaryLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── ErrorState ───────────────────────────────────────────────────────────────
interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'Something went wrong',
  description = 'Please check your connection and try again.',
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center px-8 py-10 text-center">
      <div
        className="mb-4 flex h-20 w-20 items-center justify-center rounded-full"
        style={{ background: 'rgba(239,68,68,.08)', border: '1.5px solid rgba(239,68,68,.2)' }}
      >
        <span style={{ fontSize: 38 }}>⚠️</span>
      </div>
      <p
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: '#FFF',
          fontFamily: "'Poppins',sans-serif",
          marginBottom: 8,
        }}
      >
        {title}
      </p>
      <p
        style={{
          fontSize: 12,
          color: MUTED,
          fontFamily: "'Inter',sans-serif",
          lineHeight: 1.6,
          marginBottom: 24,
        }}
      >
        {description}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="h-11 rounded-2xl px-8 text-[13px] font-semibold transition-all active:scale-95"
          style={{
            background: `linear-gradient(135deg,${G0},${G2})`,
            color: '#FFF',
            fontFamily: "'Inter',sans-serif",
            boxShadow: ELEVATION.brand,
          }}
        >
          Try Again
        </button>
      )}
    </div>
  );
}

// ─── NotificationBadge ────────────────────────────────────────────────────────
interface NotificationBadgeProps {
  count?: number;
  dot?: boolean;
}

export function NotificationBadge({ count, dot = false }: NotificationBadgeProps) {
  if (!dot && (!count || count === 0)) return null;
  if (dot) {
    return (
      <div
        style={{
          position: 'absolute',
          top: -3,
          right: -3,
          width: 9,
          height: 9,
          borderRadius: '50%',
          background: '#EF4444',
          border: '2px solid #060E1C',
        }}
      />
    );
  }
  return (
    <div
      style={{
        position: 'absolute',
        top: -6,
        right: -6,
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        background: G2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 4px',
        boxShadow: `0 2px 8px rgba(43,172,82,.4)`,
      }}
    >
      <p style={{ fontSize: 9, fontWeight: 700, color: '#FFF', fontFamily: "'Inter',sans-serif" }}>
        {(count ?? 0) > 99 ? '99+' : count}
      </p>
    </div>
  );
}

// ─── VerifiedBadge ────────────────────────────────────────────────────────────
export function VerifiedBadge() {
  return (
    <div
      className="flex items-center gap-0.5 rounded-lg px-1.5 py-0.5"
      style={{ background: 'rgba(43,172,82,.15)', border: '1px solid rgba(43,172,82,.25)' }}
    >
      <svg
        width="9"
        height="9"
        viewBox="0 0 24 24"
        fill="none"
        stroke={G3}
        strokeWidth="3"
        strokeLinecap="round"
      >
        <path d="M20 6L9 17l-5-5" />
      </svg>
      <p style={{ fontSize: 8, fontWeight: 700, color: G3, fontFamily: "'Inter',sans-serif" }}>
        Verified
      </p>
    </div>
  );
}

// ─── RatingBadge ──────────────────────────────────────────────────────────────
export function RatingBadge({ rating }: { rating: number }) {
  return (
    <div
      className="flex items-center gap-1 rounded-xl px-2 py-1"
      style={{ background: 'rgba(251,191,36,.1)' }}
    >
      <span style={{ fontSize: 10 }}>★</span>
      <p
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: '#FBBF24',
          fontFamily: "'Inter',sans-serif",
        }}
      >
        {rating.toFixed(1)}
      </p>
    </div>
  );
}
