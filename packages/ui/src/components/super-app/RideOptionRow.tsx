import * as React from 'react';

import { useSuperAppFonts } from './fonts';

/** Selectable icon+label row (no radio indicator), used for issue-category pickers. */
export function SuperAppRideOptionRow({
  icon,
  label,
  selected,
  onClick,
}: {
  icon: string;
  label: string;
  selected: boolean;
  onClick: () => void;
}): React.JSX.Element {
  const { body } = useSuperAppFonts();
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-2 flex w-full items-center gap-3 rounded-xl p-3.5 text-left"
      style={{
        background: selected ? 'rgba(34,197,94,.08)' : '#0D1B2E',
        border: selected ? '1.5px solid #47CF72' : '1px solid rgba(255,255,255,.08)',
      }}
    >
      <span style={{ fontSize: 16 }}>{icon}</span>
      <p className={`text-[14px] text-white ${body}`}>{label}</p>
    </button>
  );
}
