'use client';

import {
  SuperAppWalletScreenHeader,
  SuperAppWalletSectionLabel,
  SuperAppWalletStatusBar,
  useSuperAppFonts,
} from '@dripplex/ui';
import * as React from 'react';

import { useBankAccounts } from '@/hooks/wallet';

const FUNDING_METHODS = [
  { icon: '🟦', label: 'Paystack', sub: 'Card, bank transfer, USSD' },
  { icon: '🟧', label: 'Flutterwave', sub: 'Card, bank transfer, USSD' },
  { icon: '📱', label: 'OPay', sub: 'Card, bank transfer, USSD' },
];

function maskAccountNumber(accountNumber: string): string {
  return accountNumber.length > 4 ? `•••• ${accountNumber.slice(-4)}` : accountNumber;
}

/**
 * DPX-100 Wallet Slice 3, updated in the Slice 5 production audit. The
 * Figma source shows saved cards ("swipe to delete") — no card
 * tokenization exists anywhere in the platform, so that part stays
 * adapted to the three real gateway providers Top Up already uses.
 * Linked bank accounts are real as of Slice 4 (`CustomerBankAccount`,
 * `useBankAccounts()`) — this screen originally shipped before Slice 4
 * and was never updated to read the real list, so it kept showing "No
 * linked bank accounts yet" even for a customer who had actually linked
 * one via Withdraw. Fixed: see docs/WALLET-PRODUCTION-AUDIT.md §2.2.
 */
export function PaymentMethodsScreen({ onBack }: { onBack: () => void }): React.JSX.Element {
  const { body } = useSuperAppFonts();
  const bankAccounts = useBankAccounts();
  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#0A1628' }}
    >
      <SuperAppWalletStatusBar />
      <SuperAppWalletScreenHeader title="Payment Methods" onBack={onBack} />

      <div className="flex-1 overflow-y-auto pb-6">
        <div className="px-4 pb-6">
          <SuperAppWalletSectionLabel>Funding methods</SuperAppWalletSectionLabel>
          <p
            className={`mb-2.5 mt-1 text-[12px] ${body}`}
            style={{ color: 'rgba(255,255,255,.5)' }}
          >
            Used to top up your wallet — no card details are stored by DrippleX.
          </p>
          <div className="flex flex-col gap-2">
            {FUNDING_METHODS.map((method) => (
              <div
                key={method.label}
                className="flex items-center gap-3 rounded-2xl px-4 py-3.5"
                style={{ background: '#0D1B2E', border: '1px solid rgba(255,255,255,.08)' }}
              >
                <span className="text-[22px]">{method.icon}</span>
                <div>
                  <p className={`text-[14px] font-semibold text-white ${body}`}>{method.label}</p>
                  <p className={`text-[12px] ${body}`} style={{ color: 'rgba(255,255,255,.5)' }}>
                    {method.sub}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="px-4">
          <SuperAppWalletSectionLabel>Linked bank accounts</SuperAppWalletSectionLabel>
          {bankAccounts.isLoading ? (
            <div
              className="mt-2.5 rounded-2xl px-4 py-5 text-center"
              style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
            >
              <p className={`text-[13px] ${body}`} style={{ color: 'rgba(255,255,255,.5)' }}>
                Loading your bank accounts…
              </p>
            </div>
          ) : null}
          {bankAccounts.isError ? (
            <div
              className="mt-2.5 rounded-2xl px-4 py-5 text-center"
              style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
            >
              <p className={`text-[13px] ${body}`} style={{ color: '#EF4444' }}>
                Couldn&apos;t load your bank accounts.
              </p>
            </div>
          ) : null}
          {!bankAccounts.isLoading && !bankAccounts.isError && bankAccounts.data?.length === 0 ? (
            <div
              className="mt-2.5 rounded-2xl px-4 py-5 text-center"
              style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
            >
              <p className={`text-[13px] ${body}`} style={{ color: 'rgba(255,255,255,.5)' }}>
                No linked bank accounts yet. You&apos;ll be able to add one when withdrawing from
                your wallet.
              </p>
            </div>
          ) : null}
          {bankAccounts.data && bankAccounts.data.length > 0 ? (
            <div className="mt-2.5 flex flex-col gap-2">
              {bankAccounts.data.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center gap-3 rounded-2xl px-4 py-3.5"
                  style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
                >
                  <span className="text-[22px]">🏦</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className={`text-[14px] font-semibold text-white ${body}`}>
                        {account.bankName}
                      </p>
                      {account.isDefault ? (
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${body}`}
                          style={{ background: 'rgba(43,172,82,.15)', color: '#47CF72' }}
                        >
                          Default
                        </span>
                      ) : null}
                    </div>
                    <p className={`text-[12px] ${body}`} style={{ color: 'rgba(255,255,255,.5)' }}>
                      {account.accountName} · {maskAccountNumber(account.accountNumber)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
