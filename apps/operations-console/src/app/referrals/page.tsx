'use client';

import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  LoadingSpinner,
} from '@dripplex/ui';
import * as React from 'react';

import type { ReferralPersona } from '@dripplex/types';

import { AppShell } from '@/components/app-shell';
import {
  useOperationsReferralOverview,
  useReferralPerformers,
} from '@/hooks/use-operations-finance';

/**
 * DPX-OPS — referral performance, read one persona at a time.
 *
 * DrippleX runs two referral programmes that look like one. The generic code is
 * held by customers, drivers and riders, and its owner type decides which
 * wallet a reward is paid into — so a single combined number hides the thing
 * Operations most needs to know, which is whose programme is converting. The
 * Driver Growth Campaign is separate again: monthly, tiered, with its own
 * approval queue and its own money. Both are shown, apart, because they are
 * apart.
 *
 * Conversion is rewarded-over-redeemed, not redeemed-over-issued. A code that
 * was redeemed but never qualified has cost nothing and earned nobody anything,
 * and counting it would make a programme look like it is working when nobody
 * has been paid.
 */

const PERSONAS: { value: ReferralPersona; label: string }[] = [
  { value: 'CUSTOMER', label: 'Customers' },
  { value: 'DRIVER', label: 'Drivers' },
  { value: 'RIDER', label: 'Riders' },
];

function naira(value: number): string {
  return `₦${value.toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;
}

function percent(rate: number): string {
  return `${(rate * 100).toFixed(rate === 0 || rate === 1 ? 0 : 1)}%`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
}

function PerformersTable({ persona }: { persona: ReferralPersona }): React.JSX.Element {
  const performers = useReferralPerformers(persona);
  const items = performers.data?.items ?? [];

  if (performers.isLoading) {
    return <LoadingSpinner />;
  }
  if (performers.isError) {
    return (
      <p className="text-sm text-red-600">
        Couldn&apos;t load referrers.{' '}
        <button
          type="button"
          onClick={() => {
            void performers.refetch();
          }}
          className="font-semibold underline"
        >
          Retry
        </button>
      </p>
    );
  }
  if (items.length === 0) {
    return (
      <EmptyState
        title="Nobody has a code yet"
        description="Referrers appear here once someone generates a code for this persona."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
            <th className="pb-2 pr-4 font-medium">Referrer</th>
            <th className="pb-2 pr-4 font-medium">Code</th>
            <th className="pb-2 pr-4 text-right font-medium">Redeemed</th>
            <th className="pb-2 pr-4 text-right font-medium">Rewarded</th>
            <th className="pb-2 text-right font-medium">Campaign earnings</th>
          </tr>
        </thead>
        <tbody>
          {items.map((performer) => (
            <tr key={performer.userId} className="border-b border-gray-100 last:border-0">
              <td className="py-3 pr-4 font-medium text-gray-900">{performer.name}</td>
              <td className="py-3 pr-4 font-mono text-xs text-gray-600">{performer.code}</td>
              <td className="py-3 pr-4 text-right tabular-nums text-gray-900">
                {performer.redemptions.toLocaleString('en-NG')}
              </td>
              <td className="py-3 pr-4 text-right font-semibold tabular-nums text-gray-900">
                {performer.rewardedRedemptions.toLocaleString('en-NG')}
              </td>
              <td className="py-3 text-right tabular-nums text-gray-900">
                {/* Null, not zero: personas with no reward programme have not
                    earned nothing, they have no programme to earn from. */}
                {performer.rewardAmountEarned === null ? (
                  <span className="text-gray-400">—</span>
                ) : (
                  <>
                    {naira(performer.rewardAmountEarned)}
                    {performer.rewardAmountUnpaid !== null && performer.rewardAmountUnpaid > 0 ? (
                      <div className="text-xs text-amber-600">
                        {naira(performer.rewardAmountUnpaid)} unpaid
                      </div>
                    ) : null}
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ReferralsPage(): React.JSX.Element {
  const [persona, setPersona] = React.useState<ReferralPersona>('DRIVER');
  const overview = useOperationsReferralOverview();

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Referral performance</h1>
          <p className="mt-1 text-sm text-gray-600">
            Each persona&apos;s programme on its own terms. Conversion is what was rewarded, not
            what was clicked — a code redeemed but never qualified has earned nobody anything.
          </p>
        </div>

        {overview.isLoading ? <LoadingSpinner /> : null}
        {overview.isError ? (
          <p className="text-sm text-red-600">
            Couldn&apos;t load referral performance.{' '}
            <button
              type="button"
              onClick={() => {
                void overview.refetch();
              }}
              className="font-semibold underline"
            >
              Retry
            </button>
          </p>
        ) : null}

        {overview.data ? (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              {overview.data.personas.map((row) => (
                <Card key={row.persona}>
                  <CardHeader>
                    <CardTitle>
                      {PERSONAS.find((entry) => entry.value === row.persona)?.label ?? row.persona}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold tabular-nums text-gray-900">
                      {percent(row.conversionRate)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {row.rewardedRedemptions.toLocaleString('en-NG')} rewarded of{' '}
                      {row.redemptions.toLocaleString('en-NG')} redeemed
                    </p>
                    <dl className="mt-3 space-y-1 text-xs text-gray-600">
                      <div className="flex justify-between">
                        <dt>Referrers with a code</dt>
                        <dd className="tabular-nums">{row.referrers.toLocaleString('en-NG')}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt>Referrers with a redemption</dt>
                        <dd className="tabular-nums">
                          {row.activeReferrers.toLocaleString('en-NG')}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt>Awaiting qualification</dt>
                        <dd className="tabular-nums">
                          {row.pendingRedemptions.toLocaleString('en-NG')}
                        </dd>
                      </div>
                    </dl>
                  </CardContent>
                </Card>
              ))}
            </div>

            {overview.data.personasWithoutProgramme.length > 0 ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                No referral programme exists for{' '}
                {overview.data.personasWithoutProgramme
                  .map((entry) => entry.toLowerCase().replace('_', ' '))
                  .join(' or ')}
                . They have no code to share and no decided reward — not zero referrals, no
                programme.
              </p>
            ) : null}

            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                <CardTitle>Referrers</CardTitle>
                <div className="flex gap-2">
                  {PERSONAS.map((entry) => (
                    <button
                      key={entry.value}
                      type="button"
                      onClick={() => {
                        setPersona(entry.value);
                      }}
                      className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                        persona === entry.value
                          ? 'border-emerald-600 bg-emerald-50 font-medium text-emerald-700'
                          : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {entry.label}
                    </button>
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                <PerformersTable persona={persona} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Driver Growth Campaigns</CardTitle>
                <p className="text-sm text-gray-600">
                  A separate programme from the codes above — monthly, tiered, with its own approval
                  queue and its own money.
                </p>
              </CardHeader>
              <CardContent>
                {overview.data.driverCampaigns.length === 0 ? (
                  <EmptyState
                    title="No campaigns yet"
                    description="Monthly driver-refers-passenger campaigns appear here once one is created."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                          <th className="pb-2 pr-4 font-medium">Campaign</th>
                          <th className="pb-2 pr-4 text-right font-medium">Drivers</th>
                          <th className="pb-2 pr-4 text-right font-medium">Registered</th>
                          <th className="pb-2 pr-4 text-right font-medium">Qualified</th>
                          <th className="pb-2 pr-4 text-right font-medium">Awaiting approval</th>
                          <th className="pb-2 text-right font-medium">Approved, unpaid</th>
                        </tr>
                      </thead>
                      <tbody>
                        {overview.data.driverCampaigns.map((campaign) => (
                          <tr
                            key={campaign.campaignId}
                            className="border-b border-gray-100 last:border-0"
                          >
                            <td className="py-3 pr-4">
                              <div className="font-medium text-gray-900">
                                {campaign.campaignName}
                              </div>
                              <div className="text-xs text-gray-500">
                                {formatDate(campaign.periodStart)} –{' '}
                                {formatDate(campaign.periodEnd)}{' '}
                                <Badge variant="outline">{campaign.status}</Badge>
                              </div>
                            </td>
                            <td className="py-3 pr-4 text-right tabular-nums">
                              {campaign.participatingDrivers.toLocaleString('en-NG')}
                            </td>
                            <td className="py-3 pr-4 text-right tabular-nums">
                              {campaign.registeredPassengers.toLocaleString('en-NG')}
                            </td>
                            <td className="py-3 pr-4 text-right font-semibold tabular-nums">
                              {campaign.qualifiedPassengers.toLocaleString('en-NG')}
                            </td>
                            <td className="py-3 pr-4 text-right tabular-nums">
                              {naira(campaign.rewardsPending.amount)}
                              <div className="text-xs text-gray-500">
                                {campaign.rewardsPending.count} driver
                                {campaign.rewardsPending.count === 1 ? '' : 's'}
                              </div>
                            </td>
                            <td className="py-3 text-right tabular-nums">
                              {naira(campaign.rewardsApproved.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
