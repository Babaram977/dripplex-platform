import React from 'react';
import { G0, G2, G3, MUTED, NAVY_CARD, BORDER } from '../../tokens/colors';
import { FONT_HEADING, FONT_BODY, TYPE } from '../../tokens/typography';
import { ELEVATION } from '../../tokens/elevation';
import { VerifiedBadge, RatingBadge } from '../ui/States';

export interface Merchant {
  name: string;
  category: string;
  rating: number;
  distance: string;
  eta: string;
  deliveryFee: string;
  isOpen: boolean;
  isVerified: boolean;
  coverBg: string; // CSS gradient string
  emoji: string;
  tag: string;
  tagColor: string;
}

interface MerchantCardProps {
  merchant: Merchant;
  onPress?: () => void;
  style?: React.CSSProperties;
}

// Full-width merchant card used in Marketplace and Store listings
export function MerchantCard({ merchant: m, onPress, style }: MerchantCardProps) {
  return (
    <div
      onClick={onPress}
      className="overflow-hidden rounded-3xl transition-all active:scale-[.98]"
      style={{
        background: NAVY_CARD,
        border: `1.5px solid ${BORDER}`,
        boxShadow: ELEVATION.card,
        ...style,
      }}
    >
      {/* Cover image */}
      <div
        className="relative flex h-[88px] items-center justify-center"
        style={{ background: m.coverBg }}
      >
        <span style={{ fontSize: 44 }}>{m.emoji}</span>

        {/* Tag pill */}
        <div className="absolute left-3 top-3">
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              fontFamily: FONT_BODY,
              padding: '3px 8px',
              borderRadius: 8,
              background: m.tagColor + '22',
              color: m.tagColor,
              border: `1px solid ${m.tagColor}35`,
              backdropFilter: 'blur(4px)',
            }}
          >
            {m.tag}
          </span>
        </div>

        {/* Right badges */}
        <div className="absolute right-3 top-3 flex items-center gap-1.5">
          {!m.isOpen && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                fontFamily: FONT_BODY,
                padding: '3px 8px',
                borderRadius: 8,
                background: 'rgba(239,68,68,.2)',
                color: '#FCA5A5',
                border: '1px solid rgba(239,68,68,.25)',
              }}
            >
              Closed
            </span>
          )}
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              fontFamily: FONT_BODY,
              padding: '3px 8px',
              borderRadius: 8,
              background: 'rgba(0,0,0,.45)',
              color: '#FFF',
              backdropFilter: 'blur(6px)',
            }}
          >
            ⏱ {m.eta}
          </span>
        </div>
      </div>

      {/* Info row */}
      <div className="flex items-center gap-3 p-3.5">
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex items-center gap-2">
            <p
              style={{ fontSize: 13.5, fontWeight: 700, color: '#FFF', fontFamily: FONT_HEADING }}
              className="truncate"
            >
              {m.name}
            </p>
            {m.isVerified && <VerifiedBadge />}
          </div>
          <p style={{ fontSize: 10, color: MUTED, fontFamily: FONT_BODY, marginBottom: 6 }}>
            {m.category}
          </p>
          <div className="flex items-center gap-3">
            <span style={{ fontSize: 10, fontWeight: 700, color: '#FBBF24' }}>★ {m.rating}</span>
            <span style={{ fontSize: 10, color: MUTED, fontFamily: FONT_BODY }}>
              📍 {m.distance}
            </span>
            <span
              style={{
                fontSize: 10,
                color: m.deliveryFee === 'Free delivery' ? G3 : MUTED,
                fontFamily: FONT_BODY,
              }}
            >
              🚚 {m.deliveryFee}
            </span>
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onPress?.();
          }}
          className="h-9 flex-shrink-0 rounded-xl px-4 text-[11px] font-semibold transition-all active:scale-95"
          style={{
            background: m.isOpen ? `linear-gradient(135deg,${G0},${G2})` : 'rgba(255,255,255,.07)',
            color: m.isOpen ? '#FFF' : 'rgba(255,255,255,.3)',
            fontFamily: FONT_BODY,
            boxShadow: m.isOpen ? ELEVATION.brand : 'none',
          }}
        >
          {m.isOpen ? 'Visit Store' : 'Closed'}
        </button>
      </div>
    </div>
  );
}
