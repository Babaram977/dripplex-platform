import { BORDER, G3, MUTED, NAVY_CARD } from '../../tokens/colors';

import { useSuperAppFonts } from './fonts';

export interface SuperAppCheckoutAddress {
  label: string;
  recipientName: string;
  phone: string;
  line1: string;
  line2: string;
}

const LABEL_COLORS: Record<string, string> = {
  Home: '#2BAC52',
  Work: '#60A5FA',
  Other: '#A78BFA',
};

/**
 * Delivery address summary card, ported from `AddressSection` in the
 * locked Figma Make Checkout screen. The source also renders a "Use My
 * Location" button — dropped, since there is no real reverse-geocoding
 * endpoint to turn device coordinates into a deliverable address.
 */
export function SuperAppCheckoutAddressCard({
  address,
  onChangeAddress,
}: {
  address: SuperAppCheckoutAddress;
  onChangeAddress?: (() => void) | undefined;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  const labelColor = LABEL_COLORS[address.label] ?? G3;
  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl"
          style={{ background: 'rgba(43,172,82,.12)' }}
        >
          📍
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className={`text-[13px] font-semibold text-white ${heading}`}>
              {address.recipientName}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${body}`}
              style={{ background: `${labelColor}22`, color: labelColor }}
            >
              {address.label}
            </span>
          </div>
          <p className={`text-[12px] leading-relaxed ${body}`} style={{ color: MUTED }}>
            {address.phone}
          </p>
          <p className={`text-[12px] leading-relaxed ${body}`} style={{ color: MUTED }}>
            {address.line1}
          </p>
          {address.line2 ? (
            <p className={`text-[12px] ${body}`} style={{ color: MUTED }}>
              {address.line2}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${BORDER}` }}>
        <button
          type="button"
          onClick={onChangeAddress}
          className={`flex h-[34px] w-full items-center justify-center gap-1.5 rounded-xl text-[11px] font-semibold transition-all active:scale-95 ${body}`}
          style={{
            background: 'rgba(255,255,255,.05)',
            border: `1px solid ${BORDER}`,
            color: MUTED,
          }}
        >
          ✏️ Change Address
        </button>
      </div>
    </div>
  );
}
