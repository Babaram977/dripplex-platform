import React from 'react';
import {
  G0,
  G2,
  G3,
  NAVY_SURFACE,
  BORDER,
  TEXT_DISABLED,
  GREEN_GRADIENT,
} from '../../tokens/colors';
import { FONT_HEADING, FONT_BODY, TYPE } from '../../tokens/typography';
import { ELEVATION } from '../../tokens/elevation';
import { R_BUTTON, R_CHIP } from '../../tokens/radius';

// ─── PrimaryButton ────────────────────────────────────────────────────────────
interface PrimaryButtonProps {
  label: string;
  onPress?: () => void;
  icon?: React.ReactNode;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  style?: React.CSSProperties;
}

export function PrimaryButton({
  label,
  onPress,
  icon,
  disabled = false,
  size = 'md',
  fullWidth = false,
  style,
}: PrimaryButtonProps) {
  const heights = { sm: 40, md: 48, lg: 56 };
  const fontSizes = { sm: TYPE.base, md: TYPE.md, lg: TYPE.lg };

  return (
    <button
      onClick={disabled ? undefined : onPress}
      className="active:scale-97 flex items-center justify-center gap-2 transition-all"
      style={{
        height: heights[size],
        width: fullWidth ? '100%' : undefined,
        borderRadius: R_BUTTON,
        background: disabled ? NAVY_SURFACE : GREEN_GRADIENT,
        color: disabled ? TEXT_DISABLED : '#FFF',
        fontFamily: FONT_HEADING,
        fontSize: fontSizes[size],
        fontWeight: 700,
        border: 'none',
        boxShadow: disabled ? 'none' : ELEVATION.brand,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        paddingLeft: 24,
        paddingRight: 24,
        ...style,
      }}
      aria-disabled={disabled}
    >
      {icon && <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>}
      {label}
    </button>
  );
}

// ─── SecondaryButton ──────────────────────────────────────────────────────────
interface SecondaryButtonProps {
  label: string;
  onPress?: () => void;
  icon?: React.ReactNode;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  variant?: 'outline' | 'ghost';
  style?: React.CSSProperties;
}

export function SecondaryButton({
  label,
  onPress,
  icon,
  disabled = false,
  size = 'md',
  fullWidth = false,
  variant = 'outline',
  style,
}: SecondaryButtonProps) {
  const heights = { sm: 40, md: 48, lg: 56 };
  const fontSizes = { sm: TYPE.base, md: TYPE.md, lg: TYPE.lg };

  return (
    <button
      onClick={disabled ? undefined : onPress}
      className="active:scale-97 flex items-center justify-center gap-2 transition-all"
      style={{
        height: heights[size],
        width: fullWidth ? '100%' : undefined,
        borderRadius: R_BUTTON,
        background: variant === 'ghost' ? 'transparent' : 'rgba(255,255,255,.07)',
        color: disabled ? TEXT_DISABLED : 'rgba(255,255,255,.75)',
        fontFamily: FONT_BODY,
        fontSize: fontSizes[size],
        fontWeight: 600,
        border: variant === 'ghost' ? 'none' : `1.5px solid ${BORDER}`,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        paddingLeft: 24,
        paddingRight: 24,
        ...style,
      }}
      aria-disabled={disabled}
    >
      {icon && <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>}
      {label}
    </button>
  );
}

// ─── IconButton ───────────────────────────────────────────────────────────────
interface IconButtonProps {
  icon: React.ReactNode;
  onPress?: () => void;
  size?: number;
  variant?: 'default' | 'brand' | 'ghost';
  badgeCount?: number;
  ariaLabel?: string;
}

export function IconButton({
  icon,
  onPress,
  size = 40,
  variant = 'default',
  badgeCount,
  ariaLabel,
}: IconButtonProps) {
  return (
    <button
      onClick={onPress}
      className="relative flex items-center justify-center transition-all active:scale-90"
      aria-label={ariaLabel}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2.5,
        background:
          variant === 'brand'
            ? `linear-gradient(135deg,${G0},${G2})`
            : variant === 'ghost'
              ? 'transparent'
              : 'rgba(255,255,255,.07)',
        border: variant === 'ghost' ? 'none' : `1px solid ${BORDER}`,
        boxShadow: variant === 'brand' ? ELEVATION.brand : 'none',
        flexShrink: 0,
      }}
    >
      {icon}
      {badgeCount !== undefined && badgeCount > 0 && (
        <div
          className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full"
          style={{ background: G2, boxShadow: `0 2px 8px rgba(43,172,82,.4)` }}
        >
          <p style={{ fontSize: 9, fontWeight: 700, color: '#FFF', fontFamily: FONT_BODY }}>
            {badgeCount > 9 ? '9+' : badgeCount}
          </p>
        </div>
      )}
    </button>
  );
}

// ─── ChipButton ───────────────────────────────────────────────────────────────
interface ChipButtonProps {
  label: string;
  icon?: string;
  active?: boolean;
  onPress?: () => void;
}

export function ChipButton({ label, icon, active = false, onPress }: ChipButtonProps) {
  return (
    <button
      onClick={onPress}
      className="flex h-9 flex-shrink-0 items-center gap-1.5 rounded-full px-3.5 transition-all active:scale-95"
      style={{
        background: active ? GREEN_GRADIENT : 'rgba(255,255,255,.06)',
        border: active ? 'none' : `1px solid ${BORDER}`,
        boxShadow: active ? ELEVATION.brand : 'none',
      }}
    >
      {icon && <span style={{ fontSize: 13 }}>{icon}</span>}
      <p
        style={{
          fontFamily: FONT_BODY,
          fontSize: TYPE.sm,
          fontWeight: 600,
          color: active ? '#FFF' : 'rgba(255,255,255,.5)',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </p>
    </button>
  );
}
