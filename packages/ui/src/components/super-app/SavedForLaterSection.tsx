'use client';

import * as React from 'react';
import { useState } from 'react';

import { BORDER, G3, MUTED, NAVY_CARD } from '../../tokens/colors';

import { useSuperAppFonts } from './fonts';

export interface SuperAppSavedForLaterItem {
  id: string;
  name: string;
  imageUrl: string | null;
  priceLabel: string;
}

/**
 * "Saved for Later" collapsible section, ported from the Cart screen's
 * saved-items block. Real data: "Save" on a cart line item removes it
 * from the cart and adds it to the customer's wishlist; this section
 * lists wishlist items with an "Add to Cart" action to move them back.
 */
export function SuperAppSavedForLaterSection({
  items,
  onMoveToCart,
}: {
  items: SuperAppSavedForLaterItem[];
  onMoveToCart?: ((itemId: string) => void) | undefined;
}): React.JSX.Element | null {
  const { heading, body } = useSuperAppFonts();
  const [open, setOpen] = useState(false);

  if (items.length === 0) {
    return null;
  }

  return (
    <div
      className="mb-4 overflow-hidden rounded-2xl"
      style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
    >
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3.5"
        onClick={() => {
          setOpen((v) => !v);
        }}
      >
        <div className="flex items-center gap-2">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke={MUTED}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
          </svg>
          <span className={`text-[13px] font-semibold text-white ${heading}`}>Saved for Later</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${body}`}
            style={{ background: 'rgba(255,255,255,.08)', color: MUTED }}
          >
            {items.length}
          </span>
        </div>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke={MUTED}
          strokeWidth="2"
          strokeLinecap="round"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .25s' }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open ? (
        <div style={{ borderTop: `1px solid ${BORDER}` }}>
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 px-4 py-3"
              style={{ borderBottom: `1px solid ${BORDER}` }}
            >
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl"
                style={{ background: 'rgba(255,255,255,.06)' }}
              >
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span style={{ fontSize: 20, opacity: 0.3 }}>📦</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`truncate text-[13px] font-semibold text-white ${heading}`}>
                  {item.name}
                </p>
                <p className={`text-[12px] ${body}`} style={{ color: G3 }}>
                  {item.priceLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={
                  onMoveToCart
                    ? () => {
                        onMoveToCart(item.id);
                      }
                    : undefined
                }
                className={`h-8 rounded-xl px-3 text-[12px] font-semibold transition-all active:scale-95 ${body}`}
                style={{
                  background: 'rgba(43,172,82,.14)',
                  border: '1px solid rgba(43,172,82,.28)',
                  color: G3,
                }}
              >
                Add to Cart
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
