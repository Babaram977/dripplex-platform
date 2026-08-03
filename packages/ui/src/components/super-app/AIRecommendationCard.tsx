import { BORDER, G2, G3, MUTED, NAVY_CARD } from '../../tokens/colors';

import { useSuperAppFonts } from './fonts';

export interface SuperAppAIRecommendation {
  key: string;
  type: 'product' | 'store';
  emoji: string;
  name: string;
  sub: string;
  badge: string;
}

/** "AI Picks for You" card, ported from `AIRecs` in the locked Figma Make Marketplace screen. */
export function SuperAppAIRecommendationCard({
  item,
  onPress,
}: {
  item: SuperAppAIRecommendation;
  onPress?: (() => void) | undefined;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  return (
    <button
      type="button"
      onClick={onPress}
      className="flex flex-shrink-0 flex-col items-center gap-2.5 rounded-2xl p-3.5 transition-all active:scale-95"
      style={{ width: 130, background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
    >
      <div
        className="flex h-12 w-12 items-center justify-center rounded-2xl text-[26px]"
        style={{ background: 'rgba(255,255,255,.06)' }}
      >
        {item.emoji}
      </div>
      <div className="w-full text-center">
        <p className={`truncate text-[11.5px] font-bold ${heading}`} style={{ color: '#FFF' }}>
          {item.name}
        </p>
        <p className={`mt-0.5 truncate text-[9.5px] ${body}`} style={{ color: MUTED }}>
          {item.sub}
        </p>
      </div>
      <span
        className="rounded-full px-2.5 py-1 text-[9px] font-bold"
        style={{ background: `${G2}20`, color: G3, border: `1px solid ${G2}30` }}
      >
        {item.badge}
      </span>
    </button>
  );
}
