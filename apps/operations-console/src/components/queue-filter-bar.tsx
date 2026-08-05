'use client';

import { Button, Input, Label } from '@dripplex/ui';
import * as React from 'react';

import type { QueueFilters } from '@/hooks/use-operations-queues';

/** Which optional filters a given queue can actually satisfy — driven by
 * what the underlying frozen source table stores, per the founder's
 * decision (2026-08-05): SOS has both `rideId` and `vehicleId`; Incident
 * has `rideId` only; Support has neither. Date is available everywhere
 * (every source row has `createdAt`). Region is deliberately absent —
 * deferred until DrippleX has a canonical operational geography/zone
 * model, not invented here. */
export interface QueueFilterBarFields {
  ride?: boolean;
  vehicle?: boolean;
}

interface QueueFilterBarProps {
  fields?: QueueFilterBarFields;
  value: QueueFilters;
  onChange: (next: QueueFilters) => void;
}

/** DPX-OPS-001 Slice 2 refinement (founder-approved 2026-08-05) — Date/
 * Ride/Vehicle filters on the three work queues. Applies on explicit
 * submit rather than per-keystroke, so a partially-typed ride/vehicle id
 * doesn't fire a request (and doesn't reset the case list) on every
 * character. */
export function QueueFilterBar({
  fields = {},
  value,
  onChange,
}: QueueFilterBarProps): React.JSX.Element {
  const [draft, setDraft] = React.useState<QueueFilters>(value);

  const hasActiveFilter =
    value.dateFrom !== undefined ||
    value.dateTo !== undefined ||
    value.rideId !== undefined ||
    value.vehicleId !== undefined;

  function handleSubmit(event: React.SyntheticEvent<HTMLFormElement>): void {
    event.preventDefault();
    onChange({
      ...(draft.dateFrom ? { dateFrom: draft.dateFrom } : {}),
      ...(draft.dateTo ? { dateTo: draft.dateTo } : {}),
      ...(draft.rideId?.trim() ? { rideId: draft.rideId.trim() } : {}),
      ...(draft.vehicleId?.trim() ? { vehicleId: draft.vehicleId.trim() } : {}),
    });
  }

  function handleClear(): void {
    setDraft({});
    onChange({});
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-border/70 flex flex-wrap items-end gap-3 rounded-md border p-3"
    >
      <div className="flex flex-col gap-1">
        <Label htmlFor="queue-filter-date-from">From</Label>
        <Input
          id="queue-filter-date-from"
          type="date"
          className="h-9 w-40"
          value={draft.dateFrom ?? ''}
          onChange={(event) => {
            setDraft((prev) => ({ ...prev, dateFrom: event.target.value }));
          }}
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="queue-filter-date-to">To</Label>
        <Input
          id="queue-filter-date-to"
          type="date"
          className="h-9 w-40"
          value={draft.dateTo ?? ''}
          onChange={(event) => {
            setDraft((prev) => ({ ...prev, dateTo: event.target.value }));
          }}
        />
      </div>

      {fields.ride ? (
        <div className="flex flex-col gap-1">
          <Label htmlFor="queue-filter-ride">Ride ID</Label>
          <Input
            id="queue-filter-ride"
            type="text"
            placeholder="ride id"
            className="h-9 w-48"
            value={draft.rideId ?? ''}
            onChange={(event) => {
              setDraft((prev) => ({ ...prev, rideId: event.target.value }));
            }}
          />
        </div>
      ) : null}

      {fields.vehicle ? (
        <div className="flex flex-col gap-1">
          <Label htmlFor="queue-filter-vehicle">Vehicle ID</Label>
          <Input
            id="queue-filter-vehicle"
            type="text"
            placeholder="vehicle id"
            className="h-9 w-48"
            value={draft.vehicleId ?? ''}
            onChange={(event) => {
              setDraft((prev) => ({ ...prev, vehicleId: event.target.value }));
            }}
          />
        </div>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="outline">
          Apply filters
        </Button>
        {hasActiveFilter ? (
          <Button type="button" size="sm" variant="ghost" onClick={handleClear}>
            Clear
          </Button>
        ) : null}
      </div>
    </form>
  );
}
