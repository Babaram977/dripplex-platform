'use client';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  Label,
  LoadingSpinner,
} from '@dripplex/ui';
import * as React from 'react';

import type {
  BankAccountDto,
  OrderSettlementDto,
  OrderSettlementStatus,
  WalletDto,
  WalletLedgerEntryDto,
} from '@dripplex/types';

import { describeSdkError, sdk } from '@/lib/sdk';

const SETTLEMENTS_PAGE_SIZE = 10;
const LEDGER_PAGE_SIZE = 10;

// The backend's OrderSettlementStatus has exactly four values. PENDING
// only exists transiently between wallet credit and the audit write —
// see MerchantSettlementService.settleOrder — but is included here for
// completeness rather than assumed away.
const SETTLEMENT_STATUS_LABEL: Record<OrderSettlementStatus, string> = {
  PENDING: 'Processing',
  COMPLETED: 'Settled',
  FAILED: 'Failed',
  REVERSED: 'Reversed',
};

const SETTLEMENT_STATUS_BADGE_VARIANT: Record<
  OrderSettlementStatus,
  'outline' | 'accent' | 'success'
> = {
  PENDING: 'accent',
  COMPLETED: 'success',
  FAILED: 'outline',
  REVERSED: 'outline',
};

function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(amount);
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );
}

function formatPercent(rate: number): string {
  return new Intl.NumberFormat('en-NG', { style: 'percent', maximumFractionDigits: 1 }).format(
    rate,
  );
}

export default function WalletPage(): React.JSX.Element {
  const [wallet, setWallet] = React.useState<WalletDto | null>(null);
  const [walletLoading, setWalletLoading] = React.useState(true);
  const [walletError, setWalletError] = React.useState<string | null>(null);

  const loadWallet = React.useCallback(async () => {
    try {
      const data = await sdk.merchant.getWallet();
      setWallet(data);
      setWalletError(null);
    } catch (error) {
      setWalletError(describeSdkError(error).description);
    } finally {
      setWalletLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadWallet();
    // Settlements and the wallet balance both change the moment an order
    // completes — same 15s live-data precedent Incoming Orders uses,
    // since there is no wallet-domain websocket push in this codebase.
    const interval = setInterval(() => {
      void loadWallet();
    }, 15_000);
    return () => {
      clearInterval(interval);
    };
  }, [loadWallet]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Wallet &amp; Bank</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Your DrippleX wallet balance, every settlement breakdown, and the bank account your
          settlements pay out to.
        </p>
      </div>

      {walletError ? (
        <p className="text-destructive text-sm" role="alert">
          {walletError}
        </p>
      ) : null}

      {walletLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : (
        <>
          <BalanceCard wallet={wallet} />
          <SettlementsCard />
          <LedgerCard currency={wallet?.currency ?? 'NGN'} />
          <BankAccountsCard />
        </>
      )}
    </div>
  );
}

function BalanceCard({ wallet }: { wallet: WalletDto | null }): React.JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Current balance</CardTitle>
      </CardHeader>
      <CardContent>
        {wallet ? (
          <div className="flex flex-wrap items-baseline gap-x-8 gap-y-3">
            <div>
              <p className="text-muted-foreground text-xs">Available</p>
              <p className="font-display text-3xl font-semibold tracking-tight">
                {formatMoney(wallet.availableBalance, wallet.currency)}
              </p>
            </div>
            {wallet.pendingBalance > 0 ? (
              <div>
                <p className="text-muted-foreground text-xs">Pending</p>
                <p className="text-lg font-medium">
                  {formatMoney(wallet.pendingBalance, wallet.currency)}
                </p>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            No wallet yet — it is created automatically once your first order settles.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function SettlementsCard(): React.JSX.Element {
  const [items, setItems] = React.useState<OrderSettlementDto[]>([]);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await sdk.merchant.listSettlements({ page, pageSize: SETTLEMENTS_PAGE_SIZE });
      setItems(result.items);
      setTotalPages(result.meta.totalPages);
    } catch (loadError) {
      setError(describeSdkError(loadError).description);
    } finally {
      setLoading(false);
    }
  }, [page]);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Settlements</CardTitle>
        <p className="text-muted-foreground text-sm">
          Every completed order, broken down from the sale price down to what was paid into your
          wallet.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}

        {loading && items.length === 0 ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title="No settlements yet"
            description="A settlement is created here the moment an order you fulfil is marked complete."
          />
        ) : (
          <div className="border-border/70 divide-border/70 divide-y overflow-hidden rounded-lg border">
            {items.map((settlement) => (
              <div key={settlement.id} className="flex flex-col gap-2 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">Order {settlement.orderNumber}</p>
                    <Badge variant={SETTLEMENT_STATUS_BADGE_VARIANT[settlement.status]}>
                      {SETTLEMENT_STATUS_LABEL[settlement.status]}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {formatDate(settlement.createdAt)}
                  </p>
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-muted-foreground text-xs">Gross (subtotal)</dt>
                    <dd>{formatMoney(settlement.grossAmount, settlement.currency)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">
                      Commission ({formatPercent(settlement.commissionRate)})
                    </dt>
                    <dd className="text-destructive">
                      -{formatMoney(settlement.commissionAmount, settlement.currency)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">You received</dt>
                    <dd className="font-semibold">
                      {formatMoney(settlement.merchantAmount, settlement.currency)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">Status</dt>
                    <dd>
                      {settlement.status === 'FAILED' && settlement.failureReason
                        ? settlement.failureReason
                        : settlement.status === 'REVERSED' && settlement.reversalReason
                          ? `Reversed: ${settlement.reversalReason}`
                          : SETTLEMENT_STATUS_LABEL[settlement.status]}
                    </dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        )}

        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </CardContent>
    </Card>
  );
}

function LedgerCard({ currency }: { currency: string }): React.JSX.Element {
  const [items, setItems] = React.useState<WalletLedgerEntryDto[]>([]);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await sdk.merchant.getWalletTransactions({
        page,
        pageSize: LEDGER_PAGE_SIZE,
      });
      setItems(result.items);
      setTotalPages(result.meta.totalPages);
    } catch (loadError) {
      setError(describeSdkError(loadError).description);
    } finally {
      setLoading(false);
    }
  }, [page]);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ledger history</CardTitle>
        <p className="text-muted-foreground text-sm">
          Every credit and debit to your wallet — settlements, reversals, and any other adjustment.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}

        {loading && items.length === 0 ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title="No ledger entries yet"
            description="Wallet activity will appear here as settlements and adjustments happen."
          />
        ) : (
          <div className="border-border/70 divide-border/70 divide-y overflow-hidden rounded-lg border">
            {items.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{entry.description ?? entry.type}</p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {formatDate(entry.createdAt)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className={entry.direction === 'CREDIT' ? 'text-success' : 'text-destructive'}>
                    {entry.direction === 'CREDIT' ? '+' : '-'}
                    {formatMoney(entry.amount, currency)}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Balance {formatMoney(entry.balanceAfter, currency)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </CardContent>
    </Card>
  );
}

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}): React.JSX.Element | null {
  if (totalPages <= 1) {
    return null;
  }
  return (
    <div className="flex items-center justify-between">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => {
          onChange(Math.max(1, page - 1));
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
        size="sm"
        disabled={page >= totalPages}
        onClick={() => {
          onChange(Math.min(totalPages, page + 1));
        }}
      >
        Next
      </Button>
    </div>
  );
}

function BankAccountsCard(): React.JSX.Element {
  const [accounts, setAccounts] = React.useState<BankAccountDto[] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [showForm, setShowForm] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await sdk.merchant.listBankAccounts();
      setAccounts(result);
    } catch (loadError) {
      setError(describeSdkError(loadError).description);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const setDefault = async (id: string): Promise<void> => {
    if (busyId) {
      return;
    }
    setBusyId(id);
    setError(null);
    try {
      const updated = await sdk.merchant.setDefaultBankAccount(id);
      setAccounts((current) =>
        (current ?? []).map((account) =>
          account.id === updated.id
            ? updated
            : { ...account, isDefault: account.isDefault ? false : account.isDefault },
        ),
      );
    } catch (setDefaultError) {
      setError(describeSdkError(setDefaultError).description);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bank account</CardTitle>
        <p className="text-muted-foreground text-sm">
          Your default bank account is the settlement destination DrippleX pays out to. Adding a
          bank account here does not start a withdrawal — DrippleX does not yet support automated
          bank payouts from the wallet.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}

        {loading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : !accounts || accounts.length === 0 ? (
          <EmptyState
            title="No bank account on file"
            description="Add a bank account so your settlement destination is on record."
          />
        ) : (
          <div className="border-border/70 divide-border/70 divide-y overflow-hidden rounded-lg border">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{account.accountName}</p>
                    {account.isDefault ? (
                      <Badge variant="success">Settlement destination</Badge>
                    ) : null}
                    {account.verifiedAt ? (
                      <Badge variant="outline">Verified</Badge>
                    ) : (
                      <Badge variant="accent">Unverified</Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {account.bankName} · {account.accountNumber}
                  </p>
                </div>
                {!account.isDefault ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busyId === account.id}
                    onClick={() => {
                      void setDefault(account.id);
                    }}
                  >
                    {busyId === account.id ? 'Setting…' : 'Set as settlement destination'}
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        )}

        {showForm ? (
          <AddBankAccountForm
            onCancel={() => {
              setShowForm(false);
            }}
            onCreated={(account) => {
              setAccounts((current) => [...(current ?? []), account]);
              setShowForm(false);
            }}
          />
        ) : (
          <div>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowForm(true);
              }}
            >
              Add bank account
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AddBankAccountForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (account: BankAccountDto) => void;
}): React.JSX.Element {
  const [bankName, setBankName] = React.useState('');
  const [accountName, setAccountName] = React.useState('');
  const [accountNumber, setAccountNumber] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const onSubmit: React.SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    if (saving) {
      return;
    }
    void (async () => {
      setSaving(true);
      setError(null);
      try {
        const account = await sdk.merchant.createBankAccount({
          bankName: bankName.trim(),
          accountName: accountName.trim(),
          accountNumber: accountNumber.trim(),
        });
        onCreated(account);
      } catch (submitError) {
        setError(describeSdkError(submitError).description);
      } finally {
        setSaving(false);
      }
    })();
  };

  return (
    <form
      className="border-border/70 flex flex-col gap-4 rounded-lg border p-4"
      onSubmit={onSubmit}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bankName">Bank name</Label>
          <Input
            id="bankName"
            required
            minLength={2}
            maxLength={100}
            value={bankName}
            onChange={(event) => {
              setBankName(event.target.value);
            }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="accountName">Account name</Label>
          <Input
            id="accountName"
            required
            minLength={2}
            maxLength={100}
            value={accountName}
            onChange={(event) => {
              setAccountName(event.target.value);
            }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="accountNumber">Account number</Label>
          <Input
            id="accountNumber"
            required
            minLength={10}
            maxLength={10}
            inputMode="numeric"
            value={accountNumber}
            onChange={(event) => {
              setAccountNumber(event.target.value);
            }}
          />
        </div>
      </div>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Add account'}
        </Button>
      </div>
    </form>
  );
}
