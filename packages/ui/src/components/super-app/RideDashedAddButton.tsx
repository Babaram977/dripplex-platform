import * as React from 'react';

import { useSuperAppFonts } from './fonts';

/** Dashed-border "add" affordance, used for "Add a place" on Saved Places. */
export function SuperAppRideDashedAddButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}): React.JSX.Element {
  const { heading } = useSuperAppFonts();
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-6 mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl"
      style={{ border: '1.5px dashed rgba(34,197,94,.4)', background: 'transparent' }}
    >
      <span style={{ fontSize: 20, color: '#47CF72' }}>+</span>
      <p className={`text-[14px] font-semibold ${heading}`} style={{ color: '#47CF72' }}>
        {label}
      </p>
    </button>
  );
}
