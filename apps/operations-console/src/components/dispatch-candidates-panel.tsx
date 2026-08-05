'use client';

import { Button, EmptyState, LoadingSpinner } from '@dripplex/ui';
import * as React from 'react';

import { useDispatchCandidates } from '@/hooks/use-ride-detail';

function formatEtaMinutes(etaSeconds: number): string {
  const minutes = Math.round(etaSeconds / 60);
  return minutes <= 1 ? '~1 min' : `~${String(minutes)} min`;
}

function formatDistanceKm(distanceMeters: number): string {
  return `${(distanceMeters / 1000).toFixed(1)} km`;
}

/**
 * DPX-OPS-001 Slice 3 — the founder's DPX-RIDE-201 decision-support panel.
 * Informational only: this tells an operator "these are the best available
 * drivers for this ride." It does not, and must not, let them act on that
 * information — there is deliberately no "Assign" control anywhere in this
 * component. Manual reassignment stays out of scope until DPX-RIDE-201
 * itself is activated by its own separate founder approval.
 *
 * Fetched lazily (not on the page's 15s poll) — an operator only pays the
 * nearby-driver query cost when they actually open this panel.
 */
export function DispatchCandidatesPanel({ rideId }: { rideId: string }): React.JSX.Element {
  const [expanded, setExpanded] = React.useState(false);
  const support = useDispatchCandidates(rideId, expanded);

  if (!expanded) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setExpanded(true);
        }}
      >
        Show best available drivers
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-xs">
        Decision support only — reassignment isn&apos;t available yet.
      </p>

      {support.isLoading ? <LoadingSpinner label="Finding nearby drivers…" /> : null}

      {support.isError ? (
        <EmptyState
          title="Couldn't load nearby drivers"
          description="Check your connection and try again."
        />
      ) : null}

      {support.data?.candidates.length === 0 ? (
        <EmptyState
          title="No eligible drivers nearby"
          description="No online, accepting driver of the right vehicle type is within range."
        />
      ) : null}

      {support.data && support.data.candidates.length > 0 ? (
        <ul className="divide-border/70 divide-y">
          {support.data.candidates.map((candidate) => (
            <li key={candidate.driverId} className="flex flex-col gap-1 py-2.5 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{candidate.driverName}</span>
                <span className="text-muted-foreground text-xs">
                  {formatDistanceKm(candidate.distanceMeters)} ·{' '}
                  {formatEtaMinutes(candidate.etaSeconds)} estimate
                </span>
              </div>
              <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                {candidate.vehiclePlateNumber ? <span>{candidate.vehiclePlateNumber}</span> : null}
                <span>
                  {candidate.averageRating !== null
                    ? `★ ${candidate.averageRating.toFixed(1)} (${String(candidate.ratingCount)})`
                    : 'No ratings yet'}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
