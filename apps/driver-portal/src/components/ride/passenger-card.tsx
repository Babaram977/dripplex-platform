'use client';

import { Button } from '@dripplex/ui';
import { Phone } from 'lucide-react';
import * as React from 'react';

import { usePassengerContact } from '@/hooks/rides/use-passenger-contact';

/**
 * Passenger identity card. Driver Slice 2 item 2 (founder-approved
 * 2026-08-04): plain `tel:` one-tap calling only, no masked calling —
 * resolved via `DriverRideContactService`, which closes the gap this
 * component used to document honestly (`RideDto` never exposed the
 * customer's name/phone to the driver — see docs/DRIVER-SLICE-2-AUDIT.md
 * item 8). `rideId` gates the fetch — pass it only once a ride is
 * assigned/arrived/in-progress.
 */
export function PassengerCard({ rideId }: { rideId: string }): React.JSX.Element {
  const contact = usePassengerContact(rideId);

  return (
    <div className="border-border/70 flex items-center gap-3 rounded-md border p-3">
      <div className="bg-primary/10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-lg">
        🧑
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {contact.data ? contact.data.name : 'Your passenger'}
        </p>
        {contact.isLoading ? (
          <p className="text-muted-foreground text-xs">Loading contact…</p>
        ) : null}
        {!contact.isLoading && !contact.data ? (
          <p className="text-muted-foreground text-xs">Contact isn&apos;t available right now</p>
        ) : null}
        {contact.data && !contact.data.phone ? (
          <p className="text-muted-foreground text-xs">No phone number on file</p>
        ) : null}
      </div>
      {contact.data?.phone ? (
        <a href={`tel:${contact.data.phone}`}>
          <Button type="button" variant="outline" size="icon" aria-label="Call passenger">
            <Phone className="h-4 w-4" aria-hidden="true" />
          </Button>
        </a>
      ) : null}
    </div>
  );
}
