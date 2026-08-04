import * as React from 'react';

import { useSuperAppFonts } from './fonts';

/** Labeled single-line text input, used on the Saved Places add/edit form. */
export function SuperAppRideTextField({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean | undefined;
}): React.JSX.Element {
  const { body } = useSuperAppFonts();
  return (
    <div className="mb-3">
      <p
        className={`mb-1.5 text-[11px] font-semibold ${body}`}
        style={{ color: 'rgba(255,255,255,.5)' }}
      >
        {label}
        {required ? ' *' : ''}
      </p>
      <input
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className={`h-12 w-full rounded-2xl px-4 text-[14px] text-white outline-none ${body}`}
        style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
      />
    </div>
  );
}
