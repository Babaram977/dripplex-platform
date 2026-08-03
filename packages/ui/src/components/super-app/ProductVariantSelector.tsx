import { BORDER, G2, G3, MUTED } from '../../tokens/colors';

import { useSuperAppFonts } from './fonts';

export interface SuperAppProductVariantOption {
  id: string;
  label: string;
  priceLabel?: string | undefined;
  available: boolean;
}

/**
 * Single-select variant chip row, ported from `VariantSelector` in the
 * locked Figma Make Product Detail screen. The source groups options
 * into named, independently-required sets ("Meal Size", "Spice Level",
 * "Choose Drink") backed by mock data with no real equivalent — the real
 * `ProductVariantDto` is a flat, ungrouped list (id/name/priceOverride),
 * so this renders one flat chip row rather than the grouped mock shape.
 */
export function SuperAppProductVariantSelector({
  label,
  options,
  selectedId,
  onSelect,
}: {
  label: string;
  options: SuperAppProductVariantOption[];
  selectedId: string | null;
  onSelect?: ((id: string) => void) | undefined;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  return (
    <div className="mb-4 px-5">
      <p className={`mb-2 text-[13px] font-semibold text-white ${heading}`}>{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const isSelected = selectedId === opt.id;
          const unavailable = !opt.available;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={
                !unavailable && onSelect
                  ? () => {
                      onSelect(opt.id);
                    }
                  : undefined
              }
              disabled={unavailable}
              className={`flex flex-col items-center justify-center rounded-2xl transition-all active:scale-95 ${body}`}
              style={{
                padding: '8px 14px',
                minWidth: 64,
                background: isSelected ? 'rgba(43,172,82,.18)' : 'rgba(255,255,255,.05)',
                border: `1.5px solid ${isSelected ? G2 : unavailable ? 'rgba(255,255,255,.04)' : BORDER}`,
                opacity: unavailable ? 0.38 : 1,
                boxShadow: isSelected ? '0 0 0 2px rgba(43,172,82,.12)' : 'none',
              }}
            >
              <span
                className="text-[13px] font-medium"
                style={{
                  color: isSelected
                    ? G3
                    : unavailable
                      ? 'rgba(255,255,255,.25)'
                      : 'rgba(255,255,255,.8)',
                }}
              >
                {opt.label}
              </span>
              {opt.priceLabel ? (
                <span className="mt-0.5 text-[11px]" style={{ color: isSelected ? G3 : MUTED }}>
                  {opt.priceLabel}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
