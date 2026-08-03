'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';

import { useSuperAppFonts } from './fonts';

export interface SuperAppPromo {
  key: string;
  background: string;
  icon: string;
  title: string;
  subtitle: string;
  cta: string;
}

/** Auto-rotating promo banner, ported from Home's `PromoCarousel`. */
export function SuperAppPromoCarousel({
  promos,
  intervalMs = 4800,
  onCta,
}: {
  promos: SuperAppPromo[];
  intervalMs?: number | undefined;
  onCta?: ((promo: SuperAppPromo) => void) | undefined;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  const [i, setI] = useState(0);
  const [fade, setFade] = useState(false);

  useEffect(() => {
    const t = setInterval(() => {
      setFade(true);
      setTimeout(() => {
        setI((n) => (n + 1) % promos.length);
        setFade(false);
      }, 200);
    }, intervalMs);
    return () => {
      clearInterval(t);
    };
  }, [promos.length, intervalMs]);

  const p = promos[i] ?? { key: '', background: '', icon: '', title: '', subtitle: '', cta: '' };
  return (
    <div className="mx-5 mb-5">
      <div
        className="relative overflow-hidden rounded-3xl p-5 transition-opacity duration-200"
        style={{
          background: p.background,
          minHeight: 116,
          boxShadow: '0 12px 40px rgba(0,0,0,.38)',
          opacity: fade ? 0 : 1,
        }}
      >
        <div
          className="absolute right-5 top-1/2 -translate-y-1/2 text-[64px]"
          style={{ opacity: 0.1 }}
        >
          {p.icon}
        </div>
        <div className="relative z-10 flex items-center gap-4">
          <div
            className="flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded-2xl"
            style={{ background: 'rgba(255,255,255,.14)', backdropFilter: 'blur(12px)' }}
          >
            <span style={{ fontSize: 26 }}>{p.icon}</span>
          </div>
          <div className="flex-1">
            <p className={`mb-0.5 text-[17px] font-bold ${heading}`} style={{ color: '#FFF' }}>
              {p.title}
            </p>
            <p className={`mb-3 text-[11px] ${body}`} style={{ color: 'rgba(255,255,255,.68)' }}>
              {p.subtitle}
            </p>
            <button
              type="button"
              onClick={
                onCta
                  ? () => {
                      onCta(p);
                    }
                  : undefined
              }
              className={`rounded-xl px-4 py-1.5 text-[11px] font-bold ${body}`}
              style={{
                background: 'rgba(255,255,255,.2)',
                color: '#FFF',
                backdropFilter: 'blur(8px)',
              }}
            >
              {p.cta} →
            </button>
          </div>
        </div>
        <div className="mt-4 flex gap-1.5">
          {promos.map((promo, j) => (
            <div
              key={promo.key}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: j === i ? 24 : 6,
                background: j === i ? '#FFF' : 'rgba(255,255,255,.28)',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
