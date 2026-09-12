'use client';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Select,
} from '@dripplex/ui';
import * as React from 'react';

import type {
  AcquisitionIncentiveDto,
  AddCampaignPromoterRequest,
  CampaignDetailDto,
  CampaignParticipantType,
  CampaignPerformanceDto,
} from '@dripplex/types';

import {
  CampaignStatusBadge,
  PARTICIPANT_TYPE_LABEL,
  PointsValue,
  PromoterStatusBadge,
  PromoterToken,
  RewardValue,
  conversion,
  count,
  naira,
} from '@/components/promotions-primitives';
import { describeSdkError } from '@/lib/sdk';

/** One consistent failure surface. Every message comes from the server's own
 *  description of the error — a 403 says it is a permission problem and not
 *  "something went wrong", because those need different reactions. */
export function ApiErrorNotice({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}): React.JSX.Element {
  const described = describeSdkError(error);
  return (
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm">
      <p className="font-semibold text-red-800">{described.title}</p>
      <p className="text-red-700">{described.description}</p>
      {onRetry !== undefined && described.retryable ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 font-semibold text-red-800 underline"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}

/**
 * A campaign or promoter rollup.
 *
 * Naira and DX Points sit in separate rows under separate headings. There is
 * deliberately no "total earned" that adds them: they are different
 * liabilities, settled through different paths, and one combined number would
 * be the first step towards treating 15,000 points as ₦15,000.
 */
export function PerformanceStats({
  performance,
  pointsPerNaira,
}: {
  performance: CampaignPerformanceDto;
  pointsPerNaira: number | null;
}): React.JSX.Element {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <p className="text-xs uppercase tracking-wide text-gray-500">Referrals</p>
        <p className="text-xl font-semibold tabular-nums text-gray-900">
          {count(performance.totalReferrals)}
        </p>
        <p className="text-xs text-gray-500">
          {count(performance.qualifiedReferrals)} qualified ·{' '}
          {conversion(performance.conversionRate)}
        </p>
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-gray-500">First rides completed</p>
        <p className="text-xl font-semibold tabular-nums text-gray-900">
          {count(performance.firstCompletedRides)}
        </p>
        <p className="text-xs text-gray-500">
          Counted from rides — a referral can qualify on an order instead
        </p>
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-gray-500">Cash rewards (₦)</p>
        <p className="text-xl font-semibold tabular-nums text-gray-900">
          {naira(performance.rewardsEarnedNgn)}
        </p>
        <p className="text-xs text-gray-500">
          {naira(performance.rewardsPendingNgn)} pending · {naira(performance.rewardsPaidNgn)} paid
        </p>
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-gray-500">Points rewards</p>
        <p className="text-xl font-semibold tabular-nums text-gray-900">
          {count(performance.rewardsEarnedPoints)}
        </p>
        <p className="text-xs text-gray-500">
          <PointsValue
            points={performance.rewardsEarnedPoints}
            valueNgn={performance.rewardsEarnedPointsValueNgn}
            pointsPerNaira={pointsPerNaira}
          />
        </p>
      </div>
    </div>
  );
}

/**
 * The three rewards, side by side, because they are the three things this
 * programme is most often wrong about.
 *
 * A promoter's reward, the new customer's signup reward, and the new customer's
 * ride discount are paid to different people, out of different budgets, on
 * different triggers. Every figure here is stated by the server; none is
 * computed or assumed by this screen.
 */
export function RewardModelPanel({
  incentive,
}: {
  incentive: AcquisitionIncentiveDto;
}): React.JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>What each side gets</CardTitle>
        <p className="text-sm text-gray-600">
          Three separate rewards. They are paid to different people and are never substitutes for
          one another.
        </p>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-gray-200 p-3">
          <p className="text-sm font-semibold text-gray-900">Promoter reward</p>
          <p className="mt-1 text-xs text-gray-600">
            Paid to the person who promoted, per qualified acquisition. Set per promoter on their
            campaign row — it is the only one of the three that varies by who referred.
          </p>
          <p className="mt-2 text-xs text-gray-500">See each promoter&apos;s row below.</p>
        </div>
        <div className="rounded-lg border border-gray-200 p-3">
          <p className="text-sm font-semibold text-gray-900">New customer reward</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">
            {incentive.refereeRewardNgn === null ? '—' : naira(incentive.refereeRewardNgn)}
          </p>
          <p className="mt-1 text-xs text-gray-600">
            Paid to the customer who was referred, once. The same amount whoever referred them.
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 p-3">
          <p className="text-sm font-semibold text-gray-900">Acquisition incentive</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">
            {incentive.percentOff === null ? '—' : `${count(incentive.percentOff)}%`}
            <span className="text-sm font-normal text-gray-600">
              {' '}
              × {count(incentive.maxDiscountedRides)} rides
            </span>
          </p>
          <p className="mt-1 text-xs text-gray-600">
            A discount on the new customer&apos;s fares, not a payment. Universal — every eligible
            new customer gets it, whoever referred them.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * The universal acquisition incentive: its terms and what it has cost.
 *
 * Read-only by design. There is no control here to create one, to change the
 * percentage, or to give a campaign its own — it is a single platform-wide
 * promotion by founder ruling, and two of them would stack.
 */
export function AcquisitionIncentivePanel({
  incentive,
}: {
  incentive: AcquisitionIncentiveDto;
}): React.JSX.Element {
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle>Universal acquisition incentive</CardTitle>
        <Badge variant="outline">{incentive.status ?? 'NOT CONFIGURED'}</Badge>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-600">
          One platform-wide promotion, shown here read-only. Campaigns cannot carry their own
          discount, and this is not part of any promoter&apos;s reward.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Terms</p>
            <p className="text-xl font-semibold tabular-nums text-gray-900">
              {incentive.percentOff === null ? '—' : `${count(incentive.percentOff)}%`}
            </p>
            <p className="text-xs text-gray-500">
              first {count(incentive.maxDiscountedRides)} rides
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Discounted rides</p>
            <p className="text-xl font-semibold tabular-nums text-gray-900">
              {count(incentive.discountedRides)}
            </p>
            <p className="text-xs text-gray-500">cancelled rides excluded</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Customers benefiting</p>
            <p className="text-xl font-semibold tabular-nums text-gray-900">
              {count(incentive.customersBenefiting)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Discount given</p>
            <p className="text-xl font-semibold tabular-nums text-gray-900">
              {naira(incentive.totalDiscountNgn)}
            </p>
            <p className="text-xs text-gray-500">fare foregone, not a payout</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const PARTICIPANT_TYPES: CampaignParticipantType[] = [
  'CUSTOMER',
  'RIDER',
  'DRIVER',
  'PIONEER_DRIVER',
  'INFLUENCER',
  'CREATOR',
  'AMBASSADOR',
];

type RewardKind = 'cash' | 'points';

/**
 * Enrol a promoter.
 *
 * The form collects a reward; it does not decide one. There is no default
 * amount per participant type here on purpose — prefilling ₦350 for a pioneer
 * driver would put a rate the server never stated into the operator's hands,
 * and a typo over a prefill is indistinguishable from a decision.
 *
 * Cash or points is a single choice because the database enforces exactly one.
 */
export function AddPromoterForm({
  onSubmit,
  isPending,
  error,
}: {
  onSubmit: (body: AddCampaignPromoterRequest) => void;
  isPending: boolean;
  error: unknown;
}): React.JSX.Element {
  const [userId, setUserId] = React.useState('');
  const [participantType, setParticipantType] = React.useState<CampaignParticipantType>('CUSTOMER');
  const [rewardKind, setRewardKind] = React.useState<RewardKind>('cash');
  const [amount, setAmount] = React.useState('');

  const parsed = Number(amount);
  const amountValid = amount.trim() !== '' && Number.isFinite(parsed) && parsed > 0;
  const canSubmit = userId.trim() !== '' && amountValid && !isPending;

  return (
    <form
      aria-label="Add promoter"
      onSubmit={(event) => {
        event.preventDefault();
        if (!canSubmit) {
          return;
        }
        onSubmit({
          userId: userId.trim(),
          participantType,
          ...(rewardKind === 'cash' ? { rewardAmountNgn: parsed } : { rewardPoints: parsed }),
        });
      }}
      className="space-y-3"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">User ID</span>
          <Input
            value={userId}
            onChange={(event) => {
              setUserId(event.target.value);
            }}
            placeholder="Existing DrippleX user"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">Participant type</span>
          <Select
            value={participantType}
            onChange={(event) => {
              setParticipantType(event.target.value as CampaignParticipantType);
            }}
          >
            {PARTICIPANT_TYPES.map((type) => (
              <option key={type} value={type}>
                {PARTICIPANT_TYPE_LABEL[type]}
              </option>
            ))}
          </Select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">Reward paid in</span>
          <Select
            value={rewardKind}
            onChange={(event) => {
              setRewardKind(event.target.value as RewardKind);
            }}
          >
            <option value="cash">Naira (cash)</option>
            <option value="points">DX Points</option>
          </Select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">
            {rewardKind === 'cash' ? 'Amount (₦)' : 'Points'}
          </span>
          <Input
            type="number"
            min="1"
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
            }}
            /* No example amount. A placeholder naming ₦350 would put a rate
               this screen was never told into the operator's head, and a
               prefill-shaped hint is how the wrong figure gets accepted. */
            placeholder={rewardKind === 'cash' ? 'Naira per acquisition' : 'Points per acquisition'}
          />
        </label>
      </div>
      <p className="text-xs text-gray-500">
        A promoter is paid in cash or in DX Points, never both. The amount is whatever you enter —
        the server holds the rules, this form holds no rates.
      </p>
      {error !== null && error !== undefined ? <ApiErrorNotice error={error} /> : null}
      <Button type="submit" disabled={!canSubmit}>
        {isPending ? 'Adding…' : 'Add promoter'}
      </Button>
    </form>
  );
}

/**
 * The promoters on a campaign.
 *
 * Removed promoters stay listed, visibly removed, because their attributions
 * and unpaid rewards still exist and hiding them would make a payable liability
 * invisible. They are never rendered as active, and no remove control is
 * offered for a row that is already removed.
 */
export function PromoterTable({
  promoters,
  pointsPerNaira,
  canManage,
  onRemove,
  removingId,
}: {
  promoters: CampaignDetailDto['promoters'];
  pointsPerNaira: number | null;
  canManage: boolean;
  onRemove: (promoterId: string) => void;
  removingId: string | null;
}): React.JSX.Element {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[880px] text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
            <th className="pb-2 pr-4 font-medium">Promoter</th>
            <th className="pb-2 pr-4 font-medium">Type</th>
            <th className="pb-2 pr-4 font-medium">Token</th>
            <th className="pb-2 pr-4 font-medium">Reward each</th>
            <th className="pb-2 pr-4 text-right font-medium">Referrals</th>
            <th className="pb-2 pr-4 text-right font-medium">Cash earned</th>
            <th className="pb-2 pr-4 font-medium">Status</th>
            {canManage ? <th className="pb-2 font-medium">Actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {promoters.map((promoter) => (
            <tr
              key={promoter.id}
              className={`border-b border-gray-100 last:border-0 ${
                promoter.status === 'REMOVED' ? 'text-gray-500' : ''
              }`}
            >
              <td className="py-3 pr-4 font-medium text-gray-900">{promoter.name}</td>
              <td className="py-3 pr-4">{PARTICIPANT_TYPE_LABEL[promoter.participantType]}</td>
              <td className="py-3 pr-4">
                <PromoterToken token={promoter.token} />
              </td>
              <td className="py-3 pr-4">
                <RewardValue
                  rewardAmountNgn={promoter.rewardAmountNgn}
                  rewardPoints={promoter.rewardPoints}
                  rewardPointsValueNgn={promoter.rewardPointsValueNgn}
                  pointsPerNaira={pointsPerNaira}
                />
              </td>
              <td className="py-3 pr-4 text-right tabular-nums">
                {count(promoter.performance.totalReferrals)}
                <div className="text-xs text-gray-500">
                  {count(promoter.performance.qualifiedReferrals)} qualified ·{' '}
                  {conversion(promoter.performance.conversionRate)}
                </div>
              </td>
              <td className="py-3 pr-4 text-right tabular-nums">
                {naira(promoter.performance.rewardsEarnedNgn)}
                <div className="text-xs text-gray-500">
                  {naira(promoter.performance.rewardsPendingNgn)} pending
                </div>
                {promoter.performance.rewardsEarnedPoints > 0 ? (
                  <div className="text-xs text-gray-500">
                    {count(promoter.performance.rewardsEarnedPoints)} DX Points
                  </div>
                ) : null}
              </td>
              <td className="py-3 pr-4">
                <PromoterStatusBadge status={promoter.status} removedAt={promoter.removedAt} />
              </td>
              {canManage ? (
                <td className="py-3">
                  {promoter.status === 'ACTIVE' ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={removingId === promoter.id}
                      onClick={() => {
                        onRemove(promoter.id);
                      }}
                    >
                      {removingId === promoter.id ? 'Removing…' : 'Remove'}
                    </Button>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export { CampaignStatusBadge };
