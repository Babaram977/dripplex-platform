'use client';

import { useAuth } from '@dripplex/hooks';
import {
  SuperAppBottomNav,
  SuperAppCancelOrderSheet,
  SuperAppCartEmptyState,
  SuperAppOrderCompletedCelebration,
  SuperAppOrderTimeline,
  SuperAppReportIssueSheet,
  SuperAppTrackingActionBar,
  SuperAppTrackingItemsAccordion,
  SuperAppTrackingMerchantCard,
  SuperAppTrackingRiderCard,
  SuperAppTrackingSkeleton,
  toast,
  type SuperAppTimelineStep,
} from '@dripplex/ui';
import { useParams, useRouter } from 'next/navigation';
import * as React from 'react';

import type { CustomerDeliveryDto, OrderDto } from '@dripplex/types';

import { LiveMap } from '@/components/ride/live-map';
import { formatPrice } from '@/lib/format';
import { reorderItems } from '@/lib/marketplace-actions';
import { describeSdkError, sdk } from '@/lib/sdk';
import { siteConfig } from '@/lib/site';

const CANCELLABLE_STATUSES = new Set(['PENDING', 'CONFIRMED', 'PREPARING']);
const TERMINAL_STATUSES = new Set(['DELIVERED', 'COMPLETED', 'CANCELLED', 'REFUNDED']);

/** Rank is relative to "confirmed" = 0; PENDING (awaiting payment) sits
 * below that, so nothing shows LIVE until the order is genuinely
 * confirmed — the checkout flow creates the order as PENDING and only
 * moves it to CONFIRMED once payment actually succeeds. */
function buildDeliverySteps(
  order: OrderDto,
  delivery: CustomerDeliveryDto | null,
): SuperAppTimelineStep[] {
  const orderRank: Record<string, number> = {
    DRAFT: -2,
    PENDING: -1,
    CONFIRMED: 0,
    PREPARING: 1,
    READY: 2,
    DRIVER_ASSIGNED: 3,
    PICKED_UP: 4,
    IN_TRANSIT: 5,
    DELIVERED: 6,
    COMPLETED: 6,
  };
  const orderStep = orderRank[order.status] ?? -2;
  const deliveryRank: Record<string, number> = {
    PENDING: 0,
    ASSIGNED: 1,
    ACCEPTED: 1,
    PICKED_UP: 2,
    ON_THE_WAY: 3,
    ARRIVED: 4,
    DELIVERED: 5,
  };
  const deliveryStep = delivery ? (deliveryRank[delivery.status] ?? -1) : -1;
  const delivered = delivery?.status === 'DELIVERED' || orderStep >= 6;

  const state = (
    threshold: number,
    rank: number,
    activeAt: number,
  ): 'done' | 'active' | 'pending' => {
    if (delivered) return 'done';
    if (rank > threshold) return 'done';
    if (rank === threshold && threshold === activeAt) return 'active';
    return 'pending';
  };

  return [
    {
      key: 'confirmed',
      label: 'Order Confirmed',
      sub:
        order.confirmedAt !== null
          ? `Confirmed ${new Date(order.confirmedAt).toLocaleTimeString()}`
          : 'Awaiting payment',
      state: state(0, orderStep, 0),
    },
    {
      key: 'preparing',
      label: 'Merchant Preparing',
      sub: 'Your order is being prepared',
      state: state(1, orderStep, 1),
    },
    {
      key: 'ready',
      label: 'Ready for Pickup',
      sub: order.readyAt
        ? `Ready ${new Date(order.readyAt).toLocaleTimeString()}`
        : 'Waiting for a rider',
      state: state(2, orderStep, 2),
    },
    {
      key: 'assigned',
      label: 'Rider Assigned',
      sub: delivery?.riderName
        ? `${delivery.riderName} is heading to the merchant`
        : 'Finding a rider',
      state: delivery ? state(1, deliveryStep, 1) : 'pending',
    },
    {
      key: 'on_the_way',
      label: 'On the Way',
      sub: 'Your rider is en route',
      state: delivery ? state(3, deliveryStep, 3) : 'pending',
    },
    {
      key: 'delivered',
      label: 'Delivered',
      sub: delivery?.deliveredAt
        ? `Delivered ${new Date(delivery.deliveredAt).toLocaleTimeString()}`
        : 'Order complete',
      state: delivered ? 'done' : 'pending',
    },
  ];
}

function buildPickupSteps(order: OrderDto): SuperAppTimelineStep[] {
  const orderRank: Record<string, number> = {
    DRAFT: -2,
    PENDING: -1,
    CONFIRMED: 0,
    PREPARING: 1,
    READY: 2,
    COMPLETED: 3,
  };
  const rank = orderRank[order.status] ?? -2;
  const completed = order.status === 'COMPLETED';
  const state = (threshold: number): 'done' | 'active' | 'pending' => {
    if (completed) return 'done';
    if (rank > threshold) return 'done';
    if (rank === threshold) return 'active';
    return 'pending';
  };
  return [
    {
      key: 'confirmed',
      label: 'Order Confirmed',
      sub:
        order.confirmedAt !== null
          ? `Confirmed ${new Date(order.confirmedAt).toLocaleTimeString()}`
          : 'Awaiting payment',
      state: state(0),
    },
    {
      key: 'preparing',
      label: 'Merchant Preparing',
      sub: 'Your order is being prepared',
      state: state(1),
    },
    {
      key: 'ready',
      label: 'Ready for Pickup',
      sub: order.readyAt
        ? `Ready ${new Date(order.readyAt).toLocaleTimeString()}`
        : 'Waiting for you to collect',
      state: state(2),
    },
    {
      key: 'completed',
      label: 'Picked Up',
      sub: 'Order complete',
      state: completed ? 'done' : 'pending',
    },
  ];
}

export default function TrackingPage(): React.JSX.Element {
  const router = useRouter();
  const params = useParams<{ orderId: string }>();
  const orderId = params.orderId;
  const { hydrated, isAuthenticated } = useAuth();

  const [order, setOrder] = React.useState<OrderDto | null>(null);
  const [delivery, setDelivery] = React.useState<CustomerDeliveryDto | null>(null);
  const [merchantName, setMerchantName] = React.useState<string | null>(null);
  const [merchantSlugId, setMerchantSlugId] = React.useState<string | null>(null);
  const [loaded, setLoaded] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [showCancel, setShowCancel] = React.useState(false);
  const [cancelling, setCancelling] = React.useState(false);
  const [showReport, setShowReport] = React.useState(false);
  const [reporting, setReporting] = React.useState(false);

  const load = React.useCallback(async (): Promise<void> => {
    try {
      const orderData = await sdk.orders.getOrder(orderId);
      setOrder(orderData);

      if (orderData.fulfillmentType === 'DELIVERY') {
        try {
          const deliveryData = await sdk.delivery.getDelivery(orderId);
          setDelivery(deliveryData);
        } catch {
          setDelivery(null);
        }
      }

      const firstItem = orderData.items[0];
      if (firstItem) {
        try {
          const product = await sdk.products.get(firstItem.productId);
          setMerchantName(product.merchant?.businessName ?? null);
          setMerchantSlugId(product.merchantId);
        } catch {
          setMerchantName(null);
        }
      }
      setError(null);
    } catch (loadError) {
      setError(describeSdkError(loadError).description);
    } finally {
      setLoaded(true);
    }
  }, [orderId]);

  React.useEffect(() => {
    if (!hydrated || !isAuthenticated) {
      if (hydrated) setLoaded(true);
      return;
    }
    void load();
  }, [hydrated, isAuthenticated, load]);

  React.useEffect(() => {
    if (!order || TERMINAL_STATUSES.has(order.status)) return;
    const interval = setInterval(() => {
      void load();
    }, 8000);
    return () => {
      clearInterval(interval);
    };
  }, [order, load]);

  const onCancel = async (): Promise<void> => {
    setCancelling(true);
    try {
      await sdk.orders.cancelOrder(orderId, { reason: 'Cancelled by customer' });
      setShowCancel(false);
      toast({ title: 'Order cancelled', description: 'Your order has been cancelled.' });
      await load();
    } catch (cancelError) {
      const described = describeSdkError(cancelError);
      toast({ title: described.title, description: described.description, variant: 'destructive' });
    } finally {
      setCancelling(false);
    }
  };

  const onReport = async (reason: string): Promise<void> => {
    setReporting(true);
    try {
      await sdk.orders.raiseDispute(orderId, { reason });
      setShowReport(false);
      toast({ title: 'Report submitted', description: 'Our team will review your order.' });
    } catch (reportError) {
      const described = describeSdkError(reportError);
      toast({ title: described.title, description: described.description, variant: 'destructive' });
    } finally {
      setReporting(false);
    }
  };

  const onReorder = async (): Promise<void> => {
    if (!order) return;
    try {
      await reorderItems(order.items);
      toast({ title: 'Added to cart', description: 'Your items were added to a new cart.' });
      router.push('/marketplace/cart');
    } catch (reorderError) {
      const described = describeSdkError(reorderError);
      toast({ title: described.title, description: described.description, variant: 'destructive' });
    }
  };

  if (!hydrated || !loaded) {
    return (
      <div className="absolute inset-0 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <SuperAppTrackingSkeleton />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="absolute inset-0 flex flex-col overflow-hidden">
        <SuperAppCartEmptyState
          onBrowse={() => {
            router.push(siteConfig.links.login);
          }}
        />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
        <p className="text-sm text-white/70" role="alert">
          {error ?? 'Order not found.'}
        </p>
      </div>
    );
  }

  if (order.status === 'DELIVERED' || order.status === 'COMPLETED') {
    return (
      <div className="absolute inset-0 flex flex-col overflow-hidden">
        <SuperAppOrderCompletedCelebration
          orderNumber={order.orderNumber}
          onReorder={() => {
            void onReorder();
          }}
          onViewOrders={() => {
            router.push('/marketplace');
          }}
          onHome={() => {
            router.push('/marketplace');
          }}
          onReportIssue={
            order.status === 'DELIVERED'
              ? () => {
                  setShowReport(true);
                }
              : undefined
          }
        />
        {showReport ? (
          <SuperAppReportIssueSheet
            submitting={reporting}
            onSubmit={(reason) => {
              void onReport(reason);
            }}
            onClose={() => {
              setShowReport(false);
            }}
          />
        ) : null}
      </div>
    );
  }

  const steps =
    order.fulfillmentType === 'DELIVERY'
      ? buildDeliverySteps(order, delivery)
      : buildPickupSteps(order);
  const items = order.items.map((item) => ({
    id: item.id,
    name: item.snapshotName,
    imageUrl: item.snapshotImage,
    quantity: item.quantity,
    lineTotalLabel: formatPrice(item.subtotal, order.currency),
  }));
  const canCancel = CANCELLABLE_STATUSES.has(order.status);
  const showMap =
    order.fulfillmentType === 'DELIVERY' &&
    delivery !== null &&
    delivery.status !== 'DELIVERED' &&
    delivery.status !== 'CANCELLED';

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between px-5 pb-3 pt-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              router.push('/marketplace');
            }}
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{
              background: 'rgba(255,255,255,.06)',
              border: '1px solid rgba(255,255,255,.08)',
            }}
          >
            ←
          </button>
          <div>
            <p className="text-[18px] font-bold leading-none text-white">Track Order</p>
            <p className="mt-0.5 text-[11px] text-white/40">
              #{order.orderNumber}
              {merchantName ? ` · ${merchantName}` : ''}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-44" style={{ scrollbarWidth: 'none' }}>
        {order.status === 'CANCELLED' || order.status === 'REFUNDED' ? (
          <div
            className="mb-4 rounded-2xl p-4"
            style={{
              background: 'rgba(248,113,113,.08)',
              border: '1px solid rgba(248,113,113,.22)',
            }}
          >
            <p className="text-[13px] font-semibold" style={{ color: '#F87171' }}>
              This order was cancelled
            </p>
            {order.cancellationReason ? (
              <p className="mt-1 text-[12px] text-white/50">{order.cancellationReason}</p>
            ) : null}
          </div>
        ) : null}

        {showMap ? (
          <div className="mb-4">
            <LiveMap
              pickup={{ latitude: delivery.pickupLatitude, longitude: delivery.pickupLongitude }}
              dropoff={{ latitude: delivery.dropoffLatitude, longitude: delivery.dropoffLongitude }}
              routeBetween={
                delivery.status === 'PICKED_UP' ||
                delivery.status === 'ON_THE_WAY' ||
                delivery.status === 'ARRIVED'
                  ? 'driverDropoff'
                  : 'pickupDropoff'
              }
              className="h-[200px] w-full overflow-hidden rounded-2xl"
              fallbackVariant="assigned"
            />
          </div>
        ) : null}

        {delivery?.riderName ? (
          <div className="mb-4">
            <SuperAppTrackingRiderCard
              name={delivery.riderName}
              live={delivery.status === 'ON_THE_WAY' || delivery.status === 'ARRIVED'}
            />
          </div>
        ) : null}

        <div
          className="mb-4 rounded-2xl p-4"
          style={{ background: '#0D1B2E', border: '1px solid rgba(255,255,255,.08)' }}
        >
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-white/40">
            Order Progress
          </p>
          <SuperAppOrderTimeline steps={steps} />
        </div>

        <div className="mb-4">
          <SuperAppTrackingMerchantCard
            merchantName={merchantName ?? 'Your Order'}
            onViewStore={
              merchantSlugId
                ? () => {
                    router.push(`/marketplace/products/${order.items[0]?.productId ?? ''}`);
                  }
                : undefined
            }
          />
        </div>

        <div className="mb-4">
          <SuperAppTrackingItemsAccordion
            items={items}
            totalLabel={formatPrice(order.total, order.currency)}
          />
        </div>

        <SuperAppTrackingActionBar
          canCancel={canCancel}
          onCancel={
            canCancel
              ? () => {
                  setShowCancel(true);
                }
              : undefined
          }
        />
      </div>

      <SuperAppBottomNav
        active="marketplace"
        onNavigate={(tab) => {
          if (tab === 'home') router.push('/');
          if (tab === 'marketplace') router.push('/marketplace');
        }}
      />

      {showCancel ? (
        <SuperAppCancelOrderSheet
          submitting={cancelling}
          onConfirm={() => {
            void onCancel();
          }}
          onClose={() => {
            setShowCancel(false);
          }}
        />
      ) : null}
    </div>
  );
}
