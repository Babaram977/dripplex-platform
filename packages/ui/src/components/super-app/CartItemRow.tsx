import { G3, MUTED } from '../../tokens/colors';

import { useSuperAppFonts } from './fonts';
import { SuperAppQuantityStepper } from './QuantityStepper';

export interface SuperAppCartItem {
  id: string;
  name: string;
  imageUrl: string | null;
  unitPriceLabel: string;
  quantity: number;
  lineTotalLabel: string;
}

/**
 * Cart line-item row, ported from `CartItemRow` in the locked Figma Make
 * Cart screen. The source also renders a discount/"New" badge, an
 * out-of-stock overlay, a "Price updated" notice, and per-item variant
 * text — none of which the real `CartItemDto` carries (no badge concept,
 * no live stock re-check on the cart response, no price-history, and no
 * variant name snapshot), so those are omitted rather than invented.
 */
export function SuperAppCartItemRow({
  item,
  onDecrement,
  onIncrement,
  onRemove,
  onSaveForLater,
}: {
  item: SuperAppCartItem;
  onDecrement?: (() => void) | undefined;
  onIncrement?: (() => void) | undefined;
  onRemove?: (() => void) | undefined;
  onSaveForLater?: (() => void) | undefined;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  return (
    <div className="flex items-start gap-3 px-4 py-4">
      <div
        className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl"
        style={{ background: 'rgba(255,255,255,.06)' }}
      >
        {item.imageUrl ? (
          <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span style={{ fontSize: 28, opacity: 0.3 }}>📦</span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-[14px] font-semibold leading-tight text-white ${heading}`}>
            {item.name}
          </p>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove item"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all active:scale-90"
            style={{ background: 'rgba(248,113,113,.1)', border: '1px solid rgba(248,113,113,.2)' }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#F87171"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className={`mt-0.5 text-[11px] ${body}`} style={{ color: MUTED }}>
          {item.unitPriceLabel} each
        </p>

        <div className="mt-2.5 flex items-center justify-between">
          <SuperAppQuantityStepper
            quantity={item.quantity}
            onDecrement={onDecrement}
            onIncrement={onIncrement}
            size="compact"
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onSaveForLater}
              className={`text-[11px] font-semibold transition-opacity active:opacity-60 ${body}`}
              style={{ color: G3 }}
            >
              Save
            </button>
            <span className={`text-[15px] font-bold text-white ${heading}`}>
              {item.lineTotalLabel}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
