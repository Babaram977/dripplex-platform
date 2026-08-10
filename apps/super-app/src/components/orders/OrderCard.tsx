import React from 'react';
import {
  G3,
  MUTED,
  NAVY_CARD,
  BORDER,
  COLOR_SUCCESS,
  COLOR_WARNING,
  COLOR_ERROR,
} from '../../tokens/colors';
import { FONT_HEADING, FONT_BODY, TYPE } from '../../tokens/typography';
import { ELEVATION } from '../../tokens/elevation';

export type OrderStatus =
  'pending' | 'confirmed' | 'preparing' | 'on_the_way' | 'delivered' | 'cancelled';

export interface Order {
  id: string;
  storeName: string;
  storeEmoji: string;
  items: string[];
  total: string;
  status: OrderStatus;
  placedAt: string;
  eta?: string;
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: COLOR_WARNING, bg: 'rgba(245,158,11,.12)' },
  confirmed: { label: 'Confirmed', color: '#60A5FA', bg: 'rgba(96,165,250,.12)' },
  preparing: { label: 'Preparing', color: COLOR_WARNING, bg: 'rgba(245,158,11,.12)' },
  on_the_way: { label: 'On the way', color: G3, bg: 'rgba(43,172,82,.12)' },
  delivered: { label: 'Delivered', color: COLOR_SUCCESS, bg: 'rgba(16,185,129,.12)' },
  cancelled: { label: 'Cancelled', color: COLOR_ERROR, bg: 'rgba(239,68,68,.12)' },
};

interface OrderCardProps {
  order: Order;
  onPress?: () => void;
  onReorder?: () => void;
  onTrack?: () => void;
  style?: React.CSSProperties;
}

export function OrderCard({ order: o, onPress, onReorder, onTrack, style }: OrderCardProps) {
  const s = STATUS_CONFIG[o.status];
  const canTrack = ['confirmed', 'preparing', 'on_the_way'].includes(o.status);
  const canReorder = o.status === 'delivered';

  return (
    <div
      onClick={onPress}
      className="rounded-3xl p-4 transition-all active:scale-[.98]"
      style={{
        background: NAVY_CARD,
        border: `1.5px solid ${BORDER}`,
        boxShadow: ELEVATION.card,
        ...style,
      }}
    >
      {/* Store row */}
      <div className="mb-3 flex items-center gap-3">
        <div
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl text-[22px]"
          style={{ background: 'rgba(255,255,255,.06)' }}
        >
          {o.storeEmoji}
        </div>
        <div className="min-w-0 flex-1">
          <p
            className="truncate"
            style={{ fontSize: TYPE.md, fontWeight: 700, color: '#FFF', fontFamily: FONT_HEADING }}
          >
            {o.storeName}
          </p>
          <p style={{ fontSize: TYPE.xs, color: MUTED, fontFamily: FONT_BODY, marginTop: 2 }}>
            {o.items.slice(0, 2).join(', ')}
            {o.items.length > 2 ? ` +${o.items.length - 2} more` : ''}
          </p>
        </div>
        <div className="flex-shrink-0 rounded-lg px-2.5 py-1" style={{ background: s.bg }}>
          <p style={{ fontSize: 9.5, fontWeight: 700, color: s.color, fontFamily: FONT_BODY }}>
            {s.label}
          </p>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: BORDER, marginBottom: 12 }} />

      {/* Footer row */}
      <div className="flex items-center justify-between">
        <div>
          <p
            style={{ fontSize: TYPE.xl, fontWeight: 700, color: '#FFF', fontFamily: FONT_HEADING }}
          >
            {o.total}
          </p>
          <p style={{ fontSize: TYPE.xs, color: MUTED, fontFamily: FONT_BODY, marginTop: 2 }}>
            {o.eta ? `ETA ${o.eta}` : o.placedAt}
          </p>
        </div>
        <div className="flex gap-2">
          {canTrack && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTrack?.();
              }}
              className="h-9 rounded-xl px-4 text-[11px] font-semibold transition-all active:scale-95"
              style={{
                background: 'rgba(43,172,82,.15)',
                color: G3,
                border: '1px solid rgba(43,172,82,.25)',
                fontFamily: FONT_BODY,
              }}
            >
              Track
            </button>
          )}
          {canReorder && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onReorder?.();
              }}
              className="h-9 rounded-xl px-4 text-[11px] font-semibold transition-all active:scale-95"
              style={{
                background: 'linear-gradient(135deg,#176B30,#2BAC52)',
                color: '#FFF',
                fontFamily: FONT_BODY,
                boxShadow: ELEVATION.brand,
              }}
            >
              Reorder
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
