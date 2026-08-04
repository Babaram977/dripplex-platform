import * as React from 'react';

import { useSuperAppFonts } from './fonts';

/** Selectable payment-method row with icon, label, optional subtitle (balance), and a radio dot. */
export function SuperAppRidePaymentMethodRow({
  icon,
  label,
  subtitle,
  selected,
  disabled,
  onClick,
}: {
  icon: string;
  label: string;
  subtitle?: React.ReactNode;
  selected: boolean;
  disabled?: boolean | undefined;
  onClick: () => void;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="mb-3 flex w-full items-center gap-3 rounded-2xl p-4 text-left disabled:opacity-40"
      style={{
        background: selected ? 'rgba(34,197,94,.08)' : '#0D1B2E',
        border: selected ? '1.5px solid #47CF72' : '1px solid rgba(255,255,255,.08)',
      }}
    >
      <span style={{ fontSize: 22 }}>{icon}</span>
      <div className="flex-1">
        <p className={`text-[14px] font-semibold text-white ${heading}`}>{label}</p>
        {subtitle ? (
          <p className={`text-[12px] ${body}`} style={{ color: 'rgba(255,255,255,.6)' }}>
            {subtitle}
          </p>
        ) : null}
      </div>
      <div
        className="flex h-5 w-5 items-center justify-center rounded-full"
        style={{
          background: selected ? '#47CF72' : 'transparent',
          border: selected ? 'none' : '2px solid rgba(255,255,255,.08)',
        }}
      >
        {selected ? <div className="h-2.5 w-2.5 rounded-full bg-white" /> : null}
      </div>
    </button>
  );
}
