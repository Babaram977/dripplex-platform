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

import type { CommissionLedgerEntryDto } from '@dripplex/types';

import {
  useDriverCommercialAccount,
  useDriverCommercialLedger,
} from '@/hooks/use-driver-commercial';
import { formatDateTime, formatNaira } from '@/lib/format';

const COMMISSION_ENTRY_TYPE_LABEL: Record<CommissionLedgerEntryDto['type'], string> = {
  ACCRUAL: 'Commission accrued',
  PAYMENT: 'Payment recorded',
  ADJUSTMENT: 'Adjustment',
};

function AccountSummary(): React.JSX.Element {
  const { data, isLoading } = useDriverCommercialAccount();

  if (isLoading) {
    return <Skeleton className="h-20 w-full" />;
  }
  if (!data) {
    return (
      <p className="text-muted-foreground text-sm">Unable to load your platform fee balance.</p>
    );
  }

  const availableCredit = Math.max(0, data.creditLimit - data.outstandingBalance);

  return (
    <div className="flex flex-col gap-4">
      {data.blocked ? (
        <p className="border-destructive/40 bg-destructive/5 text-destructive rounded-lg border px-3 py-2 text-sm">
          Your outstanding platform fee has exceeded your credit limit. You cannot go Online until
          this is paid down.
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-muted-foreground text-xs">Platform fee owed</p>
          <p className="font-display text-2xl font-semibold">
            {formatNaira(data.outstandingBalance)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Credit limit</p>
          <p className="font-display text-2xl font-semibold">{formatNaira(data.creditLimit)}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Available credit</p>
          <p className="font-display text-2xl font-semibold">{formatNaira(availableCredit)}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Status</p>
          <Badge variant={data.blocked ? 'outline' : 'success'}>
            {data.blocked ? 'Blocked' : data.outstandingBalance > 0 ? 'Outstanding' : 'Clear'}
          </Badge>
        </div>
      </div>
    </div>
  );
}

function SettlementRow({ entry }: { entry: CommissionLedgerEntryDto }): React.JSX.Element {
  return (
    <div className="border-border/70 flex items-center justify-between gap-3 border-b py-3 last:border-b-0">
      <div>
        <p className="text-sm font-medium">
          {entry.description ?? COMMISSION_ENTRY_TYPE_LABEL[entry.type]}
        </p>
        <p className="text-muted-foreground text-xs">{formatDateTime(entry.createdAt)}</p>
      </div>
      <span
        className={
          entry.type === 'ACCRUAL'
            ? 'text-destructive font-semibold tabular-nums'
            : 'text-success font-semibold tabular-nums'
        }
      >
        {entry.type === 'ACCRUAL' ? '+' : '-'}
        {formatNaira(entry.amount)}
      </span>
    </div>
  );
}

function SettlementList(): React.JSX.Element {
  const { data, isLoading } = useDriverCommercialLedger(1, 20);

  if (isLoading) {
    return <Skeleton className="h-40 w-full" />;
  }
  if (!data || data.items.length === 0) {
    return (
      <EmptyState
        title="No platform fee activity yet"
        description="Commission accrued on cash rides and any payments recorded against it will appear here."
      />
    );
  }

  return (
    <div>
      {data.items.map((entry) => (
        <SettlementRow key={entry.id} entry={entry} />
      ))}
    </div>
  );
}

/**
 * DPX-COMMERCIAL-001 Slice 5 — surfaces the Ride cash commission engine
 * (Slice 4) driving the "cannot go Online while blocked" rule. Pure read,
 * mirrors `WalletPanel`'s exact shape.
 */
export function CommercialPanel(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Platform fee owed</CardTitle>
        </CardHeader>
        <CardContent>
          <AccountSummary />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Settlement history</CardTitle>
        </CardHeader>
        <CardContent>
          <SettlementList />
        </CardContent>
      </Card>
    </div>
  );
}
