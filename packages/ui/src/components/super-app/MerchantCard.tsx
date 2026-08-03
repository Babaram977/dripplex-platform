import { BORDER, G0, G2, MUTED, NAVY_CARD } from '../../tokens/colors';

import { useSuperAppFonts } from './fonts';

export interface SuperAppMerchant {
  key: string;
  name: string;
  category: string;
  rating: number;
  distance: string;
  eta: string;
  background: string;
  emoji: string;
}

/** Nearby-merchant card, ported from Home's `Merchants`. */
export function SuperAppMerchantCard({
  merchant,
  onPress,
}: {
  merchant: SuperAppMerchant;
  onPress?: (() => void) | undefined;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  return (
    <div
      className="flex-shrink-0 overflow-hidden rounded-3xl"
      style={{
        width: 155,
        background: NAVY_CARD,
        border: `1.5px solid ${BORDER}`,
        boxShadow: '0 4px 20px rgba(0,0,0,.3)',
      }}
    >
      <div
        className="relative flex h-[82px] items-center justify-center"
        style={{ background: merchant.background }}
      >
        <span style={{ fontSize: 40 }}>{merchant.emoji}</span>
        <div
          className={`absolute right-2.5 top-2.5 rounded-xl px-2 py-1 text-[9px] font-bold ${body}`}
          style={{ background: 'rgba(0,0,0,.5)', color: '#FFF' }}
        >
          ⏱ {merchant.eta}
        </div>
      </div>
      <div className="p-3">
        <p
          className={`mb-0.5 truncate text-[12.5px] font-bold ${heading}`}
          style={{ color: '#FFF' }}
        >
          {merchant.name}
        </p>
        <p className={`mb-2 text-[10px] ${body}`} style={{ color: MUTED }}>
          {merchant.category}
        </p>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[10px] font-bold" style={{ color: '#FBBF24' }}>
            ★ {merchant.rating}
          </span>
          <span className={`text-[10px] ${body}`} style={{ color: MUTED }}>
            {merchant.distance}
          </span>
        </div>
        <button
          type="button"
          onClick={onPress}
          className={`h-[30px] w-full rounded-xl text-[11px] font-semibold ${body}`}
          style={{
            background: `linear-gradient(135deg,${G0},${G2})`,
            color: '#FFF',
            boxShadow: '0 3px 12px rgba(43,172,82,.25)',
          }}
        >
          View Store
        </button>
      </div>
    </div>
  );
}
