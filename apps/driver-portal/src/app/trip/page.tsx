'use client';

import { Badge, Button, Card, CardContent, EmptyState, LoadingSpinner } from '@dripplex/ui';
import Link from 'next/link';
import * as React from 'react';

import type { RideDto } from '@dripplex/types';

import { AppShell } from '@/components/app-shell';
import { CustomerRatingForm } from '@/components/ride/customer-rating-form';
import { MapCanvas } from '@/components/ride/map-canvas';
import { PassengerCard } from '@/components/ride/passenger-card';
import { TripFareSummary } from '@/components/ride/trip-fare-summary';
import { useActiveRide } from '@/hooks/rides/use-active-ride';
import {
  useCancelTrip,
  useCompleteTrip,
  useMarkArrived,
  useStartTrip,
} from '@/hooks/rides/use-trip-actions';
import { buildDirectionsUrl } from '@/lib/maps';

function formatElapsed(startedAt: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${String(minutes)}:${String(remaining).padStart(2, '0')}`;
}

function useElapsed(startedAt: string | null): string {
  const [elapsed, setElapsed] = React.useState(() =>
    startedAt ? formatElapsed(startedAt) : '0:00',
  );

  React.useEffect(() => {
    if (!startedAt) return undefined;
    const interval = setInterval(() => {
      setElapsed(formatElapsed(startedAt));
    }, 1000);
    return () => {
      clearInterval(interval);
    };
  }, [startedAt]);

  return elapsed;
}

function AssignedSection({ ride }: { ride: RideDto }): React.JSX.Element {
  const markArrived = useMarkArrived();
  const cancelTrip = useCancelTrip();

  return (
    <div className="flex flex-col gap-4">
      <div className="h-64 overflow-hidden rounded-md">
        <MapCanvas variant="assigned" />
      </div>
      <PassengerCard />
      <div className="flex flex-col gap-2 text-sm">
        <div className="flex items-start gap-2">
          <span className="bg-primary mt-1.5 h-2 w-2 flex-shrink-0 rounded-full" />
          <span>{ride.pickupAddress ?? 'Pickup location on the map'}</span>
        </div>
      </div>
      <a
        href={buildDirectionsUrl({
          latitude: ride.pickupLatitude,
          longitude: ride.pickupLongitude,
        })}
        target="_blank"
        rel="noreferrer"
      >
        <Button type="button" variant="outline" className="w-full">
          Navigate to pickup
        </Button>
      </a>
      <Button
        type="button"
        className="w-full"
        onClick={() => {
          markArrived.mutate(ride.id);
        }}
        disabled={markArrived.isPending}
      >
        I&apos;ve arrived
      </Button>
      {markArrived.isError ? (
        <p className="text-destructive text-xs">Couldn&apos;t update the trip. Try again.</p>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        className="text-destructive w-full"
        onClick={() => {
          cancelTrip.mutate({ rideId: ride.id });
        }}
        disabled={cancelTrip.isPending}
      >
        Cancel trip
      </Button>
    </div>
  );
}

function ArrivedSection({ ride }: { ride: RideDto }): React.JSX.Element {
  const startTrip = useStartTrip();
  const cancelTrip = useCancelTrip();

  return (
    <div className="flex flex-col gap-4">
      <div className="h-64 overflow-hidden rounded-md">
        <MapCanvas variant="arrived" />
      </div>
      <PassengerCard />
      <Button
        type="button"
        className="w-full"
        onClick={() => {
          startTrip.mutate(ride.id);
        }}
        disabled={startTrip.isPending}
      >
        Start trip
      </Button>
      {startTrip.isError ? (
        <p className="text-destructive text-xs">
          {startTrip.error.message.includes('too far')
            ? startTrip.error.message
            : "Couldn't start the trip. Make sure location access is on and try again."}
        </p>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        className="text-destructive w-full"
        onClick={() => {
          cancelTrip.mutate({ rideId: ride.id });
        }}
        disabled={cancelTrip.isPending}
      >
        Cancel trip
      </Button>
    </div>
  );
}

function InProgressSection({ ride }: { ride: RideDto }): React.JSX.Element {
  const completeTrip = useCompleteTrip();
  const elapsed = useElapsed(ride.startedAt);

  return (
    <div className="flex flex-col gap-4">
      <div className="h-64 overflow-hidden rounded-md">
        <MapCanvas variant="inprogress" />
      </div>
      <div className="flex items-center justify-between">
        <Badge variant="success">Trip in progress</Badge>
        <span className="text-sm font-medium tabular-nums">{elapsed}</span>
      </div>
      <div className="flex flex-col gap-2 text-sm">
        <div className="flex items-start gap-2">
          <span className="bg-muted-foreground mt-1.5 h-2 w-2 flex-shrink-0 rounded-full" />
          <span>{ride.dropoffAddress ?? 'Dropoff location on the map'}</span>
        </div>
      </div>
      <a
        href={buildDirectionsUrl({
          latitude: ride.dropoffLatitude,
          longitude: ride.dropoffLongitude,
        })}
        target="_blank"
        rel="noreferrer"
      >
        <Button type="button" variant="outline" className="w-full">
          Navigate to dropoff
        </Button>
      </a>
      <Button
        type="button"
        className="w-full"
        onClick={() => {
          completeTrip.mutate(ride.id);
        }}
        disabled={completeTrip.isPending}
      >
        End trip
      </Button>
      {completeTrip.isError ? (
        <p className="text-destructive text-xs">Couldn&apos;t complete the trip. Try again.</p>
      ) : null}
    </div>
  );
}

function CompletedSection({ ride }: { ride: RideDto }): React.JSX.Element {
  const [rated, setRated] = React.useState(false);

  return (
    <div className="flex flex-col gap-4">
      <Badge variant="success" className="w-fit">
        Trip completed
      </Badge>
      <TripFareSummary ride={ride} />
      {rated ? (
        <p className="text-muted-foreground text-sm">Thanks for rating your passenger.</p>
      ) : (
        <CustomerRatingForm
          rideId={ride.id}
          onSubmitted={() => {
            setRated(true);
          }}
        />
      )}
      <Link href="/">
        <Button type="button" variant="outline" className="w-full">
          Back to dashboard
        </Button>
      </Link>
    </div>
  );
}

export default function TripPage(): React.JSX.Element {
  const activeRide = useActiveRide();
  const [completedRide, setCompletedRide] = React.useState<RideDto | null>(null);

  const ride = completedRide ?? activeRide.data;

  React.useEffect(() => {
    if (activeRide.data?.status === 'COMPLETED') {
      setCompletedRide(activeRide.data);
    }
  }, [activeRide.data]);

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Current trip</h1>

        {activeRide.isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : null}

        {!activeRide.isLoading && !ride ? (
          <EmptyState
            title="No active trip"
            description="Accept a ride request from your dashboard to get started."
          />
        ) : null}

        {ride ? (
          <Card>
            <CardContent className="pt-6">
              {ride.status === 'DRIVER_ASSIGNED' ? <AssignedSection ride={ride} /> : null}
              {ride.status === 'ARRIVED' ? <ArrivedSection ride={ride} /> : null}
              {ride.status === 'IN_PROGRESS' ? <InProgressSection ride={ride} /> : null}
              {ride.status === 'COMPLETED' ? <CompletedSection ride={ride} /> : null}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}
