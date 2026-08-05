'use client';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  LoadingSpinner,
} from '@dripplex/ui';
import {
  Bell,
  Building2,
  ClipboardList,
  Package,
  Star,
  Store,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import type { BusinessDto, ReviewWithAggregateDto, WalletDto } from '@dripplex/types';

import { describeSdkError, sdk } from '@/lib/sdk';

const currency = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0,
});

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium' }).format(new Date(iso));
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

interface OrderCounts {
  pending: number;
  preparing: number;
  ready: number;
}

/** One independently-loadable dashboard section: holds its own data plus
 * an error string so one failed call (e.g. analytics timing out) never
 * blanks the rest of the page — same resilience principle as every other
 * Phase 2 screen, just applied per-widget instead of per-page. */
interface SectionState<T> {
  data: T | null;
  error: string | null;
}

function initialSection<T>(): SectionState<T> {
  return { data: null, error: null };
}

export default function DashboardOverviewPage(): React.JSX.Element {
  const [loading, setLoading] = React.useState(true);
  const [orders, setOrders] = React.useState<SectionState<OrderCounts>>(initialSection);
  const [revenue, setRevenue] = React.useState<SectionState<number>>(initialSection);
  const [wallet, setWallet] = React.useState<SectionState<WalletDto>>(initialSection);
  const [business, setBusiness] =
    React.useState<SectionState<BusinessDto | 'none'>>(initialSection);
  const [unreadCount, setUnreadCount] = React.useState<SectionState<number>>(initialSection);
  const [reviews, setReviews] =
    React.useState<SectionState<ReviewWithAggregateDto>>(initialSection);

  const load = React.useCallback(async () => {
    const today = todayIso();

    const [
      confirmedResult,
      preparingResult,
      readyResult,
      analyticsResult,
      walletResult,
      businessResult,
      notificationsResult,
      reviewsResult,
    ] = await Promise.allSettled([
      sdk.orders.merchantGetOrders({ status: 'CONFIRMED', page: 1, pageSize: 1 }),
      sdk.orders.merchantGetOrders({ status: 'PREPARING', page: 1, pageSize: 1 }),
      sdk.orders.merchantGetOrders({ status: 'READY', page: 1, pageSize: 1 }),
      sdk.analytics.merchant({ from: today, to: today, period: 'daily' }),
      sdk.merchant.getWallet(),
      sdk.merchant.getBusiness(),
      sdk.notifications.list({ unreadOnly: true, page: 1, limit: 1 }),
      sdk.reviews.listMerchant({ page: 1, pageSize: 3 }),
    ]);

    if (
      confirmedResult.status === 'fulfilled' &&
      preparingResult.status === 'fulfilled' &&
      readyResult.status === 'fulfilled'
    ) {
      setOrders({
        data: {
          pending: confirmedResult.value.meta.total,
          preparing: preparingResult.value.meta.total,
          ready: readyResult.value.meta.total,
        },
        error: null,
      });
    } else {
      const failed = [confirmedResult, preparingResult, readyResult].find(
        (r) => r.status === 'rejected',
      );
      setOrders({
        data: null,
        error:
          failed?.status === 'rejected'
            ? describeSdkError(failed.reason).description
            : 'Failed to load',
      });
    }

    if (analyticsResult.status === 'fulfilled') {
      setRevenue({ data: analyticsResult.value.kpis.revenue, error: null });
    } else {
      setRevenue({ data: null, error: describeSdkError(analyticsResult.reason).description });
    }

    if (walletResult.status === 'fulfilled') {
      setWallet({ data: walletResult.value, error: null });
    } else {
      setWallet({ data: null, error: describeSdkError(walletResult.reason).description });
    }

    if (businessResult.status === 'fulfilled') {
      setBusiness({ data: businessResult.value, error: null });
    } else {
      const described = describeSdkError(businessResult.reason);
      // No business profile created yet is the real first onboarding step,
      // not an error — same handling as the Business Profile screen.
      setBusiness(
        described.statusCode === 404
          ? { data: 'none', error: null }
          : { data: null, error: described.description },
      );
    }

    if (notificationsResult.status === 'fulfilled') {
      setUnreadCount({ data: notificationsResult.value.total, error: null });
    } else {
      setUnreadCount({
        data: null,
        error: describeSdkError(notificationsResult.reason).description,
      });
    }

    if (reviewsResult.status === 'fulfilled') {
      setReviews({ data: reviewsResult.value, error: null });
    } else {
      setReviews({ data: null, error: describeSdkError(reviewsResult.reason).description });
    }

    setLoading(false);
  }, []);

  React.useEffect(() => {
    void load();
    // Same 15s live-data polling precedent every other Phase 2 screen uses.
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
          <h1 className="font-display text-3xl font-semibold tracking-tight">Overview</h1>
          <p className="text-muted-foreground mt-2 text-sm">Your store, at a glance.</p>
        </div>
        <StoreStatusBadge state={business} />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <OrdersCard orders={orders} />
            <StatCard
              label="Today's revenue"
              icon={<TrendingUp className="h-4 w-4" aria-hidden="true" />}
              value={revenue.data !== null ? currency.format(revenue.data) : null}
              error={revenue.error}
            />
            <StatCard
              label="Wallet balance"
              icon={<Wallet className="h-4 w-4" aria-hidden="true" />}
              value={wallet.data !== null ? currency.format(wallet.data.availableBalance) : null}
              error={wallet.error}
            />
            <StatCard
              label="Unread notifications"
              icon={<Bell className="h-4 w-4" aria-hidden="true" />}
              value={unreadCount.data !== null ? String(unreadCount.data) : null}
              error={unreadCount.error}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Quick actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <QuickAction href="/orders" label="Orders" icon={ClipboardList} />
                <QuickAction href="/products" label="Products" icon={Package} />
                <QuickAction href="/business" label="Business" icon={Building2} />
                <QuickAction href="/wallet" label="Wallet" icon={Wallet} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Recent reviews</CardTitle>
              {reviews.data?.aggregate ? (
                <span className="text-muted-foreground text-xs">
                  {reviews.data.aggregate.averageRating.toFixed(1)} avg ·{' '}
                  {reviews.data.aggregate.reviewCount} total
                </span>
              ) : null}
            </CardHeader>
            <CardContent>
              {reviews.error ? (
                <p className="text-destructive text-sm" role="alert">
                  {reviews.error}
                </p>
              ) : reviews.data && reviews.data.items.length > 0 ? (
                <ul className="divide-border/70 divide-y">
                  {reviews.data.items.map((review) => (
                    <li key={review.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-center gap-2">
                        <Stars rating={review.rating} />
                        <span className="text-muted-foreground text-xs">
                          {formatDate(review.createdAt)}
                        </span>
                      </div>
                      {review.comment ? (
                        <p className="mt-1 line-clamp-2 text-sm">{review.comment}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-sm">No reviews yet.</p>
              )}
              <Link
                href="/reviews"
                className="text-primary mt-3 inline-block text-sm font-medium hover:underline"
              >
                View all reviews →
              </Link>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function OrdersCard({ orders }: { orders: SectionState<OrderCounts> }): React.JSX.Element {
  return (
    <Card className="col-span-2 sm:col-span-1">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-muted-foreground text-sm font-medium">
          Today&apos;s orders
        </CardTitle>
        <ClipboardList className="text-muted-foreground h-4 w-4" aria-hidden="true" />
      </CardHeader>
      <CardContent>
        {orders.error ? (
          <p className="text-destructive text-xs" role="alert">
            {orders.error}
          </p>
        ) : orders.data ? (
          <div className="flex gap-4">
            <MiniStat label="Pending" value={orders.data.pending} />
            <MiniStat label="Preparing" value={orders.data.preparing} />
            <MiniStat label="Ready" value={orders.data.ready} />
          </div>
        ) : (
          <p className="text-2xl font-semibold">—</p>
        )}
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: number }): React.JSX.Element {
  return (
    <div>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      <p className="text-muted-foreground text-xs">{label}</p>
    </div>
  );
}

function StatCard({
  label,
  icon,
  value,
  error,
}: {
  label: string;
  icon: React.ReactNode;
  value: string | null;
  error: string | null;
}): React.JSX.Element {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-muted-foreground text-sm font-medium">{label}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-destructive text-xs" role="alert">
            {error}
          </p>
        ) : (
          <p className="text-2xl font-semibold tabular-nums">{value ?? '—'}</p>
        )}
      </CardContent>
    </Card>
  );
}

function QuickAction({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
}): React.JSX.Element {
  return (
    <Button asChild variant="outline" className="h-auto flex-col gap-2 py-4">
      <Link href={href}>
        <Icon className="h-5 w-5" aria-hidden={true} />
        {label}
      </Link>
    </Button>
  );
}

function StoreStatusBadge({
  state,
}: {
  state: SectionState<BusinessDto | 'none'>;
}): React.JSX.Element | null {
  if (state.error) {
    return null;
  }
  if (state.data === null) {
    return null;
  }
  if (state.data === 'none') {
    return (
      <Link href="/business">
        <Badge variant="outline">
          <Store className="mr-1 h-3 w-3" aria-hidden="true" />
          Set up your store
        </Badge>
      </Link>
    );
  }
  const isActive = state.data.status === 'ACTIVE';
  return (
    <Badge variant={isActive ? 'success' : 'outline'}>
      <Store className="mr-1 h-3 w-3" aria-hidden="true" />
      {isActive ? 'Store open' : 'Store paused'}
    </Badge>
  );
}

function Stars({ rating }: { rating: number }): React.JSX.Element {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${String(rating)} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={
            i < rating
              ? 'h-3.5 w-3.5 fill-amber-400 text-amber-400'
              : 'text-muted-foreground/30 h-3.5 w-3.5'
          }
          aria-hidden="true"
        />
      ))}
    </div>
  );
}
