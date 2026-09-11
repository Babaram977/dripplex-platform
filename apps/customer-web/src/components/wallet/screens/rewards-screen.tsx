'use client';

import {
  SuperAppWalletButton,
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

import type { LoyaltyPointsSummaryDto, LoyaltyTier } from '@dripplex/types';

import {
  useLoyaltyAccount,
  useRedeemLoyaltyPoints,
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
  const redeem = useRedeemLoyaltyPoints();
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
          <SuperAppWalletSectionLabel>DX points</SuperAppWalletSectionLabel>
          <div className="mt-2.5">
            {loyalty.data ? <DxPointsCard points={loyalty.data.points} redeem={redeem} /> : null}
            {loyalty.isLoading ? (
              <p className={`text-[13px] ${body}`} style={{ color: 'rgba(255,255,255,.5)' }}>
                Loading…
              </p>
            ) : null}
          </div>
        </div>

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

/**
 * What DX points are worth, and the button that makes them worth it.
 *
 * Points had no exit before this: redeeming burned them and paid nothing
 * anywhere in the platform. They now convert into wallet balance at the
 * founder-set rate, and the whole card is deliberately built out of figures the
 * backend computed — the rate, the redeemable amount, the expiry date and the
 * benefit thresholds all arrive in `GET /customer/loyalty`. Nothing here
 * recomputes them, so the app cannot quote a rate the backend would refuse or
 * offer a redemption it would reject.
 *
 * Redemption is whole naira only. Rather than let the customer discover that
 * through a validation error, the button redeems exactly `redeemablePoints` —
 * the largest amount the backend will accept — and the leftover is stated
 * plainly underneath.
 */
function DxPointsCard({
  points,
  redeem,
}: {
  points: LoyaltyPointsSummaryDto;
  redeem: ReturnType<typeof useRedeemLoyaltyPoints>;
}): React.JSX.Element {
  const { body, heading } = useSuperAppFonts();
  const canRedeem = points.redeemablePoints >= points.minimumRedeemablePoints;
  const leftover = points.balance - points.redeemablePoints;

  return (
    <div
      className="rounded-[16px] p-4"
      style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)' }}
    >
      <div className="flex items-end justify-between">
        <div>
          <p className={`text-[26px] font-semibold ${heading}`} style={{ color: '#fff' }}>
            {points.balance.toLocaleString()}
          </p>
          <p className={`text-[12px] ${body}`} style={{ color: 'rgba(255,255,255,.5)' }}>
            points · {points.pointsPerNaira} points = ₦1
          </p>
        </div>
        <p className={`text-[20px] font-semibold ${heading}`} style={{ color: '#2BAC52' }}>
          ₦{points.balanceValue.toLocaleString()}
        </p>
      </div>

      <div className="mt-3.5">
        <SuperAppWalletButton
          onClick={() => {
            redeem.mutate(points.redeemablePoints);
          }}
          disabled={!canRedeem || redeem.isPending}
          loading={redeem.isPending}
        >
          {canRedeem
            ? `Redeem ${points.redeemablePoints.toLocaleString()} points for ₦${points.balanceValue.toLocaleString()}`
            : `${(points.minimumRedeemablePoints - points.balance).toLocaleString()} points to your first ₦1`}
        </SuperAppWalletButton>
      </div>

      {canRedeem && leftover > 0 ? (
        <p className={`mt-2 text-[12px] ${body}`} style={{ color: 'rgba(255,255,255,.45)' }}>
          {leftover.toLocaleString()} points stay on your balance — redemptions are whole naira.
        </p>
      ) : null}

      {redeem.isError ? (
        <p className={`mt-2 text-[12px] ${body}`} style={{ color: '#EF4444' }}>
          {redeem.error.message || "Couldn't redeem your points just now."}
        </p>
      ) : null}

      {redeem.isSuccess ? (
        <p className={`mt-2 text-[12px] ${body}`} style={{ color: '#2BAC52' }}>
          ₦{redeem.data.amountCredited.toLocaleString()} added to your wallet.
        </p>
      ) : null}

      <div className="mt-3.5 space-y-1.5">
        <p className={`text-[12px] ${body}`} style={{ color: 'rgba(255,255,255,.5)' }}>
          {points.earnedThisMonth.toLocaleString()} points earned this month
          {points.benefits.monthlyElite.eligible
            ? ' — free-delivery rewards unlocked'
            : ` · ${points.benefits.monthlyElite.pointsToGo.toLocaleString()} more unlocks free-delivery rewards`}
        </p>
        <p className={`text-[12px] ${body}`} style={{ color: 'rgba(255,255,255,.5)' }}>
          {points.benefits.deliveryFeeDiscount.eligible
            ? 'Delivery-fee discounts unlocked on campaigns offering them'
            : `${points.benefits.deliveryFeeDiscount.pointsToGo.toLocaleString()} points to delivery-fee discounts`}
        </p>
        {points.nextExpiry ? (
          <p className={`text-[12px] ${body}`} style={{ color: 'rgba(255,255,255,.45)' }}>
            {points.nextExpiry.points.toLocaleString()} points expire on{' '}
            {new Date(points.nextExpiry.at).toLocaleDateString('en-NG', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}{' '}
            — points last 365 days.
          </p>
        ) : null}
      </div>
    </div>
  );
}
