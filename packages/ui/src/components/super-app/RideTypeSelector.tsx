import * as React from 'react';

import { useSuperAppFonts } from './fonts';

export interface SuperAppRideTypeOption {
  key: string;
  label: string;
  emoji: string;
}

/** Ride-type chip row (Economy/Tricycle, etc) on the Fare Estimate screen. */
export function SuperAppRideTypeSelector({
  options,
  selectedKey,
  onSelect,
}: {
  options: SuperAppRideTypeOption[];
  selectedKey: string;
  onSelect: (key: string) => void;
}): React.JSX.Element {
  const { body } = useSuperAppFonts();
  return (
    <div className="flex gap-2">
      {options.map((option) => {
        const selected = option.key === selectedKey;
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => {
              onSelect(option.key);
            }}
            className="flex flex-1 flex-col items-center gap-1.5 rounded-2xl px-2 py-3 transition-all"
            style={{
              background: selected ? 'rgba(43,172,82,.08)' : '#112238',
              border: `1.5px solid ${selected ? 'rgba(43,172,82,.35)' : 'rgba(255,255,255,.08)'}`,
            }}
          >
            <span style={{ fontSize: 20 }}>{option.emoji}</span>
            <p
              className={`text-[12px] font-semibold ${body}`}
              style={{ color: selected ? '#47CF72' : 'rgba(255,255,255,.6)' }}
            >
              {option.label}
            </p>
          </button>
        );
      })}
    </div>
  );
}
