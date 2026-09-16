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
import { formatNaira, formatRelativeTime } from '@dripplex/utils';
import * as React from 'react';

import type { OrderExceptionFilters } from '@/hooks/use-order-exceptions';
import type { OrderExceptionDto } from '@dripplex/types';

import { AppShell } from '@/components/app-shell';
import { useOrderExceptions } from '@/hooks/use-order-exceptions';

/**
 * DPX-ORDER-8D-C ops visibility — the stalled-order queue.
 *
 * Founder remediation ruling, 2026-09-16: a DELIVERY order left CONFIRMED and
 * unadvanced for 30 minutes stops being the merchant's private problem and
 * becomes a DrippleX-managed exception. The backend increment (#416) detects
 * those and warns the merchant. Until this screen existed the rows were written
 * to a table nothing read, so the platform could not actually see what it had
 * taken ownership of.
 *
 * READ ONLY, deliberately. There is no resolve, dismiss, assign, annotate or
 * contact-merchant control here, because no ruling defines one — the 30-minute
 * threshold escalates an order, it does not authorise anyone to act on one. An
 * exception closes when the ORDER moves and the backend resolves it
 * automatically; nothing on this screen can close one. The operator recovery
 * model is recorded as an open blocker rather than invented here.
 */
export default function StalledOrdersQueuePage(): React.JSX.Element {
  const [filters, setFilters] = React.useState<OrderExceptionFilters>({ status: 'OPEN' });
  const queue = useOrderExceptions({ ...filters, pageSize: 50 });
  const data = queue.data;

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Stalled Orders</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Confirmed delivery orders a merchant has not advanced. DrippleX owns these; the merchant
            has already been warned automatically.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {(['OPEN', 'RESOLVED'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => {
                setFilters({ status });
              }}
              aria-pressed={filters.status === status}
              className={
                filters.status === status
                  ? 'bg-primary text-primary-foreground rounded-full px-3 py-1 text-xs font-medium'
                  : 'bg-muted text-muted-foreground rounded-full px-3 py-1 text-xs font-medium'
              }
            >
              {status === 'OPEN' ? 'Open' : 'Resolved'}
            </button>
          ))}
        </div>

        {queue.isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner label="Loading stalled orders…" />
          </div>
        ) : null}

        {queue.isError ? (
          <EmptyState
            title="Couldn't load stalled orders"
            description="Check your connection and try again."
          />
        ) : null}

        {data?.items.length === 0 ? (
          <EmptyState
            title={filters.status === 'OPEN' ? 'No stalled orders' : 'No resolved exceptions'}
            description={
              filters.status === 'OPEN'
                ? 'Every confirmed delivery order is moving.'
                : 'Nothing has been resolved yet.'
            }
          />
        ) : null}

        {data && data.items.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>
                {data.meta.total.toLocaleString('en-NG')}{' '}
                {data.meta.total === 1 ? 'exception' : 'exceptions'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-border/70 divide-y">
                {data.items.map((item) => (
                  <ExceptionRow key={item.id} exception={item} />
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}

function ExceptionRow({ exception }: { exception: OrderExceptionDto }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-medium">
          {exception.order.orderNumber} · {formatNaira(exception.order.total)}
        </p>
        <p className="text-muted-foreground mt-0.5 text-xs">
          {/* The STORED wait, not a live clock. It records what the order had
              waited when the platform took ownership; recomputing it would
              quietly disagree the moment the order moves. */}
          Waited {formatWait(exception.waitedMinutes)} · Detected{' '}
          {formatRelativeTime(exception.detectedAt)}
          {exception.notifiedAt === null
            ? ' · Merchant warning pending retry'
            : ` · Merchant warned ${formatRelativeTime(exception.notifiedAt)}`}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge variant={exception.status === 'OPEN' ? 'accent' : 'secondary'}>
          {exception.status === 'OPEN' ? 'Open' : 'Resolved'}
        </Badge>
        <Badge variant="outline">{exception.order.status}</Badge>
        <Badge variant="outline">{exception.order.paymentStatus}</Badge>
      </div>
    </div>
  );
}

/**
 * Minutes read badly past a couple of hours, and this queue's whole point is
 * that an order has been waiting an unreasonable time — "6382 minutes" makes
 * that harder to see, not easier.
 */
export function formatWait(minutes: number): string {
  if (minutes < 60) {
    return `${String(minutes)}m`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const rest = minutes % 60;
    return rest === 0 ? `${String(hours)}h` : `${String(hours)}h ${String(rest)}m`;
  }
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours === 0 ? `${String(days)}d` : `${String(days)}d ${String(restHours)}h`;
}
