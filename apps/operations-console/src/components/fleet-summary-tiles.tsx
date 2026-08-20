import * as React from 'react';

import type { FleetSummaryDto } from '@dripplex/types';

function Tile({ label, value }: { label: string; value: number }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-xl font-semibold tabular-nums">{value}</span>
    </div>
  );
}

/** DPX-OPS-001 Slice 1 — fleet-wide counts, ordered the same way as
 * `computeFleetDriverStatus`'s priority so the highest-attention figures
 * (SOS, Suspended, Needs inspection) read left-to-right first.
 *
 * "Gone quiet" sits beside Online because the pair is the point: those
 * drivers' apps still say Online, but the platform has stopped hearing from
 * them and dispatch will skip them. Online / Gone quiet / Offline are the
 * only three tiles here that partition the fleet. */
export function FleetSummaryTiles({ summary }: { summary: FleetSummaryDto }): React.JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-9">
      <Tile label="SOS" value={summary.sosCount} />
      <Tile label="Suspended" value={summary.suspendedCount} />
      <Tile label="Needs inspection" value={summary.needsInspectionCount} />
      <Tile label="On a trip" value={summary.busyCount} />
      <Tile label="Available" value={summary.availableCount} />
      <Tile label="Online" value={summary.onlineCount} />
      <Tile label="Gone quiet" value={summary.staleCount} />
      <Tile label="Offline" value={summary.offlineCount} />
      <Tile label="Total drivers" value={summary.totalDrivers} />
    </div>
  );
}
