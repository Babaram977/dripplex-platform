import * as React from 'react';

/**
 * Passenger identity card — deliberately honest about a real capability
 * gap, mirroring customer-web's `DriverCard` (which has the same gap in
 * the opposite direction). `RideDto` never exposes the customer's name or
 * phone to the driver, even after acceptance (see docs/
 * DRIVER-PORTAL-SLICE-2.md's "capability gap identified" section) — only
 * `customerId`, an opaque id. Shown honestly instead of fabricating a name
 * or contact number.
 */
export function PassengerCard(): React.JSX.Element {
  return (
    <div className="border-border/70 flex items-center gap-3 rounded-md border p-3">
      <div className="bg-primary/10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-lg">
        🧑
      </div>
      <div>
        <p className="text-sm font-medium">Your passenger</p>
        <p className="text-muted-foreground text-xs">
          Name and phone aren&apos;t available yet — pending a backend passenger-contact endpoint
        </p>
      </div>
    </div>
  );
}
