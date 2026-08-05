'use client';

import { Card, CardContent, CardHeader, CardTitle, LoadingSpinner, Select } from '@dripplex/ui';
import * as React from 'react';

import type { MerchantAnalyticsOverviewDto, MerchantAnalyticsPeriod } from '@dripplex/types';

import { describeSdkError, sdk } from '@/lib/sdk';

const PERIOD_LABEL: Record<MerchantAnalyticsPeriod, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
};

const currency = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0,
});

function formatSeconds(seconds: number): string {
  if (seconds <= 0) {
    return '—';
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${String(minutes)}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0
    ? `${String(hours)}h ${String(remainingMinutes)}m`
    : `${String(hours)}h`;
}

export default function AnalyticsPage(): React.JSX.Element {
  const [period, setPeriod] = React.useState<MerchantAnalyticsPeriod>('daily');
  const [overview, setOverview] = React.useState<MerchantAnalyticsOverviewDto | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await sdk.analytics.merchant({ period });
      setOverview(data);
    } catch (loadError) {
      setError(describeSdkError(loadError).description);
    } finally {
      setLoading(false);
    }
  }, [period]);

  React.useEffect(() => {
    void load();
    // Same 15s live-data precedent every other Phase 2 screen uses.
    const interval = setInterval(() => {
      void load();
    }, 15_000);
    return () => {
      clearInterval(interval);
    };
  }, [load]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Real order and revenue performance for your store.
          </p>
        </div>
        <Select
          aria-label="Period"
          value={period}
          onChange={(event) => {
            setPeriod(event.target.value as MerchantAnalyticsPeriod);
          }}
        >
          {(Object.keys(PERIOD_LABEL) as MerchantAnalyticsPeriod[]).map((value) => (
            <option key={value} value={value}>
              {PERIOD_LABEL[value]}
            </option>
          ))}
        </Select>
      </div>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      {loading && !overview ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : overview ? (
        <>
          <p className="text-muted-foreground text-sm">
            {overview.range.from} – {overview.range.to}
          </p>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Kpi label="Orders" value={String(overview.kpis.orders)} />
            <Kpi label="Revenue" value={currency.format(overview.kpis.revenue)} />
            <Kpi label="Avg. order value" value={currency.format(overview.kpis.aov)} />
            <Kpi label="Repeat customers" value={String(overview.kpis.repeatCustomers)} />
            <Kpi
              label="Avg. delivery time"
              value={formatSeconds(overview.kpis.deliveryTimeAvgSeconds)}
            />
            <Kpi label="Failed payments" value={String(overview.kpis.failedPayments)} />
            <Kpi label="Cancelled orders" value={String(overview.kpis.cancelledOrders)} />
            <Kpi label="Refunds" value={String(overview.kpis.refunds)} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Orders &amp; revenue by period</CardTitle>
            </CardHeader>
            <CardContent>
              {overview.series.length === 0 ? (
                <p className="text-muted-foreground text-sm">No activity in this range yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-border/70 text-muted-foreground border-b text-left">
                        <th className="py-2 pr-4 font-medium">Period</th>
                        <th className="py-2 pr-4 font-medium">Orders</th>
                        <th className="py-2 font-medium">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-border/70 divide-y">
                      {overview.series.map((point) => (
                        <tr key={point.period}>
                          <td className="py-2 pr-4">{point.period}</td>
                          <td className="py-2 pr-4">{point.orders}</td>
                          <td className="py-2">{currency.format(point.revenue)}</td>
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
  );
}

function Kpi({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="border-border/70 rounded-lg border p-4">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
