import * as React from 'react';

/** 5-star tap-to-rate picker, used on Rate Driver. */
export function SuperAppRideStarRating({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}): React.JSX.Element {
  return (
    <div className="mb-6 flex justify-center gap-3">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => {
            onChange(n);
          }}
          style={{ fontSize: 36, filter: n <= value ? 'none' : 'grayscale(1) opacity(.3)' }}
        >
          ⭐
        </button>
      ))}
    </div>
  );
}
