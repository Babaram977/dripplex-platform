'use client';

import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Skeleton,
} from '@dripplex/ui';
import { Download } from 'lucide-react';
import * as React from 'react';

import type { DriverReferralRewardDto, DriverReferralRewardStatus } from '@dripplex/types';
import type { BadgeProps } from '@dripplex/ui';

import { useDriverDashboard } from '@/hooks/use-driver-campaign';
import { formatDate, formatNaira, tierLabel } from '@/lib/format';

const STATUS_VARIANT: Record<DriverReferralRewardStatus, BadgeProps['variant']> = {
  PENDING: 'outline',
  APPROVED: 'accent',
  REJECTED: 'outline',
  PAID: 'success',
};

const STATUS_LABEL: Record<DriverReferralRewardStatus, string> = {
  PENDING: 'Pending review',
  APPROVED: 'Approved — awaiting payout',
  REJECTED: 'Rejected',
  PAID: 'Paid',
};

function downloadReceipt(reward: DriverReferralRewardDto): void {
  const lines = [
    'DrippleX Driver Growth Campaign — Reward Receipt',
    `Reward ID: ${reward.id}`,
    `Tier: ${tierLabel(reward.tier)}`,
    `Qualified passengers: ${String(reward.qualifiedPassengerCount)}`,
    `Amount: ${formatNaira(reward.amount)}`,
    `Status: ${STATUS_LABEL[reward.status]}`,
    reward.approvedAt ? `Approved: ${formatDate(reward.approvedAt)}` : null,
    reward.paidAt ? `Paid: ${formatDate(reward.paidAt)}` : null,
  ].filter((line): line is string => line !== null);

  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `dripplex-referral-reward-${reward.id}.txt`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function RewardRow({ reward }: { reward: DriverReferralRewardDto }): React.JSX.Element {
  return (
    <div className="border-border/70 flex flex-wrap items-center justify-between gap-3 border-b py-4 last:border-b-0">
      <div>
        <p className="font-medium">
          {tierLabel(reward.tier)} tier — {reward.qualifiedPassengerCount} qualified passengers
        </p>
        <p className="text-muted-foreground text-sm">
          {reward.paidAt
            ? `Paid ${formatDate(reward.paidAt)}`
            : reward.approvedAt
              ? `Approved ${formatDate(reward.approvedAt)}`
              : 'Awaiting campaign end for review'}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-display text-base font-semibold">{formatNaira(reward.amount)}</span>
        <Badge variant={STATUS_VARIANT[reward.status]}>{STATUS_LABEL[reward.status]}</Badge>
        <button
          type="button"
          onClick={() => {
            downloadReceipt(reward);
          }}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Download receipt"
        >
          <Download className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function RewardHistoryList(): React.JSX.Element {
  const { data, isLoading } = useDriverDashboard();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reward history</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? <Skeleton className="h-40 w-full" /> : null}
        {data?.rewardHistory.length === 0 ? (
          <EmptyState
            title="No rewards yet"
            description="Rewards appear here once a campaign month ends and your tier is confirmed."
          />
        ) : null}
        {data && data.rewardHistory.length > 0
          ? data.rewardHistory.map((reward) => <RewardRow key={reward.id} reward={reward} />)
          : null}
      </CardContent>
    </Card>
  );
}
