import React, { useState, useEffect } from 'react';
import { G0, G2, G3, NAVY_DEEP, NAVY_CARD, NAVY_SURFACE, BORDER, MUTED } from './shared';

// ─────────────────────────────────────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────────────────────────────────────
const CATS = [
  { icon: '🛒', label: 'Supermarkets' },
  { icon: '🍽', label: 'Restaurants' },
  { icon: '💊', label: 'Pharmacy' },
  { icon: '👗', label: 'Fashion' },
  { icon: '📱', label: 'Electronics' },
  { icon: '💄', label: 'Beauty' },
  { icon: '🛋', label: 'Home' },
  { icon: '🔧', label: 'Hardware' },
];

const QUICK = [
  { icon: '🛍', label: 'Marketplace', color: '#2BAC52' },
  { icon: '🚖', label: 'Ride', color: '#3B82F6' },
  { icon: '💳', label: 'Wallet', color: '#8B5CF6' },
  { icon: '📦', label: 'Orders', color: '#F59E0B' },
  { icon: '⚡', label: 'Utilities', color: '#06B6D4' },
  { icon: '🍔', label: 'Food', color: '#F97316' },
  { icon: '🏥', label: 'Health', color: '#10B981' },
  { icon: '⋯', label: 'More', color: '#6B7280' },
];

const MERCHANTS = [
  {
    name: 'Shoprite',
    cat: 'Supermarket',
    rating: 4.8,
    dist: '0.4 km',
    eta: '12 min',
    bg: 'linear-gradient(135deg,#7F1D1D,#EF4444)',
    emoji: '🛒',
  },
  {
    name: 'KFC Ikeja',
    cat: 'Fast Food',
    rating: 4.6,
    dist: '0.9 km',
    eta: '18 min',
    bg: 'linear-gradient(135deg,#7C2D12,#F97316)',
    emoji: '🍗',
  },
  {
    name: 'Jumia Express',
    cat: 'E-commerce',
    rating: 4.7,
    dist: '1.2 km',
    eta: '25 min',
    bg: 'linear-gradient(135deg,#0D2E18,#2BAC52)',
    emoji: '📦',
  },
  {
    name: 'HealthPlus',
    cat: 'Pharmacy',
    rating: 4.9,
    dist: '0.6 km',
    eta: '15 min',
    bg: 'linear-gradient(135deg,#0C4A6E,#06B6D4)',
    emoji: '💊',
  },
  {
    name: 'ZARA Nigeria',
    cat: 'Fashion',
    rating: 4.5,
    dist: '2.1 km',
    eta: '30 min',
    bg: 'linear-gradient(135deg,#2E1065,#8B5CF6)',
    emoji: '👗',
  },
];

const RECS = [
  { emoji: '📱', name: 'iPhone 15 Pro', price: '₦890K', badge: 'Trending', bc: '#EF4444' },
  { emoji: '🍛', name: 'Jollof + Protein', price: '₦4,200', badge: 'Popular', bc: '#F97316' },
  { emoji: '👘', name: 'Adire Set', price: '₦18K', badge: 'New In', bc: '#8B5CF6' },
  { emoji: '🎧', name: 'Wireless Buds', price: '₦45K', badge: 'Hot', bc: '#2BAC52' },
];

const PROMOS = [
  {
    bg: 'linear-gradient(135deg,#064E3B,#065F46 40%,#10B981)',
    icon: '🎁',
    title: '5% Weekend Cashback',
    sub: 'On all DrippleX spends',
    cta: 'Claim',
  },
  {
    bg: 'linear-gradient(135deg,#1E3A5F,#1D4ED8 40%,#60A5FA)',
    icon: '🚗',
    title: 'Free First Ride',
    sub: 'New users ride free today',
    cta: 'Book',
  },
  {
    bg: 'linear-gradient(135deg,#3B0764,#7C3AED 40%,#C084FC)',
    icon: '💎',
    title: 'Upgrade to Premium',
    sub: 'Unlock all exclusive perks',
    cta: 'Unlock',
  },
  {
    bg: 'linear-gradient(135deg,#431407,#B45309 40%,#FCD34D)',
    icon: '🛒',
    title: 'Free Delivery Week',
    sub: 'All marketplace orders',
    cta: 'Shop',
  },
];

const AI_PROMPTS = [
  'Find the best shawarma near me',
  'Book a ride to Victoria Island',
  'Track my last order',
  'Find a pharmacy open now',
  'Show weekend deals near me',
];

const ACTIVITY = [
  {
    icon: '🚗',
    label: 'DrippleX Ride',
    sub: 'Lagos Island · 2 min ago',
    amount: '-₦2,800',
    credit: false,
  },
  {
    icon: '🛒',
    label: 'Shoprite Ikeja',
    sub: 'Shopping · 1 hr ago',
    amount: '-₦12,500',
    credit: false,
  },
  { icon: '↙', label: 'From Yusuf', sub: 'Transfer · 3 hrs ago', amount: '+₦50,000', credit: true },
  {
    icon: '🍔',
    label: 'Chicken Republic',
    sub: 'Food · Yesterday',
    amount: '-₦4,350',
    credit: false,
  },
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
      className="flex items-center justify-between px-5 pb-1 pt-[52px]"
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
  onNotif,
  onProfile,
}: {
  greeting: string;
  onNotif: () => void;
  onProfile: () => void;
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
            Saeed
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
              S
            </span>
          </button>
        </div>
      </div>

      {/* Search */}
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
            <svg width="13" height="13" viewBox="0 0 24 24" fill="white">
              <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
            </svg>
          </div>
          <p
            className="flex-1 text-[12.5px]"
            style={{ color: 'rgba(255,255,255,.32)', fontFamily: "'Inter',sans-serif" }}
          >
            Search products, rides, pharmacies…
          </p>
          <button
            className="flex h-8 w-8 items-center justify-center rounded-xl"
            style={{ background: 'rgba(255,255,255,.06)' }}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="rgba(255,255,255,.55)"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <rect x="9" y="2" width="6" height="11" rx="3" />
              <path d="M5 10a7 7 0 0014 0M12 19v3M9 22h6" />
            </svg>
          </button>
          <button
            className="flex h-8 w-8 items-center justify-center rounded-xl"
            style={{ background: 'rgba(255,255,255,.06)' }}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="rgba(255,255,255,.55)"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <path d="M14 14h2v2h-2zM18 14h3M14 18v3M18 18h3v3h-3z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE SWITCHER
// ─────────────────────────────────────────────────────────────────────────────
type SvcKey = 'market' | 'ride' | 'wallet';
const SVC_TABS: { key: SvcKey; icon: string; label: string; dot: string }[] = [
  { key: 'market', icon: '🛍', label: 'Marketplace', dot: '#2BAC52' },
  { key: 'ride', icon: '🚖', label: 'Ride', dot: '#3B82F6' },
  { key: 'wallet', icon: '💳', label: 'Wallet', dot: '#8B5CF6' },
];

function ServiceSwitcher({ active, onChange }: { active: SvcKey; onChange: (k: SvcKey) => void }) {
  return (
    <div className="mx-5 mb-4 mt-4">
      <div
        className="flex gap-1 rounded-2xl p-1"
        style={{ background: 'rgba(255,255,255,.05)', border: '1.5px solid rgba(255,255,255,.07)' }}
      >
        {SVC_TABS.map((t) => {
          const on = active === t.key;
          return (
            <button
              key={t.key}
              onClick={() => onChange(t.key)}
              className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl transition-all active:scale-95"
              style={{
                background: on ? 'rgba(255,255,255,.10)' : 'transparent',
                border: on ? '1px solid rgba(255,255,255,.12)' : '1px solid transparent',
                boxShadow: on ? '0 2px 12px rgba(0,0,0,.28)' : 'none',
              }}
            >
              <span style={{ fontSize: 15 }}>{t.icon}</span>
              <p
                className="text-[11.5px] font-semibold"
                style={{
                  fontFamily: "'Inter',sans-serif",
                  color: on ? '#FFF' : 'rgba(255,255,255,.35)',
                  transition: 'color .2s ease',
                }}
              >
                {t.label}
              </p>
              {on && (
                <div
                  className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                  style={{ background: t.dot }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BALANCE CARD — conditional on wallet activation
// ─────────────────────────────────────────────────────────────────────────────
function ActivateWalletCard({ onActivate }: { onActivate: () => void }) {
  return (
    <div
      className="relative mx-5 mb-5 overflow-hidden rounded-3xl p-5"
      style={{
        background: 'linear-gradient(135deg,#0D1B2E 0%,#112238 100%)',
        border: '1.5px dashed rgba(43,172,82,.28)',
        boxShadow: '0 4px 24px rgba(0,0,0,.3)',
      }}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full"
        style={{ background: 'radial-gradient(circle,rgba(43,172,82,.1) 0%,transparent 70%)' }}
      />
      <div className="relative z-10">
        <div className="mb-4 flex items-center gap-4">
          <div
            className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl"
            style={{ background: 'rgba(43,172,82,.10)', border: '1.5px solid rgba(43,172,82,.22)' }}
          >
            <span style={{ fontSize: 28 }}>💳</span>
          </div>
          <div>
            <p
              className="mb-0.5 text-[15px] font-bold"
              style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
            >
              Activate your Wallet
            </p>
            <p
              className="text-[11px]"
              style={{ color: 'rgba(255,255,255,.45)', fontFamily: "'Inter',sans-serif" }}
            >
              Send, receive and pay — all in one place.
            </p>
          </div>
        </div>
        <button
          onClick={onActivate}
          className="active:scale-97 flex h-11 w-full items-center justify-center gap-2 rounded-2xl text-[13px] font-semibold transition-all"
          style={{
            background: 'linear-gradient(135deg,#176B30,#2BAC52)',
            color: '#FFF',
            fontFamily: "'Poppins',sans-serif",
            boxShadow: '0 6px 20px rgba(43,172,82,.28)',
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <path d="M12 5v14M5 12l7-7 7 7" />
          </svg>
          Activate Wallet
        </button>
      </div>
    </div>
  );
}

function BalanceCard({ activated, onActivate }: { activated: boolean; onActivate: () => void }) {
  const [show, setShow] = useState(true);
  if (!activated) return <ActivateWalletCard onActivate={onActivate} />;
  return (
    <div
      className="relative mx-5 mb-5 overflow-hidden rounded-3xl p-5"
      style={{
        background: 'linear-gradient(135deg,#0E3320 0%,#155C31 45%,#1E8A49 80%,#2BAC52 100%)',
        boxShadow: '0 16px 48px rgba(43,172,82,.28), 0 4px 16px rgba(0,0,0,.4)',
      }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,.028) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.028) 1px,transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />
      <div
        className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full"
        style={{ background: 'radial-gradient(circle,rgba(71,207,114,.22) 0%,transparent 65%)' }}
      />
      <div className="relative z-10">
        <div className="mb-1 flex items-center justify-between">
          <p
            className="text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: 'rgba(255,255,255,.55)', fontFamily: "'Inter',sans-serif" }}
          >
            Total Balance
          </p>
          <button
            onClick={() => setShow((v) => !v)}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition-all active:scale-90"
            style={{ background: 'rgba(255,255,255,.12)' }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="rgba(255,255,255,.8)"
              strokeWidth="2"
              strokeLinecap="round"
            >
              {show ? (
                <>
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </>
              ) : (
                <>
                  <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M1 1l22 22" />
                </>
              )}
            </svg>
          </button>
        </div>
        <p
          className="mb-0.5 text-[36px] font-bold leading-tight tracking-tight"
          style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
        >
          {show ? '₦847,250' : '₦ •••,•••'}
          <span className="text-[20px]">{show ? '.00' : ''}</span>
        </p>
        <p
          className="mb-5 text-[11px]"
          style={{ color: 'rgba(255,255,255,.45)', fontFamily: "'Inter',sans-serif" }}
        >
          {show ? '≈ $563.50 USD' : 'Hidden'}
        </p>
        <div className="mb-4 flex gap-2.5">
          {[
            ['↑ Income', '+₦320K', 'rgba(255,255,255,.12)'],
            ['↓ Spent', '-₦87.5K', 'rgba(0,0,0,.15)'],
            ['⊙ Savings', '₦150K', 'rgba(255,255,255,.09)'],
          ].map(([l, v, bg]) => (
            <div
              key={l}
              className="flex-1 rounded-xl px-2.5 py-2"
              style={{ background: bg as string }}
            >
              <p
                className="mb-0.5 text-[8.5px]"
                style={{ color: 'rgba(255,255,255,.5)', fontFamily: "'Inter',sans-serif" }}
              >
                {l}
              </p>
              <p
                className="text-[13px] font-bold"
                style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
              >
                {show ? v : '••••'}
              </p>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          {[
            ['↑', 'Send'],
            ['↓', 'Receive'],
            ['⊕', 'Top Up'],
            ['≡', 'Pay'],
          ].map(([ico, lbl]) => (
            <button
              key={lbl}
              className="flex flex-1 flex-col items-center gap-1 rounded-2xl py-2 transition-all active:scale-90"
              style={{ background: 'rgba(255,255,255,.10)' }}
            >
              <span className="text-[15px] font-bold" style={{ color: '#FFF' }}>
                {ico}
              </span>
              <p
                className="text-[9px] font-semibold"
                style={{ color: 'rgba(255,255,255,.65)', fontFamily: "'Inter',sans-serif" }}
              >
                {lbl}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// QUICK ACTIONS
// ─────────────────────────────────────────────────────────────────────────────
function QuickActions() {
  return (
    <div className="mb-5 px-5">
      <div className="grid grid-cols-4 gap-3">
        {QUICK.map((q) => (
          <button
            key={q.label}
            className="flex flex-col items-center gap-1.5 transition-all active:scale-90"
          >
            <div
              className="flex h-[56px] w-[56px] items-center justify-center rounded-2xl text-[24px]"
              style={{
                background: q.color + '18',
                border: `1.5px solid ${q.color}28`,
                boxShadow: `0 4px 16px ${q.color}12`,
              }}
            >
              {q.icon}
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
// AI CARD
// ─────────────────────────────────────────────────────────────────────────────
function AICard({ onAsk }: { onAsk: () => void }) {
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
    const t = setTimeout(() => setChars((c) => c + 1), 34);
    return () => clearTimeout(t);
  }, [chars, idx]);

  return (
    <div
      className="mx-5 mb-5 overflow-hidden rounded-3xl"
      style={{
        background: 'linear-gradient(135deg,#0A1628 0%,#0E1F38 100%)',
        border: '1.5px solid rgba(43,172,82,.22)',
        boxShadow: '0 4px 32px rgba(43,172,82,.08)',
      }}
    >
      <div className="p-4">
        <div className="mb-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl"
              style={{
                background: `linear-gradient(135deg,${G0},${G3})`,
                boxShadow: `0 6px 20px rgba(43,172,82,.38)`,
                animation: 'avatar-pulse 3s ease-in-out infinite',
              }}
            >
              <span style={{ fontSize: 20 }}>✨</span>
            </div>
            <div>
              <p
                className="text-[15px] font-bold leading-tight"
                style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
              >
                Ask Drip
              </p>
              <p className="text-[10px]" style={{ color: G3, fontFamily: "'Inter',sans-serif" }}>
                AI · Your personal assistant
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: G3, animation: 'pulse-ring 1.8s ease-out infinite' }}
            />
            <p
              className="text-[9px] font-medium"
              style={{ color: G3, fontFamily: "'Inter',sans-serif" }}
            >
              Online
            </p>
          </div>
        </div>

        <div
          className="mb-3.5 flex min-h-[46px] items-center rounded-2xl px-4 py-3"
          style={{ background: 'rgba(43,172,82,.07)', border: '1px solid rgba(43,172,82,.14)' }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke={G3}
            strokeWidth="2"
            strokeLinecap="round"
            className="mr-2.5 flex-shrink-0 opacity-60"
          >
            <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          <p
            className="flex-1 text-[12px]"
            style={{ color: 'rgba(255,255,255,.72)', fontFamily: "'Inter',sans-serif" }}
          >
            {AI_PROMPTS[idx].slice(0, chars)}
            <span
              style={{
                opacity: chars < AI_PROMPTS[idx].length ? 1 : 0,
                animation:
                  chars < AI_PROMPTS[idx].length ? 'fade-in .4s ease infinite alternate' : 'none',
              }}
            >
              |
            </span>
          </p>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {AI_PROMPTS.slice(0, 4).map((s, i) => (
            <button
              key={i}
              onClick={onAsk}
              className="rounded-full px-3 py-1.5 text-[10px] font-medium transition-all active:scale-95"
              style={{
                background: 'rgba(255,255,255,.055)',
                color: 'rgba(255,255,255,.58)',
                border: `1px solid ${BORDER}`,
                fontFamily: "'Inter',sans-serif",
              }}
            >
              {s.length > 22 ? s.slice(0, 20) + '…' : s}
            </button>
          ))}
        </div>

        <button
          onClick={onAsk}
          className="active:scale-97 flex h-[46px] w-full items-center justify-center gap-2 rounded-2xl text-[14px] font-semibold transition-all"
          style={{
            background: `linear-gradient(135deg,${G0} 0%,${G2} 55%,${G3} 100%)`,
            color: '#FFF',
            fontFamily: "'Poppins',sans-serif",
            boxShadow: `0 8px 24px rgba(43,172,82,.3)`,
          }}
        >
          <span>✨</span>Ask AI
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROMO CAROUSEL
// ─────────────────────────────────────────────────────────────────────────────
function PromoCarousel() {
  const [i, setI] = useState(0);
  const [fade, setFade] = useState(false);

  useEffect(() => {
    const t = setInterval(() => {
      setFade(true);
      setTimeout(() => {
        setI((n) => (n + 1) % PROMOS.length);
        setFade(false);
      }, 200);
    }, 4800);
    return () => clearInterval(t);
  }, []);

  const p = PROMOS[i];
  return (
    <div className="mx-5 mb-5">
      <div
        className="relative overflow-hidden rounded-3xl p-5"
        style={{
          background: p.bg,
          minHeight: 116,
          boxShadow: '0 12px 40px rgba(0,0,0,.38)',
          transition: 'opacity .2s ease',
          opacity: fade ? 0 : 1,
        }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle at 80% 50%,rgba(255,255,255,.08) 0%,transparent 50%)',
          }}
        />
        <div
          className="absolute right-5 top-1/2 -translate-y-1/2 text-[64px]"
          style={{ opacity: 0.1 }}
        >
          {p.icon}
        </div>
        <div className="relative z-10 flex items-center gap-4">
          <div
            className="flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded-2xl"
            style={{ background: 'rgba(255,255,255,.14)', backdropFilter: 'blur(12px)' }}
          >
            <span style={{ fontSize: 26 }}>{p.icon}</span>
          </div>
          <div className="flex-1">
            <p
              className="mb-0.5 text-[17px] font-bold"
              style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
            >
              {p.title}
            </p>
            <p
              className="mb-3 text-[11px]"
              style={{ color: 'rgba(255,255,255,.68)', fontFamily: "'Inter',sans-serif" }}
            >
              {p.sub}
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
              {p.cta} →
            </button>
          </div>
        </div>
        <div className="mt-4 flex gap-1.5">
          {PROMOS.map((_, j) => (
            <button
              key={j}
              onClick={() => setI(j)}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: j === i ? 24 : 6,
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
// CATEGORIES
// ─────────────────────────────────────────────────────────────────────────────
function Categories() {
  const [active, setActive] = useState('Supermarkets');
  return (
    <div className="mb-5">
      <Row title="Categories" />
      <div className="flex gap-3 overflow-x-auto px-5" style={{ scrollbarWidth: 'none' }}>
        {CATS.map((c) => {
          const on = active === c.label;
          return (
            <button
              key={c.label}
              onClick={() => setActive(c.label)}
              className="flex flex-shrink-0 flex-col items-center gap-1.5 transition-all active:scale-90"
            >
              <div
                className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl text-[22px]"
                style={{
                  background: on ? `linear-gradient(135deg,${G0},${G2})` : NAVY_CARD,
                  border: on ? 'none' : `1.5px solid ${BORDER}`,
                  boxShadow: on ? `0 6px 18px rgba(43,172,82,.28)` : 'none',
                  transition: 'all .2s ease',
                }}
              >
                {c.icon}
              </div>
              <p
                className="text-center text-[9px] font-semibold"
                style={{
                  color: on ? G3 : 'rgba(255,255,255,.42)',
                  fontFamily: "'Inter',sans-serif",
                  maxWidth: 52,
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
function Merchants({ loaded }: { loaded: boolean }) {
  return (
    <div className="mb-5">
      <Row title="Nearby Merchants" onAll={() => {}} />
      <div className="flex gap-3 overflow-x-auto px-5" style={{ scrollbarWidth: 'none' }}>
        {!loaded
          ? [1, 2, 3].map((i) => <Bone key={i} w={155} h={188} />)
          : MERCHANTS.map((m) => (
              <div
                key={m.name}
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
                  style={{ background: m.bg }}
                >
                  <span style={{ fontSize: 40 }}>{m.emoji}</span>
                  <div
                    className="absolute right-2.5 top-2.5 rounded-xl px-2 py-1 text-[9px] font-bold"
                    style={{
                      background: 'rgba(0,0,0,.5)',
                      color: '#FFF',
                      backdropFilter: 'blur(6px)',
                      fontFamily: "'Inter',sans-serif",
                    }}
                  >
                    ⏱ {m.eta}
                  </div>
                </div>
                <div className="p-3">
                  <p
                    className="mb-0.5 truncate text-[12.5px] font-bold"
                    style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
                  >
                    {m.name}
                  </p>
                  <p
                    className="mb-2 text-[10px]"
                    style={{ color: MUTED, fontFamily: "'Inter',sans-serif" }}
                  >
                    {m.cat}
                  </p>
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-[10px] font-bold" style={{ color: '#FBBF24' }}>
                      ★ {m.rating}
                    </span>
                    <span
                      className="text-[10px]"
                      style={{ color: MUTED, fontFamily: "'Inter',sans-serif" }}
                    >
                      {m.dist}
                    </span>
                  </div>
                  <button
                    className="h-[30px] w-full rounded-xl text-[11px] font-semibold transition-all active:scale-95"
                    style={{
                      background: `linear-gradient(135deg,${G0},${G2})`,
                      color: '#FFF',
                      fontFamily: "'Inter',sans-serif",
                      boxShadow: `0 3px 12px rgba(43,172,82,.25)`,
                    }}
                  >
                    View Store
                  </button>
                </div>
              </div>
            ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RECOMMENDATIONS
// ─────────────────────────────────────────────────────────────────────────────
function Recs({ loaded }: { loaded: boolean }) {
  return (
    <div className="mb-5">
      <Row title="Recommended for You" onAll={() => {}} />
      <div className="flex gap-3 overflow-x-auto px-5" style={{ scrollbarWidth: 'none' }}>
        {!loaded
          ? [1, 2, 3, 4].map((i) => <Bone key={i} w={130} h={148} />)
          : RECS.map((r) => (
              <button
                key={r.name}
                className="flex flex-shrink-0 flex-col items-center gap-2.5 rounded-2xl p-3.5 transition-all active:scale-95"
                style={{ width: 130, background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
              >
                <div
                  className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl text-[28px]"
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
                    className="mt-0.5 text-[11px] font-bold"
                    style={{ color: G3, fontFamily: "'Poppins',sans-serif" }}
                  >
                    {r.price}
                  </p>
                </div>
                <span
                  className="rounded-full px-2.5 py-1 text-[9px] font-bold"
                  style={{ background: r.bc + '20', color: r.bc, border: `1px solid ${r.bc}35` }}
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
// RECENT ACTIVITY
// ─────────────────────────────────────────────────────────────────────────────
function ActivityList({ loaded }: { loaded: boolean }) {
  return (
    <div className="mb-4 px-5">
      <Row title="Recent Activity" onAll={() => {}} />
      {!loaded ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <Bone key={i} w="100%" h={64} r={20} />
          ))}
        </div>
      ) : (
        <div
          className="overflow-hidden rounded-3xl"
          style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
        >
          {ACTIVITY.map((a, i) => (
            <div
              key={i}
              className="flex items-center gap-3.5 px-4 py-3.5"
              style={{ borderBottom: i < ACTIVITY.length - 1 ? `1px solid ${BORDER}` : 'none' }}
            >
              <div
                className="flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-2xl text-[18px]"
                style={{ background: a.credit ? 'rgba(43,172,82,.12)' : 'rgba(255,255,255,.06)' }}
              >
                {a.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className="truncate text-[13px] font-semibold"
                  style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
                >
                  {a.label}
                </p>
                <p
                  className="text-[10px]"
                  style={{ color: MUTED, fontFamily: "'Inter',sans-serif" }}
                >
                  {a.sub}
                </p>
              </div>
              <p
                className="flex-shrink-0 text-[14px] font-bold"
                style={{ fontFamily: "'Poppins',sans-serif", color: a.credit ? G3 : '#FFF' }}
              >
                {a.amount}
              </p>
            </div>
          ))}
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
              AI · Ready to help you
            </p>
          </div>
        </div>
        <div className="mb-5 flex flex-col gap-2.5">
          {AI_PROMPTS.map((s, i) => (
            <button
              key={i}
              onClick={onClose}
              className="active:scale-98 flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left text-[12.5px] transition-all"
              style={{
                background: 'rgba(255,255,255,.045)',
                color: 'rgba(255,255,255,.78)',
                fontFamily: "'Inter',sans-serif",
                border: `1px solid ${BORDER}`,
              }}
            >
              <span style={{ fontSize: 16, flexShrink: 0 }}>
                {'✨🚗📦💊🏷'.slice(i * 2, i * 2 + 2)}
              </span>
              {s}
            </button>
          ))}
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
function FAB({ onPress }: { onPress: () => void }) {
  return (
    <button
      onClick={onPress}
      className="absolute z-40 transition-all active:scale-90"
      style={{ bottom: 94, right: 18 }}
      aria-label="AI Assistant"
    >
      <div
        style={{
          width: 52,
          height: 52,
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
  onRide,
  onDriverApp,
}: {
  onAccount: () => void;
  onSecurity: () => void;
  onNotifications: () => void;
  onMarketplace?: () => void;
  onRide?: () => void;
  onDriverApp?: () => void;
}) {
  const [navTab, setNavTab] = useState<NavTab>('home');
  const [svcTab, setSvcTab] = useState<SvcKey>('market');
  const [walletActivated, setWalletActivated] = useState(true);
  const [showAI, setShowAI] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const [greeting] = useState(() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
  });

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 1000);
    return () => clearTimeout(t);
  }, []);

  const handleNav = (t: NavTab) => {
    setNavTab(t);
    if (t === 'profile') onAccount();
    if (t === 'market') onMarketplace?.();
    if (t === 'ride') onRide?.();
  };

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{ background: NAVY_DEEP }}
    >
      {/* Fixed header with hero bg, search */}
      <Header greeting={greeting} onNotif={onNotifications} onProfile={onAccount} />

      {/* Scrollable body */}
      <div
        className="flex-1 overflow-y-auto"
        style={{
          scrollbarWidth: 'none',
          background: `linear-gradient(180deg,${NAVY_DEEP} 0%,#060E1C 100%)`,
        }}
      >
        {/* Service switcher — first thing below search */}
        <ServiceSwitcher active={svcTab} onChange={setSvcTab} />

        {/* Wallet balance card (or activate CTA) */}
        <BalanceCard activated={walletActivated} onActivate={() => setWalletActivated(true)} />

        {/* Quick actions 4×2 grid */}
        <div className="mb-1">
          <Row title="Quick Actions" />
          <QuickActions />
        </div>

        <AICard onAsk={() => setShowAI(true)} />
        <PromoCarousel />
        <Categories />
        <Merchants loaded={loaded} />
        <Recs loaded={loaded} />
        <ActivityList loaded={loaded} />

        <div style={{ height: 104 }} />
      </div>

      <FAB onPress={() => setShowAI(true)} />
      <BottomNav active={navTab} onChange={handleNav} />
      {showAI && <AISheet onClose={() => setShowAI(false)} />}
    </div>
  );
}
