import { BORDER, G3, NAVY_CARD } from '../../tokens/colors';

import { useSuperAppFonts } from './fonts';

export interface SuperAppRecommendation {
  key: string;
  emoji: string;
  name: string;
  price: string;
  badge: string;
  badgeColor: string;
}

/** "Recommended for You" product card, ported from Home's `Recs`. */
export function SuperAppRecommendationCard({
  item,
  onPress,
}: {
  item: SuperAppRecommendation;
  onPress?: (() => void) | undefined;
}): React.JSX.Element {
  const { heading } = useSuperAppFonts();
  return (
    <button
      type="button"
      onClick={onPress}
      className="flex flex-shrink-0 flex-col items-center gap-2.5 rounded-2xl p-3.5"
      style={{ width: 130, background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
    >
      <div
        className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl text-[28px]"
        style={{ background: 'rgba(255,255,255,.06)' }}
      >
        {item.emoji}
      </div>
      <div className="w-full text-center">
        <p className={`truncate text-[11.5px] font-bold ${heading}`} style={{ color: '#FFF' }}>
          {item.name}
        </p>
        <p className={`mt-0.5 text-[11px] font-bold ${heading}`} style={{ color: G3 }}>
          {item.price}
        </p>
      </div>
      <span
        className="rounded-full px-2.5 py-1 text-[9px] font-bold"
        style={{
          background: `${item.badgeColor}20`,
          color: item.badgeColor,
          border: `1px solid ${item.badgeColor}35`,
        }}
      >
        {item.badge}
      </span>
    </button>
  );
}
