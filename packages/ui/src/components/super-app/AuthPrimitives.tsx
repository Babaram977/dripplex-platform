import * as React from 'react';

import { useSuperAppFonts } from './fonts';

/** Ported from `shared.tsx`'s `GreenBtn` -- the primary CTA on every Auth screen. */
export function SuperAppAuthGreenButton({
  label,
  disabled,
  loading,
  onClick,
  icon,
  type = 'button',
}: {
  label: string;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  icon?: React.ReactNode;
  type?: 'button' | 'submit';
}): React.JSX.Element {
  const { heading } = useSuperAppFonts();
  const isInactive = Boolean(disabled) || Boolean(loading);
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isInactive}
      className={`flex h-[56px] w-full items-center justify-center gap-2.5 rounded-2xl text-[15px] font-semibold transition-all duration-200 active:scale-[0.97] ${heading}`}
      style={{
        background: isInactive
          ? 'rgba(255,255,255,.06)'
          : 'linear-gradient(135deg,#176B30 0%,#2BAC52 52%,#47CF72 100%)',
        color: isInactive ? 'rgba(255,255,255,.22)' : 'white',
        boxShadow: isInactive
          ? 'none'
          : '0 10px 36px rgba(43,172,82,.38),0 0 0 1px rgba(43,172,82,.26)',
      }}
    >
      {loading ? (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          style={{ animation: 'spin 1s linear infinite' }}
        >
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" />
        </svg>
      ) : (
        <>
          {label}
          {icon}
        </>
      )}
    </button>
  );
}

/** Ported from `shared.tsx`'s `Divider` -- an "OR" rule between two auth options. */
export function SuperAppAuthDivider({ label = 'OR' }: { label?: string }): React.JSX.Element {
  const { body } = useSuperAppFonts();
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,.07)' }} />
      <span className={`text-xs ${body}`} style={{ color: 'rgba(255,255,255,.24)' }}>
        {label}
      </span>
      <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,.07)' }} />
    </div>
  );
}

export function SuperAppAuthArrowIcon(): React.JSX.Element {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

export function SuperAppAuthCheckIcon(): React.JSX.Element {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

export interface SuperAppAuthCountry {
  flag: string;
  name: string;
  code: string;
}

/** Ported verbatim from `shared.tsx`'s `COUNTRIES`. */
export const SUPER_APP_AUTH_COUNTRIES: readonly SuperAppAuthCountry[] = [
  { flag: '🇳🇬', name: 'Nigeria', code: '+234' },
  { flag: '🇬🇧', name: 'United Kingdom', code: '+44' },
  { flag: '🇺🇸', name: 'United States', code: '+1' },
  { flag: '🇰🇪', name: 'Kenya', code: '+254' },
  { flag: '🇿🇦', name: 'South Africa', code: '+27' },
  { flag: '🇬🇭', name: 'Ghana', code: '+233' },
  { flag: '🇦🇪', name: 'UAE', code: '+971' },
  { flag: '🇮🇳', name: 'India', code: '+91' },
];
