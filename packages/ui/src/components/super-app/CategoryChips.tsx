import { BORDER, G0, G2 } from '../../tokens/colors';

import { useSuperAppFonts } from './fonts';

export interface SuperAppCategoryChip {
  key: string;
  icon: string;
  label: string;
}

/**
 * Horizontally-scrolling filter pills (icon + label, single row), ported
 * from `CategoryChips` in the locked Figma Make Marketplace screen.
 * Distinct from `SuperAppCategoryGrid` (Home's icon-over-label stack) —
 * a different visual shape for a different screen, not a reskin of it.
 */
export function SuperAppCategoryChips({
  chips,
  active,
  onChange,
}: {
  chips: SuperAppCategoryChip[];
  active: string;
  onChange?: ((key: string) => void) | undefined;
}): React.JSX.Element {
  const { body } = useSuperAppFonts();
  return (
    <div className="mb-4 mt-3">
      <div className="flex gap-2 overflow-x-auto px-5" style={{ scrollbarWidth: 'none' }}>
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
              className="flex h-9 flex-shrink-0 items-center gap-1.5 rounded-full px-3.5 transition-all active:scale-95"
              style={{
                background: on ? `linear-gradient(135deg,${G0},${G2})` : 'rgba(255,255,255,.06)',
                border: on ? 'none' : `1px solid ${BORDER}`,
                boxShadow: on ? '0 4px 14px rgba(43,172,82,.28)' : 'none',
              }}
            >
              <span style={{ fontSize: 13 }}>{c.icon}</span>
              <p
                className={`text-[11.5px] font-semibold ${body}`}
                style={{ color: on ? '#FFF' : 'rgba(255,255,255,.5)', whiteSpace: 'nowrap' }}
              >
                {c.label}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
