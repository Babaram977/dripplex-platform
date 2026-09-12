'use client';

import { usePermission } from '@dripplex/hooks';
import { Card, CardContent, CardHeader, CardTitle, EmptyState, LoadingSpinner } from '@dripplex/ui';
import Link from 'next/link';
import * as React from 'react';

import { AppShell } from '@/components/app-shell';
import {
  AcquisitionIncentivePanel,
  ApiErrorNotice,
  RewardModelPanel,
} from '@/components/promotions-panels';
import { CampaignStatusBadge, conversion, count, naira } from '@/components/promotions-primitives';
import {
  useAcquisitionIncentive,
  useCampaigns,
  useLoyaltySettings,
} from '@/hooks/use-operations-promotions';

/**
 * DPX-PROMO-REF-001 — the Promotions tab.
 *
 * A management and read surface over `operations/promotions`, and nothing more.
 * It computes no reward, holds no rate, and offers no way to create a second
 * acquisition promotion. Every number below arrives already totalled.
 *
 * The permission checks here hide controls the operator cannot use. They are a
 * courtesy, not a control: each route enforces its own permission server-side,
 * and an operator who reached this page without `operations:promotions:read`
 * sees the API's 403, not an empty screen pretending there is no data.
 */
export function PromotionsOverview(): React.JSX.Element {
  const canRead = usePermission('operations:promotions:read');
  const campaigns = useCampaigns();
  const incentive = useAcquisitionIncentive();
  const settings = useLoyaltySettings();
  const pointsPerNaira = settings.data?.pointsPerNaira ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Promotions</h1>
        <p className="mt-1 text-sm text-gray-600">
          Referral campaigns, who promotes them, and what they have earned. Cash and DX Points are
          shown separately throughout — they are different money.
        </p>
      </div>

      {!canRead ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          You do not have the <code>operations:promotions:read</code> permission. Anything below
          that loads anyway is served by the API, which decides access on its own.
        </p>
      ) : null}

      {incentive.isError ? (
        <ApiErrorNotice
          error={incentive.error}
          onRetry={() => {
            void incentive.refetch();
          }}
        />
      ) : null}
      {incentive.data ? (
        <>
          <RewardModelPanel incentive={incentive.data} />
          <AcquisitionIncentivePanel incentive={incentive.data} />
        </>
      ) : null}

      {settings.isError ? (
        <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
          The DX Points valuation could not be loaded, so points are shown without a naira value.
          Points are not naira and no rate is assumed here.
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Campaigns</CardTitle>
          <p className="text-sm text-gray-600">
            Campaigns that have at least one promoter. Conversion is qualified over referred.
          </p>
        </CardHeader>
        <CardContent>
          {campaigns.isLoading ? <LoadingSpinner /> : null}
          {campaigns.isError ? (
            <ApiErrorNotice
              error={campaigns.error}
              onRetry={() => {
                void campaigns.refetch();
              }}
            />
          ) : null}
          {campaigns.data?.length === 0 ? (
            <EmptyState
              title="No campaigns with promoters"
              description="A campaign appears here once somebody is enrolled to promote it."
            />
          ) : null}
          {campaigns.data !== undefined && campaigns.data.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                    <th className="pb-2 pr-4 font-medium">Campaign</th>
                    <th className="pb-2 pr-4 text-right font-medium">Promoters</th>
                    <th className="pb-2 pr-4 text-right font-medium">Referrals</th>
                    <th className="pb-2 pr-4 text-right font-medium">Conversion</th>
                    <th className="pb-2 pr-4 text-right font-medium">Cash earned</th>
                    <th className="pb-2 text-right font-medium">Points earned</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.data.map((campaign) => (
                    <tr key={campaign.id} className="border-b border-gray-100 last:border-0">
                      <td className="py-3 pr-4">
                        <Link
                          href={`/promotions/${campaign.id}`}
                          className="font-medium text-emerald-700 underline"
                        >
                          {campaign.name}
                        </Link>
                        <div className="mt-1">
                          <CampaignStatusBadge status={campaign.status} />
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums">
                        {count(campaign.promoterCount)}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums">
                        {count(campaign.performance.totalReferrals)}
                        <div className="text-xs text-gray-500">
                          {count(campaign.performance.qualifiedReferrals)} qualified
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums">
                        {conversion(campaign.performance.conversionRate)}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums">
                        {naira(campaign.performance.rewardsEarnedNgn)}
                        <div className="text-xs text-gray-500">
                          {naira(campaign.performance.rewardsPendingNgn)} pending
                        </div>
                      </td>
                      {/* Points in their own column, never folded into the
                            cash total beside it. */}
                      <td className="py-3 text-right tabular-nums">
                        {count(campaign.performance.rewardsEarnedPoints)}
                        {pointsPerNaira !== null && pointsPerNaira > 0 ? (
                          <div className="text-xs text-gray-500">
                            ≈ {naira(campaign.performance.rewardsEarnedPoints / pointsPerNaira)}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

export default function PromotionsPage(): React.JSX.Element {
  return (
    <AppShell>
      <PromotionsOverview />
    </AppShell>
  );
}
