'use client';

import {
  SuperAppWalletScreenHeader,
  SuperAppWalletSectionLabel,
  SuperAppWalletStatusBar,
  SuperAppWalletToggle,
  useSuperAppFonts,
} from '@dripplex/ui';
import * as React from 'react';

import type { NotificationType } from '@dripplex/types';

import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from '@/hooks/use-notification-preferences';
import { useSetWalletLimits, useWallet } from '@/hooks/wallet';

const PRIVACY_MODE_STORAGE_KEY = 'dripplex.wallet.privacyMode';

/** Only types that are unambiguously wallet-money-movement, not shared
 * with other domains (PAYMENT_SUCCESS/FAILED are also used by Marketplace
 * order and Ride fare confirmations, so they're deliberately excluded —
 * toggling them here would silently mute those too). */
const WALLET_ACTIVITY_TYPES: NotificationType[] = [
  'WITHDRAWAL_REQUESTED',
  'WITHDRAWAL_COMPLETED',
  'WITHDRAWAL_FAILED',
];
const PROMO_TYPES: NotificationType[] = [
  'PROMOTION_REDEEMED',
  'PROMOTION_EXPIRED',
  'CASHBACK_AWARDED',
  'REFERRAL_REDEEMED',
  'REFERRAL_REWARDED',
];

function useLocalToggle(key: string): [boolean, (value: boolean) => void] {
  const [value, setValue] = React.useState(false);
  React.useEffect(() => {
    setValue(window.localStorage.getItem(key) === '1');
  }, [key]);
  const set = React.useCallback(
    (next: boolean) => {
      setValue(next);
      window.localStorage.setItem(key, next ? '1' : '0');
    },
    [key],
  );
  return [value, set];
}

/**
 * DPX-100 Wallet Slice 5. Notification preferences reuse the platform's
 * real `NotificationPreference` system (`GET/PUT
 * customer/notifications/preferences`) at the IN_APP channel — adapted
 * from Figma's 3 toggles to 2, since the backend's (channel, type)
 * granularity can't distinguish "ride deduction" alerts from "marketplace
 * payment" alerts (both fire `PAYMENT_SUCCESS`); see
 * docs/WALLET-005-STATEMENT-SECURITY-SETTINGS-DESIGN.md for the full
 * reasoning. Spending limits are real, persisted on the `Wallet` row, and
 * actually enforced on Transfer and Withdrawal (not ride/marketplace
 * wallet payments — a stated scope boundary, not silently omitted).
 * Privacy Mode is a real, client-only display preference (no backend
 * meaning to persist server-side). Currency is genuinely static — this
 * platform is NGN-only. Auto Top-Up is a documented gap: it would need a
 * saved auto-charge payment method, which doesn't exist (Payment Methods,
 * Slice 3, already established this).
 */
export function WalletSettingsScreen({ onBack }: { onBack: () => void }): React.JSX.Element {
  const wallet = useWallet();
  const setLimits = useSetWalletLimits();
  const preferences = useNotificationPreferences();
  const updatePreferences = useUpdateNotificationPreferences();
  const { body, heading } = useSuperAppFonts();

  const [dailyLimit, setDailyLimit] = React.useState('');
  const [singleLimit, setSingleLimit] = React.useState('');
  const [privacyMode, setPrivacyMode] = useLocalToggle(PRIVACY_MODE_STORAGE_KEY);

  React.useEffect(() => {
    if (wallet.data) {
      setDailyLimit(wallet.data.dailyLimit !== null ? String(wallet.data.dailyLimit) : '');
      setSingleLimit(
        wallet.data.singleTransactionLimit !== null
          ? String(wallet.data.singleTransactionLimit)
          : '',
      );
    }
  }, [wallet.data]);

  const isGroupEnabled = (types: NotificationType[]): boolean => {
    if (!preferences.data) return true;
    return types.every((type) => {
      const row = preferences.data.find((p) => p.channel === 'IN_APP' && p.type === type);
      return row?.enabled ?? true;
    });
  };

  const toggleGroup = (types: NotificationType[]): void => {
    const nextEnabled = !isGroupEnabled(types);
    updatePreferences.mutate(
      types.map((type) => ({ channel: 'IN_APP', type, enabled: nextEnabled })),
    );
  };

  const limitsChanged =
    wallet.data &&
    (dailyLimit !== (wallet.data.dailyLimit !== null ? String(wallet.data.dailyLimit) : '') ||
      singleLimit !==
        (wallet.data.singleTransactionLimit !== null
          ? String(wallet.data.singleTransactionLimit)
          : ''));

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#0A1628' }}
    >
      <SuperAppWalletStatusBar />
      <SuperAppWalletScreenHeader title="Wallet Settings" onBack={onBack} />

      <div className="flex-1 overflow-y-auto pb-8">
        <div className="px-4 pb-4">
          <SuperAppWalletSectionLabel>Auto Top-Up</SuperAppWalletSectionLabel>
          <div
            className="mt-2.5 overflow-hidden rounded-2xl"
            style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
          >
            <div className="flex items-center justify-between px-4 py-3.5">
              <div>
                <div className={`text-[14px] font-semibold text-white ${body}`}>
                  Enable Auto Top-Up
                </div>
                <div
                  className={`mt-0.5 text-[11px] ${body}`}
                  style={{ color: 'rgba(255,255,255,.5)' }}
                >
                  Needs a saved card to auto-charge — not available yet
                </div>
              </div>
              <SuperAppWalletToggle on={false} onToggle={() => undefined} disabled />
            </div>
          </div>
        </div>

        <div className="px-4 pb-4">
          <SuperAppWalletSectionLabel>Notification preferences</SuperAppWalletSectionLabel>
          <div
            className="mt-2.5 overflow-hidden rounded-2xl"
            style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
          >
            {[
              {
                label: 'Withdrawals & payouts',
                sub: 'Alerts when a withdrawal is requested, completed, or fails',
                types: WALLET_ACTIVITY_TYPES,
              },
              {
                label: 'Promotions & offers',
                sub: 'Cashback and reward updates',
                types: PROMO_TYPES,
              },
            ].map((row, i) => (
              <div key={row.label}>
                {i > 0 ? <div style={{ height: 1, background: 'rgba(255,255,255,.08)' }} /> : null}
                <div className="flex items-center justify-between px-4 py-3.5">
                  <div>
                    <div className={`text-[14px] font-semibold text-white ${body}`}>
                      {row.label}
                    </div>
                    <div
                      className={`mt-0.5 text-[11px] ${body}`}
                      style={{ color: 'rgba(255,255,255,.5)' }}
                    >
                      {row.sub}
                    </div>
                  </div>
                  <SuperAppWalletToggle
                    on={isGroupEnabled(row.types)}
                    onToggle={() => {
                      toggleGroup(row.types);
                    }}
                    disabled={preferences.isLoading || updatePreferences.isPending}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="px-4 pb-4">
          <SuperAppWalletSectionLabel>Currency display</SuperAppWalletSectionLabel>
          <div
            className="mt-2.5 flex items-center justify-between rounded-2xl px-4 py-3.5"
            style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
          >
            <div>
              <div className={`text-[14px] font-semibold text-white ${body}`}>
                Nigerian Naira (NGN)
              </div>
              <div className={`text-[12px] ${body}`} style={{ color: 'rgba(255,255,255,.5)' }}>
                All amounts displayed in ₦
              </div>
            </div>
            <div
              className="rounded-lg px-2.5 py-1"
              style={{ background: 'rgba(43,172,82,.1)', border: '1px solid rgba(43,172,82,.2)' }}
            >
              <span className={`text-[13px] font-bold ${heading}`} style={{ color: '#47CF72' }}>
                NGN ₦
              </span>
            </div>
          </div>
        </div>

        <div className="px-4 pb-4">
          <SuperAppWalletSectionLabel>Spending limits</SuperAppWalletSectionLabel>
          <div
            className="mt-2.5 overflow-hidden rounded-2xl"
            style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
          >
            {[
              { label: 'Daily limit', value: dailyLimit, onChange: setDailyLimit },
              { label: 'Single transaction limit', value: singleLimit, onChange: setSingleLimit },
            ].map((item, i) => (
              <div key={item.label}>
                {i > 0 ? <div style={{ height: 1, background: 'rgba(255,255,255,.08)' }} /> : null}
                <div className="px-4 py-3.5">
                  <div
                    className={`mb-1.5 text-[11px] uppercase tracking-wider ${body}`}
                    style={{ color: 'rgba(255,255,255,.5)' }}
                  >
                    {item.label}
                  </div>
                  <div
                    className="flex h-11 items-center rounded-xl px-3.5"
                    style={{ background: '#0A1628', border: '1px solid rgba(255,255,255,.08)' }}
                  >
                    <span
                      className={`mr-1.5 text-[15px] font-bold ${heading}`}
                      style={{ color: '#3B82F6' }}
                    >
                      ₦
                    </span>
                    <input
                      value={item.value}
                      onChange={(e) => {
                        item.onChange(e.target.value.replace(/[^0-9]/g, ''));
                      }}
                      placeholder="No limit"
                      inputMode="numeric"
                      className={`flex-1 bg-transparent text-[14px] font-semibold text-white outline-none ${body}`}
                    />
                  </div>
                </div>
              </div>
            ))}
            <div className="px-4 pb-3.5">
              {setLimits.isError ? (
                <p className={`mb-2 text-[12px] ${body}`} style={{ color: '#EF4444' }}>
                  Couldn&apos;t save your limits.
                </p>
              ) : null}
              <button
                type="button"
                disabled={!limitsChanged || setLimits.isPending}
                onClick={() => {
                  setLimits.mutate({
                    dailyLimit: dailyLimit ? Number(dailyLimit) : null,
                    singleTransactionLimit: singleLimit ? Number(singleLimit) : null,
                  });
                }}
                className={`h-10 w-full rounded-xl text-[13px] font-semibold ${heading}`}
                style={{
                  background:
                    limitsChanged && !setLimits.isPending
                      ? 'linear-gradient(135deg,#176B30,#2BAC52)'
                      : 'rgba(255,255,255,.06)',
                  color: limitsChanged && !setLimits.isPending ? '#fff' : 'rgba(255,255,255,.3)',
                }}
              >
                {setLimits.isPending
                  ? 'Saving…'
                  : setLimits.isSuccess && !limitsChanged
                    ? 'Saved'
                    : 'Save limits'}
              </button>
            </div>
          </div>
        </div>

        <div className="px-4">
          <SuperAppWalletSectionLabel>Privacy</SuperAppWalletSectionLabel>
          <div
            className="mt-2.5 overflow-hidden rounded-2xl"
            style={{
              background: '#112238',
              border: `1px solid ${privacyMode ? '#2BAC52' : 'rgba(255,255,255,.08)'}`,
            }}
          >
            <div className="flex items-center justify-between px-4 py-3.5">
              <div>
                <div className={`text-[14px] font-semibold text-white ${body}`}>Privacy Mode</div>
                <div
                  className={`mt-0.5 text-[11px] ${body}`}
                  style={{ color: 'rgba(255,255,255,.5)' }}
                >
                  Hide balance and amounts on this device
                </div>
              </div>
              <SuperAppWalletToggle
                on={privacyMode}
                onToggle={() => {
                  setPrivacyMode(!privacyMode);
                }}
              />
            </div>
            {privacyMode ? (
              <div className="px-4 pb-3.5" style={{ background: 'rgba(43,172,82,.05)' }}>
                <p className={`text-[12px] ${body}`} style={{ color: '#47CF72' }}>
                  🔒 Balances are hidden on this device. Tap amounts to reveal.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
