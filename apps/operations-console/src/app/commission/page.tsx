'use client';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  LoadingSpinner,
  toast,
} from '@dripplex/ui';
import * as React from 'react';

import type {
  CommissionCampaignDto,
  CommissionCampaignStatus,
  CommissionScope,
} from '@dripplex/types';

import { AppShell } from '@/components/app-shell';
import {
  useArchiveCommissionCampaign,
  useCommissionCampaigns,
  useCreateCommissionCampaign,
  usePauseCommissionCampaign,
  useResumeCommissionCampaign,
} from '@/hooks/use-commission-campaigns';

/**
 * DPX-COMMISSION-001 — commission campaigns.
 *
 * Commission used to be two numbers an operator edited in place: change it to
 * 7% on Monday, change it back on Friday. Changing it back is the part that
 * does not happen, and the failure mode is charging every partner on the
 * platform a promotional rate indefinitely. A campaign has an end date, so
 * reverting is not something anybody has to remember.
 *
 * Everything on this screen is stated in percent because that is how the
 * decision is made and discussed; the API takes and returns a fraction, and the
 * conversion happens at this boundary and nowhere else.
 */

const SCOPES: { value: CommissionScope; label: string; charged: string }[] = [
  { value: 'MERCHANT_ORDER', label: 'Marketplace orders', charged: 'Merchants' },
  { value: 'DELIVERY', label: 'Deliveries', charged: 'Riders' },
  { value: 'RIDE', label: 'Rides', charged: 'Drivers' },
];

const STATUS_TONE: Record<
  CommissionCampaignStatus,
  'success' | 'accent' | 'outline' | 'secondary'
> = {
  ACTIVE: 'success',
  SCHEDULED: 'accent',
  PAUSED: 'outline',
  DRAFT: 'outline',
  EXPIRED: 'secondary',
  ARCHIVED: 'secondary',
};

const WEEKDAYS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

function scopeLabel(scope: CommissionScope): string {
  return SCOPES.find((entry) => entry.value === scope)?.label ?? scope;
}

function chargedLabel(scope: CommissionScope): string {
  return SCOPES.find((entry) => entry.value === scope)?.charged ?? 'Partners';
}

function asPercent(rate: number): string {
  const percent = rate * 100;
  return `${Number.isInteger(percent) ? percent.toFixed(0) : percent.toFixed(2)}%`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Reads a percentage box. A blank or unparseable field is "no value", never
 * zero — a commission field that silently saves as 0 would hand the platform's
 * entire cut away without anyone typing a number.
 */
function parsePercent(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0 || value >= 100) return null;
  return value / 100;
}

function describeRules(campaign: CommissionCampaignDto): string | null {
  const weekdays = campaign.rules?.weekdays;
  if (weekdays === undefined || weekdays.length === 0) return null;
  if (weekdays.length === 7) return null;
  return weekdays
    .map((day) => WEEKDAYS.find((entry) => entry.value === day)?.label ?? String(day))
    .join(', ');
}

// ── New campaign ─────────────────────────────────────────────────────────────

function NewCampaignForm(): React.JSX.Element {
  const create = useCreateCommissionCampaign();
  const [name, setName] = React.useState('');
  const [scope, setScope] = React.useState<CommissionScope>('MERCHANT_ORDER');
  const [percent, setPercent] = React.useState('');
  const [startsAt, setStartsAt] = React.useState('');
  const [endsAt, setEndsAt] = React.useState('');
  const [weekdays, setWeekdays] = React.useState<number[]>([]);
  const [announce, setAnnounce] = React.useState(true);

  const rate = parsePercent(percent);
  const canSubmit =
    name.trim() !== '' && rate !== null && startsAt !== '' && endsAt !== '' && !create.isPending;

  function toggleWeekday(day: number): void {
    setWeekdays((current) =>
      current.includes(day) ? current.filter((value) => value !== day) : [...current, day],
    );
  }

  function submit(): void {
    if (rate === null) return;
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    if (end.getTime() <= start.getTime()) {
      toast({ title: 'A campaign has to end after it starts', variant: 'destructive' });
      return;
    }

    create.mutate(
      {
        name: name.trim(),
        scope,
        commissionRate: rate,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        announce,
        ...(weekdays.length > 0 && weekdays.length < 7 ? { rules: { weekdays } } : {}),
      },
      {
        onSuccess: () => {
          toast({
            title: `${name.trim()} scheduled`,
            description: `${chargedLabel(scope)} will be charged ${asPercent(rate)} on ${scopeLabel(scope).toLowerCase()} for the window you set.`,
          });
          setName('');
          setPercent('');
          setStartsAt('');
          setEndsAt('');
          setWeekdays([]);
        },
        onError: (error: Error) => {
          toast({
            title: "Couldn't schedule the campaign",
            description: error.message,
            variant: 'destructive',
          });
        },
      },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New commission campaign</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">Name</span>
            <Input
              value={name}
              placeholder="Launch week"
              onChange={(event) => {
                setName(event.target.value);
              }}
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">Charged on</span>
            <select
              value={scope}
              onChange={(event) => {
                setScope(event.target.value as CommissionScope);
              }}
              className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
            >
              {SCOPES.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label} ({entry.charged})
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">Commission rate (%)</span>
            <Input
              value={percent}
              inputMode="decimal"
              placeholder="7"
              onChange={(event) => {
                setPercent(event.target.value);
              }}
            />
            {percent.trim() !== '' && rate === null ? (
              <span className="mt-1 block text-xs text-red-600">
                Enter a percentage between 0 and 100.
              </span>
            ) : null}
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-700">Starts</span>
              <Input
                type="datetime-local"
                value={startsAt}
                onChange={(event) => {
                  setStartsAt(event.target.value);
                }}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-700">Ends</span>
              <Input
                type="datetime-local"
                value={endsAt}
                onChange={(event) => {
                  setEndsAt(event.target.value);
                }}
              />
            </label>
          </div>
        </div>

        <div>
          <span className="mb-1 block text-sm font-medium text-gray-700">
            Only on these days <span className="font-normal text-gray-500">(optional)</span>
          </span>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((day) => {
              const selected = weekdays.includes(day.value);
              return (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => {
                    toggleWeekday(day.value);
                  }}
                  className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                    selected
                      ? 'border-emerald-600 bg-emerald-50 font-medium text-emerald-700'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {day.label}
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Leave all unselected to run every day. Selecting Sat and Sun makes it a weekend-only
            rate.
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={announce}
            onChange={(event) => {
              setAnnounce(event.target.checked);
            }}
          />
          Notify {chargedLabel(scope).toLowerCase()} when this starts and ends
        </label>

        <div className="flex items-center gap-3">
          <Button
            onClick={submit}
            disabled={!canSubmit}
            aria-busy={create.isPending ? 'true' : undefined}
          >
            {create.isPending ? 'Scheduling…' : 'Schedule campaign'}
          </Button>
          {rate !== null ? (
            <span className="text-sm text-gray-500">
              {chargedLabel(scope)} will be charged {asPercent(rate)} on{' '}
              {scopeLabel(scope).toLowerCase()}.
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Running campaigns ────────────────────────────────────────────────────────

function CampaignRow({ campaign }: { campaign: CommissionCampaignDto }): React.JSX.Element {
  const pause = usePauseCommissionCampaign();
  const resume = useResumeCommissionCampaign();
  const archive = useArchiveCommissionCampaign();
  const busy = pause.isPending || resume.isPending || archive.isPending;
  const days = describeRules(campaign);
  const finished = campaign.status === 'EXPIRED' || campaign.status === 'ARCHIVED';

  function run(action: {
    mutate: (id: string, options: { onError: (error: Error) => void }) => void;
  }): void {
    action.mutate(campaign.id, {
      onError: (error: Error) => {
        toast({
          title: "Couldn't update the campaign",
          description: error.message,
          variant: 'destructive',
        });
      },
    });
  }

  return (
    <tr className="border-b border-gray-100 last:border-0">
      <td className="py-3 pr-4">
        <div className="font-medium text-gray-900">{campaign.name}</div>
        <div className="text-xs text-gray-500">
          {chargedLabel(campaign.scope)} · {scopeLabel(campaign.scope)}
          {days === null ? '' : ` · ${days} only`}
        </div>
      </td>
      <td className="py-3 pr-4 text-right font-semibold tabular-nums text-gray-900">
        {asPercent(campaign.commissionRate)}
      </td>
      <td className="py-3 pr-4 text-sm text-gray-600">
        {formatDate(campaign.startsAt)} – {formatDate(campaign.endsAt)}
      </td>
      <td className="py-3 pr-4">
        <Badge variant={STATUS_TONE[campaign.status]}>{campaign.status}</Badge>
      </td>
      <td className="py-3 pr-4 text-xs text-gray-500">
        {campaign.announcedAt === null ? 'Not announced' : 'Announced'}
      </td>
      <td className="py-3 text-right">
        <div className="flex justify-end gap-2">
          {campaign.status === 'ACTIVE' || campaign.status === 'SCHEDULED' ? (
            <Button
              variant="secondary"
              onClick={() => {
                run(pause);
              }}
              disabled={busy}
            >
              Pause
            </Button>
          ) : null}
          {campaign.status === 'PAUSED' ? (
            <Button
              variant="secondary"
              onClick={() => {
                run(resume);
              }}
              disabled={busy}
            >
              Resume
            </Button>
          ) : null}
          {finished ? null : (
            <Button
              variant="ghost"
              onClick={() => {
                run(archive);
              }}
              disabled={busy}
            >
              Archive
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function CommissionCampaignsPage(): React.JSX.Element {
  const [scope, setScope] = React.useState<CommissionScope | undefined>(undefined);
  const campaigns = useCommissionCampaigns({ ...(scope === undefined ? {} : { scope }) });
  const items = campaigns.data?.items ?? [];

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Commission</h1>
          <p className="mt-1 text-sm text-gray-600">
            A campaign changes what DrippleX charges a partner for a set period, then reverts on its
            own. The standing rates stay in place whenever no campaign is running.
          </p>
        </div>

        <NewCampaignForm />

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle>Campaigns</CardTitle>
            <select
              value={scope ?? ''}
              onChange={(event) => {
                setScope(
                  event.target.value === '' ? undefined : (event.target.value as CommissionScope),
                );
              }}
              className="h-9 rounded-md border border-gray-300 px-3 text-sm"
            >
              <option value="">All partners</option>
              {SCOPES.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.charged}
                </option>
              ))}
            </select>
          </CardHeader>
          <CardContent>
            {campaigns.isLoading ? <LoadingSpinner /> : null}
            {campaigns.isError ? (
              <p className="text-sm text-red-600">
                Couldn&apos;t load commission campaigns.{' '}
                <button
                  type="button"
                  onClick={() => {
                    void campaigns.refetch();
                  }}
                  className="font-semibold underline"
                >
                  Retry
                </button>
              </p>
            ) : null}
            {!campaigns.isLoading && !campaigns.isError && items.length === 0 ? (
              <EmptyState
                title="No commission campaigns"
                description="Partners are being charged the standing rates. Schedule a campaign above to change that for a period."
              />
            ) : null}
            {items.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                      <th className="pb-2 pr-4 font-medium">Campaign</th>
                      <th className="pb-2 pr-4 text-right font-medium">Rate</th>
                      <th className="pb-2 pr-4 font-medium">Window</th>
                      <th className="pb-2 pr-4 font-medium">Status</th>
                      <th className="pb-2 pr-4 font-medium">Notice</th>
                      <th className="pb-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((campaign) => (
                      <CampaignRow key={campaign.id} campaign={campaign} />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
