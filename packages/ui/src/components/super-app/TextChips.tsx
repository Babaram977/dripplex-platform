import { BORDER, G0, G2 } from '../../tokens/colors';

import { useSuperAppFonts } from './fonts';

export interface SuperAppTextChip {
  key: string;
  label: string;
}

/**
 * Plain text filter pills (no icon), ported from `StoreCats` in the
 * locked Figma Make Store screen. Distinct from `SuperAppCategoryChips`
 * (icon + label) — Store's category row has no icons at all.
 */
export function SuperAppTextChips({
  chips,
  active,
  onChange,
}: {
  chips: SuperAppTextChip[];
  active: string;
  onChange?: ((key: string) => void) | undefined;
}): React.JSX.Element {
  const { body } = useSuperAppFonts();
  return (
    <div
      className="flex gap-2 overflow-x-auto px-4 pb-1"
      style={{ scrollbarWidth: 'none', marginTop: 10 }}
    >
      {chips.map((c) => {
        const on = active === c.key;
        return (
          <button
            key={c.key}
            type="button"
            onClick={
              onChange
                ? () => {
                    onChange(c.key);
                  }
                : undefined
            }
            className={`h-9 flex-shrink-0 rounded-full px-4 text-[11.5px] font-semibold transition-all active:scale-95 ${body}`}
            style={{
              background: on ? `linear-gradient(135deg,${G0},${G2})` : 'rgba(255,255,255,.06)',
              border: on ? 'none' : `1px solid ${BORDER}`,
              boxShadow: on ? '0 4px 14px rgba(43,172,82,.28)' : 'none',
              color: on ? '#FFF' : 'rgba(255,255,255,.5)',
              whiteSpace: 'nowrap',
            }}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
