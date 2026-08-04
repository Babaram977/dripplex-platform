'use client';

import {
  SuperAppRideActionButton,
  SuperAppRideHeader,
  SuperAppRideHistoryCard,
  SuperAppRidePagination,
  SuperAppRideSegmentedTabs,
  SuperAppRideStatusBanner,
  useSuperAppFonts,
} from '@dripplex/ui';
import * as React from 'react';

import type { RideStatus } from '@dripplex/types';

import { useRideList, useRideTypeCatalog } from '@/hooks/rides';

const TABS = ['all', 'completed', 'cancelled'] as const;
type HistoryTab = (typeof TABS)[number];

const TAB_STATUS: Record<HistoryTab, RideStatus | undefined> = {
  all: undefined,
  completed: 'COMPLETED',
  cancelled: 'CANCELLED',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NG', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Real source, adapted. `onDetail` only fires for COMPLETED rides — the
 * backend's receipt endpoint (GET /customer/rides/:id/receipt) 404s for any
 * other status (ride-receipt.service.ts requires status === COMPLETED), so
 * non-completed rows render as static (non-tappable) cards instead of
 * linking to a detail view that would fail. Pagination is real
 * (ListRidesQueryDto page/limit), not a fabricated infinite scroll.
 */
export function RideHistoryScreen({
  onBack,
  onDetail,
}: {
  onBack: () => void;
  onDetail: (rideId: string) => void;
}): React.JSX.Element {
  const [tab, setTab] = React.useState<HistoryTab>('all');
  const [page, setPage] = React.useState(1);
  const rides = useRideList({ page, limit: 20, status: TAB_STATUS[tab] });
  const rideTypeCatalog = useRideTypeCatalog();
  const { body } = useSuperAppFonts();

  const rideTypeLabel = (type: string): string =>
    rideTypeCatalog.data?.find((entry) => entry.type === type)?.displayName ?? type;

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#0A1628' }}
    >
      <SuperAppRideHeader onBack={onBack} title="Ride History" />
      <div className="flex-shrink-0 px-5 pb-4 pt-3">
        <SuperAppRideSegmentedTabs
          tabs={TABS.map((t) => ({ key: t, label: t }))}
          selectedKey={tab}
          onSelect={(t) => {
            setTab(t);
            setPage(1);
          }}
        />
      </div>
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 pb-4">
        {rides.isLoading ? (
          <p className={`py-4 text-[13px] ${body}`} style={{ color: 'rgba(255,255,255,.5)' }}>
            Loading your rides…
          </p>
        ) : null}
        {rides.isError ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <SuperAppRideStatusBanner
              tone="error"
              title="Couldn't load your rides"
              subtitle="Check your connection and try again."
            />
            <div className="w-full max-w-[200px]">
              <SuperAppRideActionButton
                label="Retry"
                variant="secondary"
                onClick={() => {
                  void rides.refetch();
                }}
              />
            </div>
          </div>
        ) : null}
        {!rides.isLoading && !rides.isError && (rides.data?.items.length ?? 0) === 0 ? (
          <p className={`py-4 text-[13px] ${body}`} style={{ color: 'rgba(255,255,255,.5)' }}>
            No rides here yet.
          </p>
        ) : null}
        {(rides.data?.items ?? []).map((ride) => {
          const completed = ride.status === 'COMPLETED';
          return (
            <SuperAppRideHistoryCard
              key={ride.id}
              icon={completed ? '🚗' : '❌'}
              tone={completed ? 'success' : 'error'}
              title={rideTypeLabel(ride.rideType)}
              dateLabel={formatDate(ride.requestedAt)}
              fare={`₦${ride.totalFare.toLocaleString()}`}
              pickupAddress={ride.pickupAddress ?? 'Pickup location'}
              dropoffAddress={ride.dropoffAddress ?? 'Drop-off location'}
              note={!completed && ride.cancellationReason ? ride.cancellationReason : undefined}
              onClick={
                completed
                  ? () => {
                      onDetail(ride.id);
                    }
                  : undefined
              }
            />
          );
        })}
        {rides.data && rides.data.meta.totalPages > 1 ? (
          <SuperAppRidePagination
            page={page}
            totalPages={rides.data.meta.totalPages}
            onPrevious={() => {
              setPage((p) => p - 1);
            }}
            onNext={() => {
              setPage((p) => p + 1);
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
