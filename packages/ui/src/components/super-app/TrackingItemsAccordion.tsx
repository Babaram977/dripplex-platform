import * as React from 'react';

import { BORDER, G3, MUTED, NAVY_CARD } from '../../tokens/colors';

import { useSuperAppFonts } from './fonts';

export interface SuperAppTrackingOrderItem {
  id: string;
  name: string;
  imageUrl: string | null;
  quantity: number;
  lineTotalLabel: string;
}

/**
 * Collapsible ordered-items list, ported from the Tracking screen. Real
 * `OrderItemDto` has no variant-name snapshot (same gap as Cart), so the
 * per-item variant subtitle is dropped rather than invented.
 */
export function SuperAppTrackingItemsAccordion({
  items,
  totalLabel,
}: {
  items: SuperAppTrackingOrderItem[];
  totalLabel: string;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  const [open, setOpen] = React.useState(false);

  return (
    <div
      className="overflow-hidden rounded-2xl"
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
          <span className={`text-[13px] font-semibold text-white ${heading}`}>Ordered Items</span>
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
          {items.map((item, i) => (
            <div
              key={item.id}
              className="flex items-center gap-3 px-4 py-3"
              style={{ borderBottom: i < items.length - 1 ? `1px solid ${BORDER}` : 'none' }}
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl"
                style={{ background: 'rgba(255,255,255,.05)' }}
              >
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-lg">🛍️</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`truncate text-[13px] font-semibold text-white ${heading}`}>
                  {item.quantity > 1 ? <span style={{ color: G3 }}>{item.quantity}× </span> : null}
                  {item.name}
                </p>
              </div>
              <span className={`shrink-0 text-[13px] font-semibold text-white ${heading}`}>
                {item.lineTotalLabel}
              </span>
            </div>
          ))}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderTop: `1px solid ${BORDER}`, background: 'rgba(255,255,255,.02)' }}
          >
            <span className={`text-[12px] ${body}`} style={{ color: MUTED }}>
              Total paid
            </span>
            <span className={`text-[14px] font-bold ${heading}`} style={{ color: G3 }}>
              {totalLabel}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
