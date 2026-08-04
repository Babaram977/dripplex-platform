import * as React from 'react';

import { useSuperAppFonts } from './fonts';

/** Styled multiline text input used for comment/description fields (Rate Driver, Report Trip). */
export function SuperAppRideTextarea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  rows?: number | undefined;
}): React.JSX.Element {
  const { body } = useSuperAppFonts();
  return (
    <textarea
      value={value}
      onChange={(event) => {
        onChange(event.target.value);
      }}
      placeholder={placeholder}
      rows={rows}
      className={`w-full resize-none rounded-2xl px-4 py-3 text-[14px] text-white outline-none ${body}`}
      style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
    />
  );
}
