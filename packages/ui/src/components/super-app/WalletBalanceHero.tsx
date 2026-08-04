import * as React from 'react';

import { useSuperAppFonts } from './fonts';

const HERO_GRAD = 'linear-gradient(145deg,#0D2E1A 0%,#143D22 35%,#1A5230 65%,#0F2919 100%)';

export interface SuperAppWalletBadge {
  icon: string;
  label: string;
  tone: 'neutral' | 'success';
}

/**
 * Wallet's hero balance card — the stripe-pattern/dual-glow treatment is
 * specific to this screen (visually distinct from Home's Locked
 * `SuperAppBalanceCard`, which uses a different gradient and a grid-line
 * pattern), so it's a new component rather than a reuse. `badges` is
 * optional and empty by default — the real backend has no wallet PIN or
 * loyalty-tier concept today, so the real screen passes none rather than
 * hardcoding "PIN Protected"/"Gold Tier" text for capabilities that don't
 * exist; the prop exists so a future module that adds either can use it
 * without a redesign.
 */
export function SuperAppWalletBalanceHero({
  label = 'DrippleX Wallet Balance',
  amount,
  decimals,
  lastUpdatedLabel,
  badges = [],
}: {
  label?: string | undefined;
  amount: string;
  decimals?: string | undefined;
  lastUpdatedLabel?: string | undefined;
  badges?: SuperAppWalletBadge[] | undefined;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  return (
    <div
      className="relative mx-4 mt-2.5 overflow-hidden rounded-3xl"
      style={{
        background: HERO_GRAD,
        padding: '28px 24px 24px',
        boxShadow: '0 8px 40px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.08)',
      }}
    >
      <div
        className="pointer-events-none absolute -left-10 -top-10 h-[200px] w-[200px] rounded-full"
        style={{ background: 'radial-gradient(circle,#47CF72 0%,transparent 65%)', opacity: 0.12 }}
      />
      <div
        className="pointer-events-none absolute -bottom-[30px] -right-5 h-40 w-40 rounded-full"
        style={{ background: 'radial-gradient(circle,#2BAC52 0%,transparent 65%)', opacity: 0.1 }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          opacity: 0.04,
          backgroundImage:
            'repeating-linear-gradient(45deg,#fff 0,#fff 1px,transparent 0,transparent 50%)',
          backgroundSize: '12px 12px',
        }}
      />
      <div className="relative">
        <p
          className={`mb-2 text-[12px] font-medium uppercase tracking-wider ${body}`}
          style={{ color: 'rgba(255,255,255,.55)' }}
        >
          {label}
        </p>
        <p
          className={`mb-1 text-[42px] font-extrabold leading-[1.1] tracking-tight text-white ${heading}`}
        >
          {amount}
          {decimals ? (
            <span className="text-[24px] font-semibold opacity-70">{decimals}</span>
          ) : null}
        </p>
        {lastUpdatedLabel ? (
          <p className={`mb-4 text-[12px] ${body}`} style={{ color: 'rgba(255,255,255,.45)' }}>
            {lastUpdatedLabel}
          </p>
        ) : null}
        {badges.length > 0 ? (
          <div className="flex items-center gap-3">
            {badges.map((badge) => (
              <div
                key={badge.label}
                className="rounded-[10px] px-3 py-1.5"
                style={{
                  background:
                    badge.tone === 'success' ? 'rgba(43,172,82,.2)' : 'rgba(255,255,255,.1)',
                  border:
                    badge.tone === 'success'
                      ? '1px solid rgba(43,172,82,.3)'
                      : '1px solid rgba(255,255,255,.12)',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <span
                  className={`text-[11px] font-semibold ${body}`}
                  style={{ color: badge.tone === 'success' ? '#47CF72' : 'rgba(255,255,255,.8)' }}
                >
                  {badge.icon} {badge.label}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
