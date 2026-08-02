'use client';

import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Skeleton,
} from '@dripplex/ui';
import { cn } from '@dripplex/utils';
import { Trophy } from 'lucide-react';
import * as React from 'react';

import type { DriverCampaignLeaderboardEntryDto } from '@dripplex/types';

import { useDriverLeaderboard } from '@/hooks/use-driver-campaign';
import { formatNaira, tierLabel } from '@/lib/format';

function LeaderboardRow({
  entry,
}: {
  entry: DriverCampaignLeaderboardEntryDto;
}): React.JSX.Element {
  return (
    <div
      className={cn(
        'border-border/70 flex items-center justify-between gap-3 border-b px-1 py-3 last:border-b-0',
        entry.isCurrentDriver && 'bg-primary/5 -mx-1 rounded-md px-2',
      )}
    >
      <div className="flex items-center gap-3">
        <span className="text-muted-foreground w-6 text-center text-sm font-semibold tabular-nums">
          {entry.position <= 3 ? <Trophy className="mx-auto h-4 w-4" /> : entry.position}
        </span>
        <span className="font-medium">
          {entry.driverName}
          {entry.isCurrentDriver ? ' (you)' : ''}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-muted-foreground text-sm tabular-nums">
          {entry.qualifiedCount} qualified
        </span>
        <Badge variant={entry.currentTier === 'NONE' ? 'outline' : 'success'}>
          {tierLabel(entry.currentTier)}
        </Badge>
        <span className="text-sm font-semibold tabular-nums">
          {formatNaira(entry.estimatedRewardAmount)}
        </span>
      </div>
    </div>
  );
}

export function LeaderboardTable(): React.JSX.Element {
  const { data, isLoading, isError } = useDriverLeaderboard();

  return (
    <Card>
      <CardHeader>
        <CardTitle>This month&apos;s leaderboard</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? <Skeleton className="h-56 w-full" /> : null}
        {isError ? (
          <p className="text-muted-foreground text-sm">
            No active campaign right now — the leaderboard will populate once one starts.
          </p>
        ) : null}
        {data?.length === 0 ? (
          <EmptyState
            title="No entries yet"
            description="Once drivers start earning qualified referrals this month, rankings will show here."
          />
        ) : null}
        {data?.map((entry) => (
          <LeaderboardRow key={entry.position} entry={entry} />
        ))}
      </CardContent>
    </Card>
  );
}
