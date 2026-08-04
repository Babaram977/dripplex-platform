'use client';

import { useAuth } from '@dripplex/hooks';
import {
  SuperAppWalletBalanceHero,
  SuperAppWalletQuickActionsGrid,
  SuperAppWalletRewardsStrip,
  SuperAppWalletStatusBar,
  SuperAppWalletTransactionList,
  SuperAppWalletTransactionRow,
  useSuperAppFonts,
} from '@dripplex/ui';
import * as React from 'react';

import type { WalletLedgerEntryDto } from '@dripplex/types';

import { useWallet, useWalletTransactions } from '@/hooks/wallet';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning,';
  if (hour < 18) return 'Good afternoon,';
  return 'Good evening,';
}

function txVisual(entry: WalletLedgerEntryDto): { icon: string; color: string; title: string } {
  switch (entry.type) {
    case 'CREDIT':
      return { icon: '💳', color: '#10B981', title: entry.description ?? 'Wallet credit' };
    case 'REFUND':
      return { icon: '↩', color: '#10B981', title: entry.description ?? 'Refund' };
    case 'SETTLEMENT':
      return { icon: '⇄', color: '#3B82F6', title: entry.description ?? 'Settlement' };
    case 'CASHBACK':
      return { icon: '🎁', color: '#F59E0B', title: entry.description ?? 'Cashback reward' };
    case 'WITHDRAWAL':
      return { icon: '🏦', color: '#F59E0B', title: entry.description ?? 'Withdrawal' };
    case 'TRANSFER':
      return {
        icon: entry.direction === 'CREDIT' ? '↓' : '↑',
        color: '#8B5CF6',
        title:
          entry.description ??
          (entry.direction === 'CREDIT' ? 'Transfer received' : 'Transfer sent'),
      };
    case 'DEBIT':
    default:
      return { icon: '🧾', color: '#3B82F6', title: entry.description ?? 'Wallet debit' };
  }
}

function formatEntryDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NG', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * DPX-100 Wallet Slice 1-4. Top Up, Transfer, Withdraw, "See all", and the
 * rewards strip all navigate to their real screens. Pay still has no
 * destination — it has no standalone concept in the real backend at all
 * (merchant/ride payments happen in-flow, not from Wallet Home) — so it
 * stays disabled rather than navigating nowhere. The rewards strip shows a
 * real sum of CASHBACK entries from the fetched recent-transactions batch
 * (not a lifetime total — that lives on the Rewards screen itself, worded
 * honestly here as recent activity).
 */
export function WalletHomeScreen({
  onBack,
  onSeeAllTransactions,
  onTopUp,
  onTransfer,
  onRewards,
  onWithdraw,
}: {
  onBack: () => void;
  onSeeAllTransactions: () => void;
  onTopUp: () => void;
  onTransfer: () => void;
  onRewards: () => void;
  onWithdraw: () => void;
}): React.JSX.Element {
  const { user } = useAuth();
  const wallet = useWallet();
  const transactions = useWalletTransactions({ page: 1, pageSize: 5 });
  const { heading, body } = useSuperAppFonts();

  const recentCashback = (transactions.data?.items ?? [])
    .filter((entry) => entry.type === 'CASHBACK')
    .reduce((sum, entry) => sum + entry.amount, 0);

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#0A1628' }}
    >
      <SuperAppWalletStatusBar />
      <div
        className="flex items-center justify-between px-5"
        style={{ paddingTop: 8, paddingBottom: 4 }}
      >
        <div>
          <p
            className={`text-[12px] font-medium ${body}`}
            style={{ color: 'rgba(255,255,255,.5)' }}
          >
            {greeting()}
          </p>
          <p className={`text-[17px] font-bold text-white ${heading}`}>
            {user ? `${user.firstName} ${user.lastName}`.trim() : 'Welcome back'}
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px]"
          style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
          aria-label="Close wallet"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <circle cx="7" cy="7" r="5" stroke="rgba(255,255,255,.5)" strokeWidth="1.5" />
            <path
              d="M11.5 11.5L16 16"
              stroke="rgba(255,255,255,.5)"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      <SuperAppWalletBalanceHero
        amount={wallet.data ? `₦${Math.trunc(wallet.data.availableBalance).toLocaleString()}` : '—'}
        decimals={
          wallet.data
            ? `.${String(Math.round((wallet.data.availableBalance % 1) * 100)).padStart(2, '0')}`
            : undefined
        }
        lastUpdatedLabel={
          wallet.data
            ? `Last updated: ${new Date(wallet.data.updatedAt).toLocaleTimeString()}`
            : undefined
        }
      />

      <SuperAppWalletQuickActionsGrid
        actions={[
          { key: 'topup', icon: '↓', label: 'Top Up', color: '#10B981', onClick: onTopUp },
          { key: 'withdraw', icon: '↑', label: 'Withdraw', color: '#F59E0B', onClick: onWithdraw },
          { key: 'transfer', icon: '→', label: 'Transfer', color: '#3B82F6', onClick: onTransfer },
          { key: 'pay', icon: '₦', label: 'Pay', color: '#8B5CF6' },
        ]}
      />

      {recentCashback > 0 ? (
        <SuperAppWalletRewardsStrip
          title={`₦${recentCashback.toLocaleString()} cashback in recent activity`}
          subtitle="View your rewards & referral code"
          onClick={onRewards}
        />
      ) : null}

      <div className="mt-4 flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5" style={{ marginBottom: 12 }}>
          <span className={`text-[15px] font-bold text-white ${heading}`}>Recent Transactions</span>
          <button
            type="button"
            onClick={onSeeAllTransactions}
            className={`text-[13px] font-medium ${body}`}
            style={{ color: '#47CF72' }}
          >
            See all
          </button>
        </div>
        <div className="flex-1 overflow-y-auto pb-6">
          {transactions.isLoading ? (
            <p
              className={`px-5 py-4 text-[13px] ${body}`}
              style={{ color: 'rgba(255,255,255,.5)' }}
            >
              Loading transactions…
            </p>
          ) : null}
          {transactions.isError ? (
            <p className={`px-5 py-4 text-[13px] ${body}`} style={{ color: '#EF4444' }}>
              Couldn&apos;t load your transactions.
            </p>
          ) : null}
          {!transactions.isLoading &&
          !transactions.isError &&
          (transactions.data?.items.length ?? 0) === 0 ? (
            <p
              className={`px-5 py-4 text-[13px] ${body}`}
              style={{ color: 'rgba(255,255,255,.5)' }}
            >
              No transactions yet.
            </p>
          ) : null}
          {transactions.data && transactions.data.items.length > 0 ? (
            <SuperAppWalletTransactionList>
              {transactions.data.items.map((entry) => {
                const visual = txVisual(entry);
                return (
                  <SuperAppWalletTransactionRow
                    key={entry.id}
                    icon={visual.icon}
                    iconColor={visual.color}
                    title={visual.title}
                    subtitle={formatEntryDate(entry.createdAt)}
                    amountLabel={`${entry.direction === 'CREDIT' ? '+' : '-'}₦${entry.amount.toLocaleString()}`}
                    isCredit={entry.direction === 'CREDIT'}
                  />
                );
              })}
            </SuperAppWalletTransactionList>
          ) : null}
        </div>
      </div>
    </div>
  );
}
