import * as React from 'react';

import { useSuperAppFonts } from './fonts';

/** Equal-width segmented tab row, used for History status filters and the Saved Places label picker. */
export function SuperAppRideSegmentedTabs<T extends string>({
  tabs,
  selectedKey,
  onSelect,
}: {
  tabs: { key: T; label: React.ReactNode }[];
  selectedKey: T;
  onSelect: (key: T) => void;
}): React.JSX.Element {
  const { body } = useSuperAppFonts();
  return (
    <div className="flex gap-2">
      {tabs.map((tab) => {
        const selected = tab.key === selectedKey;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              onSelect(tab.key);
            }}
            className={`h-9 flex-1 rounded-xl text-[12px] font-semibold capitalize ${body}`}
            style={{
              background: selected ? '#2BAC52' : '#112238',
              color: selected ? '#fff' : 'rgba(255,255,255,.5)',
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
