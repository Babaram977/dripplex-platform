'use client';

import { Badge, Card, CardContent, CardHeader, CardTitle, Progress, Skeleton } from '@dripplex/ui';
import Link from 'next/link';
import * as React from 'react';

import { useDriverDashboard } from '@/hooks/use-driver-campaign';
import { formatCountdown, formatNaira, tierLabel } from '@/lib/format';

/**
 * Compact dashboard summary of the Driver Growth Campaign — the full
 * referral code + detailed progress view lives at /campaign. "Promotion
 * status" and "Referral progress" from the Dashboard spec both map onto
 * this same campaign data; there is no separate driver-facing promotions
 * feed (RIDE-004.2's Promotion Platform integration targets customer fare
 * discounts, not driver-side promotions).
 */
export function ReferralPromoSummaryCard(): React.JSX.Element {
  const { data, isLoading } = useDriverDashboard();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Referral & rewards</CardTitle>
        <Link href="/campaign" className="text-primary text-xs font-medium">
          View details
        </Link>
      </CardHeader>
      <CardContent>
        {isLoading ? <Skeleton className="h-20 w-full" /> : null}
        {!isLoading && data?.campaign ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">
                {formatCountdown(data.campaignCountdownSeconds)}
              </span>
              <Badge variant={data.estimatedTier === 'NONE' ? 'outline' : 'success'}>
                {tierLabel(data.estimatedTier)} tier
              </Badge>
            </div>
            <Progress value={data.progressToGold} aria-label="Progress to gold tier" />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Estimated reward</span>
              <span className="font-semibold">{formatNaira(data.estimatedRewardAmount)}</span>
            </div>
          </div>
        ) : null}
        {!isLoading && !data?.campaign ? (
          <p className="text-muted-foreground text-sm">
            There&apos;s no active driver referral campaign this month.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
