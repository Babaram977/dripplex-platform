import * as React from 'react';

import { useSuperAppFonts } from './fonts';

/** Large ₦-prefixed amount input card (Top Up, Transfer). */
export function SuperAppWalletAmountCard({
  value,
  onChange,
  label = 'Amount',
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  return (
    <div
      className="rounded-[20px] p-5"
      style={{ background: '#0D1B2E', border: '1px solid rgba(255,255,255,.08)' }}
    >
      <p
        className={`mb-2 text-[12px] font-medium uppercase tracking-wider ${body}`}
        style={{ color: 'rgba(255,255,255,.5)' }}
      >
        {label}
      </p>
      <div className="flex items-center">
        <span className={`mr-1 text-[32px] font-bold ${heading}`} style={{ color: '#47CF72' }}>
          ₦
        </span>
        <input
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          inputMode="numeric"
          className={`w-full flex-1 bg-transparent text-[32px] font-bold text-white outline-none ${heading}`}
        />
      </div>
      <div
        className="mt-2 h-px"
        style={{ background: 'linear-gradient(90deg,#2BAC52,transparent)' }}
      />
    </div>
  );
}

/** Quick amount preset chip row (Top Up's ₦500/₦1,000/…). */
export function SuperAppWalletPresetChips({
  presets,
  value,
  onSelect,
}: {
  presets: readonly string[];
  value: string;
  onSelect: (preset: string) => void;
}): React.JSX.Element {
  const { body } = useSuperAppFonts();
  return (
    <div className="flex flex-wrap gap-2">
      {presets.map((preset) => {
        const selected = preset === value;
        return (
          <button
            key={preset}
            type="button"
            onClick={() => {
              onSelect(preset);
            }}
            className={`rounded-[10px] px-4 py-2.5 text-[14px] font-semibold ${body}`}
            style={{
              background: selected ? 'linear-gradient(135deg,#176B30,#2BAC52)' : '#112238',
              border: `1px solid ${selected ? 'transparent' : 'rgba(255,255,255,.08)'}`,
              color: selected ? '#fff' : 'rgba(255,255,255,.5)',
              boxShadow: selected ? '0 2px 12px rgba(43,172,82,.35)' : 'none',
            }}
          >
            ₦{preset}
          </button>
        );
      })}
    </div>
  );
}
