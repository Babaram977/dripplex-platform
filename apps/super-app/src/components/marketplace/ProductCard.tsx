import React, { useState } from 'react';
import { G0, G2, G3, MUTED, NAVY_CARD, BORDER } from '../../tokens/colors';
import { FONT_HEADING, FONT_BODY, TYPE } from '../../tokens/typography';
import { ELEVATION } from '../../tokens/elevation';

export interface Product {
  name: string;
  price: string;
  originalPrice?: string;
  emoji: string;
  rating: number;
  storeName: string;
  badge?: string;
  badgeColor?: string;
  soldCount?: number;
}

interface ProductCardProps {
  product: Product;
  onPress?: () => void;
  onAddCart?: () => void;
  width?: number;
  style?: React.CSSProperties;
}

export function ProductCard({
  product: p,
  onPress,
  onAddCart,
  width = 145,
  style,
}: ProductCardProps) {
  const [wishlisted, setWishlisted] = useState(false);

  return (
    <div
      onClick={onPress}
      className="flex-shrink-0 overflow-hidden rounded-3xl transition-all active:scale-[.98]"
      style={{ width, background: NAVY_CARD, border: `1.5px solid ${BORDER}`, ...style }}
    >
      {/* Cover */}
      <div
        className="relative flex items-center justify-center"
        style={{ height: 82, background: 'linear-gradient(135deg,#0D1B2E,#1A2E45)' }}
      >
        <span style={{ fontSize: 42 }}>{p.emoji}</span>

        {p.badge && (
          <div
            className="absolute left-2 top-2 rounded-lg px-2 py-0.5 text-[9px] font-bold"
            style={{ background: p.badgeColor ?? '#EF4444', color: '#FFF', fontFamily: FONT_BODY }}
          >
            {p.badge}
          </div>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            setWishlisted((w) => !w);
          }}
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-xl transition-all active:scale-90"
          style={{ background: wishlisted ? 'rgba(239,68,68,.18)' : 'rgba(0,0,0,.35)' }}
          aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
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

      {/* Info */}
      <div style={{ padding: '10px 12px 12px' }}>
        <p
          className="truncate"
          style={{
            fontSize: 11.5,
            fontWeight: 700,
            color: '#FFF',
            fontFamily: FONT_HEADING,
            marginBottom: 2,
          }}
        >
          {p.name}
        </p>
        <p
          className="truncate"
          style={{ fontSize: 9.5, color: MUTED, fontFamily: FONT_BODY, marginBottom: 4 }}
        >
          {p.storeName}
        </p>
        <div className="flex items-center gap-1.5" style={{ marginBottom: 4 }}>
          <span style={{ fontSize: 9.5, fontWeight: 700, color: '#FBBF24' }}>★ {p.rating}</span>
          {p.soldCount !== undefined && (
            <span style={{ fontSize: 9, color: MUTED, fontFamily: FONT_BODY }}>
              {p.soldCount}+ sold
            </span>
          )}
        </div>
        {p.originalPrice && (
          <p
            style={{
              fontSize: 10,
              textDecoration: 'line-through',
              color: MUTED,
              fontFamily: FONT_BODY,
              marginBottom: 2,
            }}
          >
            {p.originalPrice}
          </p>
        )}
        <p
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: G3,
            fontFamily: FONT_HEADING,
            marginBottom: 10,
          }}
        >
          {p.price}
        </p>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddCart?.();
          }}
          className="h-[28px] w-full rounded-xl text-[10px] font-semibold transition-all active:scale-95"
          style={{
            background: `linear-gradient(135deg,${G0},${G2})`,
            color: '#FFF',
            fontFamily: FONT_BODY,
            boxShadow: ELEVATION.brand,
          }}
        >
          Add to Cart
        </button>
      </div>
    </div>
  );
}
