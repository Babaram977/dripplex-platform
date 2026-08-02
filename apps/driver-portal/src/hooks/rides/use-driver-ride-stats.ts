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

function deriveStats(rides: RideDto[]): DriverRideStats {
  const now = new Date();
  const weekStart = startOfWeek(now);
  let todayTrips = 0;
  let todayEarnings = 0;
  let weekTrips = 0;
  let weekEarnings = 0;

  for (const ride of rides) {
    if (!ride.completedAt) continue;
    const completedAt = new Date(ride.completedAt);
    const earning = ride.driverEarning ?? 0;

    if (completedAt >= weekStart) {
      weekTrips += 1;
      weekEarnings += earning;
    }
    if (isSameDay(completedAt, now)) {
      todayTrips += 1;
      todayEarnings += earning;
    }
  }

  return { todayTrips, todayEarnings, weekTrips, weekEarnings };
}

/**
 * Derived client-side from the driver's own recent completed rides
 * (RideDto.driverEarning is already computed by RideSettlementService —
 * no need to re-derive earnings from wallet ledger entries). Full
 * daily/weekly/monthly breakdowns with pagination land in the Earnings
 * screen (Slice 4); this is just the dashboard's at-a-glance summary.
 */
export function useDriverRideStats(): UseQueryResult<DriverRideStats> {
  return useQuery({
    queryKey: rideQueryKeys.list({ status: 'COMPLETED', limit: 100 }),
    queryFn: async () => {
      const page = await sdk.rides.listOwnRides({ status: 'COMPLETED', limit: 100 });
      return deriveStats(page.items);
    },
    refetchInterval: 60_000,
  });
}
