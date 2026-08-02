'use client';

import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  Skeleton,
} from '@dripplex/ui';
import * as React from 'react';

import type { RideDto, RideStatus } from '@dripplex/types';

import { AppShell } from '@/components/app-shell';
import { RideRatingsDisplay } from '@/components/ride/ride-ratings-display';
import { TripFareSummary } from '@/components/ride/trip-fare-summary';
import { useRideHistory } from '@/hooks/rides/use-ride-history';
import { formatDate, formatNaira } from '@/lib/format';

const TABS: { key: 'all' | RideStatus; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'CANCELLED', label: 'Cancelled' },
];

function statusBadgeProps(status: RideStatus): {
  variant: 'success' | 'outline';
  className?: string;
} {
  if (status === 'COMPLETED') return { variant: 'success' };
  if (status === 'CANCELLED')
    return { variant: 'outline', className: 'text-destructive border-destructive/40' };
  return { variant: 'outline' };
}

function RideRow({ ride, onOpen }: { ride: RideDto; onOpen: () => void }): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="border-border/70 hover:bg-muted/40 flex w-full flex-col gap-1.5 border-b px-1 py-3 text-left last:border-b-0"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{formatDate(ride.requestedAt)}</span>
        <Badge {...statusBadgeProps(ride.status)}>{ride.status}</Badge>
      </div>
      <p className="text-muted-foreground truncate text-xs">
        {ride.pickupAddress ?? 'Pickup'} → {ride.dropoffAddress ?? 'Dropoff'}
      </p>
      {ride.status === 'COMPLETED' ? (
        <p className="text-sm font-semibold">
          {formatNaira(ride.driverEarning ?? 0)}
          <span className="text-muted-foreground ml-1 font-normal">earned</span>
        </p>
      ) : null}
    </button>
  );
}

export default function HistoryPage(): React.JSX.Element {
  const [tab, setTab] = React.useState<'all' | RideStatus>('all');
  const [page, setPage] = React.useState(1);
  const [selectedRide, setSelectedRide] = React.useState<RideDto | null>(null);

  const query = useRideHistory({
    page,
    limit: 20,
    ...(tab === 'all' ? {} : { status: tab }),
  });

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Ride history</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Every trip you&apos;ve driven, with fares and ratings.
          </p>
        </div>

        <div className="flex gap-2">
          {TABS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => {
                setTab(option.key);
                setPage(1);
              }}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === option.key
                  ? 'bg-secondary text-secondary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <Card>
          <CardContent className="pt-6">
            {query.isLoading ? <Skeleton className="h-64 w-full" /> : null}

            {!query.isLoading && (query.data?.items.length ?? 0) === 0 ? (
              <EmptyState
                title="No trips yet"
                description="Completed and cancelled trips will show up here."
              />
            ) : null}

            {!query.isLoading && (query.data?.items.length ?? 0) > 0 ? (
              <div>
                {query.data?.items.map((ride) => (
                  <RideRow
                    key={ride.id}
                    ride={ride}
                    onOpen={() => {
                      setSelectedRide(ride);
                    }}
                  />
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {query.data && query.data.meta.totalPages > 1 ? (
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              disabled={page <= 1}
              onClick={() => {
                setPage((p) => Math.max(1, p - 1));
              }}
            >
              Previous
            </Button>
            <span className="text-muted-foreground text-sm">
              Page {query.data.meta.page} of {query.data.meta.totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              disabled={page >= query.data.meta.totalPages}
              onClick={() => {
                setPage((p) => p + 1);
              }}
            >
              Next
            </Button>
          </div>
        ) : null}
      </div>

      <Modal
        open={selectedRide !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedRide(null);
        }}
      >
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Trip details</ModalTitle>
          </ModalHeader>
          {selectedRide ? (
            <div className="flex flex-col gap-4">
              <p className="text-muted-foreground text-sm">
                {formatDate(selectedRide.requestedAt)}
              </p>
              {selectedRide.status === 'COMPLETED' ? (
                <>
                  <TripFareSummary ride={selectedRide} />
                  <RideRatingsDisplay rideId={selectedRide.id} />
                </>
              ) : (
                <Badge {...statusBadgeProps(selectedRide.status)}>
                  {selectedRide.status}
                  {selectedRide.cancellationReason ? ` — ${selectedRide.cancellationReason}` : ''}
                </Badge>
              )}
            </div>
          ) : null}
        </ModalContent>
      </Modal>
    </AppShell>
  );
}
