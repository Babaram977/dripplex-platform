'use client';

import { Badge, Card, CardContent, CardHeader, CardTitle, LoadingSpinner } from '@dripplex/ui';
import * as React from 'react';

import type { ReferralProgrammeDto, ReferralRefereeType } from '@dripplex/types';

import { AppShell } from '@/components/app-shell';
import { useReferralProgrammes, useUpdateReferralProgramme } from '@/hooks/use-operations-finance';

/**
 * DPX-REFERRAL-003 — what DrippleX pays for a referral, per kind of referee.
 *
 * Every figure here was a constant until this shipped. Referring a fleet is
 * worth several times referring a customer because it is several times the
 * work, and none of those numbers should need a deployment to change.
 *
 * Two things this screen deliberately says out loud:
 *
 * - **The milestone, per referee type.** An operator setting ₦2,500 against
 *   "Fleet" needs to know what has to be true before it is paid, or the number
 *   is just a number.
 * - **What a zero means.** A fleet pays the referrer only. Zero is a real
 *   setting — no credit is attempted — not a missing one, and a blank field
 *   would read as unset.
 */

const PROGRAMME_LABELS: Record<ReferralRefereeType, string> = {
  CUSTOMER: 'Referring a customer',
  MERCHANT: 'Referring a merchant',
  FLEET: 'Referring a fleet',
};

const MILESTONES: Record<ReferralRefereeType, string> = {
  CUSTOMER: 'Pays once the referred customer completes their first ride or order.',
  MERCHANT:
    'Pays once the referred merchant is verified, has a bank account on file, and completes their first order.',
  FLEET:
    'Pays once the referred fleet is activated by DrippleX, has a bank account, and has at least one active rider or driver.',
};

const INTAKE: Record<ReferralRefereeType, string> = {
  CUSTOMER: 'Code entered at customer sign-up.',
  MERCHANT: 'Code entered at merchant sign-up.',
  FLEET: 'Code entered when the owner registers their company.',
};

function naira(value: number): string {
  return `₦${value.toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;
}

interface Draft {
  referrerRewardAmount: string;
  refereeRewardAmount: string;
  holdDays: string;
  qualificationWindowDays: string;
}

function toDraft(programme: ReferralProgrammeDto): Draft {
  return {
    referrerRewardAmount: String(programme.referrerRewardAmount),
    refereeRewardAmount: String(programme.refereeRewardAmount),
    holdDays: String(programme.holdDays),
    qualificationWindowDays: String(programme.qualificationWindowDays),
  };
}

function Field({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (next: string) => void;
}): React.JSX.Element {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-700">{label}</span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm tabular-nums"
      />
      {hint === undefined ? null : <span className="mt-1 block text-xs text-gray-500">{hint}</span>}
    </label>
  );
}

function ProgrammeCard({ programme }: { programme: ReferralProgrammeDto }): React.JSX.Element {
  const update = useUpdateReferralProgramme();
  const [draft, setDraft] = React.useState<Draft>(() => toDraft(programme));

  // The server is the source of truth — a hold changed in another tab, or a
  // value the server clamped, must win over what is sitting in this form.
  React.useEffect(() => {
    setDraft(toDraft(programme));
  }, [programme]);

  const dirty =
    draft.referrerRewardAmount !== String(programme.referrerRewardAmount) ||
    draft.refereeRewardAmount !== String(programme.refereeRewardAmount) ||
    draft.holdDays !== String(programme.holdDays) ||
    draft.qualificationWindowDays !== String(programme.qualificationWindowDays);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>{PROGRAMME_LABELS[programme.refereeType]}</CardTitle>
          <Badge variant={programme.active ? 'success' : 'outline'}>
            {programme.active ? 'Running' : 'Paused'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-gray-600">{MILESTONES[programme.refereeType]}</p>
        <p className="text-xs text-gray-500">{INTAKE[programme.refereeType]}</p>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="To the referrer"
            hint={`Currently ${naira(programme.referrerRewardAmount)}`}
            value={draft.referrerRewardAmount}
            onChange={(next) => {
              setDraft((current) => ({ ...current, referrerRewardAmount: next }));
            }}
          />
          <Field
            label="To the referred"
            // Zero is a real setting, not a missing one, and a screen that does
            // not say so invites somebody to "fix" it.
            hint={
              programme.refereeRewardAmount === 0
                ? 'Zero — the referrer only. No credit is attempted.'
                : `Currently ${naira(programme.refereeRewardAmount)}`
            }
            value={draft.refereeRewardAmount}
            onChange={(next) => {
              setDraft((current) => ({ ...current, refereeRewardAmount: next }));
            }}
          />
          <Field
            label="Hold before paying (days)"
            hint={
              programme.holdDays === 0
                ? 'Zero pays the moment it qualifies.'
                : 'A fraudulent referral is usually visible within a week, and money already withdrawn cannot be clawed back.'
            }
            value={draft.holdDays}
            onChange={(next) => {
              setDraft((current) => ({ ...current, holdDays: next }));
            }}
          />
          <Field
            label="Qualification window (days)"
            hint="After this, an unqualified referral expires unpaid."
            value={draft.qualificationWindowDays}
            onChange={(next) => {
              setDraft((current) => ({ ...current, qualificationWindowDays: next }));
            }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!dirty || update.isPending}
            onClick={() => {
              update.mutate({
                refereeType: programme.refereeType,
                body: {
                  referrerRewardAmount: Number(draft.referrerRewardAmount),
                  refereeRewardAmount: Number(draft.refereeRewardAmount),
                  holdDays: Number(draft.holdDays),
                  qualificationWindowDays: Number(draft.qualificationWindowDays),
                },
              });
            }}
            className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Save
          </button>
          <button
            type="button"
            disabled={update.isPending}
            onClick={() => {
              // Pausing stops new referrals qualifying. Ones already qualified
              // keep the amounts snapshotted on them and still pay — pausing
              // decides what DrippleX takes on, not what it walks away from
              // owing.
              update.mutate({
                refereeType: programme.refereeType,
                body: { active: !programme.active },
              });
            }}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 disabled:opacity-50"
          >
            {programme.active ? 'Pause' : 'Resume'}
          </button>
          {update.isError ? (
            <span className="text-xs text-red-600">
              That didn&apos;t save. It may need the referrals admin permission.
            </span>
          ) : null}
        </div>

        {programme.active ? null : (
          <p className="text-xs text-gray-500">
            Paused stops new referrals qualifying. Referrals that already qualified keep the amount
            they qualified at and still pay.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function ReferralProgrammesPage(): React.JSX.Element {
  const programmes = useReferralProgrammes();

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Referral programmes</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-600">
            What DrippleX pays for a referral, and what has to be true before it pays. Changing a
            figure here never rewrites a referral that already qualified — each one keeps the amount
            it was worth at the time.
          </p>
        </div>

        {programmes.isLoading ? <LoadingSpinner /> : null}
        {programmes.isError ? (
          <p className="text-sm text-red-600">
            Couldn&apos;t load the programmes.{' '}
            <button
              type="button"
              onClick={() => {
                void programmes.refetch();
              }}
              className="font-semibold underline"
            >
              Retry
            </button>
          </p>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {(programmes.data ?? []).map((programme) => (
            <ProgrammeCard key={programme.refereeType} programme={programme} />
          ))}
        </div>
      </div>
    </AppShell>
  );
}
