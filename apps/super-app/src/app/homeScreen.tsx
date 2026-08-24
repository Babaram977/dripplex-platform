import React, { useState, useEffect } from 'react';
import {
  G0,
  G2,
  G3,
  NAVY_DEEP,
  NAVY_BASE,
  NAVY_CARD,
  NAVY_SURFACE,
  BORDER,
  MUTED,
  timeGreeting,
} from './shared';
import { api } from '../lib/api';
import { auth } from '../lib/auth';
import type {
  PromotionActiveDto,
  MerchantSummaryDto,
  OrderDto,
  ProductSummaryDto,
  CategoryDto,
  WalletDto,
  WalletLedgerEntryDto,
} from '../lib/api';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';
import { Icon, type IconName } from './icons';
import { monogram } from './marketplaceScreen';

// Relative time for real wallet activity timestamps.
function relTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = new Date().getTime();
  const s = Math.max(0, Math.floor((now - then) / 1000));
  if (s < 60) return 'Just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'Yesterday';
  return `${d} days ago`;
}

const TXN_ICON: Record<WalletLedgerEntryDto['type'], string> = {
  CREDIT: '↙',
  DEBIT: '↗',
  REFUND: '↩',
  SETTLEMENT: '🏦',
  CASHBACK: '🎁',
  WITHDRAWAL: '🏧',
  TRANSFER: '🔁',
};

// ─────────────────────────────────────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────────────────────────────────────
const CATS: { icon: IconName; label: string }[] = [
  { icon: 'supermarket', label: 'Supermarkets' },
  { icon: 'restaurant', label: 'Restaurants' },
  { icon: 'pharmacy', label: 'Pharmacy' },
  { icon: 'fashion', label: 'Fashion' },
  { icon: 'electronics', label: 'Electronics' },
  { icon: 'beauty', label: 'Beauty' },
  { icon: 'home', label: 'Home' },
  { icon: 'hardware', label: 'Hardware' },
];

/**
 * `ready: false` means the destination does not exist yet. Those tiles are
 * dimmed and marked "Soon" rather than left looking tappable — a tile that
 * swallows a tap silently is worse than one that says it is not built. No
 * screen is invented to fill them; the gap is recorded in the diff register.
 */
const QUICK: { icon: IconName; label: string; color: string; ready: boolean }[] = [
  { icon: 'marketplace', label: 'Marketplace', color: '#2BAC52', ready: true },
  { icon: 'ride', label: 'Ride', color: '#3B82F6', ready: true },
  { icon: 'wallet', label: 'Wallet', color: '#8B5CF6', ready: true },
  { icon: 'orders', label: 'Orders', color: '#F59E0B', ready: true },
  { icon: 'utilities', label: 'Utilities', color: '#06B6D4', ready: true },
  { icon: 'food', label: 'Food', color: '#F97316', ready: true },
  // Hotels replaced a dead "Health" placeholder on 2026-08-23. The hotel flow
  // has been live since #233 with no entry point anywhere on Home, the nav or
  // the category row — the only route was a Marketplace chip sitting 9th of 12
  // in a scrolling strip, off-screen on a 390px phone. Reported by the founder
  // as "I cannot find the hotel menu or icon", which is exactly what it was.
  //
  // Taking Health's slot rather than adding a ninth tile keeps the approved
  // 8-tile grid intact: a built feature displaces an unbuilt one.
  { icon: 'hotel', label: 'Hotels', color: '#10B981', ready: true },
  { icon: 'more', label: 'More', color: '#6B7280', ready: false },
];

// ─────────────────────────────────────────────────────────────────────────────
// PRIMITIVES
// ─────────────────────────────────────────────────────────────────────────────
function Row({ title, onAll }: { title: string; onAll?: () => void }) {
  return (
    <div className="mb-3 flex items-center justify-between px-5">
      <p
        className="text-[15px] font-bold"
        style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
      >
        {title}
      </p>
      {onAll && (
        <button
          onClick={onAll}
          className="text-[12px] font-semibold active:opacity-60"
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

// ─────────────────────────────────────────────────────────────────────────────
// STATUS BAR (inline, no import needed)
// ─────────────────────────────────────────────────────────────────────────────
function HomeStatusBar() {
  return (
    <div
      className="dx-status-mock flex items-center justify-between px-5 pb-1 pt-[52px]"
      style={{ fontSize: 11, color: 'rgba(255,255,255,.38)', fontFamily: "'Inter',sans-serif" }}
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
function Header({
  greeting,
  name,
  initial,
  onNotif,
  onProfile,
  query,
  onQuery,
  onSubmit,
}: {
  greeting: string;
  /** The whole greeting line, e.g. "Hi, Sameer" — this is a sentence. */
  name: string;
  /** The avatar letter, from the PERSON's name.
   *
   *  It used to be derived from `name` with `.charAt(0)`, and `name` is the
   *  greeting sentence — so the avatar read the first letter of "Hi", and
   *  every customer on every screen saw the same "H". A signed-in user with
   *  no name fell back to "Hello", which is also H, so nothing ever revealed
   *  the mistake. Passed in separately now, from the user record. */
  initial: string;
  onNotif: () => void;
  onProfile: () => void;
  query: string;
  onQuery: (v: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div
      className="relative overflow-hidden"
      style={{
        background: 'linear-gradient(175deg,#0B2317 0%,#0D2A1C 55%,#091420 100%)',
        paddingBottom: 20,
      }}
    >
      <div
        className="pointer-events-none absolute -right-14 -top-14 h-48 w-48 rounded-full"
        style={{ background: `radial-gradient(circle,${G2} 0%,transparent 68%)`, opacity: 0.12 }}
      />
      <div
        className="pointer-events-none absolute -left-10 top-10 h-32 w-32 rounded-full"
        style={{ background: `radial-gradient(circle,${G0} 0%,transparent 70%)`, opacity: 0.16 }}
      />

      <HomeStatusBar />

      <div className="relative z-10 mt-2 flex items-center justify-between px-5">
        <div>
          <div className="mb-1 flex items-center gap-1.5">
            <span style={{ fontSize: 15 }}>👋</span>
            <p
              className="text-[12px]"
              style={{ color: 'rgba(255,255,255,.48)', fontFamily: "'Inter',sans-serif" }}
            >
              {greeting}
            </p>
          </div>
          <p
            className="text-[22px] font-bold leading-tight"
            style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
          >
            {name}
          </p>
          <p
            className="mt-0.5 text-[11px] font-semibold"
            style={{ color: G3, fontFamily: "'Inter',sans-serif", letterSpacing: '0.05em' }}
          >
            life,Simplified
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={onNotif}
            className="relative flex h-[42px] w-[42px] items-center justify-center rounded-2xl transition-all active:scale-90"
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
            >
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
            </svg>
            <div
              className="absolute right-2 top-2 h-2 w-2 rounded-full"
              style={{ background: '#F87171', border: '1.5px solid #0B2317' }}
            />
          </button>
          <button
            onClick={onProfile}
            className="flex h-[42px] w-[42px] items-center justify-center rounded-2xl transition-all active:scale-90"
            style={{
              background: `linear-gradient(135deg,${G0},${G2})`,
              boxShadow: `0 4px 14px rgba(43,172,82,.3)`,
            }}
          >
            <span
              className="text-[17px] font-bold text-white"
              style={{ fontFamily: "'Poppins',sans-serif" }}
            >
              {initial}
            </span>
          </button>
        </div>
      </div>

      {/* Search — a real <input>, not the <p> that used to sit here. Typing
          searches merchants and products against /merchants/smart-search and
          /products/smart-search; Enter searches immediately.

          The mic and QR buttons that flanked it are gone. Both were <button>s
          with no handler, and there is no voice-search or QR endpoint to give
          them — inventing one would be guessing at a contract. Recorded as a
          gap rather than faked. */}
      <div className="relative z-10 mx-5 mt-4">
        <div
          className="flex items-center gap-3 rounded-2xl px-4"
          style={{
            height: 50,
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
              strokeWidth="2.4"
              strokeLinecap="round"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.6-3.6" />
            </svg>
          </div>
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSubmit();
            }}
            placeholder="Search products, rides, pharmacies…"
            aria-label="Search DrippleX"
            className="flex-1 bg-transparent text-[12.5px] outline-none"
            style={{
              color: '#FFF',
              fontFamily: "'Inter',sans-serif",
              minWidth: 0,
            }}
          />
          {query.length > 0 && (
            <button
              onClick={() => onQuery('')}
              aria-label="Clear search"
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl transition-all active:scale-90"
              style={{ background: 'rgba(255,255,255,.06)' }}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="rgba(255,255,255,.6)"
                strokeWidth="2.2"
                strokeLinecap="round"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// REMOVED (founder, 2026-08-18)
//
// ServiceSwitcher / SVC_TABS / SvcKey — the Marketplace · Ride · Wallet tabs.
// `svcTab` was written and never read, so the tabs only moved a highlight and
// the page below never changed.
//
// BalanceCard / ActivateWalletCard — the full-bleed balance card. It duplicated
// the Wallet screen, which owns the balance, income, spend and the
// Send / Receive / Top Up / Pay actions. Home is simpler without it.
//
// Deleted rather than left unreachable: dead components are what make the next
// change harder to reason about.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// QUICK ACTIONS
// ─────────────────────────────────────────────────────────────────────────────
function QuickActions({ onSelect }: { onSelect?: (label: string) => void }) {
  return (
    <div className="mb-5 px-5">
      <div className="grid grid-cols-4 gap-3">
        {QUICK.map((q) => (
          <button
            key={q.label}
            onClick={() => q.ready && onSelect?.(q.label)}
            disabled={!q.ready}
            aria-label={q.ready ? q.label : `${q.label} — coming soon`}
            className="flex flex-col items-center gap-1.5 transition-all active:scale-90"
            style={{ opacity: q.ready ? 1 : 0.42, cursor: q.ready ? 'pointer' : 'default' }}
          >
            <div
              className="relative flex h-[56px] w-[56px] items-center justify-center rounded-2xl"
              style={{
                background: q.color + '18',
                border: `1.5px solid ${q.color}28`,
                boxShadow: q.ready ? `0 4px 16px ${q.color}12` : 'none',
              }}
            >
              {/* An emoji ignored `q.color` entirely — the tile was tinted and
                  the glyph inside it stayed whatever the OS painted. */}
              <Icon name={q.icon} size={26} color={q.color} />
              {!q.ready && (
                // Absolutely positioned so the unbuilt tiles stay the same size
                // as the built ones and the 4×2 grid does not shift.
                <span
                  className="absolute -top-1 right-[-6px] rounded-full px-1.5 py-[1px] text-[7.5px] font-bold"
                  style={{
                    background: 'rgba(255,255,255,.10)',
                    border: '1px solid rgba(255,255,255,.14)',
                    color: 'rgba(255,255,255,.62)',
                    fontFamily: "'Inter',sans-serif",
                    letterSpacing: '.04em',
                  }}
                >
                  SOON
                </span>
              )}
            </div>
            <p
              className="text-center text-[10px] font-medium"
              style={{ color: 'rgba(255,255,255,.58)', fontFamily: "'Inter',sans-serif" }}
            >
              {q.label}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LIVE ORDER CARD
// ─────────────────────────────────────────────────────────────────────────────
/**
 * A customer with an order in flight had no sign of it anywhere on this
 * screen. "Recent Activity" is wallet transactions, not orders, and the only
 * route to a live order was the "Orders" icon among eight in Quick Actions —
 * so anyone who came back to the app after a reload or a re-login had, from
 * where they were standing, lost their order.
 *
 * Real data, existing endpoint, existing tracking screen: this only surfaces
 * what the app already knew, in the place the customer actually lands.
 */
const LIVE_ORDER_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'READY',
  'PICKED_UP',
  'IN_TRANSIT',
];

function LiveOrderCard({ onTrack }: { onTrack: (orderId: string) => void }) {
  const [order, setOrder] = useState<OrderDto | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () => {
      api.orders
        .list({ page: 1, pageSize: 10 })
        .then((res) => {
          if (!alive) return;
          const items =
            (res as { items?: OrderDto[] }).items ??
            (Array.isArray(res) ? (res as OrderDto[]) : []);
          setOrder(items.find((o) => LIVE_ORDER_STATUSES.includes(o.status)) ?? null);
        })
        .catch(() => {
          // No card rather than a wrong one.
        });
    };
    load();
    const timer = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  if (!order) return null;

  const label: Record<string, string> = {
    PENDING: 'Waiting for the store to accept',
    CONFIRMED: 'Accepted by the store',
    PREPARING: 'Being prepared',
    READY: 'Ready — waiting for a rider',
    PICKED_UP: 'Picked up',
    IN_TRANSIT: 'On the way to you',
  };

  return (
    <div className="mb-5 px-5">
      <button
        onClick={() => onTrack(order.id)}
        aria-label="Track your order"
        className="flex w-full items-center gap-3 rounded-2xl p-4 text-left transition-all active:scale-[.98]"
        style={{
          background: 'rgba(43,172,82,.08)',
          border: '1px solid rgba(43,172,82,.25)',
        }}
      >
        <div
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl text-xl"
          style={{ background: 'rgba(43,172,82,.14)' }}
        >
          📦
        </div>
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-[14px] font-semibold text-white"
            style={{ fontFamily: "'Poppins',sans-serif" }}
          >
            Order #{order.orderNumber}
          </p>
          <p
            className="truncate text-[12px]"
            style={{ fontFamily: "'Inter',sans-serif", color: G3 }}
          >
            {label[order.status] ?? 'In progress'}
          </p>
        </div>
        <span className="text-[12px] font-semibold" style={{ color: G3 }}>
          Track →
        </span>
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PARTNER ENTRY CARD — prominent in-feed "Become a Partner" entry point.
// Founder decision: the partner hub gets a prominent in-app entry (it used to be
// buried under the Driver App). Tapping opens the partner choice hub (Sell /
// Drive / Deliver). personaCounts, when supplied from the API, annotate each
// chip; otherwise the chips read as plain labels.
// ─────────────────────────────────────────────────────────────────────────────
function PartnerEntryCard({
  onOpen,
  badgeText = '2,400+ active partners',
  personaCounts,
}: {
  onOpen: () => void;
  badgeText?: string;
  personaCounts?: { sell?: number; drive?: number; deliver?: number };
}) {
  const [pressed, setPressed] = useState(false);
  const handleTap = () => {
    setPressed(true);
    // Brief press-feedback delay before navigating (matches the hub's tap feel).
    setTimeout(() => {
      setPressed(false);
      onOpen();
    }, 145);
  };
  const chips: { icon: string; label: string; count?: number }[] = [
    { icon: '🏪', label: 'Sell', count: personaCounts?.sell },
    { icon: '🚗', label: 'Drive', count: personaCounts?.drive },
    { icon: '🛵', label: 'Deliver', count: personaCounts?.deliver },
  ];
  // Width, twice wrong, so here is the whole rule. `w-full` alongside `mx-5`
  // made the card 100% of the parent PLUS 40px of margin, and it ran off the
  // right edge. Dropping the width was not the fix either: `width: auto` on a
  // <button> is shrink-to-fit, not fill — unlike a <div>, a form control sizes
  // to its content — so the card came up short on the right and read as
  // off-centre. Only an explicit width that subtracts the margins does both.
  return (
    <button
      onClick={handleTap}
      className="mx-5 mb-5 block overflow-hidden rounded-3xl text-left transition-transform"
      style={{
        width: 'calc(100% - 40px)', // 100% minus mx-5 (20px each side)
        background: 'linear-gradient(135deg,#0A1628 0%,#0E1F38 100%)',
        border: '1.5px solid rgba(43,172,82,.28)',
        boxShadow: '0 4px 32px rgba(43,172,82,.10)',
        transform: pressed ? 'scale(0.985)' : 'scale(1)',
      }}
    >
      {/* green gradient accent bar */}
      <div style={{ height: 3, background: `linear-gradient(90deg,${G0},${G2},${G3})` }} />
      <div className="p-4">
        <div className="mb-3 flex items-center gap-3">
          <div
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl"
            style={{
              background:
                'radial-gradient(circle at 30% 30%, rgba(43,172,82,.45), rgba(43,172,82,.12))',
              boxShadow: `0 6px 20px rgba(43,172,82,.30)`,
            }}
          >
            <span style={{ fontSize: 22 }}>🤝</span>
          </div>
          <div className="flex-1">
            <p
              className="text-[15px] font-bold leading-tight"
              style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
            >
              Become a Partner
            </p>
            <p className="text-[11px]" style={{ color: MUTED, fontFamily: "'Inter',sans-serif" }}>
              Sell, drive or deliver on DrippleX · {badgeText}
            </p>
          </div>
        </div>

        <div className="mb-4 flex gap-2">
          {chips.map((c) => (
            <div
              key={c.label}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl px-2 py-2.5"
              style={{ background: 'rgba(43,172,82,.07)', border: '1px solid rgba(43,172,82,.14)' }}
            >
              <span style={{ fontSize: 15 }}>{c.icon}</span>
              <span
                className="text-[11.5px] font-medium"
                style={{ color: 'rgba(255,255,255,.78)', fontFamily: "'Inter',sans-serif" }}
              >
                {c.label}
                {typeof c.count === 'number' ? ` · ${c.count.toLocaleString()}` : ''}
              </span>
            </div>
          ))}
        </div>

        <div
          className="flex h-[46px] w-full items-center justify-center gap-2 rounded-2xl text-[14px] font-semibold"
          style={{
            background: `linear-gradient(135deg,${G0} 0%,${G2} 55%,${G3} 100%)`,
            color: '#FFF',
            fontFamily: "'Poppins',sans-serif",
            boxShadow: `0 8px 24px rgba(43,172,82,.28)`,
          }}
        >
          Join now
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#FFF"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </div>
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROMO CAROUSEL
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORIES
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Live campaigns from the promotions engine. Every line is derived from the
 * campaign's real configuration (percent/amount off, cap, per-user limit), so
 * the app can never advertise a discount the backend would not actually apply.
 * Renders nothing when there are no ACTIVE campaigns — a DRAFT or paused
 * campaign is invisible here, which is what makes it safe to ship campaigns
 * inert and switch them on later from the Ops Console.
 */
function LiveOffers() {
  const [offers, setOffers] = useState<PromotionActiveDto[] | null>(null);

  useEffect(() => {
    if (!auth.isLoggedIn()) return;
    let alive = true;
    void api.promotions
      .active()
      .then((list) => {
        if (alive) setOffers(list);
      })
      .catch(() => {
        if (alive) setOffers([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!offers || offers.length === 0) return null;

  const naira = (n: number) => `₦${n.toLocaleString()}`;
  const headline = (p: PromotionActiveDto): string => {
    if (p.percentOff !== null) return `${p.percentOff}% off`;
    if (p.amountOff !== null) return `${naira(p.amountOff)} off`;
    return 'Offer';
  };
  const terms = (p: PromotionActiveDto): string => {
    const parts: string[] = [];
    if (p.maxDiscount !== null) parts.push(`up to ${naira(p.maxDiscount)}`);
    if (p.minOrderAmount !== null) parts.push(`on orders over ${naira(p.minOrderAmount)}`);
    if (p.perUserLimit === 1) parts.push('once per customer');
    if (p.code) parts.push(`code ${p.code}`);
    else parts.push('applied automatically');
    return parts.join(' · ');
  };

  return (
    <div className="mb-5">
      <Row title="Offers" />
      <div className="flex gap-3 overflow-x-auto px-5" style={{ scrollbarWidth: 'none' }}>
        {offers.map((p) => (
          <div
            key={p.id}
            className="shrink-0 rounded-2xl p-4"
            style={{
              minWidth: 232,
              background: 'linear-gradient(135deg,#0B2317,#123A22)',
              border: `1px solid rgba(43,172,82,.28)`,
            }}
          >
            <p
              className="text-[18px] font-bold"
              style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
            >
              {headline(p)}
            </p>
            <p
              className="mt-0.5 text-[12px] font-semibold"
              style={{ color: G3, fontFamily: "'Inter',sans-serif" }}
            >
              {p.name}
            </p>
            <p
              className="mt-1.5 text-[10px] leading-relaxed"
              style={{ color: MUTED, fontFamily: "'Inter',sans-serif" }}
            >
              {terms(p)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Results for whatever is in the search bar. Merchants and products come back
 * from the two smart-search endpoints; tapping either opens the merchant's
 * store, which is the only destination that exists for both today.
 *
 * A category chip writes its label into the same search box, so the chips and
 * the bar are one mechanism rather than two — that is what makes both of them
 * do something.
 */
function SearchResults({
  term,
  busy,
  error,
  merchants,
  products,
  onStore,
  onRetry,
}: {
  term: string;
  busy: boolean;
  error: string;
  merchants: MerchantSummaryDto[];
  products: ProductSummaryDto[];
  onStore?: (id: string) => void;
  onRetry: () => void;
}) {
  const total = merchants.length + products.length;
  return (
    <div className="mb-5">
      <Row title={`Results for “${term}”`} />
      <div className="px-5">
        {busy ? (
          <div className="flex flex-col gap-2">
            {[1, 2, 3].map((i) => (
              <Bone key={i} w="100%" h={56} r={18} />
            ))}
          </div>
        ) : error ? (
          <div
            className="rounded-2xl px-4 py-4"
            style={{
              background: 'rgba(239,68,68,.07)',
              border: '1px solid rgba(239,68,68,.18)',
            }}
          >
            <p
              className="mb-2 text-[12.5px]"
              style={{ color: 'rgba(255,255,255,.55)', fontFamily: "'Inter',sans-serif" }}
            >
              {error}
            </p>
            <button
              onClick={onRetry}
              className="rounded-lg px-3.5 py-1.5 text-[12px] font-semibold transition-all active:scale-95"
              style={{
                background: 'rgba(43,172,82,.1)',
                border: '1px solid rgba(43,172,82,.25)',
                color: G3,
                fontFamily: "'Inter',sans-serif",
              }}
            >
              Retry
            </button>
          </div>
        ) : total === 0 ? (
          <div
            className="rounded-3xl px-4 py-8 text-center"
            style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
          >
            <p style={{ fontSize: 26 }}>🔍</p>
            <p
              className="mt-2 text-[13px] font-semibold"
              style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
            >
              Nothing matched “{term}”
            </p>
            <p
              className="mt-1 text-[11px]"
              style={{ color: MUTED, fontFamily: "'Inter',sans-serif" }}
            >
              Try a shorter word, or a different category.
            </p>
          </div>
        ) : (
          <div
            className="overflow-hidden rounded-3xl"
            style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
          >
            {merchants.map((m, i) => (
              <button
                key={`m-${m.id}`}
                onClick={() => onStore?.(m.id)}
                className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-all active:opacity-70"
                style={{
                  borderBottom:
                    i < merchants.length - 1 || products.length > 0
                      ? `1px solid ${BORDER}`
                      : 'none',
                }}
              >
                <div
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl text-[18px]"
                  style={{ background: 'rgba(255,255,255,.06)' }}
                >
                  <ImageWithFallback
                    src={m.logoUrl ?? undefined}
                    alt={m.businessName}
                    className="h-full w-full object-cover"
                    fallbackEmoji="🏪"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-[13px] font-bold"
                    style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
                  >
                    {m.businessName}
                  </p>
                  <p
                    className="mt-0.5 truncate text-[10.5px]"
                    style={{ color: MUTED, fontFamily: "'Inter',sans-serif" }}
                  >
                    Store · {m.businessType}
                    {m.distanceKm != null ? ` · ${m.distanceKm.toFixed(1)} km` : ''}
                  </p>
                </div>
                <span className="flex-shrink-0 text-[13px]" style={{ color: G3 }}>
                  →
                </span>
              </button>
            ))}
            {products.map((p, i) => (
              <button
                key={`p-${p.id}`}
                onClick={() => onStore?.(p.merchantId)}
                className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-all active:opacity-70"
                style={{
                  borderBottom: i < products.length - 1 ? `1px solid ${BORDER}` : 'none',
                }}
              >
                <div
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl text-[18px]"
                  style={{ background: 'rgba(255,255,255,.06)' }}
                >
                  {p.primaryImageUrl ? (
                    <ImageWithFallback
                      src={p.primaryImageUrl}
                      alt={p.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    '🛍️'
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-[13px] font-bold"
                    style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
                  >
                    {p.name}
                  </p>
                  <p
                    className="mt-0.5 text-[10.5px]"
                    style={{ color: MUTED, fontFamily: "'Inter',sans-serif" }}
                  >
                    Product
                  </p>
                </div>
                <span
                  className="flex-shrink-0 text-[12px] font-bold"
                  style={{ color: G3, fontFamily: "'Poppins',sans-serif" }}
                >
                  ₦{p.basePrice.toLocaleString()}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Categories({ active, onPick }: { active: string; onPick: (label: string) => void }) {
  return (
    <div className="mb-5">
      <Row title="Categories" />
      <div className="flex gap-3 overflow-x-auto px-5" style={{ scrollbarWidth: 'none' }}>
        {CATS.map((c) => {
          const on = active === c.label;
          return (
            <button
              key={c.label}
              onClick={() => onPick(on ? '' : c.label)}
              // A fixed column width is what stops the labels colliding. The
              // tile stays 52px; the button is wider so a long word has room.
              className="flex flex-shrink-0 flex-col items-center gap-1.5 transition-all active:scale-90"
              style={{ width: 66 }}
            >
              <div
                className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl"
                style={{
                  background: on ? `linear-gradient(135deg,${G0},${G2})` : NAVY_CARD,
                  border: on ? 'none' : `1.5px solid ${BORDER}`,
                  boxShadow: on ? `0 6px 18px rgba(43,172,82,.28)` : 'none',
                  transition: 'all .2s ease',
                }}
              >
                <Icon name={c.icon} size={23} color={on ? '#FFF' : 'rgba(255,255,255,.62)'} />
              </div>
              {/* `maxWidth: 52` could not contain "Supermarkets": a single
                  word longer than its box does not wrap on its own, so the
                  label overflowed and ran into the next category's label.
                  Full-width of the 66px column, and allowed to break, so any
                  label wraps to a second line instead of escaping sideways. */}
              <p
                className="text-center text-[9px] font-semibold"
                style={{
                  color: on ? G3 : 'rgba(255,255,255,.42)',
                  fontFamily: "'Inter',sans-serif",
                  width: '100%',
                  lineHeight: 1.25,
                  overflowWrap: 'anywhere',
                  transition: 'color .2s ease',
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
// MERCHANTS
// ─────────────────────────────────────────────────────────────────────────────
// The five-gradient pool that used to live here is gone. It was the same
// defect as the marketplace's BG_POOL and was missed when that one was fixed:
// a merchant was coloured by its POSITION in this row, so the same shop was
// red here, orange one slot over, and neutral on the marketplace screen it
// links to. Founder instruction was no colour for ANY merchant.

function Merchants({
  loaded,
  liveMerchants,
  onStore,
  onAll,
}: {
  loaded: boolean;
  liveMerchants?: MerchantSummaryDto[];
  onStore?: (id: string) => void;
  onAll?: () => void;
}) {
  const showLive = liveMerchants && liveMerchants.length > 0;
  return (
    <div className="mb-5">
      <Row title="Nearby Merchants" onAll={onAll} />
      <div className="flex gap-3 overflow-x-auto px-5" style={{ scrollbarWidth: 'none' }}>
        {!loaded ? (
          [1, 2, 3].map((i) => <Bone key={i} w={155} h={188} />)
        ) : showLive ? (
          liveMerchants!.map((m, idx) => (
            <div
              key={m.id}
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
                style={{ background: NAVY_BASE, borderBottom: `1px solid ${BORDER}` }}
              >
                {/* `object-contain` on a neutral tile, matching the marketplace
                    card. `object-cover` cropped a wide wordmark to a square and
                    cut its ends off, and the 🏪 fallback was a bitmap glyph
                    that blurs at 3x — initials are vector and name the shop. */}
                <div
                  className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl"
                  style={{ background: 'rgba(255,255,255,.06)', border: `1px solid ${BORDER}` }}
                >
                  {m.logoUrl != null && m.logoUrl !== '' ? (
                    <ImageWithFallback
                      src={m.logoUrl}
                      alt={m.businessName}
                      className="h-full w-full object-contain"
                      fallbackEmoji="🛍️"
                    />
                  ) : (
                    <span
                      style={{
                        fontFamily: "'Poppins',sans-serif",
                        fontSize: 17,
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        color: 'rgba(255,255,255,.9)',
                      }}
                    >
                      {monogram(m.businessName)}
                    </span>
                  )}
                </div>
                {/* Was "🟢 Open" / "🔴 Closed" / "🏪" — two emoji and, when the
                    hours are unknown, a shop glyph standing in for a status
                    nobody knows. Only the real states are named now, in the
                    colour that already carries the meaning. Unknown shows
                    nothing rather than a badge that says nothing. */}
                {m.isOpenNow !== null && (
                  <div
                    className="absolute right-2.5 top-2.5 rounded-xl px-2 py-1 text-[9px] font-bold"
                    style={{
                      background: 'rgba(0,0,0,.5)',
                      color: m.isOpenNow ? G3 : '#FCA5A5',
                      backdropFilter: 'blur(6px)',
                      fontFamily: "'Inter',sans-serif",
                    }}
                  >
                    {m.isOpenNow ? 'Open' : 'Closed'}
                  </div>
                )}
              </div>
              <div className="p-3">
                <p
                  className="mb-0.5 truncate text-[12.5px] font-bold"
                  style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
                >
                  {m.businessName}
                </p>
                <p
                  className="mb-2 text-[10px]"
                  style={{ color: MUTED, fontFamily: "'Inter',sans-serif" }}
                >
                  {m.businessType}
                </p>
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[10px] font-bold" style={{ color: '#FBBF24' }}>
                    ★ {m.rating.average.toFixed(1)}
                  </span>
                  <span
                    className="text-[10px]"
                    style={{ color: MUTED, fontFamily: "'Inter',sans-serif" }}
                  >
                    {m.distanceKm != null ? `${m.distanceKm.toFixed(1)} km` : m.city}
                  </span>
                </div>
                <button
                  onClick={() => onStore?.(m.id)}
                  className="h-[30px] w-full rounded-xl text-[11px] font-semibold transition-all active:scale-95"
                  style={{
                    background: `linear-gradient(135deg,${G0},${G2})`,
                    color: '#FFF',
                    fontFamily: "'Inter',sans-serif",
                    boxShadow: '0 3px 12px rgba(43,172,82,.25)',
                  }}
                >
                  View Store
                </button>
              </div>
            </div>
          ))
        ) : (
          // No live merchants → honest empty state (no fabricated storefronts).
          <div style={{ padding: '24px 20px', width: '100%', textAlign: 'center' }}>
            <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: MUTED }}>
              No merchants nearby right now.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RECOMMENDATIONS
// ─────────────────────────────────────────────────────────────────────────────
function Recs({
  loaded,
  products,
  onProduct,
  onAll,
}: {
  loaded: boolean;
  products: ProductSummaryDto[];
  onProduct?: (productId: string, merchantId: string) => void;
  onAll?: () => void;
}) {
  if (loaded && products.length === 0) return null;
  return (
    <div className="mb-5">
      <Row title="Recommended for You" onAll={onAll} />
      <div className="flex gap-3 overflow-x-auto px-5" style={{ scrollbarWidth: 'none' }}>
        {!loaded
          ? [1, 2, 3, 4].map((i) => <Bone key={i} w={130} h={148} />)
          : products.map((p) => (
              <button
                key={p.id}
                onClick={() => onProduct?.(p.id, p.merchantId)}
                className="flex flex-shrink-0 flex-col items-center gap-2.5 rounded-2xl p-3.5 transition-all active:scale-95"
                style={{ width: 130, background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
              >
                <div
                  className="flex h-[52px] w-[52px] items-center justify-center overflow-hidden rounded-2xl text-[28px]"
                  style={{ background: 'rgba(255,255,255,.06)' }}
                >
                  {p.primaryImageUrl ? (
                    <ImageWithFallback
                      src={p.primaryImageUrl}
                      alt={p.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    '🛍️'
                  )}
                </div>
                <div className="w-full text-center">
                  <p
                    className="truncate text-[11.5px] font-bold"
                    style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
                  >
                    {p.name}
                  </p>
                  <p
                    className="mt-0.5 text-[11px] font-bold"
                    style={{ color: G3, fontFamily: "'Poppins',sans-serif" }}
                  >
                    ₦{p.basePrice.toLocaleString()}
                  </p>
                </div>
                {p.isFeatured && (
                  <span
                    className="rounded-full px-2.5 py-1 text-[9px] font-bold"
                    style={{
                      background: '#8B5CF620',
                      color: '#8B5CF6',
                      border: '1px solid #8B5CF635',
                    }}
                  >
                    Featured
                  </span>
                )}
              </button>
            ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RECENT ACTIVITY
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Real wallet ledger — never hardcoded rows. Both "See all" and the rows
 * themselves open the Wallet screen, which is where the full ledger lives;
 * there is no per-transaction detail screen to send them to, so they all go to
 * the one place that can actually show more.
 */
function ActivityList({
  loaded,
  txns,
  onAll,
}: {
  loaded: boolean;
  txns: WalletLedgerEntryDto[];
  onAll?: () => void;
}) {
  const recent = txns.slice(0, 5);
  return (
    <div className="mb-4 px-5">
      <Row title="Recent Activity" onAll={onAll} />
      {!loaded ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <Bone key={i} w="100%" h={64} r={20} />
          ))}
        </div>
      ) : recent.length === 0 ? (
        <div
          className="rounded-3xl px-4 py-8 text-center"
          style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
        >
          <p style={{ fontSize: 26 }}>🧾</p>
          <p
            className="mt-2 text-[13px] font-semibold"
            style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
          >
            No activity yet
          </p>
          <p
            className="mt-1 text-[11px]"
            style={{ color: MUTED, fontFamily: "'Inter',sans-serif" }}
          >
            Your wallet transactions will appear here.
          </p>
        </div>
      ) : (
        <div
          className="overflow-hidden rounded-3xl"
          style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
        >
          {recent.map((t, i) => {
            const credit = t.direction === 'CREDIT';
            const label = t.description ?? t.type.charAt(0) + t.type.slice(1).toLowerCase();
            return (
              <button
                key={t.id}
                onClick={onAll}
                disabled={!onAll}
                className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-all active:opacity-70"
                style={{ borderBottom: i < recent.length - 1 ? `1px solid ${BORDER}` : 'none' }}
              >
                <div
                  className="flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-2xl text-[18px]"
                  style={{ background: credit ? 'rgba(43,172,82,.12)' : 'rgba(255,255,255,.06)' }}
                >
                  {TXN_ICON[t.type] ?? (credit ? '↙' : '↗')}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-[13px] font-semibold"
                    style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
                  >
                    {label}
                  </p>
                  <p
                    className="text-[10px]"
                    style={{ color: MUTED, fontFamily: "'Inter',sans-serif" }}
                  >
                    {relTime(t.createdAt)}
                  </p>
                </div>
                <p
                  className="flex-shrink-0 text-[14px] font-bold"
                  style={{ fontFamily: "'Poppins',sans-serif", color: credit ? G3 : '#FFF' }}
                >
                  {credit ? '+' : '-'}₦{t.amount.toLocaleString()}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AI BOTTOM SHEET
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
            Ask Drip is coming soon. Our AI assistant isn't available yet — check back later to get
            help with products, rides, orders and more.
          </p>
        </div>
        <button
          onClick={onClose}
          className="active:scale-97 h-12 w-full rounded-2xl text-[13px] font-semibold transition-all"
          style={{
            background: 'rgba(255,255,255,.07)',
            color: 'rgba(255,255,255,.42)',
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
// BOTTOM NAV
// ─────────────────────────────────────────────────────────────────────────────
type NavTab = 'home' | 'market' | 'ride' | 'wallet' | 'profile';

function BottomNav({ active, onChange }: { active: NavTab; onChange: (t: NavTab) => void }) {
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
            onClick={() => onChange(t.key)}
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
                stroke={on ? G3 : 'rgba(255,255,255,.32)'}
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
// FLOATING AI BUTTON
// ─────────────────────────────────────────────────────────────────────────────
/** Where the Ask Drip button sits and how big it is. Named so the scrollable
 *  body can reserve exactly enough room to scroll clear of it — the two were
 *  independent numbers, and the spacer was the smaller of them. */
const FAB_BOTTOM = 94;
const FAB_SIZE = 52;

function FAB({ onPress }: { onPress: () => void }) {
  return (
    <button
      onClick={onPress}
      className="absolute z-40 transition-all active:scale-90"
      style={{ bottom: FAB_BOTTOM, right: 18 }}
      aria-label="AI Assistant"
    >
      <div
        style={{
          width: FAB_SIZE,
          height: FAB_SIZE,
          borderRadius: '50%',
          background: `linear-gradient(135deg,${G0},${G2})`,
          boxShadow: `0 6px 28px rgba(43,172,82,.5), 0 0 0 1.5px rgba(43,172,82,.32)`,
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
// HOME SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export function HomeScreen({
  onAccount,
  onSecurity,
  onNotifications,
  onMarketplace,
  onHotels,
  onRide,
  onDriverApp,
  onStore,
  onWallet,
  onWalletAction,
  onUtilities,
  onOrders,
  onTrackOrder,
  onBecomePartner,
}: {
  onAccount: () => void;
  onSecurity: () => void;
  onNotifications: () => void;
  onMarketplace?: () => void;
  /** Marketplace, already filtered to hotels. */
  onHotels?: () => void;
  onRide?: () => void;
  onDriverApp?: () => void;
  onStore?: (id: string) => void;
  onWallet?: () => void;
  onWalletAction?: (a: 'send' | 'receive' | 'topup' | 'pay') => void;
  /** Bill payments — airtime, data, electricity, cable TV. */
  onUtilities?: () => void;
  onOrders?: () => void;
  /** Open live tracking for an order the customer already has in flight. */
  onTrackOrder?: (orderId: string) => void;
  onBecomePartner?: () => void;
}) {
  const [navTab, setNavTab] = useState<NavTab>('home');
  const [showAI, setShowAI] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Live API state
  const [wallet, setWallet] = useState<WalletDto | null>(null);
  const [liveMerchants, setLiveMerchants] = useState<MerchantSummaryDto[]>([]);
  // Recommended products carry their real uploaded image (primaryImageUrl).
  const [liveProducts, setLiveProducts] = useState<ProductSummaryDto[]>([]);
  // Recent Activity is the customer's real wallet ledger — never hardcoded rows.
  const [txns, setTxns] = useState<WalletLedgerEntryDto[]>([]);
  // Income / Spent are summed from real wallet transactions (JOB 6).
  const [flows, setFlows] = useState<{ income: number; spent: number } | null>(null);

  // Search: `query` is what is in the box, `term` is what has actually been
  // searched for. They differ for the 350ms it takes typing to settle, which is
  // what stops every keystroke becoming a request.
  const [query, setQuery] = useState('');
  const [term, setTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [foundMerchants, setFoundMerchants] = useState<MerchantSummaryDto[]>([]);
  const [foundProducts, setFoundProducts] = useState<ProductSummaryDto[]>([]);
  const [searchNonce, setSearchNonce] = useState(0);

  const [greeting] = useState(() => timeGreeting());

  // Debounce the box into the committed term.
  useEffect(() => {
    const q = query.trim();
    const t = setTimeout(() => setTerm(q), 350);
    return () => clearTimeout(t);
  }, [query]);

  // Run the search whenever the committed term changes. `cancelled` keeps a
  // slow earlier response from overwriting a faster later one.
  useEffect(() => {
    if (!term) {
      setFoundMerchants([]);
      setFoundProducts([]);
      setSearchError('');
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    setSearchError('');
    Promise.allSettled([
      api.marketplace.searchMerchants(term, { limit: 8 }),
      api.marketplace.searchProducts(term, { limit: 12 }),
    ]).then(([mRes, pRes]) => {
      if (cancelled) return;
      const list = <T,>(v: unknown): T[] => {
        const raw = v as { data?: T[]; items?: T[] } | T[];
        return Array.isArray(raw) ? raw : (raw?.data ?? raw?.items ?? []);
      };
      const merchants = mRes.status === 'fulfilled' ? list<MerchantSummaryDto>(mRes.value) : [];
      const products = pRes.status === 'fulfilled' ? list<ProductSummaryDto>(pRes.value) : [];
      setFoundMerchants(merchants);
      setFoundProducts(products);
      // Only an error if *both* halves failed — one working half is a result.
      if (mRes.status === 'rejected' && pRes.status === 'rejected') {
        setSearchError(
          (mRes.reason as { message?: string })?.message ?? 'Search is unavailable right now.',
        );
      }
      setSearching(false);
    });
    return () => {
      cancelled = true;
    };
  }, [term, searchNonce]);

  useEffect(() => {
    Promise.allSettled([
      api.wallet.get(),
      api.marketplace.getMerchants({ sort: 'recommended', limit: 6 }),
      api.wallet.getTransactions({ page: 1, pageSize: 100 }),
      api.marketplace.getFeaturedProducts({ limit: 10 }),
    ]).then(([walletRes, merchantsRes, txRes, productsRes]) => {
      if (walletRes.status === 'fulfilled') setWallet(walletRes.value);
      if (merchantsRes.status === 'fulfilled') {
        const result = merchantsRes.value as
          { data?: MerchantSummaryDto[]; items?: MerchantSummaryDto[] } | MerchantSummaryDto[];
        const list = Array.isArray(result) ? result : (result.data ?? result.items ?? []);
        setLiveMerchants(list);
      }
      if (txRes.status === 'fulfilled') {
        const raw = txRes.value as
          | { data?: WalletLedgerEntryDto[]; items?: WalletLedgerEntryDto[] }
          | WalletLedgerEntryDto[];
        const txs = Array.isArray(raw) ? raw : (raw.data ?? raw.items ?? []);
        setTxns(txs);
        const income = txs
          .filter((t) => t.direction === 'CREDIT')
          .reduce((s, t) => s + t.amount, 0);
        const spent = txs.filter((t) => t.direction === 'DEBIT').reduce((s, t) => s + t.amount, 0);
        setFlows({ income, spent });
      }
      if (productsRes.status === 'fulfilled') {
        const raw = productsRes.value as
          { data?: ProductSummaryDto[]; items?: ProductSummaryDto[] } | ProductSummaryDto[];
        const list = Array.isArray(raw) ? raw : (raw.data ?? raw.items ?? []);
        setLiveProducts(list);
      }
      setLoaded(true);
    });
  }, []);

  // A category chip is lit only when the search box holds exactly its label —
  // so typing over it clears the highlight rather than leaving a chip claiming
  // to filter something it no longer filters.
  const activeCategory = CATS.some((c) => c.label === query) ? query : '';

  const handleNav = (t: NavTab) => {
    setNavTab(t);
    if (t === 'profile') onAccount();
    if (t === 'market') onMarketplace?.();
    if (t === 'ride') onRide?.();
    if (t === 'wallet') onWallet?.();
  };

  const handleQuickAction = (label: string) => {
    switch (label) {
      case 'Marketplace':
      case 'Food':
        onMarketplace?.();
        break;
      case 'Ride':
        onRide?.();
        break;
      case 'Wallet':
        onWallet?.();
        break;
      case 'Orders':
        onOrders?.();
        break;
      case 'Hotels':
        onHotels?.();
        break;
      case 'Utilities':
        onUtilities?.();
        break;
      default:
        // More has no screen yet. It is marked `ready: false` above so it
        // never reaches here — this stays as the backstop.
        break;
    }
  };

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{ background: NAVY_DEEP }}
    >
      {/* Fixed header with hero bg, search */}
      <Header
        greeting={greeting}
        name={(() => {
          const n = auth.greetingName();
          return n ? `Hi, ${n}` : 'Hello';
        })()}
        initial={(auth.greetingName()?.trim().charAt(0) || 'D').toUpperCase()}
        onNotif={onNotifications}
        onProfile={onAccount}
        query={query}
        onQuery={setQuery}
        onSubmit={() => setTerm(query.trim())}
      />

      {/* Scrollable body */}
      <div
        className="flex-1 overflow-y-auto"
        style={{
          scrollbarWidth: 'none',
          background: `linear-gradient(180deg,${NAVY_DEEP} 0%,#060E1C 100%)`,
        }}
      >
        {/* Service switcher — first thing below search */}
        {/* Marketplace / Ride / Wallet switcher removed (founder, 2026-08-18):
            `svcTab` was written and never read anywhere in this file, so the
            three tabs only moved a highlight — the page below never changed.
            Quick Actions and the bottom navigation are the real routes. */}

        {/* The full-bleed balance card lived here, duplicating the Wallet
            screen's own balance. Moved off home (founder, 2026-08-18) to make
            this page simpler; Wallet still shows the balance, income, spend
            and the Send / Receive / Top Up / Pay actions. */}

        {/* Quick actions 4×2 grid */}
        <div className="mb-1">
          <Row title="Quick Actions" />
          <QuickActions onSelect={handleQuickAction} />
        </div>

        {/* Searching swaps the browse sections for results. The browse order is
            left exactly as the Figma has it, so the default screen — the one
            that gets compared against the design — does not move. Categories
            ride along with the results because they are how you change the
            search; hiding them would strand you inside a result set. */}
        {term ? (
          <>
            <Categories active={activeCategory} onPick={setQuery} />
            <SearchResults
              term={term}
              busy={searching}
              error={searchError}
              merchants={foundMerchants}
              products={foundProducts}
              onStore={onStore}
              onRetry={() => setSearchNonce((n) => n + 1)}
            />
          </>
        ) : (
          <>
            {onTrackOrder && <LiveOrderCard onTrack={onTrackOrder} />}
            <LiveOffers />
            {/* The Ask Drip card used to sit here, and the identical one was
                removed from the marketplace in the same breath — this half was
                missed. Both opened setShowAI(true), which is exactly what the
                floating button below already does, so the card was a second
                door to the same room that cost a large block of the first
                screen to announce a feature that does not exist yet. The
                floating button is the entry point. (Founder decision,
                2026-08-24: Drip answering customers comes after the app is
                stable.) */}
            {onBecomePartner && <PartnerEntryCard onOpen={onBecomePartner} />}
            <Categories active={activeCategory} onPick={setQuery} />
            <Merchants
              loaded={loaded}
              liveMerchants={liveMerchants}
              onStore={onStore}
              onAll={onMarketplace}
            />
            <Recs
              loaded={loaded}
              products={liveProducts}
              onProduct={(_productId, merchantId) => onStore?.(merchantId)}
              onAll={onMarketplace}
            />
            <ActivityList loaded={loaded} txns={txns} onAll={onWallet} />
          </>
        )}

        {/* Clearance for the bottom nav AND the floating Ask Drip button.
            At 104 this only cleared the nav: the button sits 94px up and is
            52px tall, so it reaches 146px and the last 42px of the page could
            never be scrolled out from under it. Reported live with the button
            parked on the "More" tile. A FAB is expected to float over content
            in passing — what it must never do is permanently hide something,
            and that is what too small a spacer caused. */}
        <div style={{ height: FAB_BOTTOM + FAB_SIZE + 16 }} />
      </div>

      <FAB onPress={() => setShowAI(true)} />
      <BottomNav active={navTab} onChange={handleNav} />
      {showAI && <AISheet onClose={() => setShowAI(false)} />}
    </div>
  );
}
