'use client';

import {
  SuperAppWalletFilterPills,
  SuperAppWalletScreenHeader,
  SuperAppWalletSectionLabel,
  SuperAppWalletStatusBar,
  SuperAppWalletTransactionList,
  SuperAppWalletTransactionRow,
  useSuperAppFonts,
} from '@dripplex/ui';
import * as React from 'react';

import type { WalletLedgerEntryDto } from '@dripplex/types';

import { downloadWalletStatement, useWalletStatement } from '@/hooks/wallet';

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

/** Last 12 real calendar months ending at the current month — the Figma
 * source hardcodes "2024" months with mock per-month totals; this offers
 * the real range instead of pretending a fixed year. */
function recentMonths(): { key: string; label: string; month: number; year: number }[] {
  const months: { key: string; label: string; month: number; year: number }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${String(d.getFullYear())}-${String(d.getMonth() + 1)}`,
      label: d.toLocaleDateString('en-NG', { month: 'short', year: '2-digit' }),
      month: d.getMonth() + 1,
      year: d.getFullYear(),
    });
  }
  return months;
}

/**
 * DPX-100 Wallet Slice 5. Fully real: `GET /customer/wallet/statement`
 * aggregates existing `WalletLedgerEntry` rows for the selected calendar
 * month (Money In / Money Out / Net + the real transaction list) — no
 * separate "statement" data model, this is a read view over the same
 * ledger Transaction History already shows. Export is a real CSV download
 * (`GET .../statement/export`), not the Figma source's "Export PDF" — no
 * PDF rendering library exists anywhere in this codebase, and adding one
 * for a single button would be disproportionate; CSV opens in
 * Excel/Sheets/Numbers just as readily and is the honest choice given
 * what's actually available.
 */
export function WalletStatementScreen({ onBack }: { onBack: () => void }): React.JSX.Element {
  const months = React.useMemo(() => recentMonths(), []);
  const [selectedKey, setSelectedKey] = React.useState(months[0]?.key ?? '');
  const selected = months.find((m) => m.key === selectedKey) ?? months[0];
  const statement = useWalletStatement(selected?.month ?? 1, selected?.year ?? 2026);
  const { body, heading } = useSuperAppFonts();
  const [exporting, setExporting] = React.useState(false);
  const [exportError, setExportError] = React.useState(false);

  const onExport = async (): Promise<void> => {
    if (!selected) return;
    setExporting(true);
    setExportError(false);
    try {
      await downloadWalletStatement(selected.month, selected.year);
    } catch {
      setExportError(true);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#0A1628' }}
    >
      <SuperAppWalletStatusBar />
      <SuperAppWalletScreenHeader title="Statement" onBack={onBack} />

      <SuperAppWalletFilterPills
        tabs={months.map((m) => m.label)}
        active={months.find((m) => m.key === selectedKey)?.label ?? ''}
        onChange={(label) => {
          const match = months.find((m) => m.label === label);
          if (match) setSelectedKey(match.key);
        }}
      />

      <div className="flex gap-3 px-4 pb-4">
        {[
          {
            label: 'Money In',
            value: statement.data?.totalIn ?? 0,
            color: '#10B981',
            bg: 'rgba(16,185,129,.08)',
            border: 'rgba(16,185,129,.18)',
          },
          {
            label: 'Money Out',
            value: statement.data?.totalOut ?? 0,
            color: '#EF4444',
            bg: 'rgba(239,68,68,.08)',
            border: 'rgba(239,68,68,.18)',
          },
          {
            label: 'Net',
            value: statement.data?.net ?? 0,
            color: (statement.data?.net ?? 0) >= 0 ? '#10B981' : '#EF4444',
            bg: '#112238',
            border: 'rgba(255,255,255,.08)',
          },
        ].map((card) => (
          <div
            key={card.label}
            className="flex-1 rounded-2xl p-3.5"
            style={{ background: card.bg, border: `1px solid ${card.border}` }}
          >
            <div
              className={`mb-1 text-[11px] uppercase tracking-wider ${body}`}
              style={{ color: 'rgba(255,255,255,.5)' }}
            >
              {card.label}
            </div>
            <div className={`text-[16px] font-extrabold ${heading}`} style={{ color: card.color }}>
              {card.label === 'Net' && card.value >= 0 ? '+' : ''}
              {card.label === 'Net' && card.value < 0 ? '−' : ''}₦
              {Math.abs(card.value).toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto pb-4">
        {statement.isLoading ? (
          <p className={`px-5 py-4 text-[13px] ${body}`} style={{ color: 'rgba(255,255,255,.5)' }}>
            Loading statement…
          </p>
        ) : null}
        {statement.isError ? (
          <p className={`px-5 py-4 text-[13px] ${body}`} style={{ color: '#EF4444' }}>
            Couldn&apos;t load your statement.
          </p>
        ) : null}
        {statement.data ? (
          <>
            <div className="px-5 pb-2">
              <SuperAppWalletSectionLabel>
                {selected?.label} — {statement.data.transactions.length} transaction
                {statement.data.transactions.length === 1 ? '' : 's'}
              </SuperAppWalletSectionLabel>
            </div>
            {statement.data.transactions.length === 0 ? (
              <p
                className={`px-5 py-4 text-[13px] ${body}`}
                style={{ color: 'rgba(255,255,255,.5)' }}
              >
                No transactions in {selected?.label}.
              </p>
            ) : (
              <SuperAppWalletTransactionList>
                {statement.data.transactions.map((entry) => {
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
            )}
          </>
        ) : null}
      </div>

      <div className="px-4 pb-8 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,.08)' }}>
        {exportError ? (
          <p className={`mb-2 text-center text-[12px] ${body}`} style={{ color: '#EF4444' }}>
            Couldn&apos;t download the statement. Try again.
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => {
            void onExport();
          }}
          disabled={exporting || !statement.data}
          className={`flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[15px] font-semibold ${body}`}
          style={{
            background: '#112238',
            border: '1px solid rgba(255,255,255,.08)',
            color: exporting ? 'rgba(255,255,255,.3)' : 'rgba(255,255,255,.8)',
          }}
        >
          {exporting ? 'Preparing…' : 'Export CSV Statement'}
        </button>
      </div>
    </div>
  );
}
