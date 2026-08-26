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
  Select,
} from '@dripplex/ui';
import * as React from 'react';

import type {
  CommissionLedgerEntryDto,
  CommissionOwnerType,
  DriverProfileDto,
  MerchantProfileDto,
} from '@dripplex/types';

import { AppShell } from '@/components/app-shell';
import {
  useAdminCommissionAccount,
  useAdminCommissionLedger,
  useAdminCreditSetting,
} from '@/hooks/use-admin-commercial';
import { describeSdkError, sdk } from '@/lib/sdk';

const LEDGER_PAGE_SIZE = 10;

const COMMISSION_ENTRY_TYPE_LABEL: Record<CommissionLedgerEntryDto['type'], string> = {
  ACCRUAL: 'Commission accrued',
  PAYMENT: 'Payment recorded',
  ADJUSTMENT: 'Adjustment',
};

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );
}

/**
 * DPX-COMMERCIAL-001 Slice 5 — Admin Portal's commercial dashboard.
 * Surfaces the engine built in Slices 1-4: credit-limit monitoring
 * (admin-configurable), a merchant/driver commission-account picker, and
 * manual payment recording. Every read/write here already existed as an
 * admin-scoped backend endpoint since Slice 1
 * (AdminCommercialCreditSettingsController / AdminCommissionAccountsController)
 * — this page is the first UI to surface them.
 */
export default function AdminCommercialPage(): React.JSX.Element {
  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Commercial</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Commission credit limits, and any merchant or driver&apos;s commission account, ledger,
            and manual payment recording.
          </p>
        </div>

        <CreditLimitMonitoringCard />
        <AccountLookupCard />
      </div>
    </AppShell>
  );
}

function CreditLimitRow({
  ownerType,
  label,
}: {
  ownerType: CommissionOwnerType;
  label: string;
}): React.JSX.Element {
  const { data, loading, error, reload } = useAdminCreditSetting(ownerType);
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  const startEditing = (): void => {
    setValue(String(data?.creditLimit ?? 0));
    setSaveError(null);
    setEditing(true);
  };

  const save = async (): Promise<void> => {
    const creditLimit = Number(value);
    if (!Number.isFinite(creditLimit) || creditLimit < 0) {
      setSaveError('Enter a valid, non-negative amount.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await sdk.adminCommercialCreditSettings.update({ ownerType, creditLimit });
      setEditing(false);
      reload();
    } catch (updateError) {
      setSaveError(describeSdkError(updateError).description);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-border/70 flex flex-wrap items-center justify-between gap-3 border-b py-3 last:border-b-0">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {error ? (
          <p className="text-destructive text-xs" role="alert">
            {error}
          </p>
        ) : loading ? (
          <p className="text-muted-foreground text-xs">Loading…</p>
        ) : (
          <p className="text-muted-foreground text-xs">
            {data ? `Updated ${formatDate(data.updatedAt)}` : ''}
          </p>
        )}
      </div>
      {editing ? (
        <div className="flex items-center gap-2">
          <Input
            className="w-32"
            inputMode="decimal"
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
            }}
          />
          {saveError ? <span className="text-destructive text-xs">{saveError}</span> : null}
          <Button type="button" size="sm" disabled={saving} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={saving}
            onClick={() => {
              setEditing(false);
            }}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <span className="font-display text-lg font-semibold">
            {data ? formatMoney(data.creditLimit) : '—'}
          </span>
          <Button type="button" size="sm" variant="outline" onClick={startEditing}>
            Edit
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * All three owner types, because all three are real policy.
 *
 * This card shipped with MERCHANT and DRIVER only, but `CommercialCreditSetting`
 * has always been one row per owner type and `CommissionOwnerType` has always
 * included RIDER. Riders were given the same going-Online block drivers have
 * (delivery.service.ts — a rider over their limit cannot go online until they
 * settle to zero), so a rider limit was being enforced with no screen anywhere
 * that could read or change it. The only way to move it was calling the API by
 * hand.
 *
 * Worth stating plainly because it is the trap here: these are three
 * independent rows. `DEFAULT_DRIVER_CREDIT_LIMIT` seeds both the DRIVER and
 * RIDER rows on first read, which makes them look linked, but once the rows
 * exist editing one does not touch the other.
 */
function CreditLimitMonitoringCard(): React.JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Credit-limit monitoring</CardTitle>
        <p className="text-muted-foreground text-sm">
          The commission credit limit applied to every merchant, driver and rider account —
          exceeding it blocks new checkout (merchant) or going Online (driver, rider) until the
          balance is cleared in full.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col">
        <CreditLimitRow ownerType="MERCHANT" label="Merchant credit limit" />
        <CreditLimitRow ownerType="DRIVER" label="Driver credit limit" />
        <CreditLimitRow ownerType="RIDER" label="Rider credit limit" />
      </CardContent>
      <CardContent className="pt-0">
        <p className="text-muted-foreground text-xs">
          Each is a separate policy — changing one does not change the others. Crossing a limit is a
          latch, not a threshold: only clearing the balance to zero lifts the block.
        </p>
      </CardContent>
    </Card>
  );
}

function AccountLookupCard(): React.JSX.Element {
  const [ownerType, setOwnerType] = React.useState<CommissionOwnerType>('MERCHANT');
  const [merchants, setMerchants] = React.useState<MerchantProfileDto[] | null>(null);
  const [drivers, setDrivers] = React.useState<DriverProfileDto[] | null>(null);
  const [listError, setListError] = React.useState<string | null>(null);
  const [listLoading, setListLoading] = React.useState(true);
  const [ownerId, setOwnerId] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(1);

  React.useEffect(() => {
    let cancelled = false;
    setListLoading(true);
    setListError(null);
    setOwnerId(null);
    if (ownerType === 'MERCHANT') {
      sdk.adminMerchants
        .listMerchants({ limit: 100 })
        .then((result) => {
          if (!cancelled) {
            setMerchants(result.items);
          }
        })
        .catch((loadError: unknown) => {
          if (!cancelled) {
            setListError(describeSdkError(loadError).description);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setListLoading(false);
          }
        });
    } else {
      sdk.adminDrivers
        .listDrivers({ limit: 100 })
        .then((result) => {
          if (!cancelled) {
            setDrivers(result.items);
          }
        })
        .catch((loadError: unknown) => {
          if (!cancelled) {
            setListError(describeSdkError(loadError).description);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setListLoading(false);
          }
        });
    }
    return () => {
      cancelled = true;
    };
  }, [ownerType]);

  const account = useAdminCommissionAccount(ownerType, ownerId);
  const ledger = useAdminCommissionLedger(ownerType, ownerId, page, LEDGER_PAGE_SIZE);

  const onOwnerTypeChange = (next: CommissionOwnerType): void => {
    setOwnerType(next);
    setPage(1);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Commission accounts</CardTitle>
        <p className="text-muted-foreground text-sm">
          Look up any merchant or driver&apos;s outstanding commission, ledger, and record a manual
          external payment against it.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex gap-2">
          {(['MERCHANT', 'DRIVER'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => {
                onOwnerTypeChange(type);
              }}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                ownerType === type
                  ? 'bg-secondary text-secondary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {type === 'MERCHANT' ? 'Merchants' : 'Drivers'}
            </button>
          ))}
        </div>

        {listError ? (
          <p className="text-destructive text-sm" role="alert">
            {listError}
          </p>
        ) : null}

        {listLoading ? (
          <div className="flex justify-center py-4">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="owner-select">
              {ownerType === 'MERCHANT' ? 'Select a merchant' : 'Select a driver'}
            </Label>
            <Select
              id="owner-select"
              value={ownerId ?? ''}
              onChange={(event) => {
                setOwnerId(event.target.value || null);
                setPage(1);
              }}
            >
              <option value="">— Select —</option>
              {ownerType === 'MERCHANT'
                ? (merchants ?? []).map((merchant) => (
                    <option key={merchant.id} value={merchant.merchantId}>
                      {merchant.business?.businessName ??
                        `${merchant.firstName} ${merchant.lastName}`}{' '}
                      · {merchant.email}
                    </option>
                  ))
                : (drivers ?? []).map((driver) => (
                    <option key={driver.id} value={driver.driverId}>
                      {driver.firstName} {driver.lastName} · {driver.email}
                    </option>
                  ))}
            </Select>
          </div>
        )}

        {ownerId ? (
          <AccountDetail
            ownerType={ownerType}
            ownerId={ownerId}
            account={account}
            ledger={ledger}
            page={page}
            onPageChange={setPage}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

function AccountDetail({
  ownerType,
  ownerId,
  account,
  ledger,
  page,
  onPageChange,
}: {
  ownerType: CommissionOwnerType;
  ownerId: string;
  account: ReturnType<typeof useAdminCommissionAccount>;
  ledger: ReturnType<typeof useAdminCommissionLedger>;
  page: number;
  onPageChange: (page: number) => void;
}): React.JSX.Element {
  const [paymentAmount, setPaymentAmount] = React.useState('');
  const [paymentDescription, setPaymentDescription] = React.useState('');
  const [recording, setRecording] = React.useState(false);
  const [paymentError, setPaymentError] = React.useState<string | null>(null);

  const recordPayment = async (): Promise<void> => {
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setPaymentError('Enter a valid, positive amount.');
      return;
    }
    setRecording(true);
    setPaymentError(null);
    try {
      await sdk.adminCommissionAccounts.recordPayment(ownerType, ownerId, {
        amount,
        ...(paymentDescription.trim() ? { description: paymentDescription.trim() } : {}),
      });
      setPaymentAmount('');
      setPaymentDescription('');
      account.reload();
      ledger.reload();
    } catch (recordError) {
      setPaymentError(describeSdkError(recordError).description);
    } finally {
      setRecording(false);
    }
  };

  const availableCredit = account.data
    ? Math.max(0, account.data.creditLimit - account.data.outstandingBalance)
    : 0;

  return (
    <div className="border-border/70 flex flex-col gap-4 rounded-lg border p-4">
      {account.error ? (
        <p className="text-destructive text-sm" role="alert">
          {account.error}
        </p>
      ) : account.loading ? (
        <div className="flex justify-center py-4">
          <LoadingSpinner />
        </div>
      ) : account.data ? (
        <>
          {account.data.blocked ? (
            <p className="border-destructive/40 bg-destructive/5 text-destructive rounded-lg border px-3 py-2 text-sm">
              This account is blocked — outstanding commission exceeds the credit limit.
            </p>
          ) : null}
          <div className="flex flex-wrap items-baseline gap-x-8 gap-y-3">
            <div>
              <p className="text-muted-foreground text-xs">Outstanding balance</p>
              <p className="font-display text-2xl font-semibold tracking-tight">
                {formatMoney(account.data.outstandingBalance)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Credit limit</p>
              <p className="text-lg font-medium">{formatMoney(account.data.creditLimit)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Available credit</p>
              <p className="text-lg font-medium">{formatMoney(availableCredit)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Status</p>
              <Badge variant={account.data.blocked ? 'outline' : 'success'}>
                {account.data.blocked
                  ? 'Blocked'
                  : account.data.outstandingBalance > 0
                    ? 'Outstanding'
                    : 'Clear'}
              </Badge>
            </div>
          </div>
        </>
      ) : null}

      <div className="border-border/70 border-t pt-4">
        <h3 className="mb-3 text-sm font-semibold">Record manual payment</h3>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="payment-amount">Amount</Label>
            <Input
              id="payment-amount"
              className="w-32"
              inputMode="decimal"
              value={paymentAmount}
              onChange={(event) => {
                setPaymentAmount(event.target.value);
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="payment-description">Description (optional)</Label>
            <Input
              id="payment-description"
              className="w-64"
              value={paymentDescription}
              onChange={(event) => {
                setPaymentDescription(event.target.value);
              }}
            />
          </div>
          <Button type="button" disabled={recording} onClick={() => void recordPayment()}>
            {recording ? 'Recording…' : 'Record payment'}
          </Button>
        </div>
        {paymentError ? (
          <p className="text-destructive mt-2 text-sm" role="alert">
            {paymentError}
          </p>
        ) : null}
      </div>

      <div className="border-border/70 border-t pt-4">
        <h3 className="mb-3 text-sm font-semibold">Ledger</h3>
        {ledger.error ? (
          <p className="text-destructive text-sm" role="alert">
            {ledger.error}
          </p>
        ) : ledger.loading && !ledger.data ? (
          <div className="flex justify-center py-4">
            <LoadingSpinner />
          </div>
        ) : !ledger.data || ledger.data.items.length === 0 ? (
          <EmptyState
            title="No ledger entries yet"
            description="Accruals and payments against this account will appear here."
          />
        ) : (
          <div className="border-border/70 divide-border/70 divide-y overflow-hidden rounded-lg border">
            {ledger.data.items.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {entry.description ?? COMMISSION_ENTRY_TYPE_LABEL[entry.type]}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {formatDate(entry.createdAt)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className={entry.type === 'ACCRUAL' ? 'text-destructive' : 'text-success'}>
                    {entry.type === 'ACCRUAL' ? '+' : '-'}
                    {formatMoney(entry.amount)}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Balance {formatMoney(entry.balanceAfter)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
        {ledger.data && ledger.data.meta.totalPages > 1 ? (
          <div className="mt-3 flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => {
                onPageChange(Math.max(1, page - 1));
              }}
            >
              Previous
            </Button>
            <span className="text-muted-foreground text-sm">
              Page {page} of {ledger.data.meta.totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= ledger.data.meta.totalPages}
              onClick={() => {
                onPageChange(Math.min(ledger.data?.meta.totalPages ?? page, page + 1));
              }}
            >
              Next
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
