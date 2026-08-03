import { BORDER, G3, NAVY_CARD } from '../../tokens/colors';

import { useSuperAppFonts } from './fonts';

export interface SuperAppRecentlyViewed {
  key: string;
  emoji: string;
  name: string;
  price: string;
  store: string;
}

/** "Continue Shopping" card, ported from `ContinueShopping` in the locked Figma Make Marketplace screen. */
export function SuperAppRecentlyViewedCard({
  item,
  onPress,
}: {
  item: SuperAppRecentlyViewed;
  onPress?: (() => void) | undefined;
}): React.JSX.Element {
  const { heading } = useSuperAppFonts();
  return (
    <button
      type="button"
      onClick={onPress}
      className="flex flex-shrink-0 flex-col gap-2 rounded-2xl p-3 transition-all active:scale-95"
      style={{ width: 110, background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
    >
      <div
        className="flex h-[52px] w-full items-center justify-center rounded-xl text-[28px]"
        style={{ background: 'rgba(255,255,255,.06)' }}
      >
        {item.emoji}
      </div>
      <p className={`truncate text-[11px] font-bold ${heading}`} style={{ color: '#FFF' }}>
        {item.name}
      </p>
      <p className={`text-[11px] font-bold ${heading}`} style={{ color: G3 }}>
        {item.price}
      </p>
    </button>
  );
}
