import React, { useState, useEffect, useCallback } from 'react';
import { G0, G2, G3, NAVY_DEEP, NAVY_CARD, NAVY_SURFACE, BORDER, MUTED } from './shared';
import { api } from '../lib/api';
import type { MerchantSummaryDto } from '../lib/api';

// ─────────────────────────────────────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────────────────────────────────────
const CAT_CHIPS = [
  { label: 'All', icon: '✦' },
  { label: 'Supermarkets', icon: '🛒' },
  { label: 'Restaurants', icon: '🍽' },
  { label: 'Pharmacy', icon: '💊' },
  { label: 'Electronics', icon: '📱' },
  { label: 'Fashion', icon: '👗' },
  { label: 'Beauty', icon: '💄' },
  { label: 'Hardware', icon: '🔧' },
  { label: 'Hotels', icon: '🏨' },
  { label: 'Furniture', icon: '🛋' },
  { label: 'Services', icon: '⚙' },
  { label: 'Wholesale', icon: '📦' },
];

const AI_PROMPTS = [
  'Find the best shawarma near me',
  'Groceries under ₦20,000',
  'Pharmacy open right now',
  'Phone under ₦300,000',
  'Find an electrician nearby',
];

const TRENDING_PRODUCTS = [
  {
    name: 'Basmati Rice 5kg',
    price: '₦7,800',
    was: '₦9,500',
    emoji: '🍚',
    rating: 4.7,
    store: 'Shoprite',
    badge: '-18%',
    bc: '#EF4444',
  },
  {
    name: 'Nike Air Force 1',
    price: '₦48,000',
    was: '₦65,000',
    emoji: '👟',
    rating: 4.8,
    store: 'SportsDirect',
    badge: '-26%',
    bc: '#F97316',
  },
  {
    name: 'Samsung A55 128GB',
    price: '₦224,000',
    was: '₦285,000',
    emoji: '📱',
    rating: 4.6,
    store: 'Slot',
    badge: '-21%',
    bc: '#3B82F6',
  },
  {
    name: 'Dove Body Wash 500ml',
    price: '₦2,100',
    was: '₦2,800',
    emoji: '🧴',
    rating: 4.5,
    store: 'HealthPlus',
    badge: '-25%',
    bc: '#10B981',
  },
  {
    name: 'Ankara 6 Yards',
    price: '₦14,500',
    was: '₦18,000',
    emoji: '🧵',
    rating: 4.9,
    store: 'Ruff n Tumble',
    badge: '-19%',
    bc: '#8B5CF6',
  },
];

const DEALS = [
  {
    bg: 'linear-gradient(135deg,#064E3B,#065F46 42%,#10B981)',
    icon: '🚚',
    title: 'Free Delivery All Day',
    sub: 'On orders over ₦5,000',
    cta: 'Shop Now',
  },
  {
    bg: 'linear-gradient(135deg,#431407,#B45309 42%,#FCD34D)',
    icon: '🏷',
    title: 'Weekend Flash Sale',
    sub: 'Up to 40% off — ends Sunday',
    cta: 'View Deals',
  },
  {
    bg: 'linear-gradient(135deg,#1E3A5F,#1D4ED8 42%,#60A5FA)',
    icon: '💳',
    title: 'Wallet 5% Cashback',
    sub: 'Pay with DrippleX Wallet',
    cta: 'Activate',
  },
  {
    bg: 'linear-gradient(135deg,#3B0764,#7C3AED 42%,#C084FC)',
    icon: '🍽',
    title: 'Restaurant Specials',
    sub: 'Lunch deals from ₦1,500',
    cta: 'Order Now',
  },
];

const NEARBY = [
  {
    name: 'Mr Biggs',
    cat: 'Fast Food',
    dist: '0.2 km',
    eta: '8 min',
    fee: '₦150',
    rating: 4.4,
    emoji: '🍔',
    open: true,
  },
  {
    name: 'FoodCo',
    cat: 'Supermarket',
    dist: '0.5 km',
    eta: '14 min',
    fee: 'Free',
    rating: 4.7,
    emoji: '🛒',
    open: true,
  },
  {
    name: 'Chi Farms',
    cat: 'Wholesale',
    dist: '0.8 km',
    eta: '20 min',
    fee: '₦400',
    rating: 4.3,
    emoji: '🥚',
    open: true,
  },
  {
    name: 'Dominos Pizza',
    cat: 'Restaurant',
    dist: '1.0 km',
    eta: '22 min',
    fee: '₦500',
    rating: 4.5,
    emoji: '🍕',
    open: false,
  },
];

const AI_RECS = [
  {
    type: 'product',
    emoji: '🥑',
    name: 'Avocado Facial Kit',
    sub: 'HealthPlus · ₦8,400',
    badge: 'Best Seller',
  },
  {
    type: 'store',
    emoji: '🍗',
    name: 'Chicken Republic',
    sub: 'Restaurant · 0.7 km',
    badge: 'Trending',
  },
  {
    type: 'product',
    emoji: '🎧',
    name: 'Wireless Earbuds Pro',
    sub: 'Slot · ₦18,900',
    badge: 'Hot Deal',
  },
  { type: 'store', emoji: '💆', name: 'Mane & Glam Spa', sub: 'Beauty · 1.3 km', badge: 'New' },
];

const RECENT_VIEWS = [
  { emoji: '📱', name: 'iPhone 15 Pro', price: '₦890K', store: 'Slot' },
  { emoji: '👟', name: 'Air Max 270', price: '₦65K', store: 'SportsDirect' },
  { emoji: '🛋', name: 'Sofa 3-Seater', price: '₦185K', store: 'FurniturePlus' },
  { emoji: '🍛', name: 'Jollof Combo', price: '₦4,200', store: 'Mr Biggs' },
];

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
      className="flex items-center justify-between px-5 pb-1 pt-[52px]"
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
  cartCount,
}: {
  onBack: () => void;
  onCart: () => void;
  onNotif: () => void;
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

      {/* Search bar */}
      <div className="relative z-10 mx-5">
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
            <svg width="13" height="13" viewBox="0 0 24 24" fill="white">
              <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
            </svg>
          </div>
          <p
            className="flex-1 text-[12.5px]"
            style={{ color: 'rgba(255,255,255,.30)', fontFamily: "'Inter',sans-serif" }}
          >
            Search products, stores, services…
          </p>
          <div className="flex items-center gap-1.5">
            <button
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
            <button className="flex items-center gap-1 px-1.5 active:opacity-70">
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
              <p
                className="text-[11px] font-semibold"
                style={{ color: G3, fontFamily: "'Inter',sans-serif" }}
              >
                Filter
              </p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY CHIPS
// ─────────────────────────────────────────────────────────────────────────────
function CategoryChips({ active, onChange }: { active: string; onChange: (s: string) => void }) {
  return (
    <div className="mb-4 mt-3">
      <div className="flex gap-2 overflow-x-auto px-5" style={{ scrollbarWidth: 'none' }}>
        {CAT_CHIPS.map((c) => {
          const on = active === c.label;
          return (
            <button
              key={c.label}
              onClick={() => onChange(c.label)}
              className="flex h-9 flex-shrink-0 items-center gap-1.5 rounded-full px-3.5 transition-all active:scale-95"
              style={{
                background: on ? `linear-gradient(135deg,${G0},${G2})` : 'rgba(255,255,255,.06)',
                border: on ? 'none' : `1px solid ${BORDER}`,
                boxShadow: on ? `0 4px 14px rgba(43,172,82,.28)` : 'none',
              }}
            >
              <span style={{ fontSize: 13 }}>{c.icon}</span>
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
function AIDiscovery({ onAsk }: { onAsk: () => void }) {
  const [idx, setIdx] = useState(0);
  const [chars, setChars] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setIdx((i) => (i + 1) % AI_PROMPTS.length);
      setChars(0);
    }, 4000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (chars >= AI_PROMPTS[idx].length) return;
    const t = setTimeout(() => setChars((c) => c + 1), 36);
    return () => clearTimeout(t);
  }, [chars, idx]);

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
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-2xl"
              style={{
                background: `linear-gradient(135deg,${G0},${G3})`,
                boxShadow: `0 4px 16px rgba(43,172,82,.35)`,
                animation: 'avatar-pulse 3s ease-in-out infinite',
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
                Describe what you need
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <div
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: G3, animation: 'pulse-ring 1.8s ease-out infinite' }}
            />
            <p
              className="text-[9px] font-medium"
              style={{ color: G3, fontFamily: "'Inter',sans-serif" }}
            >
              Live
            </p>
          </div>
        </div>

        {/* Typewriter */}
        <div
          className="mb-3 flex min-h-[40px] items-center rounded-xl px-3.5 py-2.5"
          style={{ background: 'rgba(43,172,82,.07)', border: '1px solid rgba(43,172,82,.14)' }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke={G3}
            strokeWidth="2"
            strokeLinecap="round"
            className="mr-2 flex-shrink-0 opacity-55"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <p
            className="flex-1 text-[11.5px]"
            style={{ color: 'rgba(255,255,255,.7)', fontFamily: "'Inter',sans-serif" }}
          >
            {AI_PROMPTS[idx].slice(0, chars)}
            <span style={{ opacity: chars < AI_PROMPTS[idx].length ? 1 : 0 }}>|</span>
          </p>
        </div>

        {/* Suggestion chips */}
        <div className="mb-3.5 flex flex-wrap gap-1.5">
          {AI_PROMPTS.slice(0, 4).map((s, i) => (
            <button
              key={i}
              onClick={onAsk}
              className="rounded-full px-2.5 py-1.5 text-[10px] font-medium transition-all active:scale-95"
              style={{
                background: 'rgba(255,255,255,.055)',
                color: 'rgba(255,255,255,.55)',
                border: `1px solid ${BORDER}`,
                fontFamily: "'Inter',sans-serif",
              }}
            >
              {s.length > 24 ? s.slice(0, 22) + '…' : s}
            </button>
          ))}
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
          <span>✨</span>Ask AI
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TODAY'S DEALS SLIDER
// ─────────────────────────────────────────────────────────────────────────────
function TodaysDeals() {
  const [i, setI] = useState(0);
  const [fade, setFade] = useState(false);

  useEffect(() => {
    const t = setInterval(() => {
      setFade(true);
      setTimeout(() => {
        setI((n) => (n + 1) % DEALS.length);
        setFade(false);
      }, 200);
    }, 5000);
    return () => clearInterval(t);
  }, []);

  const d = DEALS[i];
  return (
    <div className="mx-5 mb-5">
      <div
        className="relative overflow-hidden rounded-3xl p-5"
        style={{
          background: d.bg,
          minHeight: 108,
          boxShadow: '0 12px 40px rgba(0,0,0,.38)',
          transition: 'opacity .2s ease',
          opacity: fade ? 0 : 1,
        }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle at 78% 50%,rgba(255,255,255,.09) 0%,transparent 50%)',
          }}
        />
        <div
          className="absolute right-4 top-1/2 -translate-y-1/2 text-[62px]"
          style={{ opacity: 0.1 }}
        >
          {d.icon}
        </div>

        <div className="relative z-10 flex items-center gap-3.5">
          <div
            className="flex h-[50px] w-[50px] flex-shrink-0 items-center justify-center rounded-2xl"
            style={{ background: 'rgba(255,255,255,.14)', backdropFilter: 'blur(12px)' }}
          >
            <span style={{ fontSize: 25 }}>{d.icon}</span>
          </div>
          <div className="flex-1">
            <p
              className="mb-0.5 text-[16px] font-bold"
              style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
            >
              {d.title}
            </p>
            <p
              className="mb-3 text-[11px]"
              style={{ color: 'rgba(255,255,255,.65)', fontFamily: "'Inter',sans-serif" }}
            >
              {d.sub}
            </p>
            <button
              className="rounded-xl px-4 py-1.5 text-[11px] font-bold transition-all active:scale-95"
              style={{
                background: 'rgba(255,255,255,.2)',
                color: '#FFF',
                backdropFilter: 'blur(8px)',
                fontFamily: "'Inter',sans-serif",
              }}
            >
              {d.cta} →
            </button>
          </div>
        </div>
        <div className="mt-4 flex gap-1.5">
          {DEALS.map((_, j) => (
            <button
              key={j}
              onClick={() => setI(j)}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: j === i ? 22 : 6,
                background: j === i ? '#FFF' : 'rgba(255,255,255,.28)',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURED MERCHANTS
// ─────────────────────────────────────────────────────────────────────────────
function FeaturedMerchants({
  active,
  onStore,
}: {
  active: string;
  onStore?: (id: string) => void;
}) {
  const [merchants, setMerchants] = useState<MerchantSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const q = active === 'All' ? undefined : active;
      const res = q
        ? await api.marketplace.searchMerchants(q, { limit: 20 })
        : await api.marketplace.getMerchants({ limit: 20 });
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
  const EMOJI_POOL: Record<string, string> = {
    Restaurant: '🍽',
    Supermarket: '🛒',
    Pharmacy: '💊',
    Fashion: '👗',
    Electronics: '📱',
    Beauty: '💄',
    Hotel: '🏨',
    Hardware: '🔧',
    default: '🏪',
  };

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
            No merchants found{active !== 'All' ? ` in "${active}"` : ''}.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 px-5">
          {merchants.map((m, idx) => {
            const isOpen = m.isOpenNow;
            const bg = BG_POOL[idx % BG_POOL.length];
            const emoji = EMOJI_POOL[m.businessType ?? ''] ?? EMOJI_POOL.default;
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
                    <img
                      src={m.coverPhotoUrl}
                      alt={m.businessName}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : (
                    <span style={{ fontSize: 44 }}>{emoji}</span>
                  )}
                  <div className="absolute left-3 top-3">
                    {verified && (
                      <span
                        className="rounded-lg px-2 py-1 text-[9px] font-bold"
                        style={{
                          background: 'rgba(71,207,114,.15)',
                          color: G3,
                          border: `1px solid rgba(71,207,114,.25)`,
                          backdropFilter: 'blur(4px)',
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
                      {m.businessType ?? 'Business'}
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
function TrendingProducts({ loaded }: { loaded: boolean }) {
  const [wishlist, setWishlist] = useState<Set<number>>(new Set());
  const toggle = (i: number) =>
    setWishlist((w) => {
      const n = new Set(w);
      n.has(i) ? n.delete(i) : n.add(i);
      return n;
    });

  return (
    <div className="mb-5">
      <SRow title="Trending Products 🔥" onAll={() => {}} />
      <div className="flex gap-3 overflow-x-auto px-5" style={{ scrollbarWidth: 'none' }}>
        {!loaded
          ? [1, 2, 3, 4].map((i) => <Bone key={i} w={145} h={212} />)
          : TRENDING_PRODUCTS.map((p, i) => (
              <div
                key={i}
                className="flex-shrink-0 overflow-hidden rounded-3xl"
                style={{ width: 145, background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
              >
                <div
                  className="relative flex h-[82px] items-center justify-center"
                  style={{ background: 'linear-gradient(135deg,#0D1B2E,#1A2E45)' }}
                >
                  <span style={{ fontSize: 42 }}>{p.emoji}</span>
                  <div
                    className="absolute left-2 top-2 rounded-lg px-2 py-0.5 text-[9px] font-bold"
                    style={{ background: p.bc, color: '#FFF', fontFamily: "'Inter',sans-serif" }}
                  >
                    {p.badge}
                  </div>
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
                    {p.store}
                  </p>
                  <div className="mb-1 flex items-center gap-1.5">
                    <span className="text-[9.5px] font-bold" style={{ color: '#FBBF24' }}>
                      ★ {p.rating}
                    </span>
                  </div>
                  <p
                    className="mb-0.5 text-[10px] line-through"
                    style={{ color: MUTED, fontFamily: "'Inter',sans-serif" }}
                  >
                    {p.was}
                  </p>
                  <p
                    className="mb-2.5 text-[13px] font-bold"
                    style={{ fontFamily: "'Poppins',sans-serif", color: G3 }}
                  >
                    {p.price}
                  </p>
                  <button
                    className="h-[28px] w-full rounded-xl text-[10px] font-semibold transition-all active:scale-95"
                    style={{
                      background: `linear-gradient(135deg,${G0},${G2})`,
                      color: '#FFF',
                      fontFamily: "'Inter',sans-serif",
                      boxShadow: `0 3px 10px rgba(43,172,82,.22)`,
                    }}
                  >
                    Add to Cart
                  </button>
                </div>
              </div>
            ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NEARBY BUSINESSES
// ─────────────────────────────────────────────────────────────────────────────
function NearbyBusinesses({
  loaded,
  onStore,
}: {
  loaded: boolean;
  onStore?: (merchantId: string) => void;
}) {
  return (
    <div className="mb-5">
      <SRow title="Nearby Businesses" sub="Based on your location" onAll={() => {}} />
      <div className="flex flex-col gap-0 px-5">
        <div
          className="overflow-hidden rounded-3xl"
          style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
        >
          {!loaded
            ? [1, 2, 3].map((i) => (
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
            : NEARBY.map((b, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-4 py-3.5 transition-colors active:bg-white/[.025]"
                  style={{ borderBottom: i < NEARBY.length - 1 ? `1px solid ${BORDER}` : 'none' }}
                >
                  <div
                    className="flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-2xl text-[20px]"
                    style={{ background: 'rgba(255,255,255,.06)' }}
                  >
                    {b.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p
                        className="truncate text-[12.5px] font-semibold"
                        style={{
                          fontFamily: "'Poppins',sans-serif",
                          color: b.open ? '#FFF' : 'rgba(255,255,255,.4)',
                        }}
                      >
                        {b.name}
                      </p>
                      {!b.open && (
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
                        ★ {b.rating}
                      </span>
                      <span
                        className="text-[9.5px]"
                        style={{ color: MUTED, fontFamily: "'Inter',sans-serif" }}
                      >
                        📍 {b.dist} · ⏱ {b.eta}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 flex-col items-end gap-1">
                    <p
                      className="text-[10px] font-semibold"
                      style={{
                        color: b.fee === 'Free' ? G3 : MUTED,
                        fontFamily: "'Inter',sans-serif",
                      }}
                    >
                      {b.fee === 'Free' ? 'Free delivery' : b.fee}
                    </p>
                    <button
                      onClick={() => b.open && onStore?.(b.name)}
                      className="h-7 rounded-xl px-3 text-[10px] font-semibold transition-all active:scale-95"
                      style={{
                        background: b.open
                          ? `linear-gradient(135deg,${G0},${G2})`
                          : 'rgba(255,255,255,.06)',
                        color: b.open ? '#FFF' : 'rgba(255,255,255,.25)',
                        fontFamily: "'Inter',sans-serif",
                      }}
                    >
                      {b.open ? 'Order' : 'Closed'}
                    </button>
                  </div>
                </div>
              ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AI RECOMMENDATIONS
// ─────────────────────────────────────────────────────────────────────────────
function AIRecs({ loaded }: { loaded: boolean }) {
  return (
    <div className="mb-5">
      <SRow title="✨ AI Picks for You" sub="Personalised recommendations" onAll={() => {}} />
      <div className="flex gap-3 overflow-x-auto px-5" style={{ scrollbarWidth: 'none' }}>
        {!loaded
          ? [1, 2, 3, 4].map((i) => <Bone key={i} w={130} h={148} />)
          : AI_RECS.map((r, i) => (
              <button
                key={i}
                className="flex flex-shrink-0 flex-col items-center gap-2.5 rounded-2xl p-3.5 transition-all active:scale-95"
                style={{ width: 130, background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
              >
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-2xl text-[26px]"
                  style={{ background: 'rgba(255,255,255,.06)' }}
                >
                  {r.emoji}
                </div>
                <div className="w-full text-center">
                  <p
                    className="truncate text-[11.5px] font-bold"
                    style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
                  >
                    {r.name}
                  </p>
                  <p
                    className="mt-0.5 truncate text-[9.5px]"
                    style={{ color: MUTED, fontFamily: "'Inter',sans-serif" }}
                  >
                    {r.sub}
                  </p>
                </div>
                <span
                  className="rounded-full px-2.5 py-1 text-[9px] font-bold"
                  style={{ background: G2 + '20', color: G3, border: `1px solid ${G2}30` }}
                >
                  {r.badge}
                </span>
              </button>
            ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTINUE SHOPPING
// ─────────────────────────────────────────────────────────────────────────────
function ContinueShopping() {
  return (
    <div className="mb-5">
      <SRow title="Continue Shopping" sub="Recently viewed" />
      <div className="flex gap-2.5 overflow-x-auto px-5" style={{ scrollbarWidth: 'none' }}>
        {RECENT_VIEWS.map((r, i) => (
          <button
            key={i}
            className="flex flex-shrink-0 flex-col gap-2 rounded-2xl p-3 transition-all active:scale-95"
            style={{ width: 110, background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
          >
            <div
              className="flex h-[52px] w-full items-center justify-center rounded-xl text-[28px]"
              style={{ background: 'rgba(255,255,255,.06)' }}
            >
              {r.emoji}
            </div>
            <p
              className="truncate text-[11px] font-bold"
              style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
            >
              {r.name}
            </p>
            <p
              className="text-[11px] font-bold"
              style={{ color: G3, fontFamily: "'Poppins',sans-serif" }}
            >
              {r.price}
            </p>
          </button>
        ))}
      </div>
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
              AI Shopping Assistant
            </p>
          </div>
        </div>
        <div className="mb-5 flex flex-col gap-2.5">
          {AI_PROMPTS.map((s, i) => (
            <button
              key={i}
              onClick={onClose}
              className="active:scale-98 w-full rounded-2xl px-4 py-3.5 text-left text-[12.5px] transition-all"
              style={{
                background: 'rgba(255,255,255,.045)',
                color: 'rgba(255,255,255,.78)',
                fontFamily: "'Inter',sans-serif",
                border: `1px solid ${BORDER}`,
              }}
            >
              {s}
            </button>
          ))}
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
}: {
  onBack: () => void;
  onHome: () => void;
  onAccount: () => void;
  onNotifications: () => void;
  onStore?: (merchantId: string) => void;
  onCart?: () => void;
}) {
  const [activecat, setActivecat] = useState('All');
  const [showAI, setShowAI] = useState(false);
  const [cartCount] = useState(3);

  const handleNav = (t: NavTab) => {
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
        <TodaysDeals />
        <FeaturedMerchants active={activecat} onStore={onStore} />
        <TrendingProducts loaded={true} />
        <NearbyBusinesses loaded={true} onStore={onStore} />
        <AIRecs loaded={true} />
        <ContinueShopping />

        <div style={{ height: 104 }} />
      </div>

      <FloatingAI onPress={() => setShowAI(true)} />
      <BottomNav onNav={handleNav} />
      {showAI && <AISheet onClose={() => setShowAI(false)} />}
    </div>
  );
}
