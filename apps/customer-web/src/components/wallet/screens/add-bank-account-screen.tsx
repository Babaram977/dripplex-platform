'use client';

import {
  SuperAppWalletButton,
  SuperAppWalletScreenHeader,
  SuperAppWalletSectionLabel,
  SuperAppWalletStatusBar,
  useSuperAppFonts,
} from '@dripplex/ui';
import * as React from 'react';

import { useAddBankAccount, useBanks } from '@/hooks/wallet';

/**
 * DPX-100 Wallet Slice 4. Self-attested bank details — no bank-account-
 * verification API is integrated anywhere in the platform (see
 * docs/WALLET-004-WITHDRAW-DESIGN.md), the same trust level merchant
 * `BankAccount` already operates at in production today. A plain text form
 * rather than a bank picker, since no bank directory exists to pick from.
 */
export function AddBankAccountScreen({
  onBack,
  onAdded,
}: {
  onBack: () => void;
  onAdded: () => void;
}): React.JSX.Element {
  const [bankCode, setBankCode] = React.useState('');
  const [accountNumber, setAccountNumber] = React.useState('');
  const [accountName, setAccountName] = React.useState('');
  const addBankAccount = useAddBankAccount();
  const banksQuery = useBanks();
  const { body } = useSuperAppFonts();

  const banks = banksQuery.data ?? [];
  const chosenBank = banks.find((bank) => bank.code === bankCode);
  const validAccountNumber = /^[0-9]{6,20}$/.test(accountNumber);
  const canSubmit = chosenBank !== undefined && validAccountNumber && accountName.trim().length > 0;

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#0A1628' }}
    >
      <SuperAppWalletStatusBar />
      <SuperAppWalletScreenHeader title="Add Bank Account" onBack={onBack} />

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="pb-4">
          <SuperAppWalletSectionLabel>Bank</SuperAppWalletSectionLabel>
          {/*
            Chosen from the provider's list, never typed. The provider's own
            spelling of a bank ("OPay Digital Services Limited (OPay)") is not
            what anyone writes, and a name that fails to match is an account
            that cannot be linked. Picking carries the bank code with it.
          */}
          <select
            value={bankCode}
            onChange={(event) => {
              setBankCode(event.target.value);
            }}
            aria-label="Bank"
            className={`mt-2.5 h-[48px] w-full rounded-xl px-4 text-[14px] outline-none ${body}`}
            style={{
              background: '#112238',
              border: '1px solid rgba(255,255,255,.08)',
              color: bankCode === '' ? 'rgba(255,255,255,.5)' : '#fff',
            }}
          >
            <option value="" style={{ color: '#000' }}>
              {banksQuery.isPending ? 'Loading banks…' : 'Choose your bank'}
            </option>
            {banks.map((bank) => (
              <option key={bank.code} value={bank.code} style={{ color: '#000' }}>
                {bank.name}
              </option>
            ))}
          </select>
        </div>

        <div className="pb-4">
          <SuperAppWalletSectionLabel>Account number</SuperAppWalletSectionLabel>
          <input
            value={accountNumber}
            onChange={(event) => {
              setAccountNumber(event.target.value.replace(/[^0-9]/g, ''));
            }}
            placeholder="10-digit account number"
            inputMode="numeric"
            maxLength={20}
            className={`mt-2.5 h-[48px] w-full rounded-xl px-4 text-[14px] text-white outline-none ${body}`}
            style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
          />
        </div>

        <div className="pb-4">
          <SuperAppWalletSectionLabel>Account name</SuperAppWalletSectionLabel>
          <input
            value={accountName}
            onChange={(event) => {
              setAccountName(event.target.value);
            }}
            placeholder="Name on the account"
            maxLength={150}
            className={`mt-2.5 h-[48px] w-full rounded-xl px-4 text-[14px] text-white outline-none ${body}`}
            style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
          />
        </div>

        {addBankAccount.isError ? (
          <p className={`text-[13px] ${body}`} style={{ color: '#EF4444' }}>
            Couldn&apos;t add this account. It may already be linked.
          </p>
        ) : null}
      </div>

      <div className="px-4 pb-8 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,.08)' }}>
        <SuperAppWalletButton
          disabled={!canSubmit}
          loading={addBankAccount.isPending}
          onClick={() => {
            addBankAccount.mutate(
              {
                bankName: chosenBank?.name ?? '',
                bankCode,
                accountNumber,
                accountName: accountName.trim(),
              },
              { onSuccess: onAdded },
            );
          }}
        >
          Save Bank Account
        </SuperAppWalletButton>
      </div>
    </div>
  );
}
