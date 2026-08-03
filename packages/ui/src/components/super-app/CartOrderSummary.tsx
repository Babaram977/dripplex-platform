import { BORDER, G3, MUTED, NAVY_CARD } from '../../tokens/colors';

import { useSuperAppFonts } from './fonts';

/**
 * Order summary card, ported from the "Order Summary" block in the
 * locked Figma Make Cart screen. The source's rows for a typed promo
 * code, wallet-applied amount, and cashback have no real backend
 * equivalent (see `SuperAppCartMerchantGroup`) and are dropped; a real
 * `tax` row (present on `CartTotalsDto`, absent from the source's mock)
 * is added instead, since hiding a real charge would be dishonest.
 */
export function SuperAppCartOrderSummary({
  title = 'Order Summary',
  itemsTotalLabel,
  deliveryFeeLabel,
  discountLabel,
  taxLabel,
  totalLabel = 'Grand Total',
  grandTotalLabel,
}: {
  title?: string | undefined;
  itemsTotalLabel: string;
  deliveryFeeLabel: string;
  discountLabel?: string | undefined;
  taxLabel: string;
  totalLabel?: string | undefined;
  grandTotalLabel: string;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  const rows: { label: string; value: string; color: string }[] = [
    { label: 'Items Total', value: itemsTotalLabel, color: 'rgba(255,255,255,.8)' },
    { label: 'Delivery Fees', value: deliveryFeeLabel, color: 'rgba(255,255,255,.7)' },
    ...(discountLabel ? [{ label: 'Discount', value: discountLabel, color: G3 }] : []),
    { label: 'Tax', value: taxLabel, color: 'rgba(255,255,255,.7)' },
  ];

  return (
    <div
      className="mb-4 rounded-2xl p-4"
      style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
    >
      <p
        className={`mb-3 text-[12px] font-semibold uppercase tracking-widest ${body}`}
        style={{ color: MUTED }}
      >
        {title}
      </p>
      <div className="flex flex-col gap-2.5">
        {rows.map((row) => (
          <div key={row.label} className={`flex items-center justify-between ${body}`}>
            <span className="text-[13px]" style={{ color: MUTED }}>
              {row.label}
            </span>
            <span className="text-[13px] font-medium" style={{ color: row.color }}>
              {row.value}
            </span>
          </div>
        ))}
        <div className="my-1 h-px" style={{ background: BORDER }} />
        <div className="flex items-center justify-between">
          <span className={`text-[15px] font-semibold text-white ${heading}`}>{totalLabel}</span>
          <span className={`text-[18px] font-bold text-white ${heading}`}>{grandTotalLabel}</span>
        </div>
      </div>
    </div>
  );
}
