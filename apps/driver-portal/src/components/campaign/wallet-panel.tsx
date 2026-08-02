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
import * as React from 'react';

import type { WalletLedgerEntryDto } from '@dripplex/types';

import { useDriverWallet, useDriverWalletTransactions } from '@/hooks/use-driver-wallet';
import { formatDateTime, formatNaira } from '@/lib/format';

/** Mirrors DRIVER_CAMPAIGN_WALLET_REFERENCE_TYPE in
 * apps/backend/src/referrals/driver-campaign.constants.ts — used to flag
 * which ledger entries came from a referral campaign reward payout. */
const CAMPAIGN_REFERENCE_TYPE = 'driver_referral_campaign_reward';

function BalanceSummary(): React.JSX.Element {
  const { data, isLoading } = useDriverWallet();

  if (isLoading) {
    return <Skeleton className="h-20 w-full" />;
  }
  if (!data) {
    return <p className="text-muted-foreground text-sm">Unable to load your wallet balance.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <p className="text-muted-foreground text-xs">Available balance</p>
        <p className="font-display text-2xl font-semibold">{formatNaira(data.availableBalance)}</p>
      </div>
      <div>
        <p className="text-muted-foreground text-xs">Pending balance</p>
        <p className="font-display text-2xl font-semibold">{formatNaira(data.pendingBalance)}</p>
      </div>
    </div>
  );
}

function TransactionRow({ entry }: { entry: WalletLedgerEntryDto }): React.JSX.Element {
  const fromCampaign = entry.referenceType === CAMPAIGN_REFERENCE_TYPE;
  return (
    <div className="border-border/70 flex items-center justify-between gap-3 border-b py-3 last:border-b-0">
      <div>
        <p className="flex items-center gap-2 text-sm font-medium">
          {entry.description ?? entry.type}
          {fromCampaign ? (
            <Badge variant="accent" className="text-[10px]">
              Referral campaign
            </Badge>
          ) : null}
        </p>
        <p className="text-muted-foreground text-xs">{formatDateTime(entry.createdAt)}</p>
      </div>
      <span
        className={
          entry.direction === 'CREDIT'
            ? 'text-success font-semibold tabular-nums'
            : 'text-destructive font-semibold tabular-nums'
        }
      >
        {entry.direction === 'CREDIT' ? '+' : '-'}
        {formatNaira(entry.amount)}
      </span>
    </div>
  );
}

function TransactionList(): React.JSX.Element {
  const { data, isLoading } = useDriverWalletTransactions({ page: 1, pageSize: 20 });

  if (isLoading) {
    return <Skeleton className="h-40 w-full" />;
  }
  if (!data || data.items.length === 0) {
    return (
      <EmptyState
        title="No transactions yet"
        description="Wallet activity, including referral campaign payouts, will appear here."
      />
    );
  }

  return (
    <div>
      {data.items.map((entry) => (
        <TransactionRow key={entry.id} entry={entry} />
      ))}
    </div>
  );
}

export function WalletPanel(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Wallet balance</CardTitle>
        </CardHeader>
        <CardContent>
          <BalanceSummary />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Transaction history</CardTitle>
        </CardHeader>
        <CardContent>
          <TransactionList />
        </CardContent>
      </Card>
    </div>
  );
}
