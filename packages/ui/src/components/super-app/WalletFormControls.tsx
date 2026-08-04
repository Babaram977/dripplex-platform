import * as React from 'react';

import { useSuperAppFonts } from './fonts';

/** Small uppercase section label ("Quick amounts", "Payment method", date-group headers, …). */
export function SuperAppWalletSectionLabel({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const { body } = useSuperAppFonts();
  return (
    <span
      className={`text-[11px] font-semibold uppercase tracking-wider ${body}`}
      style={{ color: 'rgba(255,255,255,.5)' }}
    >
      {children}
    </span>
  );
}

/** Rounded search input with a magnifying-glass icon (transaction/recipient search). */
export function SuperAppWalletSearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}): React.JSX.Element {
  const { body } = useSuperAppFonts();
  return (
    <div
      className="flex h-[52px] items-center rounded-xl px-3.5"
      style={{
        background: '#112238',
        border: `1.5px solid ${value ? '#2BAC52' : 'rgba(255,255,255,.08)'}`,
        transition: 'border-color .2s',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="mr-2.5 shrink-0">
        <circle cx="7" cy="7" r="5" stroke="rgba(255,255,255,.5)" strokeWidth="1.5" />
        <path
          d="M10.5 10.5L14 14"
          stroke="rgba(255,255,255,.5)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      <input
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        placeholder={placeholder}
        className={`flex-1 bg-transparent text-[15px] text-white outline-none ${body}`}
      />
    </div>
  );
}

/** Horizontal scrollable filter pill row (Transaction History's type tabs). */
export function SuperAppWalletFilterPills<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: readonly T[];
  active: T;
  onChange: (tab: T) => void;
}): React.JSX.Element {
  const { body } = useSuperAppFonts();
  return (
    <div className="flex gap-2 overflow-x-auto px-4 pb-3">
      {tabs.map((tab) => {
        const selected = tab === active;
        return (
          <button
            key={tab}
            type="button"
            onClick={() => {
              onChange(tab);
            }}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-all ${body}`}
            style={{
              background: selected ? 'linear-gradient(135deg,#176B30,#2BAC52)' : '#112238',
              border: `1px solid ${selected ? 'transparent' : 'rgba(255,255,255,.08)'}`,
              color: selected ? '#fff' : 'rgba(255,255,255,.5)',
              boxShadow: selected ? '0 2px 12px rgba(43,172,82,.3)' : 'none',
            }}
          >
            {tab}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Full-width primary CTA. Visually near-identical to `SuperAppRideActionButton`
 * (same green-gradient design token) but Wallet's own Figma spec uses a 14px
 * radius and `padding:16px 0` rather than Ride's fixed h-14/16px radius —
 * kept as its own component for exact pixel parity rather than reusing a
 * frozen Ride component with a slightly different spec.
 */
export function SuperAppWalletButton({
  children,
  onClick,
  disabled,
  loading,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean | undefined;
  loading?: boolean | undefined;
}): React.JSX.Element {
  const { heading } = useSuperAppFonts();
  const inactive = Boolean(disabled) || Boolean(loading);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={inactive}
      className={`w-full rounded-[14px] py-4 text-[16px] font-semibold tracking-wide ${heading}`}
      style={{
        background: inactive ? 'rgba(255,255,255,.06)' : 'linear-gradient(135deg,#176B30,#2BAC52)',
        color: inactive ? 'rgba(255,255,255,.22)' : '#fff',
        boxShadow: inactive ? 'none' : '0 4px 20px rgba(43,172,82,.35)',
        border: 'none',
      }}
    >
      {loading ? 'Please wait…' : children}
    </button>
  );
}
