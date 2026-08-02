'use client';

import { Card, CardContent, CardHeader, CardTitle, EmptyState, Skeleton } from '@dripplex/ui';
import * as React from 'react';

import type { NotificationDto, NotificationType } from '@dripplex/types';

import { useNotifications } from '@/hooks/use-notifications';
import { formatDateTime } from '@/lib/format';

/** Every NotificationType this screen's timeline cares about — the six
 * triggers from the campaign spec, all driver-scoped. NotificationListQuery
 * only supports a single `type` filter, so we fetch a wide unfiltered page
 * and filter client-side rather than issuing six separate requests. */
const CAMPAIGN_NOTIFICATION_TYPES: readonly NotificationType[] = [
  'DRIVER_REFERRAL_PASSENGER_REGISTERED',
  'DRIVER_REFERRAL_PASSENGER_QUALIFIED',
  'DRIVER_REFERRAL_TIER_SILVER',
  'DRIVER_REFERRAL_TIER_GOLD',
  'DRIVER_REFERRAL_REWARD_APPROVED',
  'DRIVER_REFERRAL_REWARD_PAID',
];

function isCampaignNotification(notification: NotificationDto): boolean {
  return (CAMPAIGN_NOTIFICATION_TYPES as readonly string[]).includes(notification.type);
}

function TimelineRow({ notification }: { notification: NotificationDto }): React.JSX.Element {
  return (
    <div className="border-border/70 flex gap-3 border-b py-4 last:border-b-0">
      <div className="bg-primary mt-1.5 h-2 w-2 flex-shrink-0 rounded-full" />
      <div>
        <p className="font-medium">{notification.title}</p>
        <p className="text-muted-foreground text-sm">{notification.body}</p>
        <p className="text-muted-foreground mt-1 text-xs">
          {formatDateTime(notification.createdAt)}
        </p>
      </div>
    </div>
  );
}

export function ReferralActivityTimeline(): React.JSX.Element {
  const { data, isLoading } = useNotifications({ limit: 50 });
  const events = (data?.items ?? []).filter(isCampaignNotification);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Referral activity</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? <Skeleton className="h-40 w-full" /> : null}
        {!isLoading && events.length === 0 ? (
          <EmptyState
            title="No activity yet"
            description="Registrations, qualifications, and reward updates for your referrals will show up here."
          />
        ) : null}
        {events.map((notification) => (
          <TimelineRow key={notification.id} notification={notification} />
        ))}
      </CardContent>
    </Card>
  );
}
