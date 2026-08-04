'use client';

import {
  SuperAppRidePagination,
  SuperAppWalletFilterPills,
  SuperAppWalletScreenHeader,
  SuperAppWalletSearchInput,
  SuperAppWalletSectionLabel,
  SuperAppWalletStatusBar,
  SuperAppWalletTransactionList,
  SuperAppWalletTransactionRow,
  useSuperAppFonts,
} from '@dripplex/ui';
import * as React from 'react';

import type { WalletLedgerEntryDto } from '@dripplex/types';

import { useWalletTransactions } from '@/hooks/wallet';

const FILTER_TABS = [
  { key: 'ALL', label: 'All' },
  { key: 'CREDIT', label: 'Top-up' },
  { key: 'DEBIT', label: 'Spending' },
  { key: 'TRANSFER', label: 'Transfers' },
  { key: 'WITHDRAWAL', label: 'Withdrawals' },
  { key: 'REFUND', label: 'Refunds' },
  { key: 'CASHBACK', label: 'Cashback' },
] as const;
type FilterKey = (typeof FILTER_TABS)[number]['key'];
type FilterLabel = (typeof FILTER_TABS)[number]['label'];
const TAB_LABELS: readonly FilterLabel[] = FILTER_TABS.map((tab) => tab.label);
const LABEL_TO_KEY = new Map<FilterLabel, FilterKey>(
  FILTER_TABS.map((tab) => [tab.label, tab.key]),
);

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

function formatDateGroup(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NG', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' });
}

/**
 * DPX-100 Wallet Slice 2. The real backend has no server-side text search
 * over ledger descriptions, so `search` filters only the current page's
 * loaded rows (honest client-side narrowing, not a fabricated full-history
 * search) — the type-filter pills, by contrast, are real server-side
 * filtering (`WalletHistoryQueryDto.type`, added this slice).
 */
export function TransactionHistoryScreen({ onBack }: { onBack: () => void }): React.JSX.Element {
  const [activeLabel, setActiveLabel] = React.useState<FilterLabel>('All');
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const activeKey: FilterKey = LABEL_TO_KEY.get(activeLabel) ?? 'ALL';
  const transactions = useWalletTransactions({
    page,
    pageSize: 20,
    type: activeKey === 'ALL' ? undefined : activeKey,
  });
  const { body } = useSuperAppFonts();

  const items = transactions.data?.items ?? [];
  const filtered = search
    ? items.filter((entry) => txVisual(entry).title.toLowerCase().includes(search.toLowerCase()))
    : items;

  const groups: { date: string; entries: WalletLedgerEntryDto[] }[] = [];
  for (const entry of filtered) {
    const date = formatDateGroup(entry.createdAt);
    const lastGroup = groups.at(-1);
    if (lastGroup?.date === date) {
      lastGroup.entries.push(entry);
    } else {
      groups.push({ date, entries: [entry] });
    }
  }

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#0A1628' }}
    >
      <SuperAppWalletStatusBar />
      <SuperAppWalletScreenHeader title="Transactions" onBack={onBack} />

      <div className="px-4 pb-3">
        <SuperAppWalletSearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search transactions…"
        />
      </div>

      <SuperAppWalletFilterPills
        tabs={TAB_LABELS}
        active={activeLabel}
        onChange={(label) => {
          setActiveLabel(label);
          setPage(1);
        }}
      />

      <div className="flex-1 overflow-y-auto pb-4">
        {transactions.isLoading ? (
          <p className={`px-5 py-6 text-[13px] ${body}`} style={{ color: 'rgba(255,255,255,.5)' }}>
            Loading transactions…
          </p>
        ) : null}
        {transactions.isError ? (
          <p className={`px-5 py-6 text-[13px] ${body}`} style={{ color: '#EF4444' }}>
            Couldn&apos;t load your transactions.
          </p>
        ) : null}
        {!transactions.isLoading && !transactions.isError && groups.length === 0 ? (
          <p
            className={`px-5 py-6 text-center text-[13px] ${body}`}
            style={{ color: 'rgba(255,255,255,.5)' }}
          >
            No transactions found
          </p>
        ) : null}
        {groups.map((group) => (
          <div key={group.date}>
            <div className="px-5 pb-2 pt-3">
              <SuperAppWalletSectionLabel>{group.date}</SuperAppWalletSectionLabel>
            </div>
            <SuperAppWalletTransactionList>
              {group.entries.map((entry) => {
                const visual = txVisual(entry);
                return (
                  <SuperAppWalletTransactionRow
                    key={entry.id}
                    icon={visual.icon}
                    iconColor={visual.color}
                    title={visual.title}
                    subtitle={formatTime(entry.createdAt)}
                    amountLabel={`${entry.direction === 'CREDIT' ? '+' : '-'}₦${entry.amount.toLocaleString()}`}
                    isCredit={entry.direction === 'CREDIT'}
                  />
                );
              })}
            </SuperAppWalletTransactionList>
          </div>
        ))}
      </div>

      {transactions.data && transactions.data.meta.totalPages > 1 ? (
        <div className="px-4 pb-6 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,.08)' }}>
          <SuperAppRidePagination
            page={page}
            totalPages={transactions.data.meta.totalPages}
            onPrevious={() => {
              setPage((current) => Math.max(1, current - 1));
            }}
            onNext={() => {
              const totalPages = transactions.data.meta.totalPages;
              setPage((current) => Math.min(totalPages, current + 1));
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
