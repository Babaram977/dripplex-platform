'use client';

import * as React from 'react';
import { useState } from 'react';

import { BORDER, G0, G2, G3, MUTED, NAVY_CARD } from '../../tokens/colors';

import { useSuperAppFonts } from './fonts';

export interface SuperAppProduct {
  key: string;
  emoji: string;
  name: string;
  price: string;
  wasPrice: string;
  rating: number;
  store: string;
  badge: string;
  badgeColor: string;
}

/**
 * "Trending Products" card (cover, discount badge, wishlist heart, price,
 * Add to Cart), ported from `TrendingProducts` in the locked Figma Make
 * Marketplace screen. Source tracks wishlist state as a `Set<index>` on
 * the parent list; here each card owns its own toggle state instead
 * (same visible behavior, simpler than index bookkeeping for a reusable
 * card meant to be used outside that one list too).
 */
export function SuperAppProductCard({
  product,
  onAddToCart,
}: {
  product: SuperAppProduct;
  onAddToCart?: (() => void) | undefined;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  const [wishlisted, setWishlisted] = useState(false);

  return (
    <div
      className="flex-shrink-0 overflow-hidden rounded-3xl"
      style={{ width: 145, background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
    >
      <div
        className="relative flex h-[82px] items-center justify-center"
        style={{ background: 'linear-gradient(135deg,#0D1B2E,#1A2E45)' }}
      >
        <span style={{ fontSize: 42 }}>{product.emoji}</span>
        <div
          className={`absolute left-2 top-2 rounded-lg px-2 py-0.5 text-[9px] font-bold ${body}`}
          style={{ background: product.badgeColor, color: '#FFF' }}
        >
          {product.badge}
        </div>
        <button
          type="button"
          onClick={() => {
            setWishlisted((w) => !w);
          }}
          aria-label="Toggle wishlist"
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-xl transition-all active:scale-90"
          style={{ background: wishlisted ? 'rgba(239,68,68,.18)' : 'rgba(0,0,0,.35)' }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill={wishlisted ? '#F87171' : 'none'}
            stroke={wishlisted ? '#F87171' : 'rgba(255,255,255,.6)'}
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
          </svg>
        </button>
      </div>
      <div className="p-3">
        <p
          className={`mb-0.5 truncate text-[11.5px] font-bold leading-tight ${heading}`}
          style={{ color: '#FFF' }}
        >
          {product.name}
        </p>
        <p className={`mb-1.5 text-[9.5px] ${body}`} style={{ color: MUTED }}>
          {product.store}
        </p>
        <div className="mb-1 flex items-center gap-1.5">
          <span className="text-[9.5px] font-bold" style={{ color: '#FBBF24' }}>
            ★ {product.rating}
          </span>
        </div>
        <p className={`mb-0.5 text-[10px] line-through ${body}`} style={{ color: MUTED }}>
          {product.wasPrice}
        </p>
        <p className={`mb-2.5 text-[13px] font-bold ${heading}`} style={{ color: G3 }}>
          {product.price}
        </p>
        <button
          type="button"
          onClick={onAddToCart}
          className={`h-[28px] w-full rounded-xl text-[10px] font-semibold transition-all active:scale-95 ${body}`}
          style={{
            background: `linear-gradient(135deg,${G0},${G2})`,
            color: '#FFF',
            boxShadow: '0 3px 10px rgba(43,172,82,.22)',
          }}
        >
          Add to Cart
        </button>
      </div>
    </div>
  );
}
