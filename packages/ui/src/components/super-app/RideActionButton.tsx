import * as React from 'react';

import { useSuperAppFonts } from './fonts';

/** Full-width primary CTA used throughout the Ride flow (Confirm, Book, Pay, etc). */
export function SuperAppRideActionButton({
  label,
  onClick,
  disabled,
  loading,
  variant = 'primary',
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean | undefined;
  loading?: boolean | undefined;
  variant?: 'primary' | 'secondary' | 'danger' | undefined;
}): React.JSX.Element {
  const { heading } = useSuperAppFonts();
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
      className={`flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold transition-all duration-200 active:scale-[.97] ${heading}`}
      style={styles[variant]}
    >
      {loading ? 'Please wait…' : label}
    </button>
  );
}

/** Compact icon-over-label button used in 2-4 button quick-action rows (Call/Chat/Cancel/Share/SOS). */
export function SuperAppRideQuickActionButton({
  icon,
  label,
  onClick,
  disabled,
  tone = 'neutral',
}: {
  icon: string;
  label: string;
  onClick?: (() => void) | undefined;
  disabled?: boolean | undefined;
  tone?: 'neutral' | 'danger' | undefined;
}): React.JSX.Element {
  const { body } = useSuperAppFonts();
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
        className={`text-[11px] ${body}`}
        style={{ color: danger ? '#EF4444' : 'rgba(255,255,255,.6)' }}
      >
        {label}
      </p>
    </button>
  );
}
