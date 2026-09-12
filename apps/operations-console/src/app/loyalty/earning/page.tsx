'use client';

import { Badge, Card, CardContent, CardHeader, CardTitle, LoadingSpinner } from '@dripplex/ui';
import * as React from 'react';

import type {
  LoyaltyEarnerPersona,
  LoyaltyEarningImpactDto,
  LoyaltyEarningProgrammeDto,
} from '@dripplex/types';

import { AppShell } from '@/components/app-shell';
import {
  useLoyaltyEarningImpact,
  useLoyaltyEarningProgrammes,
  useUpdateLoyaltyEarningProgramme,
} from '@/hooks/use-loyalty-earning';

/**
 * DPX-LOYALTY-007 — whether a partner persona earns DX Points, and for what.
 *
 * The important thing about this screen is not the form. It is that switching
 * DRIVER on starts paying **every approved driver on the platform** on their
 * next trip, and that this is the only page where anybody is in a position to
 * realise it. So the blast radius is on screen before the switch is reachable,
 * and turning a programme on asks a second time.
 *
 * The worst case is stated rather than a forecast. A forecast needs assumptions
 * about how many trips a driver does in a day, and an operator cannot check my
 * assumptions; everybody hitting their cap needs none and cannot be exceeded.
 * An uncapped programme therefore shows no number at all — and that absence is
 * the warning, not a gap in the screen.
 *
 * Points are shown with their naira value throughout. "20 points" means nothing
 * on its own; "20 points (10 kobo)" is a decision somebody can make.
 */

const PERSONA_LABELS: Record<LoyaltyEarnerPersona, string> = {
  DRIVER: 'Drivers',
  RIDER: 'Riders',
  MERCHANT: 'Merchants',
  FLEET_OWNER: 'Fleet owners',
};

const PERSONA_JOBS: Record<LoyaltyEarnerPersona, string> = {
  DRIVER: 'per completed ride',
  RIDER: 'per completed delivery',
  MERCHANT: 'per completed order',
  FLEET_OWNER: 'per completed job',
};

const PERSONA_ELIGIBILITY: Record<LoyaltyEarnerPersona, string> = {
  DRIVER: 'approved drivers',
  RIDER: 'approved riders',
  MERCHANT: 'verified merchants',
  FLEET_OWNER: 'active fleets',
};

function naira(value: number): string {
  return `₦${value.toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;
}

/**
 * Points are meaningless without their value — but a wrong value is worse than
 * none.
 *
 * The rate comes from the server or not at all. It used to fall back to a
 * hardcoded 100, which would have gone on quoting the old valuation had the
 * founder repriced again; the rate has already moved once, 200 -> 100 on
 * 2026-09-12. With no rate loaded this shows the points alone.
 */
function pointsWithValue(points: number, pointsPerNaira: number | null): string {
  if (points === 0) {
    return '0 points';
  }
  const label = `${points.toLocaleString('en-NG')} points`;
  if (pointsPerNaira === null || pointsPerNaira <= 0) {
    return `${label} (value unavailable)`;
  }
  return `${label} (${naira(points / pointsPerNaira)})`;
}

interface Draft {
  pointsPerCompletedJob: string;
  pointsPerQualifyingReview: string;
  minReviewRating: string;
  dailyPointsCap: string;
}

function toDraft(programme: LoyaltyEarningProgrammeDto): Draft {
  return {
    pointsPerCompletedJob: String(programme.pointsPerCompletedJob),
    pointsPerQualifyingReview: String(programme.pointsPerQualifyingReview),
    minReviewRating: String(programme.minReviewRating),
    dailyPointsCap: programme.dailyPointsCap === null ? '' : String(programme.dailyPointsCap),
  };
}

function NumberField({
  label,
  hint,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}): React.JSX.Element {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-700">{label}</span>
      <input
        type="number"
        min={0}
        value={value}
        placeholder={placeholder}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm tabular-nums"
      />
      {hint === undefined ? null : <span className="mt-1 block text-xs text-gray-500">{hint}</span>}
    </label>
  );
}

/** The second ask before a programme starts paying people. */
function SwitchOnConfirmation({
  programme,
  impact,
  onConfirm,
  onCancel,
  pending,
}: {
  programme: LoyaltyEarningProgrammeDto;
  impact: LoyaltyEarningImpactDto | undefined;
  onConfirm: () => void;
  onCancel: () => void;
  pending: boolean;
}): React.JSX.Element {
  const uncapped = impact?.dailyPointsCap === null;

  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
      <p className="font-semibold text-amber-900">
        This starts paying {impact?.eligiblePartners.toLocaleString('en-NG') ?? 'every'}{' '}
        {PERSONA_ELIGIBILITY[programme.persona]} on their next job.
      </p>
      {uncapped ? (
        <p className="mt-1 text-amber-900">
          There is no daily cap, so there is no ceiling on what this can cost. Set one before
          switching it on unless that is genuinely intended.
        </p>
      ) : impact?.worstCaseDailyNaira === undefined ||
        impact.worstCaseDailyNaira === null ? null : (
        <p className="mt-1 text-amber-900">
          At the daily cap, every one of them at once, that is at most{' '}
          <strong className="font-semibold">{naira(impact.worstCaseDailyNaira)} a day</strong>. Not
          a forecast — a ceiling that cannot be exceeded.
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={onConfirm}
          className="rounded-md bg-amber-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Switch it on
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-sm font-medium text-gray-700"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function ProgrammeCard({
  programme,
  impact,
}: {
  programme: LoyaltyEarningProgrammeDto;
  impact: LoyaltyEarningImpactDto | undefined;
}): React.JSX.Element {
  const update = useUpdateLoyaltyEarningProgramme();
  const [draft, setDraft] = React.useState<Draft>(() => toDraft(programme));
  const [confirming, setConfirming] = React.useState(false);
  // Null until the server states it. No fallback constant: the console must
  // never carry its own copy of a founder-set rate.
  const pointsPerNaira = impact?.pointsPerNaira ?? null;

  // The server is the source of truth — a value changed in another tab, or one
  // the server refused, must win over what is sitting in this form.
  React.useEffect(() => {
    setDraft(toDraft(programme));
    setConfirming(false);
  }, [programme]);

  const dirty =
    draft.pointsPerCompletedJob !== String(programme.pointsPerCompletedJob) ||
    draft.pointsPerQualifyingReview !== String(programme.pointsPerQualifyingReview) ||
    draft.minReviewRating !== String(programme.minReviewRating) ||
    draft.dailyPointsCap !==
      (programme.dailyPointsCap === null ? '' : String(programme.dailyPointsCap));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>{PERSONA_LABELS[programme.persona]}</CardTitle>
          <Badge variant={programme.active ? 'success' : 'outline'}>
            {programme.active ? 'Earning' : 'Not earning'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-gray-600">
          {impact === undefined
            ? 'Counting who this would pay…'
            : `${impact.eligiblePartners.toLocaleString('en-NG')} ${PERSONA_ELIGIBILITY[programme.persona]} would earn under this programme.`}
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField
            label={`Points ${PERSONA_JOBS[programme.persona]}`}
            hint={pointsWithValue(programme.pointsPerCompletedJob, pointsPerNaira)}
            value={draft.pointsPerCompletedJob}
            onChange={(next) => {
              setDraft((current) => ({ ...current, pointsPerCompletedJob: next }));
            }}
          />
          <NumberField
            label="Points per qualifying review"
            hint={
              // The founder rule, said on the screen where somebody might
              // otherwise assume points and stars are the same dial.
              'A review can boost points. It never changes the star rating.'
            }
            value={draft.pointsPerQualifyingReview}
            onChange={(next) => {
              setDraft((current) => ({ ...current, pointsPerQualifyingReview: next }));
            }}
          />
          <NumberField
            label="Review counts from (stars)"
            hint="A review below this earns nothing. Nothing here ever deducts."
            value={draft.minReviewRating}
            onChange={(next) => {
              setDraft((current) => ({ ...current, minReviewRating: next }));
            }}
          />
          <NumberField
            label="Daily cap per person (points)"
            placeholder="No cap"
            hint={
              programme.dailyPointsCap === null
                ? 'Uncapped — there is no ceiling on what this can cost.'
                : `${pointsWithValue(programme.dailyPointsCap, pointsPerNaira)} each, rolling 24 hours`
            }
            value={draft.dailyPointsCap}
            onChange={(next) => {
              setDraft((current) => ({ ...current, dailyPointsCap: next }));
            }}
          />
        </div>

        {confirming ? (
          <SwitchOnConfirmation
            programme={programme}
            impact={impact}
            pending={update.isPending}
            onCancel={() => {
              setConfirming(false);
            }}
            onConfirm={() => {
              update.mutate({ persona: programme.persona, body: { active: true } });
            }}
          />
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!dirty || update.isPending}
              onClick={() => {
                update.mutate({
                  persona: programme.persona,
                  body: {
                    pointsPerCompletedJob: Number(draft.pointsPerCompletedJob),
                    pointsPerQualifyingReview: Number(draft.pointsPerQualifyingReview),
                    minReviewRating: Number(draft.minReviewRating),
                    // An empty field means no cap, which is a real setting and
                    // not a missing one.
                    dailyPointsCap:
                      draft.dailyPointsCap.trim() === '' ? null : Number(draft.dailyPointsCap),
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
                if (programme.active) {
                  // Switching off is not the dangerous direction: it stops
                  // future earning and takes nothing already earned.
                  update.mutate({ persona: programme.persona, body: { active: false } });
                  return;
                }
                setConfirming(true);
              }}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 disabled:opacity-50"
            >
              {programme.active ? 'Stop earning' : 'Start earning'}
            </button>
            {update.isError ? (
              <span className="text-xs text-red-600">
                That didn&apos;t save. It may need the loyalty admin permission.
              </span>
            ) : null}
          </div>
        )}

        {programme.active ? null : (
          <p className="text-xs text-gray-500">
            Switched off, nothing is earned. Points already earned are unaffected either way.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function LoyaltyEarningPage(): React.JSX.Element {
  const programmes = useLoyaltyEarningProgrammes();
  const impact = useLoyaltyEarningImpact();
  const impactByPersona = new Map((impact.data ?? []).map((row) => [row.persona, row] as const));
  const live = (programmes.data ?? []).filter((programme) => programme.active);

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Partner DX Points earning</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-600">
            Whether drivers, riders, merchants and fleets earn DX Points, and for what. Every
            programme starts switched off — nothing here has ever paid a partner until somebody
            turns it on.
          </p>
        </div>

        {programmes.isLoading ? <LoadingSpinner /> : null}
        {programmes.isError ? (
          <p className="text-sm text-red-600">
            Couldn&apos;t load the earning programmes.{' '}
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

        {live.length > 0 ? (
          <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800">
            <strong className="font-semibold">
              {live.length === 1 ? '1 programme is' : `${String(live.length)} programmes are`}{' '}
              paying now
            </strong>{' '}
            — {live.map((programme) => PERSONA_LABELS[programme.persona]).join(', ')}. Points earned
            under a programme stay earned if it is switched off later.
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          {(programmes.data ?? []).map((programme) => (
            <ProgrammeCard
              key={programme.persona}
              programme={programme}
              impact={impactByPersona.get(programme.persona)}
            />
          ))}
        </div>
      </div>
    </AppShell>
  );
}
