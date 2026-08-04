'use client';

import {
  SuperAppWalletReferralCard,
  SuperAppWalletRewardsHero,
  SuperAppWalletScreenHeader,
  SuperAppWalletSectionLabel,
  SuperAppWalletStatusBar,
  SuperAppWalletTransactionList,
  SuperAppWalletTransactionRow,
  useSuperAppFonts,
} from '@dripplex/ui';
import * as React from 'react';

import type { LoyaltyTier } from '@dripplex/types';

import {
  useLoyaltyAccount,
  useReferralCode,
  useReferralStats,
  useWalletTransactions,
} from '@/hooks/wallet';

const TIER_LABEL: Record<LoyaltyTier, string> = {
  BRONZE: 'Bronze',
  SILVER: 'Silver',
  GOLD: 'Gold',
  PLATINUM: 'Platinum',
  VIP: 'VIP',
};

/**
 * DPX-100 Wallet Slice 3. The Figma source's fixed reward categories
 * (Ride Cashback/Referral Bonus/Welcome Bonus with hardcoded amounts) and
 * "72% to Platinum" tier bar are mocked — but the real backend turned out
 * to already support almost all of this for real: a real loyalty tier
 * system (`GET /customer/loyalty`, found to have a type mismatch bug in
 * the SDK — fixed alongside this screen, its first real caller) and a
 * real customer referral system (`GET /customer/referrals/me` + `/stats`).
 * Adapted only where the source truly has no backend counterpart: no
 * fixed reward "categories" exist (cashback has no source taxonomy beyond
 * its real description text), so the breakdown is a real flat list of
 * CASHBACK ledger entries instead of three invented buckets.
 *
 * Updated in the Slice 5 production audit: all three queries now check
 * `.isError`, not just `.isLoading` — a failed fetch used to render as
 * "No cashback yet" (actively wrong) or an infinite "Loading your
 * referral code…" (stuck, not just unhelpful). See
 * docs/WALLET-PRODUCTION-AUDIT.md §2.3.
 */
export function RewardsScreen({ onBack }: { onBack: () => void }): React.JSX.Element {
  const [copied, setCopied] = React.useState(false);
  const loyalty = useLoyaltyAccount();
  const referral = useReferralCode();
  const referralStats = useReferralStats();
  const cashback = useWalletTransactions({ page: 1, pageSize: 100, type: 'CASHBACK' });
  const { body } = useSuperAppFonts();

  const totalCashback = (cashback.data?.items ?? []).reduce((sum, entry) => sum + entry.amount, 0);
  const hasMoreCashback = (cashback.data?.meta.totalPages ?? 1) > 1;

  const tier = loyalty.data
    ? {
        currentTierLabel: TIER_LABEL[loyalty.data.account.tier],
        nextTierLabel: loyalty.data.nextTier ? TIER_LABEL[loyalty.data.nextTier.tier] : null,
        // Real numbers only: lifetimePoints and the exact points still
        // needed for the next tier are both real; the percentage is a
        // defensible derived ratio (lifetime points reached / points
        // reached once the next tier unlocks), not a fabricated estimate —
        // the exact remaining-points figure is always shown alongside it.
        progressPercent: loyalty.data.nextTier
          ? (loyalty.data.account.lifetimePoints /
              (loyalty.data.account.lifetimePoints + loyalty.data.nextTier.pointsRequired)) *
            100
          : 100,
        remainingLabel: loyalty.data.nextTier
          ? `${loyalty.data.nextTier.pointsRequired.toLocaleString()} points more to reach ${TIER_LABEL[loyalty.data.nextTier.tier]}`
          : 'Highest tier reached',
      }
    : undefined;

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#0A1628' }}
    >
      <SuperAppWalletStatusBar />
      <SuperAppWalletScreenHeader title="Rewards" onBack={onBack} />

      <div className="flex-1 overflow-y-auto pb-6">
        <SuperAppWalletRewardsHero
          totalLabel={cashback.data ? `₦${totalCashback.toLocaleString()}` : '—'}
          subtitle={
            hasMoreCashback
              ? 'Already in your wallet balance (recent activity shown)'
              : 'Already in your wallet balance'
          }
          tier={tier}
        />
        {loyalty.isError ? (
          <p className={`px-4 pb-2 text-[12px] ${body}`} style={{ color: 'rgba(239,68,68,.7)' }}>
            Couldn&apos;t load your loyalty tier right now.
          </p>
        ) : null}

        <div className="px-4 pb-5">
          <SuperAppWalletSectionLabel>Cashback history</SuperAppWalletSectionLabel>
          <div className="mt-2.5">
            {cashback.isLoading ? (
              <p className={`text-[13px] ${body}`} style={{ color: 'rgba(255,255,255,.5)' }}>
                Loading…
              </p>
            ) : null}
            {cashback.isError ? (
              <p className={`text-[13px] ${body}`} style={{ color: '#EF4444' }}>
                Couldn&apos;t load your cashback history.{' '}
                <button
                  type="button"
                  onClick={() => {
                    void cashback.refetch();
                  }}
                  className="font-semibold underline"
                >
                  Retry
                </button>
              </p>
            ) : null}
            {!cashback.isLoading &&
            !cashback.isError &&
            (cashback.data?.items.length ?? 0) === 0 ? (
              <p className={`text-[13px] ${body}`} style={{ color: 'rgba(255,255,255,.5)' }}>
                No cashback yet — it lands here automatically from eligible rides and promotions.
              </p>
            ) : null}
            {cashback.data && cashback.data.items.length > 0 ? (
              <SuperAppWalletTransactionList>
                {cashback.data.items.map((entry) => (
                  <SuperAppWalletTransactionRow
                    key={entry.id}
                    icon="🎁"
                    iconColor="#F59E0B"
                    title={entry.description ?? 'Cashback reward'}
                    subtitle={new Date(entry.createdAt).toLocaleDateString('en-NG', {
                      month: 'short',
                      day: 'numeric',
                    })}
                    amountLabel={`+₦${entry.amount.toLocaleString()}`}
                    isCredit
                  />
                ))}
              </SuperAppWalletTransactionList>
            ) : null}
          </div>
        </div>

        <div className="px-4">
          <SuperAppWalletSectionLabel>Your referral code</SuperAppWalletSectionLabel>
          <div className="mt-2.5">
            {referral.data ? (
              <SuperAppWalletReferralCard
                code={referral.data.code}
                subtitle={
                  referralStats.data
                    ? `Share and your friend earns ₦${referralStats.data.refereeRewardAmount.toLocaleString()} when they sign up`
                    : 'Share with friends to earn rewards together'
                }
                copied={copied}
                onCopy={() => {
                  void navigator.clipboard.writeText(referral.data.code).then(() => {
                    setCopied(true);
                    setTimeout(() => {
                      setCopied(false);
                    }, 2000);
                  });
                }}
              />
            ) : referral.isError ? (
              <p className={`text-[13px] ${body}`} style={{ color: '#EF4444' }}>
                Couldn&apos;t load your referral code.{' '}
                <button
                  type="button"
                  onClick={() => {
                    void referral.refetch();
                  }}
                  className="font-semibold underline"
                >
                  Retry
                </button>
              </p>
            ) : (
              <p className={`text-[13px] ${body}`} style={{ color: 'rgba(255,255,255,.5)' }}>
                Loading your referral code…
              </p>
            )}
            {referralStats.data && referralStats.data.totalRedemptions > 0 ? (
              <p className={`mt-2 text-[12px] ${body}`} style={{ color: 'rgba(255,255,255,.5)' }}>
                {referralStats.data.rewardedRedemptions} of {referralStats.data.totalRedemptions}{' '}
                referrals rewarded so far.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
