import { BORDER, G2, G3, MUTED, NAVY_CARD } from '../../tokens/colors';

import { useSuperAppFonts } from './fonts';
import { SuperAppStatusBarIcons } from './StatusBarIcons';
import { SuperAppVerifiedBadge } from './VerifiedBadge';

export interface SuperAppStoreMerchant {
  name: string;
  category: string;
  coverBackground: string;
  emoji: string;
  tagline: string;
  rating: number;
  reviewCount: number;
  distance: string;
  eta: string;
  deliveryFee: string;
  minOrder: string;
  isOpen: boolean;
  isVerified: boolean;
}

/**
 * Store screen's cover-photo header with an overlapping merchant info
 * card, ported from `StoreHeader` in the locked Figma Make Store screen
 * (`docs/reference/figma-super-app-source/storeScreen.tsx`). Kept as one
 * cohesive component rather than decomposed further — the cover, action
 * buttons, and info card are tightly coupled to this one layout and not
 * yet shown to be reusable independently.
 */
export function SuperAppStoreHeader({
  merchant,
  cartCount = 0,
  followed = false,
  time = '9:41',
  onBack,
  onFollow,
  onShare,
  onCart,
}: {
  merchant: SuperAppStoreMerchant;
  cartCount?: number | undefined;
  followed?: boolean | undefined;
  time?: string | undefined;
  onBack?: (() => void) | undefined;
  onFollow?: (() => void) | undefined;
  onShare?: (() => void) | undefined;
  onCart?: (() => void) | undefined;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  const deliveryInfo = [
    { icon: '🚚', label: 'Delivery', value: merchant.deliveryFee },
    { icon: '🛒', label: 'Min Order', value: merchant.minOrder },
    { icon: '⏱', label: 'ETA', value: merchant.eta },
  ];

  return (
    <div className="relative flex-shrink-0 overflow-hidden">
      <div className="relative" style={{ height: 200, background: merchant.coverBackground }}>
        <div
          className="flex items-center justify-between px-5 pb-1 pt-[52px]"
          style={{ fontSize: 11, color: 'rgba(255,255,255,.35)' }}
        >
          <span className={body}>{time}</span>
          <SuperAppStatusBarIcons />
        </div>
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(ellipse at 70% 30%,rgba(255,255,255,.12) 0%,transparent 55%)',
          }}
        />
        <div
          className="pointer-events-none absolute bottom-6 right-6"
          style={{ fontSize: 90, opacity: 0.1 }}
        >
          {merchant.emoji}
        </div>

        <div className="absolute left-0 right-0 top-[88px] z-10 flex items-center justify-between px-4">
          <button
            type="button"
            onClick={onBack}
            className="flex h-9 w-9 items-center justify-center rounded-2xl transition-all active:scale-90"
            style={{
              background: 'rgba(0,0,0,.45)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,.12)',
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#FFF"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onFollow}
              className={`flex h-9 items-center gap-1.5 rounded-2xl px-3.5 text-[11px] font-semibold transition-all active:scale-90 ${body}`}
              style={{
                background: followed ? 'rgba(43,172,82,.3)' : 'rgba(0,0,0,.45)',
                backdropFilter: 'blur(12px)',
                border: followed
                  ? '1px solid rgba(43,172,82,.4)'
                  : '1px solid rgba(255,255,255,.12)',
                color: followed ? G3 : '#FFF',
              }}
            >
              {followed ? '✓ Following' : '+ Follow'}
            </button>
            <button
              type="button"
              onClick={onShare}
              aria-label="Share"
              className="flex h-9 w-9 items-center justify-center rounded-2xl transition-all active:scale-90"
              style={{
                background: 'rgba(0,0,0,.45)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,.12)',
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#FFF"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
              </svg>
            </button>
            <button
              type="button"
              onClick={onCart}
              aria-label="Cart"
              className="relative flex h-9 w-9 items-center justify-center rounded-2xl transition-all active:scale-90"
              style={{
                background: 'rgba(0,0,0,.45)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,.12)',
              }}
            >
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#FFF"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0" />
              </svg>
              {cartCount > 0 ? (
                <div
                  className={`absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white ${body}`}
                  style={{ background: G2 }}
                >
                  {cartCount}
                </div>
              ) : null}
            </button>
          </div>
        </div>
      </div>

      <div
        className="relative z-10 mx-4 -mt-5 rounded-3xl p-4"
        style={{
          background: NAVY_CARD,
          border: `1.5px solid ${BORDER}`,
          boxShadow: '0 8px 32px rgba(0,0,0,.45)',
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl text-[32px]"
            style={{
              background: merchant.coverBackground,
              boxShadow: '0 4px 14px rgba(0,0,0,.35)',
            }}
          >
            {merchant.emoji}
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-0.5 flex flex-wrap items-center gap-1.5">
              <p className={`text-[17px] font-bold ${heading}`} style={{ color: '#FFF' }}>
                {merchant.name}
              </p>
              {merchant.isVerified ? <SuperAppVerifiedBadge /> : null}
            </div>
            <p className={`mb-2 text-[11px] ${body}`} style={{ color: MUTED }}>
              {merchant.tagline}
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-[10.5px] font-bold" style={{ color: '#FBBF24' }}>
                ★ {merchant.rating} ({(merchant.reviewCount / 1000).toFixed(1)}k)
              </span>
              <span className={`text-[10px] ${body}`} style={{ color: MUTED }}>
                📍 {merchant.distance}
              </span>
              <span className={`text-[10px] ${body}`} style={{ color: MUTED }}>
                ⏱ {merchant.eta}
              </span>
              <div
                className="rounded-lg px-2 py-0.5"
                style={{
                  background: merchant.isOpen ? 'rgba(16,185,129,.12)' : 'rgba(239,68,68,.12)',
                }}
              >
                <p
                  className={`text-[9px] font-bold ${body}`}
                  style={{ color: merchant.isOpen ? '#10B981' : '#EF4444' }}
                >
                  {merchant.isOpen ? '● Open Now' : '● Closed'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div
          className="mt-3 flex items-center gap-0 overflow-hidden rounded-2xl"
          style={{ background: 'rgba(255,255,255,.04)', border: `1px solid ${BORDER}` }}
        >
          {deliveryInfo.map((s, i) => (
            <div
              key={s.label}
              className="flex flex-1 flex-col items-center py-2.5"
              style={{ borderRight: i < deliveryInfo.length - 1 ? `1px solid ${BORDER}` : 'none' }}
            >
              <span className="mb-0.5 text-[14px]">{s.icon}</span>
              <p className={`text-[9px] ${body}`} style={{ color: MUTED }}>
                {s.label}
              </p>
              <p className={`text-[11px] font-bold ${heading}`} style={{ color: '#FFF' }}>
                {s.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
