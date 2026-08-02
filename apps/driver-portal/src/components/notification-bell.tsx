'use client';

import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@dripplex/ui';
import { Bell } from 'lucide-react';
import * as React from 'react';

import type { NotificationDto } from '@dripplex/types';

import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/hooks/use-notifications';

function formatRelativeTime(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${String(minutes)}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${String(hours)}h ago`;
  const days = Math.floor(hours / 24);
  return `${String(days)}d ago`;
}

function NotificationRow({
  notification,
  onRead,
}: {
  notification: NotificationDto;
  onRead: (id: string) => void;
}): React.JSX.Element {
  const unread = notification.readAt === null;
  return (
    <button
      type="button"
      onClick={() => {
        if (unread) onRead(notification.id);
      }}
      className="hover:bg-muted/60 flex w-full flex-col gap-0.5 rounded-md px-2 py-2 text-left"
    >
      <div className="flex items-center gap-2">
        {unread ? <span className="bg-primary h-1.5 w-1.5 flex-shrink-0 rounded-full" /> : null}
        <p className="truncate text-sm font-medium">{notification.title}</p>
      </div>
      <p className="text-muted-foreground line-clamp-2 text-xs">{notification.body}</p>
      <p className="text-muted-foreground text-[11px]">
        {formatRelativeTime(notification.createdAt)}
      </p>
    </button>
  );
}

export function NotificationBell(): React.JSX.Element {
  const notifications = useNotifications({ limit: 10 });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const unreadCount = notifications.data?.items.filter((n) => n.readAt === null).length ?? 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
          {unreadCount > 0 ? (
            <Badge
              variant="default"
              className="absolute -right-1 -top-1 h-4 min-w-4 justify-center rounded-full px-1 text-[10px] leading-none"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
          {unreadCount > 0 ? (
            <button
              type="button"
              className="text-primary text-xs font-medium"
              onClick={() => {
                markAllRead.mutate();
              }}
            >
              Mark all read
            </button>
          ) : null}
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-96 overflow-y-auto">
          {notifications.isLoading ? (
            <p className="text-muted-foreground px-2 py-4 text-center text-sm">Loading…</p>
          ) : null}
          {notifications.isError ? (
            <p className="text-muted-foreground px-2 py-4 text-center text-sm">
              Couldn&apos;t load notifications.
            </p>
          ) : null}
          {!notifications.isLoading &&
          !notifications.isError &&
          (notifications.data?.items.length ?? 0) === 0 ? (
            <p className="text-muted-foreground px-2 py-4 text-center text-sm">
              You&apos;re all caught up.
            </p>
          ) : null}
          {(notifications.data?.items ?? []).map((notification) => (
            <NotificationRow
              key={notification.id}
              notification={notification}
              onRead={(id) => {
                markRead.mutate(id);
              }}
            />
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
