import * as React from 'react';

/** Trip-progress track (0-1) used on Live Tracking / In-Progress screens. */
export function SuperAppRideProgressBar({ progress }: { progress: number }): React.JSX.Element {
  const clamped = Math.max(0, Math.min(1, progress));
  return (
    <div className="h-2 rounded-full" style={{ background: '#112238' }}>
      <div
        className="h-2 rounded-full transition-all"
        style={{ background: '#47CF72', width: `${String(Math.round(clamped * 100))}%` }}
      />
    </div>
  );
}
