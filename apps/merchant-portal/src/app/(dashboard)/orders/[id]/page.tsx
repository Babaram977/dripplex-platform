'use client';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  LoadingSpinner,
  Textarea,
} from '@dripplex/ui';
import { useParams, useRouter } from 'next/navigation';
import * as React from 'react';

import type { OrderDto, OrderStatus } from '@dripplex/types';

import { describeSdkError, sdk } from '@/lib/sdk';

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

function formatDate(iso: string | null): string {
  if (!iso) {
    return '—';
  }
  return new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );
}

/** Local-datetime-input value (no timezone) -> ISO string, or undefined if empty. */
function toIso(localValue: string): string | undefined {
  if (!localValue) {
    return undefined;
  }
  const parsed = new Date(localValue);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

export default function OrderDetailPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const orderId = params.id;
  const router = useRouter();

  const [order, setOrder] = React.useState<OrderDto | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [notFound, setNotFound] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  // Which inline action form is currently open. Only one at a time — this
  // module has no Dialog component, so reason/date entry happens as an
  // inline expand-in-place form rather than a modal.
  const [openForm, setOpenForm] = React.useState<'accept' | 'reject' | 'delay' | 'cancel' | null>(
    null,
  );

  const reload = React.useCallback(async () => {
    try {
      const data = await sdk.orders.merchantGetOrder(orderId);
      setOrder(data);
    } catch (loadError) {
      const described = describeSdkError(loadError);
      if (described.statusCode === 404) {
        setNotFound(true);
      } else {
        setError(described.description);
      }
    }
  }, [orderId]);

  React.useEffect(() => {
    setLoading(true);
    void reload().finally(() => {
      setLoading(false);
    });
  }, [reload]);

  // withBusy prevents duplicate merchant actions from rapid taps: the
  // moment an action starts, every action button in this page disables via
  // the shared `busy` flag until the request settles and the order reloads.
  const withBusy = async (action: () => Promise<unknown>): Promise<void> => {
    if (busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await action();
      setOpenForm(null);
      await reload();
    } catch (actionError) {
      setError(describeSdkError(actionError).description);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (notFound || !order) {
    return (
      <p className="text-destructive text-sm" role="alert">
        {notFound ? 'Order not found.' : (error ?? 'Order not found.')}
      </p>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <Button
          type="button"
          variant="ghost"
          className="text-muted-foreground -ml-3 h-auto px-3 py-1 text-sm"
          onClick={() => {
            router.push('/orders');
          }}
        >
          ← Back to orders
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            {order.orderNumber}
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">Placed {formatDate(order.createdAt)}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <Badge variant={PAYMENT_BADGE_VARIANT[order.paymentStatus]}>
              Payment: {order.paymentStatus}
            </Badge>
            <Badge variant={STATUS_BADGE_VARIANT[order.status]}>{STATUS_LABEL[order.status]}</Badge>
          </div>
          {/* Payment status and fulfilment status are tracked independently
              by the backend and must never be conflated in the UI — an
              order can be PAID and still CONFIRMED/PREPARING, and cash
              orders reach PAID only once the courier collects payment. */}
          <p className="text-muted-foreground text-xs">
            Payment status and order status are tracked separately.
          </p>
        </div>
      </div>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <OrderActions
        order={order}
        busy={busy}
        openForm={openForm}
        setOpenForm={setOpenForm}
        withBusy={withBusy}
      />

      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{item.snapshotName}</p>
                <p className="text-muted-foreground text-xs">
                  {item.quantity} × {formatMoney(item.unitPrice, order.currency)}
                  {item.snapshotSku ? ` · SKU ${item.snapshotSku}` : ''}
                </p>
              </div>
              <p className="shrink-0 font-medium">{formatMoney(item.subtotal, order.currency)}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Order summary</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <SummaryRow label="Subtotal" value={formatMoney(order.subtotal, order.currency)} />
          {order.discount > 0 ? (
            <SummaryRow
              label="Discount"
              value={`−${formatMoney(order.discount, order.currency)}`}
            />
          ) : null}
          {order.deliveryFee > 0 ? (
            <SummaryRow
              label="Delivery fee"
              value={formatMoney(order.deliveryFee, order.currency)}
            />
          ) : null}
          {order.tax > 0 ? (
            <SummaryRow label="Tax" value={formatMoney(order.tax, order.currency)} />
          ) : null}
          <div className="border-border/70 mt-1 flex items-center justify-between border-t pt-2 font-semibold">
            <span>Total</span>
            <span>{formatMoney(order.total, order.currency)}</span>
          </div>
          <SummaryRow
            label="Fulfilment"
            value={order.fulfillmentType === 'DELIVERY' ? 'Delivery' : 'Pickup'}
          />
          {order.paymentMethod ? (
            <SummaryRow label="Payment method" value={order.paymentMethod} />
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <SummaryRow label="Confirmed" value={formatDate(order.confirmedAt)} />
          {order.estimatedReadyAt ? (
            <SummaryRow label="Estimated ready" value={formatDate(order.estimatedReadyAt)} />
          ) : null}
          <SummaryRow label="Ready" value={formatDate(order.readyAt)} />
          <SummaryRow label="Delivered" value={formatDate(order.deliveredAt)} />
          <SummaryRow label="Completed" value={formatDate(order.completedAt)} />
          {order.cancelledAt ? (
            <>
              <SummaryRow label="Cancelled" value={formatDate(order.cancelledAt)} />
              {order.cancellationReason ? (
                <SummaryRow label="Reason" value={order.cancellationReason} />
              ) : null}
            </>
          ) : null}
        </CardContent>
      </Card>

      {/* Settlement (DPX-MERCHANT-002) is driven by the order's authoritative
          completion event, not by any action taken here — accepting,
          preparing, or marking ready never credits the merchant wallet.
          This page intentionally shows no settlement/payout state so it
          never implies otherwise; settlement transparency lands on the
          Wallet & Bank screen. */}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function OrderActions({
  order,
  busy,
  openForm,
  setOpenForm,
  withBusy,
}: {
  order: OrderDto;
  busy: boolean;
  openForm: 'accept' | 'reject' | 'delay' | 'cancel' | null;
  setOpenForm: (form: 'accept' | 'reject' | 'delay' | 'cancel' | null) => void;
  withBusy: (action: () => Promise<unknown>) => Promise<void>;
}): React.JSX.Element | null {
  const [estimatedReadyAt, setEstimatedReadyAt] = React.useState('');
  const [reason, setReason] = React.useState('');

  const toggle = (form: 'accept' | 'reject' | 'delay' | 'cancel'): void => {
    setOpenForm(openForm === form ? null : form);
  };

  // Mirrors MerchantOrdersService exactly: accept/reject only apply to a
  // CONFIRMED (new) order; ready/delay only to a PREPARING order; cancel is
  // additionally allowed from READY. No other transitions are offered.
  const canAcceptOrReject = order.status === 'CONFIRMED';
  const canReadyOrDelay = order.status === 'PREPARING';
  const canCancel =
    order.status === 'CONFIRMED' || order.status === 'PREPARING' || order.status === 'READY';

  if (!canAcceptOrReject && !canReadyOrDelay && !canCancel) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actions</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {canAcceptOrReject ? (
            <>
              <Button
                type="button"
                disabled={busy}
                onClick={() => {
                  toggle('accept');
                }}
              >
                Accept order
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  toggle('reject');
                }}
              >
                Reject
              </Button>
            </>
          ) : null}
          {canReadyOrDelay ? (
            <>
              <Button
                type="button"
                disabled={busy}
                onClick={() => void withBusy(() => sdk.orders.merchantMarkOrderReady(order.id))}
              >
                Mark ready
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  toggle('delay');
                }}
              >
                Delay
              </Button>
            </>
          ) : null}
          {canCancel ? (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                toggle('cancel');
              }}
            >
              Cancel order
            </Button>
          ) : null}
        </div>

        {openForm === 'accept' ? (
          <div className="border-border/70 flex flex-col gap-3 rounded-md border p-3">
            <p className="text-muted-foreground text-xs">
              Accepting moves this order straight into preparation. Optionally give the customer an
              estimated ready time.
            </p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="accept-eta">Estimated ready time (optional)</Label>
              <Input
                id="accept-eta"
                type="datetime-local"
                value={estimatedReadyAt}
                onChange={(event) => {
                  setEstimatedReadyAt(event.target.value);
                }}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  setOpenForm(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={busy}
                onClick={() =>
                  void withBusy(() =>
                    sdk.orders.merchantAcceptOrder(order.id, {
                      ...(toIso(estimatedReadyAt)
                        ? { estimatedReadyAt: toIso(estimatedReadyAt) }
                        : {}),
                    }),
                  )
                }
              >
                {busy ? 'Accepting…' : 'Confirm accept'}
              </Button>
            </div>
          </div>
        ) : null}

        {openForm === 'reject' ? (
          <div className="border-border/70 flex flex-col gap-3 rounded-md border p-3">
            <p className="text-muted-foreground text-xs">
              Rejecting cancels this order. If the customer already paid, the payment is refunded
              automatically.
            </p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reject-reason">Reason (required)</Label>
              <Textarea
                id="reject-reason"
                rows={2}
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value);
                }}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  setOpenForm(null);
                }}
              >
                Back
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy || !reason.trim()}
                onClick={() =>
                  void withBusy(() =>
                    sdk.orders.merchantRejectOrder(order.id, { reason: reason.trim() }),
                  )
                }
              >
                {busy ? 'Rejecting…' : 'Confirm reject'}
              </Button>
            </div>
          </div>
        ) : null}

        {openForm === 'delay' ? (
          <div className="border-border/70 flex flex-col gap-3 rounded-md border p-3">
            <p className="text-muted-foreground text-xs">
              The order stays in preparation — this only updates the customer-facing estimated ready
              time.
            </p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="delay-eta">New estimated ready time (required)</Label>
              <Input
                id="delay-eta"
                type="datetime-local"
                value={estimatedReadyAt}
                onChange={(event) => {
                  setEstimatedReadyAt(event.target.value);
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="delay-reason">Reason (optional)</Label>
              <Textarea
                id="delay-reason"
                rows={2}
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value);
                }}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  setOpenForm(null);
                }}
              >
                Back
              </Button>
              <Button
                type="button"
                disabled={busy || !toIso(estimatedReadyAt)}
                onClick={() => {
                  const iso = toIso(estimatedReadyAt);
                  if (!iso) {
                    return;
                  }
                  void withBusy(() =>
                    sdk.orders.merchantDelayOrder(order.id, {
                      estimatedReadyAt: iso,
                      ...(reason.trim() ? { reason: reason.trim() } : {}),
                    }),
                  );
                }}
              >
                {busy ? 'Saving…' : 'Confirm delay'}
              </Button>
            </div>
          </div>
        ) : null}

        {openForm === 'cancel' ? (
          <div className="border-border/70 flex flex-col gap-3 rounded-md border p-3">
            <p className="text-muted-foreground text-xs">
              Cancelling stops fulfilment. If the customer already paid, the payment is refunded
              automatically.
            </p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cancel-reason">Reason (optional)</Label>
              <Textarea
                id="cancel-reason"
                rows={2}
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value);
                }}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  setOpenForm(null);
                }}
              >
                Back
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void withBusy(() =>
                    sdk.orders.merchantCancelOrder(order.id, {
                      ...(reason.trim() ? { reason: reason.trim() } : {}),
                    }),
                  )
                }
              >
                {busy ? 'Cancelling…' : 'Confirm cancel'}
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
