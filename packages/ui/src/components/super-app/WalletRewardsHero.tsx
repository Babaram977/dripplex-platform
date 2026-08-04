import * as React from 'react';

import { useSuperAppFonts } from './fonts';

export interface SuperAppWalletTierProgress {
  currentTierLabel: string;
  nextTierLabel: string | null;
  /** 0-100. Omitted (no bar rendered) when there's no next tier. */
  progressPercent: number;
  remainingLabel: string | null;
}

/**
 * Cashback hero + optional tier-progress card. Visually distinct from
 * `SuperAppWalletBalanceHero` (olive-green gradient + single top-right
 * glow vs the balance hero's dual-glow deep-green treatment) — the Figma
 * Rewards source uses its own gradient, not the wallet balance one.
 */
export function SuperAppWalletRewardsHero({
  totalLabel,
  subtitle,
  tier,
}: {
  totalLabel: string;
  subtitle: string;
  tier?: SuperAppWalletTierProgress | undefined;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  return (
    <div
      className="relative mx-4 mb-5 overflow-hidden rounded-[22px] p-[24px_22px]"
      style={{
        background: 'linear-gradient(145deg,#1A3A0D,#24582A,#1E4A22)',
        boxShadow: '0 6px 30px rgba(0,0,0,.4)',
      }}
    >
      <div
        className="pointer-events-none absolute rounded-full"
        style={{
          top: -30,
          right: -30,
          width: 140,
          height: 140,
          background: 'radial-gradient(circle,#47CF72 0%,transparent 70%)',
          opacity: 0.15,
        }}
      />
      <p
        className={`mb-1.5 text-[12px] font-medium uppercase tracking-wider ${body}`}
        style={{ color: 'rgba(255,255,255,.55)' }}
      >
        Total Cashback Earned
      </p>
      <p className={`mb-0.5 text-[38px] font-extrabold text-white ${heading}`}>{totalLabel}</p>
      <p className={`text-[13px] ${body}`} style={{ color: 'rgba(255,255,255,.45)' }}>
        {subtitle}
      </p>

      {tier ? (
        <div className="mt-5 rounded-xl p-[14px_16px]" style={{ background: 'rgba(0,0,0,.2)' }}>
          <div className="mb-2 flex items-center justify-between">
            <div>
              <span className={`text-[13px] font-bold ${heading}`} style={{ color: '#FBBF24' }}>
                ✦ {tier.currentTierLabel}
              </span>
              {tier.nextTierLabel ? (
                <span
                  className={`ml-1.5 text-[12px] ${body}`}
                  style={{ color: 'rgba(255,255,255,.5)' }}
                >
                  → {tier.nextTierLabel}
                </span>
              ) : null}
            </div>
            {tier.nextTierLabel ? (
              <span className={`text-[12px] ${body}`} style={{ color: 'rgba(255,255,255,.5)' }}>
                {Math.round(tier.progressPercent)}%
              </span>
            ) : null}
          </div>
          {tier.nextTierLabel ? (
            <div
              className="h-1.5 overflow-hidden rounded-full"
              style={{ background: 'rgba(255,255,255,.1)' }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${String(Math.min(100, Math.max(0, tier.progressPercent)))}%`,
                  background: 'linear-gradient(90deg,#176B30,#47CF72)',
                }}
              />
            </div>
          ) : null}
          {tier.remainingLabel ? (
            <p className={`mt-1.5 text-[11px] ${body}`} style={{ color: 'rgba(255,255,255,.5)' }}>
              {tier.remainingLabel}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
