'use client';

import { Badge, Card, CardContent, EmptyState, LoadingSpinner } from '@dripplex/ui';
import * as React from 'react';

import type { ReferralRejectionReason, ReferralReviewItemDto } from '@dripplex/types';

import { AppShell } from '@/components/app-shell';
import { useReferralDecision, useReferralReviewQueue } from '@/hooks/use-operations-finance';

/**
 * DPX-REFERRAL-003 — referrals that qualified but are waiting on a person.
 *
 * The anti-abuse screening refuses a self-referral, a shared phone line, a
 * shared inbox and a shared identity document outright. It does not refuse a
 * shared device, because a household sharing a handset is routine here and
 * refusing on that signal alone would reject real referrals in bulk. Those are
 * flagged and held instead — and a flag is only worth something if somebody
 * sees it.
 *
 * Without this screen a flagged referral waits forever, which is the worst of
 * both designs: the referrer is not paid and nobody ever decided not to pay
 * them. That is why this page exists and why it says, per row, that the hold
 * has already run out and nothing is coming to release it but a decision.
 *
 * The decisions post to `/admin/referrals/*`, not to the operations surface
 * this queue is read from. That surface is read-only by design, so an operator
 * can be given the queue without being given the ability to settle money.
 */

const FLAG_LABELS: Record<ReferralRejectionReason, string> = {
  SELF_REFERRAL: 'Same account',
  RECIPROCAL_RELATIONSHIP: 'Referred each other',
  SHARED_DEVICE: 'Same device',
  SHARED_PHONE: 'Same phone line',
  SHARED_EMAIL: 'Same inbox',
  SHARED_IDENTITY: 'Same ID document',
  OPERATIONS_DECISION: 'Operations decision',
};

const REFEREE_LABELS: Record<string, string> = {
  CUSTOMER: 'Customer',
  MERCHANT: 'Merchant',
  FLEET: 'Fleet',
};

function naira(value: number | null): string {
  if (value === null) {
    return '—';
  }
  return `₦${value.toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;
}

function waitingFor(qualifiedAt: string | null): string {
  if (qualifiedAt === null) {
    return 'unknown';
  }
  const days = Math.floor((Date.now() - new Date(qualifiedAt).getTime()) / 86_400_000);
  if (days <= 0) {
    return 'today';
  }
  return days === 1 ? '1 day' : `${String(days)} days`;
}

function ReviewRow({ item }: { item: ReferralReviewItemDto }): React.JSX.Element {
  const decide = useReferralDecision();
  const [note, setNote] = React.useState('');
  const [rejecting, setRejecting] = React.useState(false);
  const pending = decide.isPending;

  return (
    <div className="border-b border-gray-100 py-4 last:border-0">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-[16rem]">
          <p className="font-medium text-gray-900">
            {item.referrerName} <span className="font-normal text-gray-500">referred</span>{' '}
            {item.refereeName}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            <span className="font-mono">{item.referrerCode}</span> ·{' '}
            {REFEREE_LABELS[item.refereeType] ?? item.refereeType} · waiting{' '}
            {waitingFor(item.qualifiedAt)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {item.flaggedReason === null ? null : (
            <Badge variant="outline">{FLAG_LABELS[item.flaggedReason]}</Badge>
          )}
          {/* A flag is not released by a timer, so once the hold has passed the
              only thing left holding the money is this decision. Said plainly,
              because "pending" reads like something is still in progress. */}
          {item.holdElapsed ? (
            <Badge variant="accent">Hold elapsed — waiting on you</Badge>
          ) : (
            <Badge variant="secondary">Within hold</Badge>
          )}
        </div>

        <div className="text-right">
          <p className="text-sm font-semibold tabular-nums text-gray-900">
            {naira(item.referrerRewardAmount)}
          </p>
          <p className="text-xs text-gray-500">
            {/* Both sides, because approving pays both and an operator should
                see the whole cost of the decision they are making. */}
            + {naira(item.refereeRewardAmount)} to {item.refereeName.split(' ')[0]}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={note}
          onChange={(event) => {
            setNote(event.target.value);
          }}
          placeholder={rejecting ? 'Why is this being refused?' : 'Why is this genuine? (optional)'}
          maxLength={500}
          className="min-w-[18rem] flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        />
        {rejecting ? (
          <>
            <button
              type="button"
              disabled={pending || note.trim() === ''}
              onClick={() => {
                decide.mutate({
                  action: 'reject',
                  redemptionId: item.redemptionId,
                  reason: item.flaggedReason ?? 'OPERATIONS_DECISION',
                  note: note.trim(),
                });
              }}
              className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Confirm refusal
            </button>
            <button
              type="button"
              onClick={() => {
                setRejecting(false);
              }}
              className="px-3 py-1.5 text-sm font-medium text-gray-600"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                decide.mutate({
                  action: 'approve',
                  redemptionId: item.redemptionId,
                  ...(note.trim() === '' ? {} : { note: note.trim() }),
                });
              }}
              className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Pay it
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                // A refusal asks for a reason before it happens. The coded
                // reason is kept for counting; the note is what a person reads
                // months later when the referrer asks why.
                setRejecting(true);
              }}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 disabled:opacity-50"
            >
              Refuse
            </button>
          </>
        )}
      </div>

      {decide.isError ? (
        <p className="mt-2 text-xs text-red-600">
          That didn&apos;t go through. It may need the referrals admin permission.
        </p>
      ) : null}
    </div>
  );
}

export default function ReferralReviewPage(): React.JSX.Element {
  const queue = useReferralReviewQueue();
  const items = queue.data?.items ?? [];
  const overdue = items.filter((item) => item.holdElapsed).length;

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Referrals held for review</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-600">
            These referrals met their milestone and were then flagged by an anti-abuse check that
            refuses to decide on its own. Two accounts on one handset is usually a household; two
            accounts on one ID document usually is not. Nothing here pays until somebody says so.
          </p>
        </div>

        {queue.isLoading ? <LoadingSpinner /> : null}
        {queue.isError ? (
          <p className="text-sm text-red-600">
            Couldn&apos;t load the review queue.{' '}
            <button
              type="button"
              onClick={() => {
                void queue.refetch();
              }}
              className="font-semibold underline"
            >
              Retry
            </button>
          </p>
        ) : null}

        {queue.data ? (
          <>
            {overdue > 0 ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                <strong className="font-semibold">
                  {overdue === 1 ? '1 referral' : `${String(overdue)} referrals`}
                </strong>{' '}
                {overdue === 1 ? 'has' : 'have'} passed the hold. A flag is not released by a timer,
                so nothing will pay these except a decision here.
              </div>
            ) : null}

            <Card>
              <CardContent>
                {items.length === 0 ? (
                  <EmptyState
                    title="Nothing waiting"
                    description="Referrals appear here only when an abuse check flags one without refusing it. An empty queue means every qualified referral is paying on its own hold."
                  />
                ) : (
                  <div>
                    {items.map((item) => (
                      <ReviewRow key={item.redemptionId} item={item} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
