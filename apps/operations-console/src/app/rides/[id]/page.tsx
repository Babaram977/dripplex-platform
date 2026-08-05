'use client';

import { Card, CardContent, CardHeader, CardTitle, EmptyState, LoadingSpinner } from '@dripplex/ui';
import { formatDate, formatRelativeTime } from '@dripplex/utils';
import { useParams } from 'next/navigation';
import * as React from 'react';

import { AppShell } from '@/components/app-shell';
import { DispatchCandidatesPanel } from '@/components/dispatch-candidates-panel';
import { DispatchExceptionBanner } from '@/components/dispatch-exception-banner';
import { RideAllocationTimeline } from '@/components/ride-allocation-timeline';
import { RideStatusBadge } from '@/components/ride-status-badge';
import { TripTrackingPanel } from '@/components/trip-tracking-panel';
import { useRideAllocation, useRideDetail, useTripTracking } from '@/hooks/use-ride-detail';
import { computeDispatchExceptions } from '@/lib/dispatch-exceptions';

const RIDE_TYPE_LABEL: Record<string, string> = {
  ECONOMY: 'DX Ride',
  COMFORT: 'DX Comfort',
  XL: 'DX XL',
  TRICYCLE: 'DX Tricycle',
};

const SETTLED_STATUSES = new Set(['COMPLETED', 'CANCELLED']);

function formatTimestamp(value: string): string {
  return formatDate(value, 'en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * DPX-OPS-001 Slice 3 — the ride detail view for Dispatch Management.
 * Founder's own ordering for what an operator should be able to answer
 * quickly: where is the trip → what state is it in → who's involved →
 * what happened during dispatch → is there a problem → what options are
 * available. This page follows that order top to bottom, with the
 * exception banner given strong visual priority right under the header
 * per the founder's explicit UX direction.
 */
export default function RideDetailPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const rideId = params.id;
  const detailQuery = useRideDetail(rideId);
  const allocationQuery = useRideAllocation(rideId);
  const trackingQuery = useTripTracking(rideId);

  const detail = detailQuery.data;
  const exceptions = detail ? computeDispatchExceptions(detail, allocationQuery.data) : [];
  const isSettled = detail ? SETTLED_STATUSES.has(detail.status) : false;

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        {detailQuery.isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner label="Loading ride…" />
          </div>
        ) : null}

        {detailQuery.isError ? (
          <EmptyState
            title="Couldn't load this ride"
            description="Check your connection and try again."
          />
        ) : null}

        {detail ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="font-display text-3xl font-semibold tracking-tight">
                  {detail.customerName} → {detail.driverName ?? 'Unassigned'}
                </h1>
                <p className="text-muted-foreground mt-1 text-sm">
                  {RIDE_TYPE_LABEL[detail.rideType] ?? detail.rideType} · Requested{' '}
                  {formatRelativeTime(detail.requestedAt)}
                </p>
              </div>
              <RideStatusBadge status={detail.status} />
            </div>

            <DispatchExceptionBanner exceptions={exceptions} />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Trip</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Pickup</p>
                    <p>
                      {detail.pickupAddress ??
                        `${detail.pickupLatitude.toFixed(5)}, ${detail.pickupLongitude.toFixed(5)}`}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Dropoff</p>
                    <p>
                      {detail.dropoffAddress ??
                        `${detail.dropoffLatitude.toFixed(5)}, ${detail.dropoffLongitude.toFixed(5)}`}
                    </p>
                  </div>
                  <div className="border-border/70 grid grid-cols-2 gap-x-4 gap-y-1 border-t pt-3 text-xs">
                    <span className="text-muted-foreground">Requested</span>
                    <span>{formatTimestamp(detail.requestedAt)}</span>
                    {detail.assignedAt ? (
                      <>
                        <span className="text-muted-foreground">Assigned</span>
                        <span>{formatTimestamp(detail.assignedAt)}</span>
                      </>
                    ) : null}
                    {detail.arrivedAt ? (
                      <>
                        <span className="text-muted-foreground">Driver arrived</span>
                        <span>{formatTimestamp(detail.arrivedAt)}</span>
                      </>
                    ) : null}
                    {detail.startedAt ? (
                      <>
                        <span className="text-muted-foreground">Trip started</span>
                        <span>{formatTimestamp(detail.startedAt)}</span>
                      </>
                    ) : null}
                    {detail.completedAt ? (
                      <>
                        <span className="text-muted-foreground">Completed</span>
                        <span>{formatTimestamp(detail.completedAt)}</span>
                      </>
                    ) : null}
                    {detail.cancelledAt ? (
                      <>
                        <span className="text-muted-foreground">Cancelled</span>
                        <span>
                          {formatTimestamp(detail.cancelledAt)}
                          {detail.cancelledBy ? ` · by ${detail.cancelledBy.toLowerCase()}` : ''}
                        </span>
                      </>
                    ) : null}
                  </div>
                  <div className="border-border/70 flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs">
                    <span className="text-muted-foreground">Fare</span>
                    <span className="font-medium">
                      ₦{detail.totalFare.toLocaleString('en-NG')}
                      {detail.paymentMethod ? ` · ${detail.paymentMethod}` : ''} ·{' '}
                      {detail.paymentStatus.toLowerCase()}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Live location</CardTitle>
                </CardHeader>
                <CardContent>
                  {trackingQuery.isLoading ? (
                    <LoadingSpinner label="Loading location…" />
                  ) : trackingQuery.data ? (
                    <TripTrackingPanel tracking={trackingQuery.data} />
                  ) : (
                    <EmptyState
                      title="Couldn't load location"
                      description="Check your connection and try again."
                    />
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Who&apos;s involved</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-muted-foreground text-xs">Customer</p>
                  <p className="font-medium">{detail.customerName}</p>
                  {detail.customerPhone ? (
                    <p className="text-muted-foreground text-xs">{detail.customerPhone}</p>
                  ) : null}
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Driver</p>
                  <p className="font-medium">{detail.driverName ?? 'No driver assigned yet'}</p>
                  {detail.driverPhone ? (
                    <p className="text-muted-foreground text-xs">{detail.driverPhone}</p>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Dispatch history</CardTitle>
              </CardHeader>
              <CardContent>
                {allocationQuery.isLoading ? (
                  <LoadingSpinner label="Loading dispatch history…" />
                ) : allocationQuery.data ? (
                  <RideAllocationTimeline allocation={allocationQuery.data} />
                ) : (
                  <EmptyState
                    title="Couldn't load dispatch history"
                    description="Check your connection and try again."
                  />
                )}
              </CardContent>
            </Card>

            {!isSettled ? (
              <Card>
                <CardHeader>
                  <CardTitle>Reassign driver</CardTitle>
                </CardHeader>
                <CardContent>
                  <DispatchCandidatesPanel rideId={rideId} />
                </CardContent>
              </Card>
            ) : null}
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
