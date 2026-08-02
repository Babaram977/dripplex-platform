'use client';

import { useQuery } from '@tanstack/react-query';

import { rideQueryKeys } from './query-keys';

import type { RideDto } from '@dripplex/types';
import type { UseQueryResult } from '@tanstack/react-query';

import { sdk } from '@/lib/sdk';

export interface DriverRideStats {
  todayTrips: number;
  todayEarnings: number;
  weekTrips: number;
  weekEarnings: number;
  monthTrips: number;
  monthEarnings: number;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function startOfWeek(reference: Date): Date {
  const start = new Date(reference);
  const day = start.getDay();
  start.setDate(start.getDate() - day);
  start.setHours(0, 0, 0, 0);
  return start;
}

function startOfMonth(reference: Date): Date {
  return new Date(reference.getFullYear(), reference.getMonth(), 1);
}

function deriveStats(rides: RideDto[]): DriverRideStats {
  const now = new Date();
  const weekStart = startOfWeek(now);
  const monthStart = startOfMonth(now);
  let todayTrips = 0;
  let todayEarnings = 0;
  let weekTrips = 0;
  let weekEarnings = 0;
  let monthTrips = 0;
  let monthEarnings = 0;

  for (const ride of rides) {
    if (!ride.completedAt) continue;
    const completedAt = new Date(ride.completedAt);
    const earning = ride.driverEarning ?? 0;

    if (completedAt >= monthStart) {
      monthTrips += 1;
      monthEarnings += earning;
    }
    if (completedAt >= weekStart) {
      weekTrips += 1;
      weekEarnings += earning;
    }
    if (isSameDay(completedAt, now)) {
      todayTrips += 1;
      todayEarnings += earning;
    }
  }

  return { todayTrips, todayEarnings, weekTrips, weekEarnings, monthTrips, monthEarnings };
}

/**
 * Derived client-side from the driver's own recent completed rides
 * (RideDto.driverEarning is already computed by RideSettlementService —
 * no need to re-derive earnings from wallet ledger entries). Shared by
 * the dashboard's at-a-glance summary and the Earnings screen's
 * daily/weekly/monthly breakdown. The backend has no date-range query
 * support, so this is bounded to the driver's 200 most recent completed
 * rides rather than a true "this calendar month" total for very
 * high-volume drivers — an honest scale limitation, not a bug.
 */
export function useDriverRideStats(): UseQueryResult<DriverRideStats> {
  return useQuery({
    queryKey: rideQueryKeys.list({ status: 'COMPLETED', limit: 200 }),
    queryFn: async () => {
      const page = await sdk.rides.listOwnRides({ status: 'COMPLETED', limit: 200 });
      return deriveStats(page.items);
    },
    refetchInterval: 60_000,
  });
}
