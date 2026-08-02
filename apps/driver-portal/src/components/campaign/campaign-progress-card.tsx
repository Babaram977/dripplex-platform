'use client';

import { Badge, Card, CardContent, CardHeader, CardTitle, Progress, Skeleton } from '@dripplex/ui';
import * as React from 'react';

import type { DriverCampaignDashboardDto } from '@dripplex/types';

import { useDriverDashboard } from '@/hooks/use-driver-campaign';
import { formatCountdown, formatNaira, tierLabel } from '@/lib/format';

function StatBlock({ label, value }: { label: string; value: number }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-xl font-semibold tabular-nums">{value.toLocaleString('en-NG')}</span>
    </div>
  );
}

function TierProgress({
  label,
  threshold,
  qualifiedCount,
  progress,
  reached,
}: {
  label: string;
  threshold: number;
  qualifiedCount: number;
  progress: number;
  reached: boolean;
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground tabular-nums">
          {qualifiedCount}/{threshold} {reached ? '— reached' : ''}
        </span>
      </div>
      <Progress
        value={progress}
        indicatorClassName={reached ? 'bg-success' : undefined}
        aria-label={`Progress to ${label}`}
      />
    </div>
  );
}

function ProgressContent({
  dashboard,
}: {
  dashboard: DriverCampaignDashboardDto;
}): React.JSX.Element {
  const {
    campaign,
    statistics,
    progressToSilver,
    progressToGold,
    estimatedRewardAmount,
    estimatedTier,
  } = dashboard;

  if (!campaign || !statistics) {
    return (
      <p className="text-muted-foreground text-sm">
        There&apos;s no active driver referral campaign this month. Check back soon.
      </p>
    );
  }

  const qualificationRate =
    statistics.registeredCount > 0 ? statistics.qualifiedCount / statistics.registeredCount : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">{campaign.name}</p>
          <p className="text-muted-foreground text-sm">
            {formatCountdown(dashboard.campaignCountdownSeconds)}
          </p>
        </div>
        <Badge variant={estimatedTier === 'NONE' ? 'outline' : 'success'}>
          {tierLabel(estimatedTier)} tier
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatBlock label="Invited" value={statistics.invitesSent} />
        <StatBlock label="Registered" value={statistics.registeredCount} />
        <StatBlock label="Qualified (5 trips)" value={statistics.qualifiedCount} />
        <StatBlock label="Trips completed" value={statistics.completedTrips} />
      </div>

      <div className="flex flex-col gap-4">
        <TierProgress
          label={`Silver (${formatNaira(campaign.silverRewardAmount)})`}
          threshold={campaign.silverThreshold}
          qualifiedCount={statistics.qualifiedCount}
          progress={progressToSilver}
          reached={statistics.qualifiedCount >= campaign.silverThreshold}
        />
        <TierProgress
          label={`Gold (${formatNaira(campaign.goldRewardAmount)})`}
          threshold={campaign.goldThreshold}
          qualifiedCount={statistics.qualifiedCount}
          progress={progressToGold}
          reached={estimatedTier === 'GOLD'}
        />
        <p className="text-muted-foreground text-xs">
          Gold also requires a {Math.round(campaign.goldQualificationRate * 100)}% qualification
          rate — you&apos;re currently at {Math.round(qualificationRate * 100)}%.
        </p>
      </div>

      <div className="border-border/70 flex items-center justify-between rounded-md border border-dashed px-4 py-3">
        <span className="text-sm font-medium">Estimated reward this month</span>
        <span className="font-display text-lg font-semibold">
          {formatNaira(estimatedRewardAmount)}
        </span>
      </div>
    </div>
  );
}

export function CampaignProgressCard(): React.JSX.Element {
  const { data, isLoading } = useDriverDashboard();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Campaign progress</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? <Skeleton className="h-48 w-full" /> : null}
        {data ? <ProgressContent dashboard={data} /> : null}
      </CardContent>
    </Card>
  );
}
