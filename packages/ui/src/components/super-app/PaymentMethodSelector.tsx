import { BORDER, G2, G3, MUTED, NAVY_CARD } from '../../tokens/colors';

import { useSuperAppFonts } from './fonts';

export interface SuperAppPaymentMethodOption {
  key: string;
  icon: string;
  label: string;
  sublabel: string;
  disabled?: boolean;
}

/**
 * Payment method list, ported from the Checkout screen's "Payment
 * Method" section. Populated with the platform's real methods — the three
 * gateways (Paystack, Flutterwave, OPay), Dx Wallet balance, and Cash on
 * Delivery (delivery orders only) — matching the source's four abstract
 * categories one-for-one rather than the earlier three-gateway-only cut.
 * `disabled` (e.g. insufficient wallet balance) dims a row and blocks
 * selection without removing it from the list, so the reason stays visible.
 */
export function SuperAppPaymentMethodSelector({
  options,
  selectedKey,
  onSelect,
}: {
  options: SuperAppPaymentMethodOption[];
  selectedKey: string | null;
  onSelect?: ((key: string) => void) | undefined;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  return (
    <div
      className="overflow-hidden rounded-2xl"
      style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
    >
      {options.map((opt, i) => {
        const selected = selectedKey === opt.key;
        const disabled = opt.disabled === true;
        return (
          <button
            key={opt.key}
            type="button"
            disabled={disabled}
            onClick={
              onSelect && !disabled
                ? () => {
                    onSelect(opt.key);
                  }
                : undefined
            }
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-all disabled:opacity-40"
            style={{
              background: selected ? 'rgba(43,172,82,.08)' : 'transparent',
              borderBottom: i < options.length - 1 ? `1px solid ${BORDER}` : 'none',
            }}
          >
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg"
              style={{ background: selected ? 'rgba(43,172,82,.18)' : 'rgba(255,255,255,.05)' }}
            >
              {opt.icon}
            </div>
            <div className="min-w-0 flex-1">
              <p className={`text-[13px] font-semibold text-white ${heading}`}>{opt.label}</p>
              <p className={`text-[11px] ${body}`} style={{ color: selected ? G3 : MUTED }}>
                {opt.sublabel}
              </p>
            </div>
            <div
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2"
              style={{ borderColor: selected ? G2 : BORDER }}
            >
              {selected ? (
                <div className="h-2 w-2 rounded-full" style={{ background: G2 }} />
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}
