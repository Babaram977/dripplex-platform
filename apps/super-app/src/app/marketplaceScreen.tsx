import React, { useState, useEffect, useCallback } from 'react';
import { G0, G2, G3, NAVY_DEEP, NAVY_CARD, NAVY_SURFACE, BORDER, MUTED } from './shared';
import { api } from '../lib/api';
import { ImageWithFallback } from './components/figma/ImageWithFallback';
import { Icon, type IconName } from './icons';
import { MERCHANT_CATEGORY_LABEL, type MerchantCategory } from '../lib/api';
import type { MerchantSummaryDto, ProductSummaryDto } from '../lib/api';

// Money formatter — backend prices are numeric (e.g. 4800). Mirrors storeScreen's
// `₦${n.toLocaleString()}` convention. Do not invent a different format.
const naira = (n: number) => `₦${n.toLocaleString()}`;

/**
 * Up to two initials for a business without a cover photo.
 *
 * Words like "Ltd" or "&" carry no identity, so they never win a slot — the
 * monogram for "Ghasan Leather Shop" is GL, and for "Mani & Sons Ltd" it is MS.
 */
const MONOGRAM_SKIP = new Set(['ltd', 'limited', 'nig', 'nigeria', 'and', 'the', 'co', 'inc']);

export function monogram(businessName: string): string {
  const words = businessName
    .split(/[\s\-_/&]+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter((w) => w.length > 0 && !MONOGRAM_SKIP.has(w.toLowerCase()));
  if (words.length === 0) return businessName.trim().charAt(0).toUpperCase() || '•';
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]!.charAt(0) + words[1]!.charAt(0)).toUpperCase();
}

// ─────────────────────────────────────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────────────────────────────────────
/**
 * The chips carry the real `MerchantCategory` value now. They used to carry a
 * LABEL that was fed to a free-text merchant-name search, so "Hotels" only
 * matched a business with the word "Hotels" in its name — a hotel called
 * "Tahir Guest Palace" never appeared under it. `category: null` is All.
 */
const CAT_CHIPS: { label: string; icon: IconName; category: MerchantCategory | null }[] = [
  { label: 'All', icon: 'all', category: null },
  { label: 'Supermarkets', icon: 'supermarket', category: 'SUPERMARKET' },
  { label: 'Restaurants', icon: 'restaurant', category: 'RESTAURANT' },
  { label: 'Pharmacy', icon: 'pharmacy', category: 'PHARMACY' },
  { label: 'Electronics', icon: 'electronics', category: 'ELECTRONICS' },
  { label: 'Fashion', icon: 'fashion', category: 'FASHION' },
  { label: 'Beauty', icon: 'beauty', category: 'BEAUTY' },
  { label: 'Hardware', icon: 'hardware', category: 'HARDWARE' },
  { label: 'Hotels', icon: 'hotel', category: 'HOTEL' },
  { label: 'Furniture', icon: 'home', category: 'FURNITURE' },
  { label: 'Services', icon: 'services', category: 'SERVICES' },
  { label: 'Wholesale', icon: 'orders', category: 'WHOLESALE' },
];

/** Category -> icon. Keyed on `category`, which actually exists on a merchant;
 *  the old map was keyed on `businessType` (a legal structure) so it never
 *  matched and every card fell through to the same default glyph. */
const CATEGORY_ICON: Record<MerchantCategory, IconName> = {
  SUPERMARKET: 'supermarket',
  RESTAURANT: 'restaurant',
  PHARMACY: 'pharmacy',
  ELECTRONICS: 'electronics',
  FASHION: 'fashion',
  BEAUTY: 'beauty',
  HARDWARE: 'hardware',
  HOTEL: 'hotel',
  FURNITURE: 'home',
  SERVICES: 'services',
  WHOLESALE: 'orders',
  OTHER: 'store',
};

function categoryIcon(category: MerchantCategory | null): IconName {
  return category ? CATEGORY_ICON[category] : 'store';
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED PRIMITIVES
// ─────────────────────────────────────────────────────────────────────────────
function SRow({ title, sub, onAll }: { title: string; sub?: string; onAll?: () => void }) {
  return (
    <div className="mb-3 flex items-end justify-between px-5">
      <div>
        <p
          className="text-[15px] font-bold leading-tight"
          style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
        >
          {title}
        </p>
        {sub && (
          <p
            className="mt-0.5 text-[10px]"
            style={{ color: MUTED, fontFamily: "'Inter',sans-serif" }}
          >
            {sub}
          </p>
        )}
      </div>
      {onAll && (
        <button
          onClick={onAll}
          className="pb-0.5 text-[12px] font-semibold active:opacity-60"
          style={{ color: G3, fontFamily: "'Inter',sans-serif" }}
        >
          See all →
        </button>
      )}
    </div>
  );
}

function Bone({ w, h, r = 16 }: { w: number | string; h: number; r?: number }) {
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: r,
        background: 'rgba(255,255,255,.055)',
        flexShrink: 0,
      }}
    />
  );
}

function VerifiedBadge() {
  return (
    <div
      className="flex items-center gap-0.5 rounded-lg px-1.5 py-0.5"
      style={{ background: 'rgba(43,172,82,.15)', border: '1px solid rgba(43,172,82,.25)' }}
    >
      <svg
        width="9"
        height="9"
        viewBox="0 0 24 24"
        fill="none"
        stroke={G3}
        strokeWidth="3"
        strokeLinecap="round"
      >
        <path d="M20 6L9 17l-5-5" />
      </svg>
      <p className="text-[8px] font-bold" style={{ color: G3, fontFamily: "'Inter',sans-serif" }}>
        Verified
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STATUS BAR
// ─────────────────────────────────────────────────────────────────────────────
function MpStatus() {
  return (
    <div
      className="dx-status-mock flex items-center justify-between px-5 pb-1 pt-[52px]"
      style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', fontFamily: "'Inter',sans-serif" }}
    >
      <span>9:41</span>
      <div className="flex items-center gap-1.5">
        <svg width="16" height="11" viewBox="0 0 17 12" fill="currentColor">
          <rect x="0" y="6" width="3" height="6" rx=".6" opacity=".4" />
          <rect x="4.5" y="3.5" width="3" height="8.5" rx=".6" opacity=".6" />
          <rect x="9" y="1" width="3" height="11" rx=".6" opacity=".85" />
          <rect x="13.5" y="0" width="3" height="12" rx=".6" />
        </svg>
        <svg width="15" height="11" viewBox="0 0 16 12" fill="currentColor">
          <path d="M8 9a1.5 1.5 0 110 3 1.5 1.5 0 010-3z" />
          <path d="M2.5 5.5a7.7 7.7 0 0111 0l-1.4 1.4a5.7 5.7 0 00-8.2 0z" opacity=".7" />
          <path d="M.2 3.3a11 11 0 0115.6 0L14.3 4.8a9 9 0 00-12.6 0z" opacity=".4" />
        </svg>
        <svg width="24" height="11" viewBox="0 0 26 12" fill="currentColor">
          <rect
            x=".5"
            y=".5"
            width="22"
            height="11"
            rx="3.5"
            stroke="currentColor"
            strokeOpacity=".35"
            fill="none"
          />
          <rect x="2" y="2" width="17" height="8" rx="2" opacity=".6" />
          <path d="M24 4v4a2 2 0 000-4z" opacity=".4" />
        </svg>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HEADER
// ─────────────────────────────────────────────────────────────────────────────
function MpHeader({
  onBack,
  onCart,
  onNotif,
  onSearch,
  cartCount,
}: {
  onBack: () => void;
  onCart: () => void;
  onNotif: () => void;
  /** Opens the search that actually queries the catalogue. See below. */
  onSearch: () => void;
  cartCount: number;
}) {
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

      <MpStatus />

      {/* Top bar */}
      <div className="relative z-10 mb-4 mt-2 flex items-center justify-between px-5">
        <div className="flex items-center gap-3">
          <button
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
            <p
              className="text-[11px]"
              style={{ color: 'rgba(255,255,255,.4)', fontFamily: "'Inter',sans-serif" }}
            >
              Explore
            </p>
            <p
              className="text-[19px] font-bold leading-tight"
              style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
            >
              Marketplace
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={onNotif}
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
            onClick={onCart}
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
            {cartCount > 0 && (
              <div
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full"
                style={{ background: G2, boxShadow: `0 2px 8px rgba(43,172,82,.4)` }}
              >
                <p
                  className="text-[9px] font-bold text-white"
                  style={{ fontFamily: "'Inter',sans-serif" }}
                >
                  {cartCount}
                </p>
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Search.

          This row carried three controls and not one of them did anything:
          the "search bar" was a <p> of placeholder text in a div with no
          onClick, the microphone was a <button> with no handler, and so was
          Filter. Reported as "the search bar is not clear and I think not
          indexed to the marketplace products" — it was not indexed to
          anything — and "a lot of clustered icons that need alignment".

          The bar now opens the search that already exists on the home screen,
          which queries the same catalogue over /merchants/smart-search and
          /products/smart-search. A search that queries in place on this screen
          is the better end state and is recorded as a follow-up rather than
          faked here.

          The microphone and Filter are gone. There is no voice-search endpoint
          to give the microphone, and the category chips directly below this
          row are the filter — a second, dead one beside them was the clutter.

          The fixed height:50 went too. A locked height around text the browser
          may enlarge is what let the placeholder wrap onto three lines and
          spill over the title above it. */}
      <div className="relative z-10 mx-5">
        <button
          type="button"
          onClick={onSearch}
          aria-label="Search products, stores and services"
          className="flex w-full items-center gap-3 rounded-2xl px-4 py-2.5 text-left active:opacity-80"
          style={{
            minHeight: 50,
            background: 'rgba(255,255,255,.08)',
            border: '1.5px solid rgba(255,255,255,.10)',
          }}
        >
          <div
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl"
            style={{ background: `linear-gradient(135deg,${G0},${G2})` }}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <circle cx="11" cy="11" r="7" />
              <line x1="16.5" y1="16.5" x2="21" y2="21" />
            </svg>
          </div>
          <span
            className="min-w-0 flex-1 text-[12.5px]"
            style={{ color: 'rgba(255,255,255,.45)', fontFamily: "'Inter',sans-serif" }}
          >
            Search products, stores, services…
          </span>
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY CHIPS
// ─────────────────────────────────────────────────────────────────────────────
function CategoryChips({
  active,
  onChange,
}: {
  active: MerchantCategory | null;
  onChange: (c: MerchantCategory | null) => void;
}) {
  return (
    <div className="mb-4 mt-3">
      <div className="flex gap-2 overflow-x-auto px-5" style={{ scrollbarWidth: 'none' }}>
        {CAT_CHIPS.map((c) => {
          const on = active === c.category;
          return (
            <button
              key={c.label}
              onClick={() => onChange(c.category)}
              className="flex h-9 flex-shrink-0 items-center gap-1.5 rounded-full px-3.5 transition-all active:scale-95"
              style={{
                background: on ? `linear-gradient(135deg,${G0},${G2})` : 'rgba(255,255,255,.06)',
                border: on ? 'none' : `1px solid ${BORDER}`,
                boxShadow: on ? `0 4px 14px rgba(43,172,82,.28)` : 'none',
              }}
            >
              <Icon name={c.icon} size={15} color={on ? '#FFF' : 'rgba(255,255,255,.5)'} />
              <p
                className="text-[11.5px] font-semibold"
                style={{
                  fontFamily: "'Inter',sans-serif",
                  color: on ? '#FFF' : 'rgba(255,255,255,.5)',
                  whiteSpace: 'nowrap',
                }}
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

// ─────────────────────────────────────────────────────────────────────────────
// AI DISCOVERY BANNER
// ─────────────────────────────────────────────────────────────────────────────
// GAP: no AI backend exists. "Ask Drip" is not a live shopping assistant — no
// AI/search-chat endpoint is wired. Honest "coming soon" entry; the fake
// typewriter + "Live" status were removed.
function AIDiscovery({ onAsk }: { onAsk: () => void }) {
  return (
    <div
      className="mx-5 mb-5 overflow-hidden rounded-3xl"
      style={{
        background: 'linear-gradient(135deg,#0A1628 0%,#0E1F38 100%)',
        border: '1.5px solid rgba(43,172,82,.2)',
        boxShadow: '0 4px 32px rgba(43,172,82,.07)',
      }}
    >
      <div className="p-4">
        <div className="mb-3 flex items-center gap-2.5">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-2xl"
            style={{
              background: `linear-gradient(135deg,${G0},${G3})`,
              boxShadow: `0 4px 16px rgba(43,172,82,.35)`,
            }}
          >
            <span style={{ fontSize: 18 }}>✨</span>
          </div>
          <div>
            <p
              className="text-[14px] font-bold"
              style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
            >
              Ask Drip
            </p>
            <p className="text-[10px]" style={{ color: G3, fontFamily: "'Inter',sans-serif" }}>
              Coming soon
            </p>
          </div>
        </div>

        <div
          className="mb-3.5 rounded-xl px-3.5 py-3"
          style={{ background: 'rgba(43,172,82,.07)', border: '1px solid rgba(43,172,82,.14)' }}
        >
          <p
            className="text-[11.5px] leading-relaxed"
            style={{ color: 'rgba(255,255,255,.7)', fontFamily: "'Inter',sans-serif" }}
          >
            Our AI shopping assistant isn't available yet. Soon you'll be able to describe what you
            need and let Drip find it.
          </p>
        </div>

        <button
          onClick={onAsk}
          className="active:scale-97 flex h-11 w-full items-center justify-center gap-2 rounded-2xl text-[13px] font-semibold transition-all"
          style={{
            background: `linear-gradient(135deg,${G0},${G2} 55%,${G3})`,
            color: '#FFF',
            fontFamily: "'Poppins',sans-serif",
            boxShadow: `0 6px 22px rgba(43,172,82,.28)`,
          }}
        >
          Learn more
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TODAY'S DEALS SLIDER
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// FEATURED MERCHANTS
// ─────────────────────────────────────────────────────────────────────────────
function FeaturedMerchants({
  active,
  onStore,
}: {
  active: MerchantCategory | null;
  onStore?: (id: string) => void;
}) {
  const [merchants, setMerchants] = useState<MerchantSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // A category is a filter, not a search term. This used to send the chip
      // LABEL to smart-search, which matched merchant NAMES — so "Hotels"
      // returned only businesses with "Hotels" written in their name.
      const res = await api.marketplace.getMerchants({
        limit: 20,
        ...(active ? { category: active } : {}),
      });
      const r = res as { items?: MerchantSummaryDto[] };
      setMerchants(r.items ?? []);
    } catch (e: unknown) {
      setError((e as { message?: string }).message ?? 'Could not load merchants');
    } finally {
      setLoading(false);
    }
  }, [active]);

  useEffect(() => {
    load();
  }, [load]);

  const BG_POOL = [
    'linear-gradient(135deg,#0D2E18,#176B30 42%,#2BAC52)',
    'linear-gradient(135deg,#7F1D1D,#EF4444)',
    'linear-gradient(135deg,#7C2D12,#F97316)',
    'linear-gradient(135deg,#0C4A6E,#06B6D4)',
    'linear-gradient(135deg,#2E1065,#8B5CF6)',
    'linear-gradient(135deg,#1E3A5F,#3B82F6)',
    'linear-gradient(135deg,#831843,#EC4899)',
    'linear-gradient(135deg,#064E3B,#10B981)',
  ];

  return (
    <div className="mb-5">
      <SRow title="Featured Merchants" sub="Trusted local businesses" onAll={() => {}} />
      {loading ? (
        <div className="flex gap-3 overflow-x-auto px-5" style={{ scrollbarWidth: 'none' }}>
          {[1, 2, 3].map((i) => (
            <Bone key={i} w={290} h={178} />
          ))}
        </div>
      ) : error ? (
        <div className="px-5" style={{ padding: '16px 20px' }}>
          <div
            style={{
              background: 'rgba(239,68,68,.07)',
              border: '1px solid rgba(239,68,68,.18)',
              borderRadius: 14,
              padding: '14px 16px',
            }}
          >
            <p
              style={{
                fontFamily: "'Inter',sans-serif",
                fontSize: 13,
                color: 'rgba(255,255,255,.5)',
                marginBottom: 8,
              }}
            >
              {error}
            </p>
            <button
              onClick={load}
              style={{
                background: 'rgba(43,172,82,.1)',
                border: '1px solid rgba(43,172,82,.25)',
                borderRadius: 8,
                padding: '6px 14px',
                color: G3,
                fontFamily: "'Inter',sans-serif",
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        </div>
      ) : merchants.length === 0 ? (
        <div style={{ padding: '24px 20px', textAlign: 'center' }}>
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: MUTED }}>
            No merchants found
            {active ? ` in ${MERCHANT_CATEGORY_LABEL[active]}` : ''}.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 px-5">
          {merchants.map((m, idx) => {
            const isOpen = m.isOpenNow;
            const bg = BG_POOL[idx % BG_POOL.length];
            const icon = categoryIcon(m.category);
            const verified = m.verificationStatus === 'VERIFIED';
            const rating = m.rating?.average ?? 0;
            const dist = m.distanceKm != null ? `${m.distanceKm.toFixed(1)} km` : '';
            return (
              <div
                key={m.id}
                className="overflow-hidden rounded-3xl"
                style={{
                  background: NAVY_CARD,
                  border: `1.5px solid ${BORDER}`,
                  boxShadow: '0 4px 20px rgba(0,0,0,.28)',
                }}
              >
                <div
                  className="relative flex h-[88px] items-center justify-center"
                  style={{ background: m.coverPhotoUrl ? undefined : bg }}
                >
                  {m.coverPhotoUrl ? (
                    <ImageWithFallback
                      src={m.coverPhotoUrl}
                      alt={m.businessName}
                      className="absolute inset-0 h-full w-full object-cover"
                      fallbackEmoji="🛍️"
                      loading="lazy"
                    />
                  ) : (
                    /* A monogram, not a giant emoji. Emoji are bitmap glyphs —
                       they blur on high-DPI screens, and they look like a
                       different app on every OS. Initials in Poppins over the
                       category gradient stay vector-sharp at any density, and
                       they identify the merchant rather than their sector. */
                    <div
                      className="absolute inset-0 flex items-center justify-center overflow-hidden"
                      aria-hidden="true"
                    >
                      <span
                        style={{
                          fontFamily: "'Poppins',sans-serif",
                          fontSize: 30,
                          fontWeight: 700,
                          letterSpacing: '0.06em',
                          lineHeight: 1,
                          color: 'rgba(255,255,255,.92)',
                          textShadow: '0 2px 10px rgba(0,0,0,.28)',
                        }}
                      >
                        {monogram(m.businessName)}
                      </span>
                      <Icon
                        name={icon}
                        size={17}
                        color="rgba(255,255,255,.55)"
                        style={{ position: 'absolute', right: 10, bottom: 8 }}
                      />
                    </div>
                  )}
                  <div className="absolute left-3 top-3">
                    {verified && (
                      <span
                        className="rounded-lg px-2 py-1 text-[9px] font-bold"
                        style={{
                          // A dark scrim, not a green tint. The tint sat on
                          // whichever gradient the card drew, so green-on-red
                          // was barely readable; this reads the same on all
                          // eight banner colours and on a photo.
                          background: 'rgba(6,14,28,.55)',
                          color: G3,
                          border: `1px solid rgba(71,207,114,.35)`,
                          backdropFilter: 'blur(6px)',
                          fontFamily: "'Inter',sans-serif",
                        }}
                      >
                        ✓ Verified
                      </span>
                    )}
                  </div>
                  <div className="absolute right-3 top-3 flex items-center gap-1.5">
                    {isOpen === false && (
                      <span
                        className="rounded-lg px-2 py-1 text-[9px] font-bold"
                        style={{
                          background: 'rgba(239,68,68,.2)',
                          color: '#FCA5A5',
                          border: '1px solid rgba(239,68,68,.25)',
                          fontFamily: "'Inter',sans-serif",
                        }}
                      >
                        Closed
                      </span>
                    )}
                    {isOpen === null && (
                      <span
                        className="rounded-lg px-2 py-1 text-[9px] font-bold"
                        style={{
                          background: 'rgba(255,255,255,.12)',
                          color: 'rgba(255,255,255,.6)',
                          fontFamily: "'Inter',sans-serif",
                        }}
                      >
                        Hours unavailable
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5 flex items-center gap-2">
                      <p
                        className="truncate text-[13.5px] font-bold"
                        style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
                      >
                        {m.businessName}
                      </p>
                      {verified && <VerifiedBadge />}
                    </div>
                    <p
                      className="mb-1.5 text-[10px]"
                      style={{ color: MUTED, fontFamily: "'Inter',sans-serif" }}
                    >
                      {m.category ? MERCHANT_CATEGORY_LABEL[m.category] : 'Business'}
                    </p>
                    <div className="flex items-center gap-3">
                      {rating > 0 && (
                        <span className="text-[10px] font-bold" style={{ color: '#FBBF24' }}>
                          ★ {rating.toFixed(1)}
                        </span>
                      )}
                      {dist && (
                        <span
                          className="text-[10px]"
                          style={{ color: MUTED, fontFamily: "'Inter',sans-serif" }}
                        >
                          📍 {dist}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => isOpen !== false && onStore?.(m.id)}
                    className="h-9 flex-shrink-0 rounded-xl px-4 text-[11px] font-semibold transition-all active:scale-95"
                    style={{
                      background:
                        isOpen !== false
                          ? `linear-gradient(135deg,${G0},${G2})`
                          : 'rgba(255,255,255,.07)',
                      color: isOpen !== false ? '#FFF' : 'rgba(255,255,255,.3)',
                      fontFamily: "'Inter',sans-serif",
                      boxShadow: isOpen !== false ? `0 3px 12px rgba(43,172,82,.22)` : 'none',
                    }}
                  >
                    {isOpen === false ? 'Closed' : 'Visit Store'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TRENDING PRODUCTS
// ─────────────────────────────────────────────────────────────────────────────
function TrendingProducts() {
  const [products, setProducts] = useState<ProductSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [wishlist, setWishlist] = useState<Set<number>>(new Set());
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [cartError, setCartError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.marketplace.getTrendingProducts({ limit: 12 });
      const r = res as { items?: ProductSummaryDto[] };
      setProducts(r.items ?? []);
    } catch (e: unknown) {
      setError((e as { message?: string }).message ?? 'Could not load products');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (i: number) =>
    setWishlist((w) => {
      const n = new Set(w);
      n.has(i) ? n.delete(i) : n.add(i);
      return n;
    });

  // Single-merchant server cart. A cross-merchant add throws an error whose message
  // contains "merchant" → surface a friendly note instead of swallowing it.
  const addCart = (p: ProductSummaryDto) => {
    if (pending.has(p.id) || added.has(p.id)) return;
    setPending((s) => new Set(s).add(p.id));
    setCartError('');
    api.cart
      .addItem({
        merchantId: p.merchantId,
        productId: p.id,
        productName: p.name,
        unitPrice: p.basePrice,
        quantity: 1,
        imageUrl: p.primaryImageUrl ?? undefined,
      })
      .then(() => setAdded((s) => new Set(s).add(p.id)))
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Could not add to cart';
        setCartError(
          /merchant/i.test(msg)
            ? 'Your cart already has items from another store. Clear it to add from here.'
            : msg,
        );
      })
      .finally(() =>
        setPending((s) => {
          const n = new Set(s);
          n.delete(p.id);
          return n;
        }),
      );
  };

  return (
    <div className="mb-5">
      <SRow title="Trending Products 🔥" onAll={() => {}} />
      {cartError && (
        <div className="mb-2 px-5">
          <p className="text-[10px]" style={{ color: '#FCA5A5', fontFamily: "'Inter',sans-serif" }}>
            {cartError}
          </p>
        </div>
      )}
      {loading ? (
        <div className="flex gap-3 overflow-x-auto px-5" style={{ scrollbarWidth: 'none' }}>
          {[1, 2, 3, 4].map((i) => (
            <Bone key={i} w={145} h={212} />
          ))}
        </div>
      ) : error ? (
        <div className="px-5">
          <div
            style={{
              background: 'rgba(239,68,68,.07)',
              border: '1px solid rgba(239,68,68,.18)',
              borderRadius: 14,
              padding: '14px 16px',
            }}
          >
            <p
              style={{
                fontFamily: "'Inter',sans-serif",
                fontSize: 13,
                color: 'rgba(255,255,255,.5)',
                marginBottom: 8,
              }}
            >
              {error}
            </p>
            <button
              onClick={load}
              style={{
                background: 'rgba(43,172,82,.1)',
                border: '1px solid rgba(43,172,82,.25)',
                borderRadius: 8,
                padding: '6px 14px',
                color: G3,
                fontFamily: "'Inter',sans-serif",
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        </div>
      ) : products.length === 0 ? (
        <div style={{ padding: '24px 20px', textAlign: 'center' }}>
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: MUTED }}>
            No trending products right now.
          </p>
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto px-5" style={{ scrollbarWidth: 'none' }}>
          {products.map((p, i) => {
            const rating = p.rating?.average ?? 0;
            const isPending = pending.has(p.id);
            const isAdded = added.has(p.id);
            return (
              <div
                key={p.id}
                className="flex-shrink-0 overflow-hidden rounded-3xl"
                style={{ width: 145, background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
              >
                <div
                  className="relative flex h-[82px] items-center justify-center"
                  style={{ background: 'linear-gradient(135deg,#0D1B2E,#1A2E45)' }}
                >
                  <ImageWithFallback
                    src={p.primaryImageUrl ?? undefined}
                    alt={p.name}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  {/* GAP: backend product has no discount/original price → no "-%" badge. */}
                  <button
                    onClick={() => toggle(i)}
                    className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-xl transition-all active:scale-90"
                    style={{
                      background: wishlist.has(i) ? 'rgba(239,68,68,.18)' : 'rgba(0,0,0,.35)',
                    }}
                  >
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill={wishlist.has(i) ? '#F87171' : 'none'}
                      stroke={wishlist.has(i) ? '#F87171' : 'rgba(255,255,255,.6)'}
                      strokeWidth="2"
                      strokeLinecap="round"
                    >
                      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                    </svg>
                  </button>
                </div>
                <div className="p-3">
                  <p
                    className="mb-0.5 truncate text-[11.5px] font-bold leading-tight"
                    style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
                  >
                    {p.name}
                  </p>
                  <p
                    className="mb-1.5 text-[9.5px]"
                    style={{ color: MUTED, fontFamily: "'Inter',sans-serif" }}
                  >
                    {p.merchantName}
                  </p>
                  <div className="mb-1 flex items-center gap-1.5">
                    <span className="text-[9.5px] font-bold" style={{ color: '#FBBF24' }}>
                      {rating > 0 ? `★ ${rating.toFixed(1)}` : '★ —'}
                    </span>
                  </div>
                  {/* GAP: backend has no "was"/original price → line-through omitted. */}
                  <p
                    className="mb-2.5 text-[13px] font-bold"
                    style={{ fontFamily: "'Poppins',sans-serif", color: G3 }}
                  >
                    {naira(p.basePrice)}
                  </p>
                  <button
                    onClick={() => addCart(p)}
                    disabled={!p.inStock || isPending || isAdded}
                    className="h-[28px] w-full rounded-xl text-[10px] font-semibold transition-all active:scale-95"
                    style={{
                      background:
                        p.inStock && !isAdded
                          ? `linear-gradient(135deg,${G0},${G2})`
                          : 'rgba(255,255,255,.07)',
                      color: p.inStock && !isAdded ? '#FFF' : 'rgba(255,255,255,.4)',
                      fontFamily: "'Inter',sans-serif",
                      boxShadow: p.inStock && !isAdded ? `0 3px 10px rgba(43,172,82,.22)` : 'none',
                    }}
                  >
                    {!p.inStock
                      ? 'Out of stock'
                      : isPending
                        ? 'Adding…'
                        : isAdded
                          ? 'Added ✓'
                          : 'Add to Cart'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NEARBY BUSINESSES
// ─────────────────────────────────────────────────────────────────────────────
function NearbyBusinesses({ onStore }: { onStore?: (merchantId: string) => void }) {
  const [merchants, setMerchants] = useState<MerchantSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.marketplace.getMerchants({ limit: 8 });
      const r = res as { items?: MerchantSummaryDto[] };
      setMerchants(r.items ?? []);
    } catch (e: unknown) {
      setError((e as { message?: string }).message ?? 'Could not load businesses');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mb-5">
      <SRow title="Nearby Businesses" sub="Based on your location" onAll={() => {}} />
      <div className="flex flex-col gap-0 px-5">
        <div
          className="overflow-hidden rounded-3xl"
          style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
        >
          {loading ? (
            [1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-4 py-3.5"
                style={{ borderBottom: `1px solid ${BORDER}` }}
              >
                <Bone w={40} h={40} r={14} />
                <div className="flex flex-1 flex-col gap-2">
                  <Bone w="55%" h={11} r={6} />
                  <Bone w="40%" h={9} r={6} />
                </div>
              </div>
            ))
          ) : error ? (
            <div style={{ padding: '16px' }}>
              <p
                style={{
                  fontFamily: "'Inter',sans-serif",
                  fontSize: 13,
                  color: 'rgba(255,255,255,.5)',
                  marginBottom: 8,
                }}
              >
                {error}
              </p>
              <button
                onClick={load}
                style={{
                  background: 'rgba(43,172,82,.1)',
                  border: '1px solid rgba(43,172,82,.25)',
                  borderRadius: 8,
                  padding: '6px 14px',
                  color: G3,
                  fontFamily: "'Inter',sans-serif",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Retry
              </button>
            </div>
          ) : merchants.length === 0 ? (
            <div style={{ padding: '24px 20px', textAlign: 'center' }}>
              <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: MUTED }}>
                No nearby businesses found.
              </p>
            </div>
          ) : (
            merchants.map((m, i) => {
              const isOpen = m.isOpenNow !== false;
              const rating = m.rating?.average ?? 0;
              const dist = m.distanceKm != null ? `${m.distanceKm.toFixed(1)} km` : '—';
              const icon = categoryIcon(m.category);
              return (
                <div
                  key={m.id}
                  className="flex items-center gap-3 px-4 py-3.5 transition-colors active:bg-white/[.025]"
                  style={{
                    borderBottom: i < merchants.length - 1 ? `1px solid ${BORDER}` : 'none',
                  }}
                >
                  <div
                    className="flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-2xl"
                    style={{ background: 'rgba(255,255,255,.06)' }}
                  >
                    <Icon name={icon} size={20} color="rgba(255,255,255,.6)" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p
                        className="truncate text-[12.5px] font-semibold"
                        style={{
                          fontFamily: "'Poppins',sans-serif",
                          color: isOpen ? '#FFF' : 'rgba(255,255,255,.4)',
                        }}
                      >
                        {m.businessName}
                      </p>
                      {m.isOpenNow === false && (
                        <span
                          className="flex-shrink-0 rounded-md px-1.5 py-0.5 text-[8px] font-bold"
                          style={{ background: 'rgba(239,68,68,.12)', color: '#FCA5A5' }}
                        >
                          Closed
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9.5px] font-bold" style={{ color: '#FBBF24' }}>
                        {rating > 0 ? `★ ${rating.toFixed(1)}` : '★ —'}
                      </span>
                      {/* GAP: backend has no delivery ETA → "—". */}
                      <span
                        className="text-[9.5px]"
                        style={{ color: MUTED, fontFamily: "'Inter',sans-serif" }}
                      >
                        📍 {dist} · ⏱ —
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 flex-col items-end gap-1">
                    {/* GAP: backend has no delivery fee → "—". */}
                    <p
                      className="text-[10px] font-semibold"
                      style={{ color: MUTED, fontFamily: "'Inter',sans-serif" }}
                    >
                      —
                    </p>
                    <button
                      onClick={() => isOpen && onStore?.(m.id)}
                      className="h-7 rounded-xl px-3 text-[10px] font-semibold transition-all active:scale-95"
                      style={{
                        background: isOpen
                          ? `linear-gradient(135deg,${G0},${G2})`
                          : 'rgba(255,255,255,.06)',
                        color: isOpen ? '#FFF' : 'rgba(255,255,255,.25)',
                        fontFamily: "'Inter',sans-serif",
                      }}
                    >
                      {isOpen ? 'Order' : 'Closed'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AI RECOMMENDATIONS
// ─────────────────────────────────────────────────────────────────────────────
// Was a fake "AI Picks for You / Personalised recommendations" section over a
// hardcoded AI_RECS const. GAP: no AI backend exists — there is no personalisation
// engine. Now wired to real featured products from the marketplace API and
// honestly relabelled (no "AI" / "Personalised" claim).
function AIRecs() {
  const [products, setProducts] = useState<ProductSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.marketplace.getFeaturedProducts({ limit: 8 });
      const r = res as { items?: ProductSummaryDto[] };
      setProducts(r.items ?? []);
    } catch (e: unknown) {
      setError((e as { message?: string }).message ?? 'Could not load recommendations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mb-5">
      <SRow title="Recommended for You" sub="Popular picks in the marketplace" onAll={() => {}} />
      {loading ? (
        <div className="flex gap-3 overflow-x-auto px-5" style={{ scrollbarWidth: 'none' }}>
          {[1, 2, 3, 4].map((i) => (
            <Bone key={i} w={130} h={148} />
          ))}
        </div>
      ) : error ? (
        <div className="px-5">
          <div
            style={{
              background: 'rgba(239,68,68,.07)',
              border: '1px solid rgba(239,68,68,.18)',
              borderRadius: 14,
              padding: '14px 16px',
            }}
          >
            <p
              style={{
                fontFamily: "'Inter',sans-serif",
                fontSize: 13,
                color: 'rgba(255,255,255,.5)',
                marginBottom: 8,
              }}
            >
              {error}
            </p>
            <button
              onClick={load}
              style={{
                background: 'rgba(43,172,82,.1)',
                border: '1px solid rgba(43,172,82,.25)',
                borderRadius: 8,
                padding: '6px 14px',
                color: G3,
                fontFamily: "'Inter',sans-serif",
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        </div>
      ) : products.length === 0 ? (
        <div style={{ padding: '24px 20px', textAlign: 'center' }}>
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: MUTED }}>
            No recommendations right now.
          </p>
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto px-5" style={{ scrollbarWidth: 'none' }}>
          {products.map((p) => (
            <button
              key={p.id}
              className="flex flex-shrink-0 flex-col items-center gap-2.5 rounded-2xl p-3.5 transition-all active:scale-95"
              style={{ width: 130, background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
            >
              <div
                className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl text-[26px]"
                style={{ background: 'rgba(255,255,255,.06)' }}
              >
                <ImageWithFallback
                  src={p.primaryImageUrl ?? undefined}
                  alt={p.name}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="w-full text-center">
                <p
                  className="truncate text-[11.5px] font-bold"
                  style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
                >
                  {p.name}
                </p>
                <p
                  className="mt-0.5 truncate text-[9.5px]"
                  style={{ color: MUTED, fontFamily: "'Inter',sans-serif" }}
                >
                  {p.merchantName}
                </p>
              </div>
              <span
                className="text-[11px] font-bold"
                style={{ color: G3, fontFamily: "'Poppins',sans-serif" }}
              >
                {naira(p.basePrice)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────────
function EmptyState({
  onChangeLocation,
  onBrowseAll,
}: {
  onChangeLocation: () => void;
  onBrowseAll: () => void;
}) {
  return (
    <div className="flex flex-col items-center px-8 py-10 text-center">
      <div
        className="mb-4 flex h-20 w-20 items-center justify-center rounded-full"
        style={{ background: `rgba(43,172,82,.08)`, border: `1.5px solid rgba(43,172,82,.2)` }}
      >
        <span style={{ fontSize: 38 }}>📍</span>
      </div>
      <p
        className="mb-2 text-[16px] font-bold"
        style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
      >
        No nearby merchants found.
      </p>
      <p
        className="mb-6 text-[12px]"
        style={{ color: MUTED, fontFamily: "'Inter',sans-serif", lineHeight: 1.6 }}
      >
        Try a different location or browse the full catalogue.
      </p>
      <div className="flex w-full gap-3">
        <button
          onClick={onChangeLocation}
          className="h-11 flex-1 rounded-2xl text-[12px] font-semibold transition-all active:scale-95"
          style={{
            background: 'rgba(255,255,255,.07)',
            color: 'rgba(255,255,255,.7)',
            border: `1px solid ${BORDER}`,
            fontFamily: "'Inter',sans-serif",
          }}
        >
          Change Location
        </button>
        <button
          onClick={onBrowseAll}
          className="h-11 flex-1 rounded-2xl text-[12px] font-semibold transition-all active:scale-95"
          style={{
            background: `linear-gradient(135deg,${G0},${G2})`,
            color: '#FFF',
            fontFamily: "'Inter',sans-serif",
            boxShadow: `0 4px 16px rgba(43,172,82,.28)`,
          }}
        >
          Browse All
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BOTTOM NAV
// ─────────────────────────────────────────────────────────────────────────────
type NavTab = 'home' | 'market' | 'ride' | 'wallet' | 'profile';

function BottomNav({ onNav }: { onNav: (t: NavTab) => void }) {
  const [active, setActive] = useState<NavTab>('market');
  const tabs: { key: NavTab; label: string; d: string }[] = [
    { key: 'home', label: 'Home', d: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2zM9 22V12h6v10' },
    {
      key: 'market',
      label: 'Marketplace',
      d: 'M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0',
    },
    {
      key: 'ride',
      label: 'Ride',
      d: 'M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v9a2 2 0 01-2 2h-2M7 17a2 2 0 100 4 2 2 0 000-4zM17 17a2 2 0 100 4 2 2 0 000-4z',
    },
    {
      key: 'wallet',
      label: 'Wallet',
      d: 'M21 4H3a2 2 0 00-2 2v12a2 2 0 002 2h18a2 2 0 002-2V6a2 2 0 00-2-2zM1 10h22',
    },
    {
      key: 'profile',
      label: 'Profile',
      d: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 3a4 4 0 100 8 4 4 0 000-8z',
    },
  ];
  return (
    <div
      className="absolute bottom-0 left-0 right-0 flex items-center justify-around px-1 pb-6 pt-2"
      style={{
        background: 'rgba(6,14,28,.95)',
        borderTop: `1px solid ${BORDER}`,
        backdropFilter: 'blur(24px)',
      }}
    >
      {tabs.map((t) => {
        const on = active === t.key;
        return (
          <button
            key={t.key}
            onClick={() => {
              setActive(t.key);
              onNav(t.key);
            }}
            className="flex flex-col items-center gap-1 px-2 transition-all active:scale-90"
            style={{ minWidth: 52 }}
          >
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{
                background: on ? 'rgba(43,172,82,.15)' : 'transparent',
                border: on ? '1px solid rgba(43,172,82,.3)' : '1px solid transparent',
                transition: 'all .22s ease',
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke={on ? G3 : 'rgba(255,255,255,.3)'}
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d={t.d} />
              </svg>
            </div>
            <p
              className="text-[9px] font-semibold"
              style={{
                color: on ? G3 : 'rgba(255,255,255,.28)',
                fontFamily: "'Inter',sans-serif",
                transition: 'color .22s ease',
              }}
            >
              {t.label}
            </p>
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FLOATING AI
// ─────────────────────────────────────────────────────────────────────────────
function FloatingAI({ onPress }: { onPress: () => void }) {
  return (
    <button
      onClick={onPress}
      className="absolute z-40 transition-all active:scale-90"
      style={{ bottom: 94, right: 18 }}
      aria-label="AI Shopping Assistant"
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: `linear-gradient(135deg,${G0},${G2})`,
          boxShadow: `0 6px 28px rgba(43,172,82,.5), 0 0 0 1.5px rgba(43,172,82,.3)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'avatar-pulse 3s ease-in-out infinite',
        }}
      >
        <span style={{ fontSize: 22 }}>✨</span>
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AI SHEET
// ─────────────────────────────────────────────────────────────────────────────
function AISheet({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="absolute inset-0 z-50 flex flex-col justify-end"
      style={{
        background: 'rgba(0,0,0,.72)',
        backdropFilter: 'blur(10px)',
        animation: 'fade-in .2s ease',
      }}
    >
      <div
        className="rounded-t-[32px] p-5 pb-8"
        style={{
          background: 'linear-gradient(180deg,#0D1F2E 0%,#091420 100%)',
          border: '1.5px solid rgba(43,172,82,.18)',
          boxShadow: '0 -20px 60px rgba(0,0,0,.5)',
        }}
      >
        <div
          className="mx-auto mb-5 h-1 w-10 rounded-full"
          style={{ background: 'rgba(255,255,255,.14)' }}
        />
        <div className="mb-5 flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-2xl"
            style={{
              background: `linear-gradient(135deg,${G0},${G2})`,
              boxShadow: `0 6px 20px rgba(43,172,82,.35)`,
            }}
          >
            <span style={{ fontSize: 22 }}>✨</span>
          </div>
          <div>
            <p
              className="text-[16px] font-bold"
              style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
            >
              Ask Drip
            </p>
            <p className="text-[11px]" style={{ color: G3, fontFamily: "'Inter',sans-serif" }}>
              Coming soon
            </p>
          </div>
        </div>
        {/* GAP: no AI backend exists — honest "coming soon" panel, no answer-pretending chips. */}
        <div
          className="mb-5 rounded-2xl px-4 py-4"
          style={{ background: 'rgba(255,255,255,.045)', border: `1px solid ${BORDER}` }}
        >
          <p
            className="text-[13px] leading-relaxed"
            style={{ color: 'rgba(255,255,255,.78)', fontFamily: "'Inter',sans-serif" }}
          >
            Ask Drip is coming soon. Our AI shopping assistant isn't available yet — check back
            later to find products, stores and deals by just describing what you need.
          </p>
        </div>
        <button
          onClick={onClose}
          className="active:scale-97 h-12 w-full rounded-2xl text-[13px] font-semibold transition-all"
          style={{
            background: 'rgba(255,255,255,.07)',
            color: 'rgba(255,255,255,.4)',
            fontFamily: "'Inter',sans-serif",
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MARKETPLACE SCREEN — HOME-002
// ─────────────────────────────────────────────────────────────────────────────
export function MarketplaceScreen({
  onBack,
  onHome,
  onAccount,
  onNotifications,
  onStore,
  onCart,
  onTab,
  initialCategory = null,
  onSearch,
}: {
  onBack: () => void;
  onHome: () => void;
  onAccount: () => void;
  onNotifications: () => void;
  onStore?: (merchantId: string) => void;
  onCart?: () => void;
  /** App's single footer-tab router. */
  onTab?: (tab: NavTab) => void;
  /** Open with a category already selected — how the home screen's Hotels
   *  quick action lands the customer on hotels rather than on everything. */
  initialCategory?: MerchantCategory | null;
  /** Where the search bar goes. Falls back to Home, which is where the search
   *  that queries the catalogue lives. */
  onSearch?: () => void;
}) {
  const [activecat, setActivecat] = useState<MerchantCategory | null>(initialCategory);
  const [showAI, setShowAI] = useState(false);
  // Real cart badge — reflects the customer's actual server-side cart, never a
  // hardcoded number. 0 when the cart is empty or the fetch fails.
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    api.cart
      .get()
      .then((c) => setCartCount(c ? c.items.reduce((n, it) => n + it.quantity, 0) : 0))
      .catch(() => {});
  }, []);

  const handleNav = (t: NavTab) => {
    // Delegate to App's single tab router when wired; the local fallback
    // below only ever handled two of the five tabs, so Ride and Wallet did
    // nothing at all from this screen.
    if (onTab) {
      onTab(t);
      return;
    }
    if (t === 'home') onHome();
    if (t === 'profile') onAccount();
  };

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{ background: NAVY_DEEP }}
    >
      <MpHeader
        onBack={onBack}
        onCart={onCart ?? (() => {})}
        onNotif={onNotifications}
        onSearch={onSearch ?? onHome}
        cartCount={cartCount}
      />

      <div
        className="flex-1 overflow-y-auto"
        style={{
          scrollbarWidth: 'none',
          background: `linear-gradient(180deg,${NAVY_DEEP} 0%,#060E1C 100%)`,
        }}
      >
        <CategoryChips active={activecat} onChange={setActivecat} />
        <AIDiscovery onAsk={() => setShowAI(true)} />
        <FeaturedMerchants active={activecat} onStore={onStore} />
        <TrendingProducts />
        <NearbyBusinesses onStore={onStore} />
        <AIRecs />

        <div style={{ height: 104 }} />
      </div>

      <FloatingAI onPress={() => setShowAI(true)} />
      <BottomNav onNav={handleNav} />
      {showAI && <AISheet onClose={() => setShowAI(false)} />}
    </div>
  );
}
