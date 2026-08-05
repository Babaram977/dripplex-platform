import * as React from 'react';

import type { OperationsQueueCountersDto } from '@dripplex/types';

/** DPX-OPS-001 Slice 2 — dashboard extension: pure counts pulled from
 * `OperationsCasesService.getQueueCounters()`, no new domain logic. */
export function QueueCountersTiles({
  counters,
}: {
  counters: OperationsQueueCountersDto;
}): React.JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <Tile label="Active SOS" value={counters.activeSosCount} />
      <Tile label="Open incidents" value={counters.openIncidentsCount} />
      <Tile label="Open support tickets" value={counters.openSupportTicketsCount} />
      <Tile label="Waiting review" value={counters.waitingReviewCount} />
    </div>
  );
}

function Tile({ label, value }: { label: string; value: number }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-xl font-semibold tabular-nums">{value}</span>
    </div>
  );
}
