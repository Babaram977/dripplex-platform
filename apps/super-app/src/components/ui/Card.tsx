import React from 'react';
import { NAVY_CARD, BORDER } from '../../tokens/colors';
import { ELEVATION } from '../../tokens/elevation';
import { R_CARD } from '../../tokens/radius';
import { CARD_PADDING } from '../../tokens/spacing';

// ─── AppCard ──────────────────────────────────────────────────────────────────
// Base card container used for all content cards in DrippleX
interface AppCardProps {
  children: React.ReactNode;
  padding?: number | string;
  radius?: number;
  style?: React.CSSProperties;
  onClick?: () => void;
  border?: string;
  background?: string;
}

export function AppCard({
  children,
  padding = CARD_PADDING,
  radius = R_CARD,
  style,
  onClick,
  border,
  background,
}: AppCardProps) {
  return (
    <div
      onClick={onClick}
      className={onClick ? 'transition-all active:scale-[.98]' : ''}
      style={{
        background: background ?? NAVY_CARD,
        border: `1.5px solid ${border ?? BORDER}`,
        borderRadius: radius,
        padding: padding,
        boxShadow: ELEVATION.card,
        cursor: onClick ? 'pointer' : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─── GlassCard ────────────────────────────────────────────────────────────────
// Frosted glass card for overlays, AI panels
interface GlassCardProps {
  children: React.ReactNode;
  padding?: number | string;
  radius?: number;
  style?: React.CSSProperties;
}

export function GlassCard({
  children,
  padding = CARD_PADDING,
  radius = R_CARD,
  style,
}: GlassCardProps) {
  return (
    <div
      style={{
        background: 'rgba(13,27,46,.75)',
        border: '1.5px solid rgba(255,255,255,.10)',
        borderRadius: radius,
        padding: padding,
        backdropFilter: 'blur(16px)',
        boxShadow: ELEVATION.lg,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─── SectionHeader ────────────────────────────────────────────────────────────
interface SectionHeaderProps {
  title: string;
  sub?: string;
  onSeeAll?: () => void;
}

export function SectionHeader({ title, sub, onSeeAll }: SectionHeaderProps) {
  return (
    <div className="mb-3 flex items-end justify-between px-5">
      <div>
        <p
          style={{
            fontSize: 15,
            fontWeight: 700,
            lineHeight: 1.2,
            color: '#FFF',
            fontFamily: "'Poppins',sans-serif",
          }}
        >
          {title}
        </p>
        {sub && (
          <p
            style={{
              fontSize: 10,
              marginTop: 2,
              color: 'rgba(255,255,255,.38)',
              fontFamily: "'Inter',sans-serif",
            }}
          >
            {sub}
          </p>
        )}
      </div>
      {onSeeAll && (
        <button
          onClick={onSeeAll}
          className="active:opacity-60"
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: '#47CF72',
            fontFamily: "'Inter',sans-serif",
            paddingBottom: 2,
          }}
        >
          See all →
        </button>
      )}
    </div>
  );
}
