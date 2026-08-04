import { EmptyState } from '@dripplex/ui';
import * as React from 'react';

import { FleetStatusBadge } from './fleet-status-badge';

import type { FleetDriverDto } from '@dripplex/types';

/** DPX-OPS-001 Slice 1 — the full driver roster, distinct from the Live
 * Fleet Map's own no-key list fallback (`FleetListFallback` in
 * `fleet-map.tsx`): that one is a map substitute showing location +
 * status only, this one is the roster with the extra operational detail
 * (phone, shift, vehicle) an operator needs to act on a driver. */
export function DriverList({ drivers }: { drivers: FleetDriverDto[] }): React.JSX.Element {
  if (drivers.length === 0) {
    return (
      <EmptyState
        title="No active drivers"
        description="No approved or suspended drivers are on file yet."
      />
    );
  }

  return (
    <div className="border-border/70 divide-border/70 divide-y overflow-hidden rounded-lg border">
      <div className="text-muted-foreground bg-muted/40 hidden gap-4 px-4 py-2 text-xs font-medium uppercase tracking-wide sm:grid sm:grid-cols-[1.5fr_1fr_1fr_1fr_1fr]">
        <span>Driver</span>
        <span>Status</span>
        <span>Vehicle</span>
        <span>Shift</span>
        <span>Active ride</span>
      </div>
      {drivers.map((driver) => (
        <div
          key={driver.driverId}
          className="grid grid-cols-1 gap-2 px-4 py-3 text-sm sm:grid-cols-[1.5fr_1fr_1fr_1fr_1fr] sm:items-center sm:gap-4"
        >
          <div>
            <p className="font-medium">
              {driver.firstName} {driver.lastName}
            </p>
            <p className="text-muted-foreground text-xs">{driver.phone ?? 'No phone on file'}</p>
          </div>
          <div>
            <FleetStatusBadge status={driver.status} />
          </div>
          <span className="text-muted-foreground">
            {driver.vehiclePlateNumber ?? 'No vehicle on file'}
          </span>
          <span className="text-muted-foreground">
            {driver.shiftStatus === 'ACTIVE'
              ? 'On shift'
              : driver.shiftStatus === 'ON_BREAK'
                ? 'On break'
                : 'No active shift'}
          </span>
          <span className="text-muted-foreground">
            {driver.activeRideId ? `#${driver.activeRideId.slice(0, 8)}` : '—'}
          </span>
        </div>
      ))}
    </div>
  );
}
