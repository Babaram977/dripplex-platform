'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';

import { useSuperAppFonts } from './fonts';

export interface SuperAppDeal {
  key: string;
  background: string;
  icon: string;
  title: string;
  subtitle: string;
  cta: string;
}

/**
 * Marketplace's "Today's Deals" auto-rotating banner, ported from
 * `TodaysDeals` in the locked Figma Make Marketplace screen. Close to
 * `SuperAppPromoCarousel` (Home's) but not identical — dot indicators are
 * clickable, a radial highlight overlay, and different sizing (108px
 * min-height / 62px icon vs Home's 116px / 64px) — so it's kept as its
 * own component rather than parameterizing the Locked one.
 */
export function SuperAppDealsCarousel({
  deals,
  intervalMs = 5000,
  onCta,
}: {
  deals: SuperAppDeal[];
  intervalMs?: number | undefined;
  onCta?: ((deal: SuperAppDeal) => void) | undefined;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  const [i, setI] = useState(0);
  const [fade, setFade] = useState(false);

  useEffect(() => {
    const t = setInterval(() => {
      setFade(true);
      setTimeout(() => {
        setI((n) => (n + 1) % deals.length);
        setFade(false);
      }, 200);
    }, intervalMs);
    return () => {
      clearInterval(t);
    };
  }, [deals.length, intervalMs]);

  const d = deals[i] ?? { key: '', background: '', icon: '', title: '', subtitle: '', cta: '' };
  return (
    <div className="mx-5 mb-5">
      <div
        className="relative overflow-hidden rounded-3xl p-5"
        style={{
          background: d.background,
          minHeight: 108,
          boxShadow: '0 12px 40px rgba(0,0,0,.38)',
          transition: 'opacity .2s ease',
          opacity: fade ? 0 : 1,
        }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle at 78% 50%,rgba(255,255,255,.09) 0%,transparent 50%)',
          }}
        />
        <div
          className="absolute right-4 top-1/2 -translate-y-1/2 text-[62px]"
          style={{ opacity: 0.1 }}
        >
          {d.icon}
        </div>

        <div className="relative z-10 flex items-center gap-3.5">
          <div
            className="flex h-[50px] w-[50px] flex-shrink-0 items-center justify-center rounded-2xl"
            style={{ background: 'rgba(255,255,255,.14)', backdropFilter: 'blur(12px)' }}
          >
            <span style={{ fontSize: 25 }}>{d.icon}</span>
          </div>
          <div className="flex-1">
            <p className={`mb-0.5 text-[16px] font-bold ${heading}`} style={{ color: '#FFF' }}>
              {d.title}
            </p>
            <p className={`mb-3 text-[11px] ${body}`} style={{ color: 'rgba(255,255,255,.65)' }}>
              {d.subtitle}
            </p>
            <button
              type="button"
              onClick={
                onCta
                  ? () => {
                      onCta(d);
                    }
                  : undefined
              }
              className={`rounded-xl px-4 py-1.5 text-[11px] font-bold transition-all active:scale-95 ${body}`}
              style={{
                background: 'rgba(255,255,255,.2)',
                color: '#FFF',
                backdropFilter: 'blur(8px)',
              }}
            >
              {d.cta} →
            </button>
          </div>
        </div>
        <div className="mt-4 flex gap-1.5">
          {deals.map((deal, j) => (
            <button
              key={deal.key}
              type="button"
              onClick={() => {
                setI(j);
              }}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: j === i ? 22 : 6,
                background: j === i ? '#FFF' : 'rgba(255,255,255,.28)',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
