import * as React from 'react';

import { useSuperAppFonts } from './fonts';

/** Preset amount chip row (₦ tip presets), used on Tip Driver. */
export function SuperAppRideAmountChips({
  amounts,
  selected,
  onSelect,
}: {
  amounts: number[];
  selected: number;
  onSelect: (amount: number) => void;
}): React.JSX.Element {
  const { heading } = useSuperAppFonts();
  return (
    <div className="flex flex-wrap gap-2">
      {amounts.map((amount) => {
        const isSelected = selected === amount;
        return (
          <button
            key={amount}
            type="button"
            onClick={() => {
              onSelect(amount);
            }}
            className={`rounded-full px-5 py-2.5 text-sm font-semibold ${heading}`}
            style={{
              background: isSelected ? '#47CF72' : '#0D1B2E',
              color: isSelected ? '#0A1628' : 'rgba(255,255,255,.6)',
              border: isSelected ? 'none' : '1px solid rgba(255,255,255,.08)',
            }}
          >
            ₦{amount.toLocaleString()}
          </button>
        );
      })}
    </div>
  );
}
