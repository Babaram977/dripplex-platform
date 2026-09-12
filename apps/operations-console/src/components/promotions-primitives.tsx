'use client';

import { Badge } from '@dripplex/ui';
import * as React from 'react';

import type { CampaignParticipantType, PromotionStatus } from '@dripplex/types';

/**
 * DPX-PROMO-REF-001 — the display primitives the Promotions tab is built from.
 *
 * Split out from the screens because the rules they enforce are the ones worth
 * testing on their own: naira and DX Points never merge into one figure, a
 * private token is never rendered in the clear by default, and a removed
 * promoter never reads as active.
 */

/** Naira. Always with the symbol — an Ops screen shows two currencies of value
 *  and a bare number is the one that gets misread. */
export function naira(value: number): string {
  return `₦${value.toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;
}

export function count(value: number): string {
  return value.toLocaleString('en-NG');
}

/**
 * Conversion, or the absence of one.
 *
 * Null is "nothing referred yet", which is not 0%. A campaign that nobody has
 * used has not failed to convert; showing 0% would make a campaign that was
 * never tried look like one that was tried and did not work.
 */
export function conversion(rate: number | null): string {
  if (rate === null) {
    return '—';
  }
  return `${(rate * 100).toFixed(rate === 0 || rate === 1 ? 0 : 1)}%`;
}

/**
 * DX Points, and the naira value the server put on them.
 *
 * This component performs no financial arithmetic at all — it used to divide
 * by the current rate, which silently re-valued historical grants: points
 * earned at 200:1 were reported at today's 100:1, double what they cost. The
 * server now values each grant at the rate snapshotted when it was made and
 * sends the total. When it sends none, the points are shown alone rather than
 * converted here.
 */
export function PointsValue({
  points,
  valueNgn,
  pointsPerNaira,
}: {
  points: number;
  /** The naira equivalent, as the server computed it. Null means it could not
   *  be established — show the points alone rather than deriving one here. */
  valueNgn: number | null;
  /** Only to label the equivalence. Never used to compute it. */
  pointsPerNaira: number | null;
}): React.JSX.Element {
  return (
    <span className="whitespace-nowrap">
      <span className="font-medium tabular-nums">{count(points)}</span>{' '}
      <span className="text-xs text-gray-500">DX Points</span>
      {valueNgn === null ? (
        <span
          className="ml-1 text-xs text-gray-400"
          title="The server did not state a naira value for these points, so none is shown."
        >
          (value unavailable)
        </span>
      ) : (
        <span className="ml-1 text-xs text-gray-500">
          ≈ {naira(valueNgn)}
          {pointsPerNaira === null ? '' : ` at ${count(pointsPerNaira)}:₦1`}
        </span>
      )}
    </span>
  );
}

/**
 * What one promoter earns per qualified acquisition.
 *
 * Exactly one of cash or points, because the database enforces exactly one.
 * The two never appear added together and a points reward is never restated as
 * a naira reward — the equivalence is shown beside it, labelled, so nobody
 * reads ₦150 and 15,000 points as interchangeable line items.
 */
export function RewardValue({
  rewardAmountNgn,
  rewardPoints,
  rewardPointsValueNgn,
  pointsPerNaira,
}: {
  rewardAmountNgn: number | null;
  rewardPoints: number | null;
  rewardPointsValueNgn: number | null;
  pointsPerNaira: number | null;
}): React.JSX.Element {
  if (rewardAmountNgn !== null) {
    return (
      <span className="whitespace-nowrap">
        <span className="font-medium tabular-nums">{naira(rewardAmountNgn)}</span>{' '}
        <span className="text-xs text-gray-500">cash</span>
      </span>
    );
  }
  if (rewardPoints !== null) {
    return (
      <PointsValue
        points={rewardPoints}
        valueNgn={rewardPointsValueNgn}
        pointsPerNaira={pointsPerNaira}
      />
    );
  }
  // Unreachable while the CHECK constraint holds. Shown rather than crashed,
  // because an Ops screen that blanks out is harder to report than one that
  // says the row is wrong.
  return <span className="text-red-600">No reward set</span>;
}

const CAMPAIGN_STATUS_VARIANT: Record<
  PromotionStatus,
  'default' | 'secondary' | 'outline' | 'success' | 'accent'
> = {
  DRAFT: 'outline',
  SCHEDULED: 'accent',
  ACTIVE: 'success',
  PAUSED: 'secondary',
  EXPIRED: 'outline',
  ARCHIVED: 'outline',
  CANCELLED: 'outline',
};

/**
 * Campaign lifecycle.
 *
 * PAUSED is called out in words because it is the state whose consequence is
 * least obvious: a paused campaign still shows its promoters and their history,
 * but the server refuses to attribute new acquisitions to it. An operator who
 * reads "paused" as "quiet" will wonder why the numbers stopped.
 */
export function CampaignStatusBadge({ status }: { status: PromotionStatus }): React.JSX.Element {
  return (
    <span className="inline-flex items-center gap-2">
      <Badge variant={CAMPAIGN_STATUS_VARIANT[status]}>{status}</Badge>
      {status === 'PAUSED' ? (
        <span className="text-xs text-amber-700">not attributing new referrals</span>
      ) : null}
      {status === 'SCHEDULED' ? (
        <span className="text-xs text-gray-500">attributing, not yet started</span>
      ) : null}
    </span>
  );
}

/** ACTIVE / REMOVED, never inferred and never softened. */
export function PromoterStatusBadge({
  status,
  removedAt,
}: {
  status: 'ACTIVE' | 'REMOVED';
  removedAt: string | null;
}): React.JSX.Element {
  if (status === 'REMOVED') {
    return (
      <span className="inline-flex flex-col">
        <Badge variant="outline" className="w-fit text-gray-600">
          REMOVED
        </Badge>
        {removedAt !== null ? (
          <span className="text-xs text-gray-500">
            {new Date(removedAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
          </span>
        ) : null}
      </span>
    );
  }
  return <Badge variant="success">ACTIVE</Badge>;
}

export const PARTICIPANT_TYPE_LABEL: Record<CampaignParticipantType, string> = {
  CUSTOMER: 'Customer',
  RIDER: 'Rider',
  DRIVER: 'Driver',
  PIONEER_DRIVER: 'Pioneer driver',
  INFLUENCER: 'Influencer',
  CREATOR: 'Creator',
  AMBASSADOR: 'Ambassador',
};

/**
 * A promoter's private campaign token.
 *
 * Masked until asked for. The token is not an identifier, it is the thing that
 * earns the money: anybody holding it can have acquisitions attributed to that
 * promoter. Masking it keeps it off a shoulder-surfed screen and out of a
 * screenshot of the campaign page, and the reveal is per-row so showing one
 * does not expose the rest.
 */
export function PromoterToken({ token }: { token: string }): React.JSX.Element {
  const [revealed, setRevealed] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const onCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      window.setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      // Clipboard is unavailable in some browsers and every insecure context.
      // Revealing the token is the fallback: the operator can select it.
      setRevealed(true);
    }
  };

  return (
    <span className="inline-flex items-center gap-2">
      <code className="rounded bg-gray-100 px-2 py-1 font-mono text-xs text-gray-800">
        {revealed ? token : '••••••••'}
      </code>
      <button
        type="button"
        onClick={() => {
          setRevealed((prev) => !prev);
        }}
        className="text-xs font-semibold text-emerald-700 underline"
      >
        {revealed ? 'Hide' : 'Reveal'}
      </button>
      <button
        type="button"
        onClick={() => void onCopy()}
        className="text-xs font-semibold text-emerald-700 underline"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </span>
  );
}
