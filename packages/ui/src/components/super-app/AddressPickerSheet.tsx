import { BORDER, G2, G3, MUTED, NAVY_CARD } from '../../tokens/colors';

import { useSuperAppFonts } from './fonts';

export interface SuperAppAddressOption {
  id: string;
  label: string;
  recipientName: string;
  line1: string;
  line2: string;
}

/**
 * "Select Address" bottom sheet, ported from the Checkout screen's
 * address picker. Real addresses come from the customer's saved address
 * book (`sdk.addresses.list`); "Add New Address" opens
 * `SuperAppAddAddressSheet`.
 */
export function SuperAppAddressPickerSheet({
  addresses,
  selectedId,
  onSelect,
  onAddNew,
  onClose,
}: {
  addresses: SuperAppAddressOption[];
  selectedId: string | null;
  onSelect?: ((id: string) => void) | undefined;
  onAddNew?: (() => void) | undefined;
  onClose?: (() => void) | undefined;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  return (
    <div
      className="absolute inset-0 z-50 flex flex-col justify-end"
      style={{ background: 'rgba(0,0,0,.72)' }}
      onClick={onClose}
    >
      <div
        className="flex max-h-[80%] flex-col gap-4 overflow-y-auto rounded-t-[32px] p-6"
        style={{
          background: NAVY_CARD,
          border: `1px solid ${BORDER}`,
          animation: 'fade-up .25s ease both',
        }}
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <div
          className="mx-auto h-1 w-10 rounded-full"
          style={{ background: 'rgba(255,255,255,.2)' }}
        />
        <p className={`text-[16px] font-bold text-white ${heading}`}>Select Address</p>
        {addresses.map((addr) => {
          const isSelected = selectedId === addr.id;
          return (
            <button
              key={addr.id}
              type="button"
              onClick={
                onSelect
                  ? () => {
                      onSelect(addr.id);
                    }
                  : undefined
              }
              className={`flex items-start gap-3 rounded-2xl p-3.5 text-left transition-all ${body}`}
              style={{
                background: isSelected ? 'rgba(43,172,82,.1)' : 'rgba(255,255,255,.03)',
                border: `1.5px solid ${isSelected ? G2 : BORDER}`,
              }}
            >
              <span className="mt-0.5 text-xl">📍</span>
              <div>
                <p className="text-[13px] font-semibold text-white">
                  {addr.recipientName}{' '}
                  <span className="font-normal" style={{ color: G3 }}>
                    ({addr.label})
                  </span>
                </p>
                <p className="mt-0.5 text-[11px]" style={{ color: MUTED }}>
                  {addr.line1}
                  {addr.line2 ? `, ${addr.line2}` : ''}
                </p>
              </div>
            </button>
          );
        })}
        <button
          type="button"
          onClick={onAddNew}
          className={`flex items-center gap-3 rounded-2xl p-3.5 ${body}`}
          style={{ background: 'rgba(43,172,82,.08)', border: '1.5px dashed rgba(43,172,82,.35)' }}
        >
          <div
            className="flex h-8 w-8 items-center justify-center rounded-xl"
            style={{ background: 'rgba(43,172,82,.2)' }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke={G3}
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>
          <span className="text-[13px] font-semibold" style={{ color: G3 }}>
            Add New Address
          </span>
        </button>
      </div>
    </div>
  );
}
