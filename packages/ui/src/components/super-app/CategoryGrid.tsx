import { BORDER, G0, G2, G3, NAVY_CARD } from '../../tokens/colors';

import { useSuperAppFonts } from './fonts';

export interface SuperAppCategory {
  key: string;
  icon: string;
  label: string;
}

/** Horizontally-scrolling category chips, ported from Home's `Categories`. */
export function SuperAppCategoryGrid({
  categories,
  activeKey,
  onSelect,
}: {
  categories: SuperAppCategory[];
  activeKey?: string | undefined;
  onSelect?: ((key: string) => void) | undefined;
}): React.JSX.Element {
  const { body } = useSuperAppFonts();
  return (
    <div className="flex gap-3 overflow-x-auto px-5" style={{ scrollbarWidth: 'none' }}>
      {categories.map((c) => {
        const on = c.key === activeKey;
        return (
          <button
            key={c.key}
            type="button"
            onClick={
              onSelect
                ? () => {
                    onSelect(c.key);
                  }
                : undefined
            }
            className="flex flex-shrink-0 flex-col items-center gap-1.5"
          >
            <div
              className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl text-[22px]"
              style={{
                background: on ? `linear-gradient(135deg,${G0},${G2})` : NAVY_CARD,
                border: on ? 'none' : `1.5px solid ${BORDER}`,
                boxShadow: on ? '0 6px 18px rgba(43,172,82,.28)' : 'none',
              }}
            >
              {c.icon}
            </div>
            <p
              className={`text-center text-[9px] font-semibold ${body}`}
              style={{ color: on ? G3 : 'rgba(255,255,255,.42)', maxWidth: 52 }}
            >
              {c.label}
            </p>
          </button>
        );
      })}
    </div>
  );
}
