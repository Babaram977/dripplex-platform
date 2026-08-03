import { BORDER, G0, G2, G3, MUTED } from '../../tokens/colors';

import { useSuperAppFonts } from './fonts';
import { SuperAppSkeleton } from './Skeleton';

export interface SuperAppNearbyBusiness {
  key: string;
  name: string;
  category: string;
  distance: string;
  eta: string;
  fee: string;
  isFreeDelivery: boolean;
  rating: number;
  emoji: string;
  open: boolean;
}

/** Row inside `NearbyBusinesses`' bordered card, ported from the locked Figma Make Marketplace screen. */
export function SuperAppNearbyBusinessRow({
  business,
  showDivider,
  onOrder,
}: {
  business: SuperAppNearbyBusiness;
  showDivider: boolean;
  onOrder?: (() => void) | undefined;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  return (
    <div
      className="flex items-center gap-3 px-4 py-3.5 transition-colors active:bg-white/[.025]"
      style={{ borderBottom: showDivider ? `1px solid ${BORDER}` : 'none' }}
    >
      <div
        className="flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-2xl text-[20px]"
        style={{ background: 'rgba(255,255,255,.06)' }}
      >
        {business.emoji}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p
            className={`truncate text-[12.5px] font-semibold ${heading}`}
            style={{ color: business.open ? '#FFF' : 'rgba(255,255,255,.4)' }}
          >
            {business.name}
          </p>
          {!business.open ? (
            <span
              className="flex-shrink-0 rounded-md px-1.5 py-0.5 text-[8px] font-bold"
              style={{ background: 'rgba(239,68,68,.12)', color: '#FCA5A5' }}
            >
              Closed
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9.5px] font-bold" style={{ color: '#FBBF24' }}>
            ★ {business.rating}
          </span>
          <span className={`text-[9.5px] ${body}`} style={{ color: MUTED }}>
            📍 {business.distance} · ⏱ {business.eta}
          </span>
        </div>
      </div>
      <div className="flex flex-shrink-0 flex-col items-end gap-1">
        <p
          className={`text-[10px] font-semibold ${body}`}
          style={{ color: business.isFreeDelivery ? G3 : MUTED }}
        >
          {business.isFreeDelivery ? 'Free delivery' : business.fee}
        </p>
        <button
          type="button"
          onClick={business.open ? onOrder : undefined}
          className={`h-7 rounded-xl px-3 text-[10px] font-semibold transition-all active:scale-95 ${body}`}
          style={{
            background: business.open
              ? `linear-gradient(135deg,${G0},${G2})`
              : 'rgba(255,255,255,.06)',
            color: business.open ? '#FFF' : 'rgba(255,255,255,.25)',
          }}
        >
          {business.open ? 'Order' : 'Closed'}
        </button>
      </div>
    </div>
  );
}

/** Skeleton row matching `SuperAppNearbyBusinessRow`'s layout while loading. */
export function SuperAppNearbyBusinessSkeletonRow(): React.JSX.Element {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3.5"
      style={{ borderBottom: `1px solid ${BORDER}` }}
    >
      <SuperAppSkeleton w={40} h={40} r={14} />
      <div className="flex flex-1 flex-col gap-2">
        <SuperAppSkeleton w="55%" h={11} r={6} />
        <SuperAppSkeleton w="40%" h={9} r={6} />
      </div>
    </div>
  );
}
