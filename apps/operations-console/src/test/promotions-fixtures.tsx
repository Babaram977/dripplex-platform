import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';

import type {
  AcquisitionIncentiveDto,
  CampaignDetailDto,
  CampaignPerformanceDto,
  CampaignPromoterDto,
  CampaignSummaryDto,
} from '@dripplex/types';

/** Retries off and no cache between tests — a retrying query turns an error
 *  assertion into a timeout, and a shared cache leaks one test's data into the
 *  next. */
export function renderWithQuery(ui: React.ReactElement): {
  wrapper: ({ children }: { children: React.ReactNode }) => React.JSX.Element;
  element: React.ReactElement;
} {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }): React.JSX.Element => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { wrapper, element: ui };
}

/**
 * A query client that refetches for one reason only: an invalidation.
 *
 * `refetchOnWindowFocus` and a zero `staleTime` both fire incidental refetches
 * in jsdom — user-event's clicks raise focus events — and a test that asserts
 * "the campaign was re-read after the mutation" would then pass with the
 * invalidation deleted. It did: that is how a vacuous assertion was caught
 * here. `staleTime: Infinity` still refetches on invalidation, because
 * invalidation marks a query stale and refetches it regardless of staleTime.
 */
export function QueryHarness({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [client] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            gcTime: 0,
            staleTime: Number.POSITIVE_INFINITY,
            refetchOnWindowFocus: false,
            refetchOnMount: false,
            refetchOnReconnect: false,
          },
          mutations: { retry: false },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

export const emptyPerformance: CampaignPerformanceDto = {
  totalReferrals: 0,
  qualifiedReferrals: 0,
  firstCompletedRides: 0,
  conversionRate: null,
  rewardsEarnedNgn: 0,
  rewardsPendingNgn: 0,
  rewardsPaidNgn: 0,
  rewardsEarnedPoints: 0,
};

export const cashPerformance: CampaignPerformanceDto = {
  totalReferrals: 40,
  qualifiedReferrals: 10,
  firstCompletedRides: 8,
  conversionRate: 0.25,
  rewardsEarnedNgn: 3500,
  rewardsPendingNgn: 1400,
  rewardsPaidNgn: 2100,
  rewardsEarnedPoints: 0,
};

export const pointsPerformance: CampaignPerformanceDto = {
  ...emptyPerformance,
  totalReferrals: 4,
  qualifiedReferrals: 2,
  conversionRate: 0.5,
  rewardsEarnedPoints: 30_000,
};

export const cashPromoter: CampaignPromoterDto = {
  id: 'promoter-cash',
  userId: 'user-1',
  name: 'Amaka Pioneer',
  participantType: 'PIONEER_DRIVER',
  token: 'TOKENCASH1234567890ABCDEFGHIJKLMN',
  status: 'ACTIVE',
  addedAt: '2026-09-01T09:00:00.000Z',
  removedAt: null,
  rewardAmountNgn: 350,
  rewardPoints: null,
  performance: cashPerformance,
};

export const pointsPromoter: CampaignPromoterDto = {
  id: 'promoter-points',
  userId: 'user-2',
  name: 'Bayo Influencer',
  participantType: 'INFLUENCER',
  token: 'TOKENPOINTS1234567890ABCDEFGHIJK',
  status: 'ACTIVE',
  addedAt: '2026-09-02T09:00:00.000Z',
  removedAt: null,
  rewardAmountNgn: null,
  rewardPoints: 30_000,
  performance: pointsPerformance,
};

export const removedPromoter: CampaignPromoterDto = {
  id: 'promoter-removed',
  userId: 'user-3',
  name: 'Chidi Former',
  participantType: 'DRIVER',
  token: 'TOKENGONE1234567890ABCDEFGHIJKLM',
  status: 'REMOVED',
  addedAt: '2026-08-01T09:00:00.000Z',
  removedAt: '2026-09-05T09:00:00.000Z',
  rewardAmountNgn: 200,
  rewardPoints: null,
  performance: cashPerformance,
};

export const campaignSummary: CampaignSummaryDto = {
  id: 'campaign-1',
  name: 'Lagos Pioneer Drive',
  status: 'ACTIVE',
  startsAt: '2026-09-01T00:00:00.000Z',
  endsAt: null,
  promoterCount: 3,
  performance: cashPerformance,
};

export const campaignDetail: CampaignDetailDto = {
  id: 'campaign-1',
  name: 'Lagos Pioneer Drive',
  status: 'ACTIVE',
  startsAt: '2026-09-01T00:00:00.000Z',
  endsAt: null,
  performance: cashPerformance,
  promoters: [cashPromoter, pointsPromoter, removedPromoter],
};

export const acquisitionIncentive: AcquisitionIncentiveDto = {
  promotionId: '00000000-0000-4000-8000-00000000200a',
  status: 'ACTIVE',
  percentOff: 20,
  maxDiscountedRides: 3,
  refereeRewardNgn: 150,
  discountedRides: 12,
  customersBenefiting: 5,
  totalDiscountNgn: 2400,
};

/**
 * Narrow away null/undefined in a test without a non-null assertion.
 *
 * The repo forbids `!` because it silently turns a wrong assumption into a
 * confusing downstream failure. This fails on the spot and says what was
 * missing, so a fixture that stops matching reads as a fixture problem rather
 * than as the behaviour under test breaking.
 */
export function required<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) {
    throw new Error(`Test fixture problem: expected ${what} to exist`);
  }
  return value;
}

/** The first promoter of the shared campaign fixture. */
export function firstPromoter(): CampaignPromoterDto {
  return required(campaignDetail.promoters[0], 'campaignDetail.promoters[0]');
}
