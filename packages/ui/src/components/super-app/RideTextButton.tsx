import * as React from 'react';

import { useSuperAppFonts } from './fonts';

/** Muted inline text link/button — "Cancel ride", "Back to Home", etc. */
export function SuperAppRideTextButton({
  label,
  onClick,
  disabled,
  centered = true,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean | undefined;
  centered?: boolean | undefined;
}): React.JSX.Element {
  const { body } = useSuperAppFonts();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`text-[14px] font-medium ${centered ? 'w-full text-center' : ''} ${body}`}
      style={{ color: 'rgba(255,255,255,.5)' }}
    >
      {label}
    </button>
  );
}
