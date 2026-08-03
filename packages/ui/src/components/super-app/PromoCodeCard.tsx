'use client';

import * as React from 'react';
import { useState } from 'react';

import { BORDER, G2, G3, MUTED, NAVY_CARD } from '../../tokens/colors';

import { useSuperAppFonts } from './fonts';

/**
 * Promo code entry, moved here from where the Figma source's Cart screen
 * had it — the real backend has no customer-facing "apply code to cart"
 * endpoint, but `POST /customer/checkout` accepts a real `couponCode`
 * and `POST /customer/promotions/validate` gives a live preview before
 * committing, so this is where the real feature actually lives.
 */
export function SuperAppPromoCodeCard({
  applied,
  discountLabel,
  errorMessage,
  onApply,
  onRemove,
}: {
  applied: boolean;
  discountLabel?: string | undefined;
  errorMessage?: string | undefined;
  onApply?: ((code: string) => void) | undefined;
  onRemove?: (() => void) | undefined;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  const [code, setCode] = useState('');

  return (
    <div
      className="mb-4 rounded-2xl p-4"
      style={{
        background: NAVY_CARD,
        border: `1px solid ${applied ? 'rgba(43,172,82,.35)' : BORDER}`,
      }}
    >
      <p
        className={`mb-2.5 text-[11px] font-semibold uppercase tracking-widest ${body}`}
        style={{ color: MUTED }}
      >
        Promo Code
      </p>

      {applied ? (
        <div
          className="flex items-center justify-between rounded-xl px-3 py-2.5"
          style={{ background: 'rgba(43,172,82,.1)', border: '1px solid rgba(43,172,82,.25)' }}
        >
          <div className="flex items-center gap-2">
            <span className="text-base">🎁</span>
            <div>
              <p className={`text-[12px] font-semibold text-white ${heading}`}>Code applied</p>
              {discountLabel ? (
                <p className={`text-[11px] ${body}`} style={{ color: G3 }}>
                  {discountLabel} discount
                </p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onRemove}
            className={`text-[11px] font-semibold ${body}`}
            style={{ color: MUTED }}
          >
            Remove
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
              }}
              placeholder="Enter promo code"
              className={`h-[40px] flex-1 rounded-xl px-3 text-[13px] text-white outline-none ${body}`}
              style={{
                background: 'rgba(255,255,255,.04)',
                border: `1.5px solid ${errorMessage ? 'rgba(248,113,113,.5)' : BORDER}`,
              }}
            />
            <button
              type="button"
              onClick={
                code && onApply
                  ? () => {
                      onApply(code);
                    }
                  : undefined
              }
              className={`h-[40px] rounded-xl px-4 text-[13px] font-semibold transition-all active:scale-95 ${heading}`}
              style={{
                background: code ? 'rgba(43,172,82,.14)' : 'rgba(255,255,255,.04)',
                border: `1.5px solid ${code ? G2 : BORDER}`,
                color: code ? G3 : MUTED,
              }}
            >
              Apply
            </button>
          </div>
          {errorMessage ? (
            <p className={`text-[11px] ${body}`} style={{ color: '#F87171' }}>
              {errorMessage}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
