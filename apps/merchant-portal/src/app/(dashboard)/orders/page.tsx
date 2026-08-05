'use client';

import { Badge, Button, EmptyState, LoadingSpinner, Select } from '@dripplex/ui';
import Link from 'next/link';
import * as React from 'react';

import type { OrderDto, OrderStatus } from '@dripplex/types';

import { describeSdkError, sdk } from '@/lib/sdk';

const PAGE_SIZE = 20;

/** Orders that still need a merchant decision or are actively being
 * fulfilled — matches exactly the statuses MerchantOrdersController
 * accepts an action on (CONFIRMED/PREPARING/READY), never invented. */
const ACTIONABLE_STATUSES: ReadonlySet<OrderStatus> = new Set(['CONFIRMED', 'PREPARING', 'READY']);

const STATUS_LABEL: Record<OrderStatus, string> = {
  DRAFT: 'Draft',
  PENDING: 'Pending payment',
  CONFIRMED: 'New',
  PREPARING: 'Preparing',
  READY: 'Ready',
  DRIVER_ASSIGNED: 'Driver assigned',
  PICKED_UP: 'Picked up',
  IN_TRANSIT: 'In transit',
  DELIVERED: 'Delivered',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
  DISPUTED: 'Disputed',
  FAILED: 'Failed',
};

const STATUS_BADGE_VARIANT: Record<
  OrderStatus,
  'accent' | 'default' | 'success' | 'secondary' | 'outline'
> = {
  DRAFT: 'outline',
  PENDING: 'outline',
  CONFIRMED: 'accent',
  PREPARING: 'default',
  READY: 'success',
  DRIVER_ASSIGNED: 'secondary',
  PICKED_UP: 'secondary',
  IN_TRANSIT: 'secondary',
  DELIVERED: 'secondary',
  COMPLETED: 'secondary',
  CANCELLED: 'outline',
  REFUNDED: 'outline',
  DISPUTED: 'accent',
  FAILED: 'outline',
};

const PAYMENT_BADGE_VARIANT: Record<
  OrderDto['paymentStatus'],
  'success' | 'outline' | 'accent' | 'secondary'
> = {
  PAID: 'success',
  PENDING: 'outline',
  FAILED: 'accent',
  REFUNDED: 'secondary',
  PARTIAL_REFUND: 'secondary',
};

function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(amount);
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );
}

export default function OrdersListPage(): React.JSX.Element {
  const [items, setItems] = React.useState<OrderDto[]>([]);
  const [status, setStatus] = React.useState<OrderStatus | ''>('');
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await sdk.orders.merchantGetOrders({
        page,
        pageSize: PAGE_SIZE,
        ...(status ? { status } : {}),
      });
      setItems(result.items);
      setTotalPages(result.meta.totalPages);
    } catch (loadError) {
      setError(describeSdkError(loadError).description);
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  React.useEffect(() => {
    void load();
    // Incoming orders need to appear without a manual refresh — same
    // 15s-polling precedent every other DrippleX portal queue screen
    // uses (Ops Command Centre's queues, Driver's incoming-ride list)
    // rather than a websocket subscription this module doesn't have.
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
          <h1 className="font-display text-3xl font-semibold tracking-tight">Orders</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Incoming orders and fulfilment history for your store.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Select
          aria-label="Filter by status"
          className="w-52"
          value={status}
          onChange={(event) => {
            setPage(1);
            setStatus(event.target.value as OrderStatus | '');
          }}
        >
          <option value="">All orders</option>
          <optgroup label="Needs attention">
            <option value="CONFIRMED">New</option>
            <option value="PREPARING">Preparing</option>
            <option value="READY">Ready</option>
          </optgroup>
          <optgroup label="History">
            <option value="DELIVERED">Delivered</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="REFUNDED">Refunded</option>
          </optgroup>
        </Select>
      </div>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      {loading && items.length === 0 ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title={status ? 'No orders match this filter' : 'No orders yet'}
          description={
            status
              ? 'Try a different status, or clear the filter to see every order.'
              : 'Orders will show up here as soon as a customer checks out from your store.'
          }
        />
      ) : (
        <div className="border-border/70 divide-border/70 divide-y overflow-hidden rounded-lg border">
          {items.map((order) => (
            <Link
              key={order.id}
              href={`/orders/${order.id}`}
              className="hover:bg-muted flex items-center justify-between gap-4 px-4 py-3 transition-colors"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium">{order.orderNumber}</p>
                  {ACTIONABLE_STATUSES.has(order.status) ? (
                    <span
                      className="bg-accent h-1.5 w-1.5 shrink-0 rounded-full"
                      aria-label="Needs attention"
                    />
                  ) : null}
                </div>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {order.items.length} item{order.items.length === 1 ? '' : 's'} ·{' '}
                  {formatMoney(order.total, order.currency)} · {formatDate(order.createdAt)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant={PAYMENT_BADGE_VARIANT[order.paymentStatus]}>
                  {order.paymentStatus}
                </Badge>
                <Badge variant={STATUS_BADGE_VARIANT[order.status]}>
                  {STATUS_LABEL[order.status]}
                </Badge>
              </div>
            </Link>
          ))}
        </div>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            disabled={page <= 1}
            onClick={() => {
              setPage((current) => Math.max(1, current - 1));
            }}
          >
            Previous
          </Button>
          <span className="text-muted-foreground text-sm">
            Page {page} of {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => {
              setPage((current) => Math.min(totalPages, current + 1));
            }}
          >
            Next
          </Button>
        </div>
      ) : null}
    </div>
  );
}
