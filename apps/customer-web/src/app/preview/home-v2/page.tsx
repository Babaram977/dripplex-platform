'use client';

import { G0, G2, G3, NAVY_DEEP, NAVY_CARD, BORDER, MUTED } from '@dripplex/ui';
import { Inter, Poppins } from 'next/font/google';
import * as React from 'react';

/**
 * PREVIEW ONLY — not linked from real navigation, not wired to any backend.
 *
 * A faithful port of the founder-approved Figma Make `HomeScreen`
 * (docs/reference/figma-super-app-source/homeScreen.tsx) into a real
 * Next.js page, using the locked colors from `@dripplex/ui`. Mock data is
 * copied verbatim from the source file — this exists purely to let the
 * founder visually confirm the port is faithful before any real screen
 * gets built against live APIs. Delete once that's confirmed (or promote
 * to a real route and wire it up).
 */

const poppins = Poppins({ subsets: ['latin'], weight: ['500', '600', '700', '800'] });
const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700'] });

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
];

const RECS = [
  { emoji: '📱', name: 'iPhone 15 Pro', price: '₦890K', badge: 'Trending', bc: '#EF4444' },
  { emoji: '🍛', name: 'Jollof + Protein', price: '₦4,200', badge: 'Popular', bc: '#F97316' },
  { emoji: '👘', name: 'Adire Set', price: '₦18K', badge: 'New In', bc: '#8B5CF6' },
  { emoji: '🎧', name: 'Wireless Buds', price: '₦45K', badge: 'Hot', bc: '#2BAC52' },
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
];

function Row({ title }: { title: string }): React.JSX.Element {
  return (
    <div className="mb-3 flex items-center justify-between px-5">
      <p className={`text-[15px] font-bold ${poppins.className}`} style={{ color: '#FFF' }}>
        {title}
      </p>
      <span className={`text-[12px] font-semibold ${inter.className}`} style={{ color: G3 }}>
        See all →
      </span>
    </div>
  );
}

function Header(): React.JSX.Element {
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

      <div className="flex items-center justify-between px-5 pb-1 pt-[52px]">
        <span
          className={`text-[11px] ${inter.className}`}
          style={{ color: 'rgba(255,255,255,.38)' }}
        >
          9:41
        </span>
      </div>

      <div className="relative z-10 mt-2 flex items-center justify-between px-5">
        <div>
          <div className="mb-1 flex items-center gap-1.5">
            <span style={{ fontSize: 15 }}>👋</span>
            <p
              className={`text-[12px] ${inter.className}`}
              style={{ color: 'rgba(255,255,255,.48)' }}
            >
              Good Morning
            </p>
          </div>
          <p
            className={`text-[22px] font-bold leading-tight ${poppins.className}`}
            style={{ color: '#FFF' }}
          >
            Saeed
          </p>
          <p
            className={`mt-0.5 text-[11px] font-semibold ${inter.className}`}
            style={{ color: G3, letterSpacing: '0.05em' }}
          >
            life,Simplified
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <div
            className="relative flex h-[42px] w-[42px] items-center justify-center rounded-2xl"
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
          </div>
          <div
            className="flex h-[42px] w-[42px] items-center justify-center rounded-2xl"
            style={{
              background: `linear-gradient(135deg,${G0},${G2})`,
              boxShadow: '0 4px 14px rgba(43,172,82,.3)',
            }}
          >
            <span className={`text-[17px] font-bold text-white ${poppins.className}`}>S</span>
          </div>
        </div>
      </div>

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
            className={`flex-1 text-[12.5px] ${inter.className}`}
            style={{ color: 'rgba(255,255,255,.32)' }}
          >
            Search products, rides, pharmacies…
          </p>
        </div>
      </div>
    </div>
  );
}

function BalanceCard(): React.JSX.Element {
  const stats: [string, string, string][] = [
    ['↑ Income', '+₦320K', 'rgba(255,255,255,.12)'],
    ['↓ Spent', '-₦87.5K', 'rgba(0,0,0,.15)'],
    ['⊙ Savings', '₦150K', 'rgba(255,255,255,.09)'],
  ];
  return (
    <div
      className="relative mx-5 mb-5 overflow-hidden rounded-3xl p-5"
      style={{
        background: 'linear-gradient(135deg,#0E3320 0%,#155C31 45%,#1E8A49 80%,#2BAC52 100%)',
        boxShadow: '0 16px 48px rgba(43,172,82,.28), 0 4px 16px rgba(0,0,0,.4)',
      }}
    >
      <div
        className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full"
        style={{ background: 'radial-gradient(circle,rgba(71,207,114,.22) 0%,transparent 65%)' }}
      />
      <div className="relative z-10">
        <p
          className={`mb-1 text-[10px] font-semibold uppercase tracking-widest ${inter.className}`}
          style={{ color: 'rgba(255,255,255,.55)' }}
        >
          Total Balance
        </p>
        <p
          className={`mb-0.5 text-[36px] font-bold leading-tight tracking-tight ${poppins.className}`}
          style={{ color: '#FFF' }}
        >
          ₦847,250<span className="text-[20px]">.00</span>
        </p>
        <p
          className={`mb-5 text-[11px] ${inter.className}`}
          style={{ color: 'rgba(255,255,255,.45)' }}
        >
          ≈ $563.50 USD
        </p>
        <div className="mb-4 flex gap-2.5">
          {stats.map(([l, v, bg]) => (
            <div key={l} className="flex-1 rounded-xl px-2.5 py-2" style={{ background: bg }}>
              <p
                className={`mb-0.5 text-[8.5px] ${inter.className}`}
                style={{ color: 'rgba(255,255,255,.5)' }}
              >
                {l}
              </p>
              <p className={`text-[13px] font-bold ${poppins.className}`} style={{ color: '#FFF' }}>
                {v}
              </p>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          {(['↑ Send', '↓ Receive', '⊕ Top Up', '≡ Pay'] as const).map((entry) => {
            const [ico, lbl] = entry.split(' ');
            return (
              <div
                key={entry}
                className="flex flex-1 flex-col items-center gap-1 rounded-2xl py-2"
                style={{ background: 'rgba(255,255,255,.10)' }}
              >
                <span className="text-[15px] font-bold" style={{ color: '#FFF' }}>
                  {ico}
                </span>
                <p
                  className={`text-[9px] font-semibold ${inter.className}`}
                  style={{ color: 'rgba(255,255,255,.65)' }}
                >
                  {lbl}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function QuickActions(): React.JSX.Element {
  return (
    <div className="mb-1 px-5">
      <div className="grid grid-cols-4 gap-3">
        {QUICK.map((q) => (
          <div key={q.label} className="flex flex-col items-center gap-1.5">
            <div
              className="flex h-[56px] w-[56px] items-center justify-center rounded-2xl text-[24px]"
              style={{
                background: `${q.color}18`,
                border: `1.5px solid ${q.color}28`,
                boxShadow: `0 4px 16px ${q.color}12`,
              }}
            >
              {q.icon}
            </div>
            <p
              className={`text-center text-[10px] font-medium ${inter.className}`}
              style={{ color: 'rgba(255,255,255,.58)' }}
            >
              {q.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function AICard(): React.JSX.Element {
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
                boxShadow: '0 6px 20px rgba(43,172,82,.38)',
              }}
            >
              <span style={{ fontSize: 20 }}>✨</span>
            </div>
            <div>
              <p
                className={`text-[15px] font-bold leading-tight ${poppins.className}`}
                style={{ color: '#FFF' }}
              >
                Ask Drip
              </p>
              <p className={`text-[10px] ${inter.className}`} style={{ color: G3 }}>
                AI · Your personal assistant
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full" style={{ background: G3 }} />
            <p className={`text-[9px] font-medium ${inter.className}`} style={{ color: G3 }}>
              Online
            </p>
          </div>
        </div>
        <div
          className="mb-3.5 flex min-h-[46px] items-center rounded-2xl px-4 py-3"
          style={{ background: 'rgba(43,172,82,.07)', border: '1px solid rgba(43,172,82,.14)' }}
        >
          <p
            className={`flex-1 text-[12px] ${inter.className}`}
            style={{ color: 'rgba(255,255,255,.72)' }}
          >
            Find the best shawarma near me
          </p>
        </div>
        <button
          type="button"
          className={`flex h-[46px] w-full items-center justify-center gap-2 rounded-2xl text-[14px] font-semibold ${poppins.className}`}
          style={{
            background: `linear-gradient(135deg,${G0} 0%,${G2} 55%,${G3} 100%)`,
            color: '#FFF',
            boxShadow: '0 8px 24px rgba(43,172,82,.3)',
          }}
        >
          <span>✨</span>Ask AI
        </button>
      </div>
    </div>
  );
}

function Categories(): React.JSX.Element {
  return (
    <div className="mb-5">
      <Row title="Categories" />
      <div className="flex gap-3 overflow-x-auto px-5" style={{ scrollbarWidth: 'none' }}>
        {CATS.map((c, i) => {
          const on = i === 0;
          return (
            <div key={c.label} className="flex flex-shrink-0 flex-col items-center gap-1.5">
              <div
                className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl text-[22px]"
                style={{
                  background: on ? `linear-gradient(135deg,${G0},${G2})` : NAVY_CARD,
                  border: on ? 'none' : `1.5px solid ${BORDER}`,
                  boxShadow: on ? '0 6px 18px rgba(43,172,82,.28)' : 'none',
                }}
              >
                {c.icon}
              </div>
              <p
                className={`text-center text-[9px] font-semibold ${inter.className}`}
                style={{ color: on ? G3 : 'rgba(255,255,255,.42)', maxWidth: 52 }}
              >
                {c.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Merchants(): React.JSX.Element {
  return (
    <div className="mb-5">
      <Row title="Nearby Merchants" />
      <div className="flex gap-3 overflow-x-auto px-5" style={{ scrollbarWidth: 'none' }}>
        {MERCHANTS.map((m) => (
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
                className={`absolute right-2.5 top-2.5 rounded-xl px-2 py-1 text-[9px] font-bold ${inter.className}`}
                style={{ background: 'rgba(0,0,0,.5)', color: '#FFF' }}
              >
                ⏱ {m.eta}
              </div>
            </div>
            <div className="p-3">
              <p
                className={`mb-0.5 truncate text-[12.5px] font-bold ${poppins.className}`}
                style={{ color: '#FFF' }}
              >
                {m.name}
              </p>
              <p className={`mb-2 text-[10px] ${inter.className}`} style={{ color: MUTED }}>
                {m.cat}
              </p>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[10px] font-bold" style={{ color: '#FBBF24' }}>
                  ★ {m.rating}
                </span>
                <span className={`text-[10px] ${inter.className}`} style={{ color: MUTED }}>
                  {m.dist}
                </span>
              </div>
              <button
                type="button"
                className={`h-[30px] w-full rounded-xl text-[11px] font-semibold ${inter.className}`}
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
        ))}
      </div>
    </div>
  );
}

function Recs(): React.JSX.Element {
  return (
    <div className="mb-5">
      <Row title="Recommended for You" />
      <div className="flex gap-3 overflow-x-auto px-5" style={{ scrollbarWidth: 'none' }}>
        {RECS.map((r) => (
          <div
            key={r.name}
            className="flex flex-shrink-0 flex-col items-center gap-2.5 rounded-2xl p-3.5"
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
                className={`truncate text-[11.5px] font-bold ${poppins.className}`}
                style={{ color: '#FFF' }}
              >
                {r.name}
              </p>
              <p
                className={`mt-0.5 text-[11px] font-bold ${poppins.className}`}
                style={{ color: G3 }}
              >
                {r.price}
              </p>
            </div>
            <span
              className="rounded-full px-2.5 py-1 text-[9px] font-bold"
              style={{ background: `${r.bc}20`, color: r.bc, border: `1px solid ${r.bc}35` }}
            >
              {r.badge}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivityList(): React.JSX.Element {
  return (
    <div className="mb-4 px-5">
      <Row title="Recent Activity" />
      <div
        className="overflow-hidden rounded-3xl"
        style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
      >
        {ACTIVITY.map((a, i) => (
          <div
            key={a.label}
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
                className={`truncate text-[13px] font-semibold ${poppins.className}`}
                style={{ color: '#FFF' }}
              >
                {a.label}
              </p>
              <p className={`text-[10px] ${inter.className}`} style={{ color: MUTED }}>
                {a.sub}
              </p>
            </div>
            <p
              className={`flex-shrink-0 text-[14px] font-bold ${poppins.className}`}
              style={{ color: a.credit ? G3 : '#FFF' }}
            >
              {a.amount}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function BottomNav(): React.JSX.Element {
  const tabs = [
    { label: 'Home', d: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2zM9 22V12h6v10', on: true },
    {
      label: 'Marketplace',
      d: 'M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0',
      on: false,
    },
    {
      label: 'Ride',
      d: 'M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v9a2 2 0 01-2 2h-2M7 17a2 2 0 100 4 2 2 0 000-4zM17 17a2 2 0 100 4 2 2 0 000-4z',
      on: false,
    },
    {
      label: 'Wallet',
      d: 'M21 4H3a2 2 0 00-2 2v12a2 2 0 002 2h18a2 2 0 002-2V6a2 2 0 00-2-2zM1 10h22',
      on: false,
    },
    {
      label: 'Profile',
      d: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 3a4 4 0 100 8 4 4 0 000-8z',
      on: false,
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
      {tabs.map((t) => (
        <div
          key={t.label}
          className="flex flex-col items-center gap-1 px-2"
          style={{ minWidth: 52 }}
        >
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{
              background: t.on ? 'rgba(43,172,82,.15)' : 'transparent',
              border: t.on ? '1px solid rgba(43,172,82,.3)' : '1px solid transparent',
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke={t.on ? G3 : 'rgba(255,255,255,.32)'}
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d={t.d} />
            </svg>
          </div>
          <p
            className={`text-[9px] font-semibold ${inter.className}`}
            style={{ color: t.on ? G3 : 'rgba(255,255,255,.28)' }}
          >
            {t.label}
          </p>
        </div>
      ))}
    </div>
  );
}

function FAB(): React.JSX.Element {
  return (
    <div className="absolute z-40" style={{ bottom: 94, right: 18 }} aria-label="AI Assistant">
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: `linear-gradient(135deg,${G0},${G2})`,
          boxShadow: '0 6px 28px rgba(43,172,82,.5), 0 0 0 1.5px rgba(43,172,82,.32)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ fontSize: 22 }}>✨</span>
      </div>
    </div>
  );
}

export default function HomePreviewPage(): React.JSX.Element {
  return (
    <div
      className={`relative mx-auto flex h-[844px] w-[390px] flex-col overflow-hidden rounded-[32px] ${inter.className}`}
      style={{ background: NAVY_DEEP }}
    >
      <Header />
      <div
        className="flex-1 overflow-y-auto"
        style={{
          scrollbarWidth: 'none',
          background: `linear-gradient(180deg,${NAVY_DEEP} 0%,#060E1C 100%)`,
        }}
      >
        <div className="mx-5 mb-4 mt-4">
          <div
            className="flex gap-1 rounded-2xl p-1"
            style={{
              background: 'rgba(255,255,255,.05)',
              border: '1.5px solid rgba(255,255,255,.07)',
            }}
          >
            {[
              { icon: '🛍', label: 'Marketplace', on: true },
              { icon: '🚖', label: 'Ride', on: false },
              { icon: '💳', label: 'Wallet', on: false },
            ].map((t) => (
              <div
                key={t.label}
                className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl"
                style={{
                  background: t.on ? 'rgba(255,255,255,.10)' : 'transparent',
                  border: t.on ? '1px solid rgba(255,255,255,.12)' : '1px solid transparent',
                }}
              >
                <span style={{ fontSize: 15 }}>{t.icon}</span>
                <p
                  className={`text-[11.5px] font-semibold ${inter.className}`}
                  style={{ color: t.on ? '#FFF' : 'rgba(255,255,255,.35)' }}
                >
                  {t.label}
                </p>
              </div>
            ))}
          </div>
        </div>
        <BalanceCard />
        <div className="mb-1">
          <Row title="Quick Actions" />
          <QuickActions />
        </div>
        <AICard />
        <Categories />
        <Merchants />
        <Recs />
        <ActivityList />
        <div style={{ height: 104 }} />
      </div>
      <FAB />
      <BottomNav />
    </div>
  );
}
