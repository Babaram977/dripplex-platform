import React, { useState, useEffect } from 'react';
import { FONT_HEADING, FONT_BODY, TYPE } from '../../tokens/typography';
import { DURATION } from '../../tokens/animations';

export interface PromoBanner {
  background: string; // CSS gradient
  icon: string;
  title: string;
  subtitle: string;
  cta: string;
}

interface PromotionCarouselProps {
  banners: PromoBanner[];
  intervalMs?: number;
  style?: React.CSSProperties;
  onCtaPress?: (banner: PromoBanner, index: number) => void;
}

export function PromotionCarousel({
  banners,
  intervalMs = DURATION.carousel,
  style,
  onCtaPress,
}: PromotionCarouselProps) {
  const [idx, setIdx] = useState(0);
  const [fade, setFade] = useState(false);

  useEffect(() => {
    if (banners.length <= 1) return;
    const t = setInterval(() => {
      setFade(true);
      setTimeout(() => {
        setIdx((n) => (n + 1) % banners.length);
        setFade(false);
      }, 200);
    }, intervalMs);
    return () => clearInterval(t);
  }, [banners.length, intervalMs]);

  const b = banners[idx];

  return (
    <div style={{ paddingLeft: 20, paddingRight: 20, ...style }}>
      <div
        className="relative overflow-hidden rounded-3xl p-5"
        style={{
          background: b.background,
          minHeight: 108,
          boxShadow: '0 12px 40px rgba(0,0,0,.38)',
          transition: 'opacity .2s ease',
          opacity: fade ? 0 : 1,
        }}
      >
        {/* Glare overlay */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle at 78% 50%,rgba(255,255,255,.09) 0%,transparent 50%)',
          }}
        />
        {/* Big emoji shadow */}
        <div
          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2"
          style={{ fontSize: 62, opacity: 0.1 }}
        >
          {b.icon}
        </div>

        <div className="relative z-10 flex items-center gap-3.5">
          <div
            className="flex h-[50px] w-[50px] flex-shrink-0 items-center justify-center rounded-2xl"
            style={{ background: 'rgba(255,255,255,.14)', backdropFilter: 'blur(12px)' }}
          >
            <span style={{ fontSize: 25 }}>{b.icon}</span>
          </div>
          <div className="flex-1">
            <p
              style={{
                fontSize: 16,
                fontWeight: 700,
                fontFamily: FONT_HEADING,
                color: '#FFF',
                marginBottom: 2,
              }}
            >
              {b.title}
            </p>
            <p
              style={{
                fontSize: 11,
                fontFamily: FONT_BODY,
                color: 'rgba(255,255,255,.65)',
                marginBottom: 12,
              }}
            >
              {b.subtitle}
            </p>
            <button
              onClick={() => onCtaPress?.(b, idx)}
              className="rounded-xl px-4 py-1.5 text-[11px] font-bold transition-all active:scale-95"
              style={{
                background: 'rgba(255,255,255,.2)',
                color: '#FFF',
                backdropFilter: 'blur(8px)',
                fontFamily: FONT_BODY,
              }}
            >
              {b.cta} →
            </button>
          </div>
        </div>

        {/* Dot indicators */}
        <div className="mt-4 flex gap-1.5">
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: i === idx ? 22 : 6,
                background: i === idx ? '#FFF' : 'rgba(255,255,255,.28)',
              }}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
