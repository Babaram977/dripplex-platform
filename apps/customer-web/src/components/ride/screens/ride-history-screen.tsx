'use client';

import * as React from 'react';

import { RideHeader } from '../ride-ui';

import type { RideStatus } from '@dripplex/types';

import { useRideList } from '@/hooks/rides';

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

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#0A1628' }}
    >
      <RideHeader onBack={onBack} title="Ride History" />
      <div className="flex-shrink-0 px-5 pb-4 pt-3">
        <div className="flex gap-2">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTab(t);
                setPage(1);
              }}
              className="h-9 flex-1 rounded-xl text-[12px] font-semibold capitalize"
              style={{
                background: tab === t ? '#2BAC52' : '#112238',
                color: tab === t ? '#fff' : 'rgba(255,255,255,.38)',
                fontFamily: "'Inter',sans-serif",
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 pb-4">
        {rides.isLoading ? (
          <p
            className="py-4 text-[13px]"
            style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.38)' }}
          >
            Loading your rides…
          </p>
        ) : null}
        {!rides.isLoading && (rides.data?.items.length ?? 0) === 0 ? (
          <p
            className="py-4 text-[13px]"
            style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.38)' }}
          >
            No rides here yet.
          </p>
        ) : null}
        {(rides.data?.items ?? []).map((ride) => {
          const completed = ride.status === 'COMPLETED';
          const content = (
            <>
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-xl text-base"
                    style={{
                      background: completed ? 'rgba(43,172,82,.12)' : 'rgba(239,68,68,.1)',
                    }}
                  >
                    {completed ? '🚗' : '❌'}
                  </div>
                  <div>
                    <p
                      className="text-[13px] font-semibold capitalize"
                      style={{ fontFamily: "'Poppins',sans-serif", color: '#fff' }}
                    >
                      {ride.rideType.toLowerCase()} Ride
                    </p>
                    <p
                      className="text-[11px]"
                      style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.38)' }}
                    >
                      {formatDate(ride.requestedAt)}
                    </p>
                  </div>
                </div>
                <p
                  className="text-[15px] font-bold"
                  style={{ fontFamily: "'Poppins',sans-serif", color: '#fff' }}
                >
                  ₦{ride.totalFare.toLocaleString()}
                </p>
              </div>
              <div className="mb-1 flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full" style={{ background: '#2BAC52' }} />
                <p
                  className="text-[12px]"
                  style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.6)' }}
                >
                  {ride.pickupAddress ?? 'Pickup location'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full" style={{ background: '#EF4444' }} />
                <p
                  className="text-[12px]"
                  style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.6)' }}
                >
                  {ride.dropoffAddress ?? 'Drop-off location'}
                </p>
              </div>
              {!completed && ride.cancellationReason ? (
                <p
                  className="mt-2 text-[11px]"
                  style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(239,68,68,.7)' }}
                >
                  {ride.cancellationReason}
                </p>
              ) : null}
            </>
          );
          if (completed) {
            return (
              <button
                key={ride.id}
                type="button"
                onClick={() => {
                  onDetail(ride.id);
                }}
                className="w-full rounded-2xl p-4 text-left"
                style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
              >
                {content}
              </button>
            );
          }
          return (
            <div
              key={ride.id}
              className="w-full rounded-2xl p-4"
              style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
            >
              {content}
            </div>
          );
        })}
        {rides.data && rides.data.meta.totalPages > 1 ? (
          <div className="mb-2 flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => {
                setPage((p) => p - 1);
              }}
              className="h-10 flex-1 rounded-xl text-[13px] font-semibold disabled:opacity-30"
              style={{
                background: '#112238',
                color: 'rgba(255,255,255,.6)',
                fontFamily: "'Inter',sans-serif",
              }}
            >
              Previous
            </button>
            <p
              className="text-[12px]"
              style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.38)' }}
            >
              Page {page} of {rides.data.meta.totalPages}
            </p>
            <button
              type="button"
              disabled={page >= rides.data.meta.totalPages}
              onClick={() => {
                setPage((p) => p + 1);
              }}
              className="h-10 flex-1 rounded-xl text-[13px] font-semibold disabled:opacity-30"
              style={{
                background: '#112238',
                color: 'rgba(255,255,255,.6)',
                fontFamily: "'Inter',sans-serif",
              }}
            >
              Next
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
