'use client';

import * as React from 'react';
import { useState } from 'react';

import { BORDER, G2, MUTED, NAVY_CARD } from '../../tokens/colors';

import { SuperAppCartItemRow, type SuperAppCartItem } from './CartItemRow';
import { useSuperAppFonts } from './fonts';

/**
 * Collapsible per-merchant cart card, ported from `MerchantGroup` in the
 * locked Figma Make Cart screen. The source renders one of these per
 * merchant in the cart; the real backend only ever allows a single active
 * cart per customer scoped to one merchant (`CartMerchantConflictDomainException`
 * on cross-merchant add), so the real page composes exactly one instance
 * — this stays general because that's a real backend rule, not a UI
 * limitation. Drops the source's "cashback"/"closed" merchant badges,
 * which have no real data source on `CartDto`.
 */
export function SuperAppCartMerchantGroup({
  merchantName,
  items,
  subtotalLabel,
  deliveryFeeLabel,
  onDecrementItem,
  onIncrementItem,
  onRemoveItem,
  onSaveItemForLater,
}: {
  merchantName: string;
  items: SuperAppCartItem[];
  subtotalLabel: string;
  deliveryFeeLabel: string;
  onDecrementItem?: ((itemId: string) => void) | undefined;
  onIncrementItem?: ((itemId: string) => void) | undefined;
  onRemoveItem?: ((itemId: string) => void) | undefined;
  onSaveItemForLater?: ((itemId: string) => void) | undefined;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className="mb-4 overflow-hidden rounded-3xl"
      style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
    >
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
        onClick={() => {
          setCollapsed((v) => !v);
        }}
      >
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{ background: G2 }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <span className={`text-[14px] font-semibold text-white ${heading}`}>{merchantName}</span>
          <p className={`text-[11px] ${body}`} style={{ color: MUTED }}>
            {items.length} item{items.length === 1 ? '' : 's'}
          </p>
        </div>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke={MUTED}
          strokeWidth="2"
          strokeLinecap="round"
          style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform .25s' }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {!collapsed ? (
        <>
          <div style={{ borderTop: `1px solid ${BORDER}` }}>
            {items.map((item, i) => (
              <div key={item.id}>
                <SuperAppCartItemRow
                  item={item}
                  onDecrement={
                    onDecrementItem
                      ? () => {
                          onDecrementItem(item.id);
                        }
                      : undefined
                  }
                  onIncrement={
                    onIncrementItem
                      ? () => {
                          onIncrementItem(item.id);
                        }
                      : undefined
                  }
                  onRemove={
                    onRemoveItem
                      ? () => {
                          onRemoveItem(item.id);
                        }
                      : undefined
                  }
                  onSaveForLater={
                    onSaveItemForLater
                      ? () => {
                          onSaveItemForLater(item.id);
                        }
                      : undefined
                  }
                />
                {i < items.length - 1 ? (
                  <div className="mx-4 h-px" style={{ background: BORDER }} />
                ) : null}
              </div>
            ))}
          </div>

          <div
            className="flex flex-col gap-1.5 px-4 py-3"
            style={{ borderTop: `1px solid ${BORDER}`, background: 'rgba(255,255,255,.02)' }}
          >
            <div className={`flex items-center justify-between text-[12px] ${body}`}>
              <span style={{ color: MUTED }}>Subtotal</span>
              <span className="font-medium text-white">{subtotalLabel}</span>
            </div>
            <div className={`flex items-center justify-between text-[12px] ${body}`}>
              <span style={{ color: MUTED }}>Delivery</span>
              <span style={{ color: 'rgba(255,255,255,.7)' }}>{deliveryFeeLabel}</span>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
