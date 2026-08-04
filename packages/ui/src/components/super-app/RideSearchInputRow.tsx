import * as React from 'react';

/**
 * Rounded input row used on Destination Search — a red "pickup dot" plus a
 * slot for the actual input control. The input itself
 * (`PlacesAutocompleteInput`) stays in `customer-web` since it depends on
 * the Google Maps SDK, the same way `LiveMap` does; this component only
 * owns the surrounding chrome.
 */
export function SuperAppRideSearchInputRow({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div
      className="flex h-14 items-center gap-3 rounded-2xl px-4"
      style={{ background: '#112238', border: '1px solid rgba(43,172,82,.4)' }}
    >
      <div className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: '#EF4444' }} />
      {children}
    </div>
  );
}
