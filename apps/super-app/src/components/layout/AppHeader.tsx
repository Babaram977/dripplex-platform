import React from 'react';
import { G3, BORDER, NAVY_DEEP } from '../../tokens/colors';
import { FONT_HEADING, FONT_BODY, TYPE } from '../../tokens/typography';
import { StatusBar } from './StatusBar';

// ─── BackButton ───────────────────────────────────────────────────────────────
interface BackButtonProps {
  onPress: () => void;
}

export function BackButton({ onPress }: BackButtonProps) {
  return (
    <button
      onClick={onPress}
      className="flex h-9 w-9 items-center justify-center rounded-xl transition-all active:scale-90"
      style={{ background: 'rgba(255,255,255,.07)', border: `1px solid ${BORDER}` }}
      aria-label="Go back"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="rgba(255,255,255,.75)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
    </button>
  );
}

// ─── AppHeader ────────────────────────────────────────────────────────────────
// Standard internal-screen header (back + title + optional actions)
interface AppHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightSlot?: React.ReactNode; // icon buttons, badges, etc.
  background?: string;
  style?: React.CSSProperties;
}

export function AppHeader({
  title,
  subtitle,
  onBack,
  rightSlot,
  background,
  style,
}: AppHeaderProps) {
  return (
    <div
      style={{
        background: background ?? 'linear-gradient(175deg,#0B1F12 0%,#0D2A1C 55%,#091420 100%)',
        paddingBottom: 16,
        ...style,
      }}
    >
      <StatusBar />
      <div className="relative z-10 mt-2 flex items-center justify-between px-5">
        <div className="flex items-center gap-3">
          {onBack && <BackButton onPress={onBack} />}
          <div>
            {subtitle && (
              <p
                style={{ fontSize: TYPE.xs, color: 'rgba(255,255,255,.4)', fontFamily: FONT_BODY }}
              >
                {subtitle}
              </p>
            )}
            <p
              style={{
                fontSize: 19,
                fontWeight: 700,
                color: '#FFF',
                fontFamily: FONT_HEADING,
                lineHeight: 1.2,
              }}
            >
              {title}
            </p>
          </div>
        </div>
        {rightSlot && <div className="flex items-center gap-2.5">{rightSlot}</div>}
      </div>
    </div>
  );
}
