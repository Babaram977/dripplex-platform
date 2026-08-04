'use client';

import {
  SuperAppWalletAmountCard,
  SuperAppWalletButton,
  SuperAppWalletScreenHeader,
  SuperAppWalletSectionLabel,
  SuperAppWalletSelectableRow,
  SuperAppWalletStatusBar,
  useSuperAppFonts,
} from '@dripplex/ui';
import * as React from 'react';

import {
  useBankAccounts,
  useCreateWithdrawal,
  useWallet,
  useWalletPinStatus,
} from '@/hooks/wallet';

/**
 * DPX-100 Wallet Slice 4. Real production module — no fake success paths.
 * The wallet is debited at request creation (real `POST
 * /customer/wallet/withdrawals`), tracked as a real `WithdrawalRequest`,
 * and fulfilled by a real admin queue until Phase 2's payout-provider
 * automation lands (see docs/WALLET-004-WITHDRAW-DESIGN.md). Gated on two
 * real prerequisites — at least one linked bank account and a set
 * withdrawal PIN — surfaced as inline CTAs rather than silently disabling
 * the screen. Per DPX-UX-001, entering an amount and picking a bank account
 * doesn't withdraw anything until an explicit "Confirm withdrawal" step,
 * with PIN entry folded into that same confirm surface (one confirmation
 * step, not two).
 */
export function WithdrawScreen({
  onBack,
  onManageBankAccounts,
  onSetPin,
  onWithdrawn,
}: {
  onBack: () => void;
  onManageBankAccounts: () => void;
  onSetPin: () => void;
  onWithdrawn: () => void;
}): React.JSX.Element {
  const wallet = useWallet();
  const bankAccounts = useBankAccounts();
  const pinStatus = useWalletPinStatus();
  const createWithdrawal = useCreateWithdrawal();
  const { body } = useSuperAppFonts();

  const [amount, setAmount] = React.useState('');
  const [selectedAccountId, setSelectedAccountId] = React.useState<string | null>(null);
  const [confirming, setConfirming] = React.useState(false);
  const [pin, setPin] = React.useState('');

  const accounts = React.useMemo(() => bankAccounts.data ?? [], [bankAccounts.data]);
  React.useEffect(() => {
    if (!selectedAccountId && accounts.length > 0) {
      const defaultAccount = accounts.find((account) => account.isDefault) ?? accounts[0];
      if (defaultAccount) {
        setSelectedAccountId(defaultAccount.id);
      }
    }
  }, [accounts, selectedAccountId]);

  const numericAmount = Number(amount);
  const validAmount =
    numericAmount > 0 && (!wallet.data || numericAmount <= wallet.data.availableBalance);
  const canReview = validAmount && selectedAccountId !== null;
  const validPin = /^[0-9]{4}$/.test(pin);

  const loadingPrereqs = bankAccounts.isLoading || pinStatus.isLoading;
  const needsBankAccount = !loadingPrereqs && accounts.length === 0;
  const needsPin = !loadingPrereqs && !needsBankAccount && pinStatus.data?.hasPin === false;

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#0A1628' }}
    >
      <SuperAppWalletStatusBar />
      <SuperAppWalletScreenHeader title="Withdraw" onBack={onBack} />

      <div className="flex-1 overflow-y-auto pb-4">
        {loadingPrereqs ? (
          <p className={`px-4 py-4 text-[13px] ${body}`} style={{ color: 'rgba(255,255,255,.5)' }}>
            Loading…
          </p>
        ) : null}

        {needsBankAccount ? (
          <div className="px-4 pt-2">
            <div
              className="rounded-2xl p-5 text-center"
              style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
            >
              <p className={`mb-3 text-[14px] ${body}`} style={{ color: 'rgba(255,255,255,.7)' }}>
                Add a bank account to withdraw from your wallet.
              </p>
              <SuperAppWalletButton onClick={onManageBankAccounts}>
                Add Bank Account
              </SuperAppWalletButton>
            </div>
          </div>
        ) : null}

        {needsPin ? (
          <div className="px-4 pt-2">
            <div
              className="rounded-2xl p-5 text-center"
              style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
            >
              <p className={`mb-3 text-[14px] ${body}`} style={{ color: 'rgba(255,255,255,.7)' }}>
                Set a withdrawal PIN to continue.
              </p>
              <SuperAppWalletButton onClick={onSetPin}>Set PIN</SuperAppWalletButton>
            </div>
          </div>
        ) : null}

        {!needsBankAccount && !needsPin && !loadingPrereqs ? (
          <>
            <div className="px-4 pb-4 pt-2">
              <div
                className="flex items-center justify-between rounded-xl px-3.5 py-2.5"
                style={{
                  background: 'rgba(43,172,82,.08)',
                  border: '1px solid rgba(43,172,82,.15)',
                }}
              >
                <span className={`text-[13px] ${body}`} style={{ color: 'rgba(255,255,255,.5)' }}>
                  Available balance
                </span>
                <span className={`text-[15px] font-bold ${body}`} style={{ color: '#47CF72' }}>
                  {wallet.data ? `₦${wallet.data.availableBalance.toLocaleString()}` : '—'}
                </span>
              </div>
            </div>

            <div className="px-4 pb-4">
              <SuperAppWalletAmountCard
                value={amount}
                onChange={(next) => {
                  setAmount(next);
                  setConfirming(false);
                }}
                label="Withdraw amount"
              />
            </div>

            <div className="px-4 pb-4">
              <div className="mb-2.5 flex items-center justify-between">
                <SuperAppWalletSectionLabel>Destination account</SuperAppWalletSectionLabel>
                <button
                  type="button"
                  onClick={onManageBankAccounts}
                  className={`text-[12px] font-medium ${body}`}
                  style={{ color: '#47CF72' }}
                >
                  Manage
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {accounts.map((account) => (
                  <SuperAppWalletSelectableRow
                    key={account.id}
                    icon="🏦"
                    label={account.bankName}
                    subtitle={`${account.accountName} · ${account.accountNumber}`}
                    selected={selectedAccountId === account.id}
                    onClick={() => {
                      setSelectedAccountId(account.id);
                      setConfirming(false);
                    }}
                  />
                ))}
              </div>
            </div>

            {createWithdrawal.isError ? (
              <p className={`px-4 pb-2 text-[13px] ${body}`} style={{ color: '#EF4444' }}>
                Couldn&apos;t submit your withdrawal. Check your PIN and try again.
              </p>
            ) : null}
          </>
        ) : null}
      </div>

      {!needsBankAccount && !needsPin && !loadingPrereqs ? (
        <div className="px-4 pb-8 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,.08)' }}>
          {confirming ? (
            <>
              <p
                className={`mb-3 text-center text-[13px] ${body}`}
                style={{ color: 'rgba(255,255,255,.7)' }}
              >
                Withdraw ₦{amount || '0'} to{' '}
                {accounts.find((account) => account.id === selectedAccountId)?.bankName}?
              </p>
              <div className="mb-3">
                <input
                  value={pin}
                  onChange={(event) => {
                    setPin(event.target.value.replace(/[^0-9]/g, '').slice(0, 4));
                  }}
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="Enter your 4-digit PIN"
                  className={`h-[52px] w-full rounded-xl px-4 text-center text-[18px] font-bold tracking-[0.4em] text-white outline-none ${body}`}
                  style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setConfirming(false);
                    setPin('');
                  }}
                  className={`h-14 flex-1 rounded-2xl text-[15px] font-semibold ${body}`}
                  style={{
                    background: '#112238',
                    color: 'rgba(255,255,255,.7)',
                    border: '1px solid rgba(255,255,255,.08)',
                  }}
                >
                  Cancel
                </button>
                <div className="flex-[2]">
                  <SuperAppWalletButton
                    disabled={!validPin}
                    loading={createWithdrawal.isPending}
                    onClick={() => {
                      if (!selectedAccountId) return;
                      createWithdrawal.mutate(
                        { amount: numericAmount, bankAccountId: selectedAccountId, pin },
                        { onSuccess: onWithdrawn },
                      );
                    }}
                  >
                    Confirm
                  </SuperAppWalletButton>
                </div>
              </div>
            </>
          ) : (
            <SuperAppWalletButton
              disabled={!canReview}
              onClick={() => {
                setConfirming(true);
              }}
            >
              Withdraw ₦{amount || '0'}
            </SuperAppWalletButton>
          )}
        </div>
      ) : null}
    </div>
  );
}
