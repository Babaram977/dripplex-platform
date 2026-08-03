'use client';

import * as React from 'react';
import { useState } from 'react';

import { BORDER, G2, G3, MUTED, NAVY_CARD } from '../../tokens/colors';

import { useSuperAppFonts } from './fonts';

export type SuperAppFulfillmentType = 'DELIVERY' | 'PICKUP';

/**
 * Collapsible merchant order card with a fulfillment-type toggle and a
 * delivery note, ported from `MerchantCard` in the locked Figma Make
 * Checkout screen. The source offers three delivery speeds
 * (Standard/Express/Pickup) and a "Deliver Now / Schedule" toggle — the
 * real checkout only supports `DELIVERY`/`PICKUP`
 * (`CheckoutFulfillmentType`), with no express tier and no scheduled-time
 * parameter, so both are trimmed to what's real.
 */
export function SuperAppCheckoutMerchantCard({
  merchantName,
  itemCount,
  subtotalLabel,
  fulfillmentType,
  deliveryFeeLabel,
  note,
  onFulfillmentType,
  onNoteChange,
}: {
  merchantName: string;
  itemCount: number;
  subtotalLabel: string;
  fulfillmentType: SuperAppFulfillmentType;
  deliveryFeeLabel: string;
  note: string;
  onFulfillmentType?: ((type: SuperAppFulfillmentType) => void) | undefined;
  onNoteChange?: ((note: string) => void) | undefined;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  const [open, setOpen] = useState(true);

  return (
    <div
      className="overflow-hidden rounded-2xl"
      style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
    >
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
        onClick={() => {
          setOpen((v) => !v);
        }}
      >
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
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
            {itemCount} item{itemCount === 1 ? '' : 's'} · {subtotalLabel}
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
          style={{
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform .25s',
            flexShrink: 0,
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open ? (
        <div className="flex flex-col gap-3 px-4 pb-4" style={{ borderTop: `1px solid ${BORDER}` }}>
          <div className="flex gap-2 pt-3">
            {[
              { key: 'DELIVERY' as const, label: 'Delivery', icon: '🚚', sub: deliveryFeeLabel },
              { key: 'PICKUP' as const, label: 'Pickup', icon: '🏪', sub: 'Free' },
            ].map((opt) => {
              const selected = fulfillmentType === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={
                    onFulfillmentType
                      ? () => {
                          onFulfillmentType(opt.key);
                        }
                      : undefined
                  }
                  className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2.5 transition-all active:scale-95 ${body}`}
                  style={{
                    background: selected ? 'rgba(43,172,82,.14)' : 'rgba(255,255,255,.04)',
                    border: `1.5px solid ${selected ? G2 : BORDER}`,
                  }}
                >
                  <span className="text-base">{opt.icon}</span>
                  <span
                    className="text-[11px] font-semibold"
                    style={{ color: selected ? G3 : 'rgba(255,255,255,.65)' }}
                  >
                    {opt.label}
                  </span>
                  <span className="text-[10px]" style={{ color: selected ? G3 : MUTED }}>
                    {opt.sub}
                  </span>
                </button>
              );
            })}
          </div>

          <textarea
            value={note}
            onChange={
              onNoteChange
                ? (e) => {
                    onNoteChange(e.target.value);
                  }
                : undefined
            }
            placeholder="Add a delivery note (optional)"
            rows={2}
            className={`resize-none rounded-xl px-3 py-2 text-[12px] text-white outline-none ${body}`}
            style={{ background: 'rgba(255,255,255,.04)', border: `1px solid ${BORDER}` }}
          />
        </div>
      ) : null}
    </div>
  );
}
