import { G0, G2, G3 } from '../../tokens/colors';

import { useSuperAppFonts } from './fonts';
import { SuperAppStatusBarIcons } from './StatusBarIcons';

/**
 * Marketplace's gradient top banner — back button, title, notification
 * bell, cart (with count badge), and a search bar with voice/filter
 * affordances. Ported from `MpHeader` + `MpStatus` in the locked Figma
 * Make Marketplace screen. Distinct from `SuperAppHeader` (Home's
 * greeting+avatar banner) rather than a variant of it — different enough
 * in shape (back nav vs greeting, cart badge, mic/filter search actions)
 * to be its own Locked component once verified.
 */
export function SuperAppMarketplaceHeader({
  time = '9:41',
  eyebrow = 'Explore',
  title = 'Marketplace',
  searchPlaceholder = 'Search products, stores, services…',
  cartCount = 0,
  onBack,
  onNotifications,
  onCart,
  onSearchPress,
  onFilterPress,
  onVoicePress,
}: {
  time?: string | undefined;
  eyebrow?: string | undefined;
  title?: string | undefined;
  searchPlaceholder?: string | undefined;
  cartCount?: number | undefined;
  onBack?: (() => void) | undefined;
  onNotifications?: (() => void) | undefined;
  onCart?: (() => void) | undefined;
  onSearchPress?: (() => void) | undefined;
  onFilterPress?: (() => void) | undefined;
  onVoicePress?: (() => void) | undefined;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  return (
    <div
      className="relative overflow-hidden"
      style={{
        background: 'linear-gradient(175deg,#0B1F12 0%,#0D2A1C 55%,#091420 100%)',
        paddingBottom: 16,
      }}
    >
      <div
        className="pointer-events-none absolute -right-14 -top-14 h-48 w-48 rounded-full"
        style={{ background: `radial-gradient(circle,${G2} 0%,transparent 68%)`, opacity: 0.1 }}
      />

      <div
        className="flex items-center justify-between px-5 pb-1 pt-[52px]"
        style={{ fontSize: 11, color: 'rgba(255,255,255,.35)' }}
      >
        <span className={body}>{time}</span>
        <SuperAppStatusBarIcons />
      </div>

      <div className="relative z-10 mb-4 mt-2 flex items-center justify-between px-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex h-9 w-9 items-center justify-center rounded-xl transition-all active:scale-90"
            style={{
              background: 'rgba(255,255,255,.07)',
              border: '1px solid rgba(255,255,255,.09)',
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="rgba(255,255,255,.75)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <p className={`text-[11px] ${body}`} style={{ color: 'rgba(255,255,255,.4)' }}>
              {eyebrow}
            </p>
            <p
              className={`text-[19px] font-bold leading-tight ${heading}`}
              style={{ color: '#FFF' }}
            >
              {title}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onNotifications}
            aria-label="Notifications"
            className="flex h-[40px] w-[40px] items-center justify-center rounded-xl transition-all active:scale-90"
            style={{
              background: 'rgba(255,255,255,.07)',
              border: '1px solid rgba(255,255,255,.09)',
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="rgba(255,255,255,.65)"
              strokeWidth="1.8"
              strokeLinecap="round"
            >
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onCart}
            aria-label="Cart"
            className="relative flex h-[40px] w-[40px] items-center justify-center rounded-xl transition-all active:scale-90"
            style={{
              background: 'rgba(255,255,255,.07)',
              border: '1px solid rgba(255,255,255,.09)',
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="rgba(255,255,255,.75)"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0" />
            </svg>
            {cartCount > 0 ? (
              <div
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full"
                style={{ background: G2, boxShadow: '0 2px 8px rgba(43,172,82,.4)' }}
              >
                <p className={`text-[9px] font-bold text-white ${body}`}>{cartCount}</p>
              </div>
            ) : null}
          </button>
        </div>
      </div>

      <div className="relative z-10 mx-5">
        <div
          className="flex items-center gap-3 rounded-2xl px-4"
          style={{
            height: 50,
            background: 'rgba(255,255,255,.08)',
            border: '1.5px solid rgba(255,255,255,.10)',
          }}
        >
          <button
            type="button"
            onClick={onSearchPress}
            className="flex flex-1 items-center gap-3 text-left"
          >
            <div
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl"
              style={{ background: `linear-gradient(135deg,${G0},${G2})` }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="white">
                <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
              </svg>
            </div>
            <span
              className={`flex-1 text-[12.5px] ${body}`}
              style={{ color: 'rgba(255,255,255,.30)' }}
            >
              {searchPlaceholder}
            </span>
          </button>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onVoicePress}
              aria-label="Voice search"
              className="flex h-7 w-7 items-center justify-center rounded-lg"
              style={{ background: 'rgba(255,255,255,.06)' }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="rgba(255,255,255,.5)"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <rect x="9" y="2" width="6" height="11" rx="3" />
                <path d="M5 10a7 7 0 0014 0M12 19v3M9 22h6" />
              </svg>
            </button>
            <div className="h-4 w-px" style={{ background: 'rgba(255,255,255,.10)' }} />
            <button
              type="button"
              onClick={onFilterPress}
              className="flex items-center gap-1 px-1.5 active:opacity-70"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke={G3}
                strokeWidth="2"
                strokeLinecap="round"
              >
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="8" y1="12" x2="20" y2="12" />
                <line x1="12" y1="18" x2="20" y2="18" />
              </svg>
              <p className={`text-[11px] font-semibold ${body}`} style={{ color: G3 }}>
                Filter
              </p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
