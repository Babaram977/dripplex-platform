'use client';

import { Badge, Button, EmptyState, LoadingSpinner, Switch } from '@dripplex/ui';
import * as React from 'react';

import type { NotificationDto } from '@dripplex/types';

import { describeSdkError, sdk } from '@/lib/sdk';

const PAGE_SIZE = 20;

const CATEGORY_LABEL: Record<NotificationDto['category'], string> = {
  RIDE: 'Ride',
  DELIVERY: 'Delivery',
  MARKETPLACE: 'Marketplace',
  WALLET: 'Wallet',
  MERCHANT: 'Merchant',
  ADMIN: 'Admin',
  SUPPORT: 'Support',
  EMERGENCY: 'Emergency',
  MARKETING: 'Marketing',
  SYSTEM: 'System',
  SECURITY: 'Security',
};

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );
}

export default function NotificationsPage(): React.JSX.Element {
  const [items, setItems] = React.useState<NotificationDto[]>([]);
  const [unreadOnly, setUnreadOnly] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [markingAll, setMarkingAll] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await sdk.notifications.list({
        page,
        limit: PAGE_SIZE,
        ...(unreadOnly ? { unreadOnly: true } : {}),
      });
      setItems(result.items);
      setTotal(result.total);
    } catch (loadError) {
      setError(describeSdkError(loadError).description);
    } finally {
      setLoading(false);
    }
  }, [page, unreadOnly]);

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

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const unreadCount = items.filter((item) => item.readAt === null).length;

  const markRead = async (id: string): Promise<void> => {
    if (busyId) {
      return;
    }
    setBusyId(id);
    try {
      const updated = await sdk.notifications.markRead(id);
      setItems((current) => current.map((item) => (item.id === id ? updated : item)));
    } catch (markError) {
      setError(describeSdkError(markError).description);
    } finally {
      setBusyId(null);
    }
  };

  const markAllRead = async (): Promise<void> => {
    if (markingAll) {
      return;
    }
    setMarkingAll(true);
    try {
      await sdk.notifications.markAllRead();
      await load();
    } catch (markError) {
      setError(describeSdkError(markError).description);
    } finally {
      setMarkingAll(false);
    }
  };

  const remove = async (id: string): Promise<void> => {
    if (busyId) {
      return;
    }
    setBusyId(id);
    try {
      await sdk.notifications.delete(id);
      setItems((current) => current.filter((item) => item.id !== id));
      setTotal((current) => Math.max(0, current - 1));
    } catch (deleteError) {
      setError(describeSdkError(deleteError).description);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Order activity, low inventory, wallet settlements, and account updates.
          </p>
        </div>
        {items.length > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={markingAll || unreadCount === 0}
            onClick={() => {
              void markAllRead();
            }}
          >
            {markingAll ? 'Marking…' : 'Mark all as read'}
          </Button>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id="unread-only"
          checked={unreadOnly}
          onCheckedChange={(checked) => {
            setPage(1);
            setUnreadOnly(checked);
          }}
        />
        <label htmlFor="unread-only" className="text-sm">
          Unread only
        </label>
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
          title={unreadOnly ? 'No unread notifications' : 'No notifications yet'}
          description={
            unreadOnly
              ? 'You are all caught up.'
              : 'Order updates and account activity will show up here.'
          }
        />
      ) : (
        <div className="border-border/70 divide-border/70 divide-y overflow-hidden rounded-lg border">
          {items.map((notification) => (
            <div
              key={notification.id}
              className={
                notification.readAt === null
                  ? 'bg-brand-muted/40 flex items-start justify-between gap-4 px-4 py-3'
                  : 'flex items-start justify-between gap-4 px-4 py-3'
              }
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {notification.readAt === null ? (
                    <span
                      className="bg-accent h-1.5 w-1.5 shrink-0 rounded-full"
                      aria-label="Unread"
                    />
                  ) : null}
                  <p className="truncate text-sm font-medium">{notification.title}</p>
                  <Badge variant="outline">{CATEGORY_LABEL[notification.category]}</Badge>
                </div>
                <p className="text-muted-foreground mt-0.5 text-sm">{notification.body}</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {formatDate(notification.createdAt)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {notification.readAt === null ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busyId === notification.id}
                    onClick={() => {
                      void markRead(notification.id);
                    }}
                  >
                    Mark read
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busyId === notification.id}
                  onClick={() => {
                    void remove(notification.id);
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
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
