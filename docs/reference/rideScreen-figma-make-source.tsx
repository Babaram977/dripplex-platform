/**
 * RIDE-003 — reference copy of Figma Make's generated Ride screen source.
 *
 * Provenance: pasted into chat by Saeed across 3 messages on 2026-08-02, after
 * the Figma MCP connector (real Figma) was confirmed to have no access to
 * Figma Make output — Figma Make is a separate code-generation tool, not a
 * Figma design file, so this JSX is the actual visual source of truth for
 * RIDE-003, not a Figma design read via get_design_context/get_screenshot.
 *
 * This file is NOT part of any app build (deliberately outside any app's src) —
 * it is a durable reference copy so future work doesn't depend on chat
 * history, and it is kept as close to verbatim as what was pasted, including
 * two known defects rather than silently fixing them:
 *
 * 1. `WalletPaySuccessScreen` is exported twice with different bodies (once
 *    near the end of "Part 2", once near the end of "Part 3"). Two top-level
 *    `export function` declarations with the same name would be a hard
 *    TypeScript/JS syntax error in a real single file, so this is almost
 *    certainly a chunking artifact from however the source was split, not
 *    the actual file's real content. The customer-web port uses the Part 3
 *    version (richer transaction detail: payment method / time / txn ID)
 *    as the working default — flagged, not silently resolved.
 *
 * 2. Only 24 of the 31 screens originally claimed ever arrived. Missing:
 *    RideHomeExtendedScreen, PickupConfirmScreen, DriverProfileSheet,
 *    DriverArrivedScreen (base — only DriverArrivedExtendedScreen arrived),
 *    OPayPaymentScreen, CashPaymentScreen, RideDetailScreen. These are
 *    treated as capability gaps (not yet received), not fabricated.
 *
 * Design tokens observed (dark theme, distinct from the platform-wide
 * DRIPPLEX_BRAND tokens in packages/ui/src/brand/tokens.ts — flagged as an
 * intentional Ride-specific palette pending founder confirmation):
 *   Background=#060E1C/#0A1628  Card=#0D1B2E  Surface=#112238
 *   Primary green=#2BAC52  Green dark=#176B30  Green light=#47CF72
 *   Border=rgba(255,255,255,.08)  Muted text=rgba(255,255,255,.38)
 *   Fonts: Poppins (headings/prices), Inter (body)
 *   Frame: 390x844px mobile, full-bleed (position:absolute; inset:0), no
 *   dashboard shell/sidebar/bottom-nav on any screen.
 *
 * Some mock data in this source references ride types ("Comfort", "XL")
 * that don't exist in the real backend (RideType = 'ECONOMY' | 'TRICYCLE'
 * only, packages/types/src/ride/index.ts) — the port only offers the two
 * real types.
 */

// ============================================================
// PART 1 of 3
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import { G0, G2, G3, NAVY_DEEP, NAVY_CARD, NAVY_SURFACE, BORDER, MUTED } from './shared';
import {
  COLOR_STAR,
  COLOR_SUCCESS,
  COLOR_WARNING,
  COLOR_ERROR,
  COLOR_INFO,
  TEXT_SECONDARY,
} from '../tokens/colors';

const NAVY_BASE = '#0A1628';
const PP = "'Poppins',sans-serif";
const IT = "'Inter',sans-serif";

const RECENT_PLACES = [
  { icon: '🏠', label: 'Home', sub: '12 Adewale Close, Ikeja', type: 'saved' },
  { icon: '💼', label: 'Work', sub: 'Plot 4, Victoria Island', type: 'saved' },
  { icon: '🏥', label: 'Reddington Hospital', sub: '12 Mosley Rd, Ikoyi', type: 'recent' },
  { icon: '✈️', label: 'Murtala Airport', sub: 'Ikeja, Lagos State', type: 'recent' },
  { icon: '🛒', label: 'Shoprite Ikeja', sub: '400 Ikorodu Rd, Ikeja', type: 'recent' },
];

const POPULAR_PLACES = [
  { icon: '🏖', label: 'Bar Beach', sub: 'Victoria Island' },
  { icon: '🏟', label: 'National Stadium', sub: 'Surulere, Lagos' },
  { icon: '🏛', label: 'Eko Hotel', sub: 'Plot 1415, VI' },
  { icon: '🛍', label: 'Balogun Market', sub: 'Lagos Island' },
];

const RIDE_TYPES = [
  {
    id: 'economy',
    name: 'Economy',
    emoji: '🚗',
    desc: 'Affordable everyday rides',
    price: '₦2,100',
    time: '4 min',
    seats: 4,
    selected: true,
    color: '#2BAC52',
  },
];

const DRIVER_DATA = {
  name: 'Adeyemi Okafor',
  rating: 4.92,
  trips: 3847,
  plate: 'LAG 482 KA',
  vehicle: 'Toyota Camry (White)',
  eta: '3 min away',
  avatar: 'AO',
  phone: '+234 801 234 5678',
  level: 'Gold Driver',
  verified: true,
};

const PAYMENT_METHODS = [
  { id: 'wallet', icon: '💳', label: 'DrippleX Wallet', balance: '₦24,500', color: '#2BAC52' },
  { id: 'card', icon: '💳', label: 'Visa •••• 4821', balance: '', color: '#3B82F6' },
  { id: 'cash', icon: '💵', label: 'Cash', balance: '', color: '#F59E0B' },
];

const RIDE_HISTORY = [
  {
    id: 'RX-20241205-0012',
    date: 'Today, 9:41 AM',
    from: 'Ikeja, Lagos',
    to: 'Victoria Island',
    amount: '₦2,100',
    status: 'completed',
    driver: 'Adeyemi O.',
    rating: 5,
    type: 'Economy',
  },
  {
    id: 'RX-20241204-0049',
    date: 'Yesterday, 3:22 PM',
    from: 'VI, Lagos',
    to: 'Lekki Phase 1',
    amount: '₦1,850',
    status: 'completed',
    driver: 'Chukwuemeka N.',
    rating: 4,
    type: 'Economy',
  },
  {
    id: 'RX-20241203-0021',
    date: 'Dec 3, 11:05 AM',
    from: 'Surulere',
    to: 'Ikeja City Mall',
    amount: '₦3,400',
    status: 'completed',
    driver: 'Tunde B.',
    rating: 5,
    type: 'Comfort',
  },
  {
    id: 'RX-20241201-0007',
    date: 'Dec 1, 7:48 PM',
    from: 'Lekki Phase 1',
    to: 'Murtala Muhammed Airport',
    amount: '₦5,200',
    status: 'completed',
    driver: 'Biodun A.',
    rating: 4,
    type: 'XL',
  },
  {
    id: 'RX-20241130-0031',
    date: 'Nov 30, 2:15 PM',
    from: 'Ikeja',
    to: 'Apapa Port',
    amount: '₦4,100',
    status: 'cancelled',
    driver: '—',
    rating: 0,
    type: 'Economy',
  },
];

// DESIGN TOKENS (resolved values)
// G0=#176B30  G2=#2BAC52  G3=#47CF72
// NAVY_DEEP=#060E1C  NAVY_CARD=#0D1B2E  NAVY_SURFACE=#112238
// BORDER=rgba(255,255,255,.08)  MUTED=rgba(255,255,255,.38)
// PP=Poppins  IT=Inter  Frame=390x844px

function RideStatusBar() {
  return (
    <div
      className="relative z-10 flex w-full items-center justify-between px-5 pt-[52px]"
      style={{ fontFamily: "'Inter',sans-serif", fontSize: 11, color: 'rgba(255,255,255,.55)' }}
    >
      <span>9:41</span>
    </div>
  );
}

function BackArrow({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex h-10 w-10 items-center justify-center rounded-2xl transition-all active:scale-95"
      style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)' }}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
    </button>
  );
}

function GreenButton({ label, onClick, disabled, loading, small }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`w-full ${small ? 'h-12 rounded-xl text-sm' : 'h-14 rounded-2xl text-[15px]'} flex items-center justify-center gap-2 font-semibold transition-all duration-200 active:scale-[.97]`}
      style={{
        fontFamily: "'Poppins',sans-serif",
        background:
          disabled || loading
            ? 'rgba(255,255,255,.06)'
            : 'linear-gradient(135deg,#176B30 0%,#2BAC52 52%,#47CF72 100%)',
        color: disabled || loading ? 'rgba(255,255,255,.22)' : '#fff',
        boxShadow:
          disabled || loading
            ? 'none'
            : '0 10px 36px rgba(43,172,82,.36),0 0 0 1px rgba(43,172,82,.24)',
      }}
    >
      {label}
    </button>
  );
}

function MapCanvas({ variant = 'default', progress = 0 }) {
  const routes = {
    default: { cx: 100, cy: 240, dx: 290, dy: 100, color: '#2BAC52' },
    finding: { cx: 100, cy: 220, dx: 290, dy: 120, color: '#3B82F6' },
    assigned: { cx: 80, cy: 250, dx: 300, dy: 90, color: '#2BAC52' },
    arrived: { cx: 195, cy: 180, dx: 195, dy: 180, color: '#2BAC52' },
    inprogress: { cx: 60, cy: 260, dx: 320, dy: 80, color: '#2BAC52' },
    complete: { cx: 60, cy: 260, dx: 320, dy: 80, color: '#10B981' },
  };
  const r = routes[variant] || routes.default;
  const midX = (r.cx + r.dx) / 2;
  const midY = (r.cy + r.dy) / 2 - 60;
  const pathD = `M${r.cx},${r.cy} Q${midX},${midY} ${r.dx},${r.dy}`;
  const filled = Math.round(280 * progress);
  return (
    <svg width="390" height="320" viewBox="0 0 390 320" style={{ display: 'block' }}>
      <rect width="390" height="320" fill="#0D1B2E" />
      <line x1="0" y1="180" x2="390" y2="180" stroke="rgba(255,255,255,.07)" strokeWidth="2.5" />
      <line x1="195" y1="0" x2="195" y2="320" stroke="rgba(255,255,255,.07)" strokeWidth="2.5" />
      <path
        d={pathD}
        fill="none"
        stroke="rgba(43,172,82,.12)"
        strokeWidth="12"
        strokeLinecap="round"
      />
      <path
        d={pathD}
        fill="none"
        stroke="rgba(43,172,82,.25)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray="8 4"
      />
      {progress > 0 && (
        <path
          d={pathD}
          fill="none"
          stroke={r.color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${filled} 280`}
        />
      )}
      <circle cx={r.cx} cy={r.cy} r="10" fill="#2BAC52" opacity=".2" />
      <circle cx={r.cx} cy={r.cy} r="5" fill="#2BAC52" />
      <circle cx={r.cx} cy={r.cy} r="3" fill="#fff" />
      {variant !== 'arrived' && (
        <>
          <circle cx={r.dx} cy={r.dy} r="14" fill="rgba(43,172,82,.15)" />
          <circle cx={r.dx} cy={r.dy} r="8" fill="#2BAC52" />
          <circle cx={r.dx} cy={r.dy} r="4" fill="#fff" />
          <rect x={r.dx - 1.5} y={r.dy - 28} width="3" height="20" rx="1.5" fill="#2BAC52" />
        </>
      )}
      {['assigned', 'arrived', 'inprogress'].includes(variant) && (
        <g transform={`translate(${r.cx + 20},${r.cy - 20})`}>
          <circle r="18" fill="#0D1B2E" stroke="#2BAC52" strokeWidth="2" />
          <text textAnchor="middle" dominantBaseline="central" fontSize="16">
            🚗
          </text>
        </g>
      )}
      <defs>
        <linearGradient id="mapFade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0A1628" stopOpacity="0" />
          <stop offset="100%" stopColor="#0A1628" stopOpacity="1" />
        </linearGradient>
      </defs>
      <rect width="390" height="320" fill="url(#mapFade)" />
    </svg>
  );
}

function BottomSheet({ children, title, peek }) {
  return (
    <div
      className="relative z-10 flex flex-1 flex-col"
      style={{
        background: '#0A1628',
        borderRadius: peek ? '28px 28px 0 0' : 0,
        boxShadow: peek ? '0 -24px 80px rgba(0,0,0,.7)' : 'none',
      }}
    >
      {peek && (
        <div className="flex justify-center pb-1 pt-3">
          <div className="h-1 w-10 rounded-full" style={{ background: 'rgba(255,255,255,.15)' }} />
        </div>
      )}
      {title && (
        <p
          className="px-5 pb-2 pt-4 text-[17px] font-bold"
          style={{ fontFamily: "'Poppins',sans-serif", color: '#fff' }}
        >
          {title}
        </p>
      )}
      {children}
    </div>
  );
}

function SafetyChip() {
  return (
    <div
      className="flex items-center gap-1.5 rounded-full px-3 py-1.5"
      style={{ background: 'rgba(43,172,82,.12)', border: '1px solid rgba(43,172,82,.2)' }}
    >
      <span
        style={{
          fontFamily: "'Inter',sans-serif",
          fontSize: 11,
          color: '#47CF72',
          fontWeight: 600,
        }}
      >
        DrippleX Safe
      </span>
    </div>
  );
}

function StarRow({ value, onChange }) {
  return (
    <div className="flex justify-center gap-3">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          onClick={() => onChange(n)}
          style={{ fontSize: 36, filter: n <= value ? 'none' : 'grayscale(1) opacity(.3)' }}
        >
          ⭐
        </button>
      ))}
    </div>
  );
}

export function RideHomeScreen({ onBack, onSearch, onHistory }) {
  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#060E1C' }}
    >
      <div className="relative flex-shrink-0" style={{ height: 340 }}>
        <MapCanvas variant="default" />
        <div className="absolute inset-0">
          <RideStatusBar />
        </div>
        <div
          className="absolute left-0 right-0 top-14 flex items-center justify-between px-5"
          style={{ marginTop: 16 }}
        >
          <button
            onClick={onBack}
            className="flex h-10 w-10 items-center justify-center rounded-2xl"
            style={{
              background: 'rgba(6,14,28,.85)',
              border: '1px solid rgba(255,255,255,.08)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="rgba(255,255,255,.7)"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <SafetyChip />
            <button
              onClick={onHistory}
              className="flex h-10 w-10 items-center justify-center rounded-2xl"
              style={{
                background: 'rgba(6,14,28,.85)',
                border: '1px solid rgba(255,255,255,.08)',
                backdropFilter: 'blur(12px)',
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="rgba(255,255,255,.7)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      <BottomSheet peek>
        <div className="flex-1 overflow-y-auto px-5 pb-4 pt-2">
          <div className="mb-4">
            <p
              className="mb-0.5 text-[18px] font-bold"
              style={{ fontFamily: "'Poppins',sans-serif", color: '#fff' }}
            >
              Where to, Chidi?
            </p>
            <p
              className="text-[13px]"
              style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.38)' }}
            >
              Your current location: Ikeja GRA, Lagos
            </p>
          </div>
          <button onClick={onSearch} className="mb-4 w-full text-left">
            <div
              className="flex h-14 items-center gap-3 rounded-2xl px-4"
              style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#2BAC52"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <span
                style={{
                  fontFamily: "'Inter',sans-serif",
                  fontSize: 15,
                  color: 'rgba(255,255,255,.38)',
                }}
              >
                Where are you going?
              </span>
            </div>
          </button>
          <div className="mb-5 flex gap-3">
            {[
              { icon: '🏠', label: 'Home', sub: 'Ikeja, Lagos' },
              { icon: '💼', label: 'Work', sub: 'Victoria Island' },
            ].map((p) => (
              <button
                key={p.label}
                onClick={onSearch}
                className="flex flex-1 items-center gap-2.5 rounded-2xl px-3 py-3"
                style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
              >
                <div
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl text-base"
                  style={{ background: 'rgba(43,172,82,.12)' }}
                >
                  {p.icon}
                </div>
                <div className="min-w-0">
                  <p
                    className="truncate text-[13px] font-semibold"
                    style={{ fontFamily: "'Poppins',sans-serif", color: '#fff' }}
                  >
                    {p.label}
                  </p>
                  <p
                    className="truncate text-[11px]"
                    style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.38)' }}
                  >
                    {p.sub}
                  </p>
                </div>
              </button>
            ))}
          </div>
          <p
            className="mb-3 text-[13px] font-semibold"
            style={{ fontFamily: "'Poppins',sans-serif", color: 'rgba(255,255,255,.38)' }}
          >
            RECENT
          </p>
          {RECENT_PLACES.slice(2, 5).map((p) => (
            <button
              key={p.label}
              onClick={onSearch}
              className="flex w-full items-center gap-3 rounded-xl px-1 py-3"
            >
              <div
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl text-lg"
                style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
              >
                {p.icon}
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p
                  className="text-[14px] font-medium"
                  style={{ fontFamily: "'Poppins',sans-serif", color: '#fff' }}
                >
                  {p.label}
                </p>
                <p
                  className="truncate text-[12px]"
                  style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.38)' }}
                >
                  {p.sub}
                </p>
              </div>
            </button>
          ))}
        </div>
      </BottomSheet>
    </div>
  );
}

export function DestinationSearchScreen({ onBack, onSelect }) {
  const [query, setQuery] = useState('');
  const filtered =
    query.length > 0
      ? [...RECENT_PLACES, ...POPULAR_PLACES].filter((p) =>
          p.label.toLowerCase().includes(query.toLowerCase()),
        )
      : RECENT_PLACES;
  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#0A1628' }}
    >
      <RideStatusBar />
      <div className="px-5 pb-4 pt-3">
        <div className="mb-4 flex items-center gap-3">
          <BackArrow onClick={onBack} />
          <p
            className="text-[17px] font-bold"
            style={{ fontFamily: "'Poppins',sans-serif", color: '#fff' }}
          >
            Set Destination
          </p>
        </div>
        <div
          className="mb-2 flex items-center gap-3 rounded-2xl px-4 py-3"
          style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
        >
          <div className="h-2.5 w-2.5 rounded-full" style={{ background: '#2BAC52' }} />
          <span
            className="text-[14px]"
            style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.6)' }}
          >
            Ikeja GRA, Lagos
          </span>
        </div>
        <div
          className="flex h-14 items-center gap-3 rounded-2xl px-4"
          style={{ background: '#112238', border: '1px solid rgba(43,172,82,.4)' }}
        >
          <div className="h-2.5 w-2.5 rounded-full" style={{ background: '#EF4444' }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter destination..."
            className="flex-1 bg-transparent outline-none"
            style={{ fontFamily: "'Inter',sans-serif", fontSize: 15, color: '#fff' }}
            autoFocus
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5">
        {filtered.map((p, i) => (
          <button
            key={i}
            onClick={onSelect}
            className="flex w-full items-center gap-3 rounded-xl px-1 py-3.5"
          >
            <div
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl text-lg"
              style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
            >
              {p.icon}
            </div>
            <div className="flex-1 text-left">
              <p
                className="text-[14px] font-medium"
                style={{ fontFamily: "'Poppins',sans-serif", color: '#fff' }}
              >
                {p.label}
              </p>
              <p
                className="text-[12px]"
                style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.38)' }}
              >
                {p.sub}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function FareEstimateScreen({ onBack, onBook }) {
  const [payment, setPayment] = useState('wallet');
  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#060E1C' }}
    >
      <div className="relative flex-shrink-0" style={{ height: 260 }}>
        <MapCanvas variant="default" />
        <div className="absolute inset-0">
          <RideStatusBar />
          <div className="mt-3 px-5">
            <BackArrow onClick={onBack} />
          </div>
        </div>
      </div>
      <BottomSheet peek title="Fare Estimate">
        <div className="flex-1 overflow-y-auto px-5 pb-5">
          <div
            className="mb-4 flex items-center gap-4 rounded-2xl p-4"
            style={{ background: 'rgba(43,172,82,.08)', border: '1.5px solid rgba(43,172,82,.3)' }}
          >
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl text-3xl"
              style={{ background: 'rgba(43,172,82,.12)' }}
            >
              🚗
            </div>
            <div className="flex-1">
              <p
                className="text-[17px] font-bold"
                style={{ fontFamily: "'Poppins',sans-serif", color: '#fff' }}
              >
                Economy
              </p>
              <p
                className="text-[12px]"
                style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.38)' }}
              >
                Affordable everyday rides · 4 seats · 4 min
              </p>
            </div>
            <div className="text-right">
              <p
                className="text-[22px] font-bold"
                style={{ fontFamily: "'Poppins',sans-serif", color: '#47CF72' }}
              >
                ₦2,100
              </p>
              <p
                className="text-[11px]"
                style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.38)' }}
              >
                fixed fare
              </p>
            </div>
          </div>
          <div className="mb-4 flex gap-2">
            {PAYMENT_METHODS.map((pm) => (
              <button
                key={pm.id}
                onClick={() => setPayment(pm.id)}
                className="flex flex-1 flex-col items-center gap-1.5 rounded-2xl px-2 py-3 transition-all"
                style={{
                  background: payment === pm.id ? 'rgba(43,172,82,.08)' : '#112238',
                  border: `1.5px solid ${payment === pm.id ? 'rgba(43,172,82,.35)' : 'rgba(255,255,255,.08)'}`,
                }}
              >
                <span style={{ fontSize: 20 }}>{pm.icon}</span>
                <p
                  className="text-[10px] font-semibold"
                  style={{
                    fontFamily: "'Inter',sans-serif",
                    color: payment === pm.id ? '#47CF72' : 'rgba(255,255,255,.38)',
                  }}
                >
                  {pm.id === 'wallet' ? 'Wallet' : pm.id === 'card' ? 'Card' : 'Cash'}
                </p>
              </button>
            ))}
          </div>
          <div
            className="mb-5 rounded-2xl p-4"
            style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
          >
            {[
              ['Base fare', '₦800'],
              ['Distance (14 km)', '₦1,120'],
              ['Time fee', '₦180'],
              ['Promo', '−₦0'],
            ].map(([l, v]) => (
              <div key={l} className="mb-2 flex justify-between">
                <p
                  className="text-[13px]"
                  style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.6)' }}
                >
                  {l}
                </p>
                <p
                  className="text-[13px] font-medium"
                  style={{ fontFamily: "'Inter',sans-serif", color: '#fff' }}
                >
                  {v}
                </p>
              </div>
            ))}
            <div className="my-2 h-px" style={{ background: 'rgba(255,255,255,.08)' }} />
            <div className="flex justify-between">
              <p
                className="text-[14px] font-bold"
                style={{ fontFamily: "'Poppins',sans-serif", color: '#fff' }}
              >
                Total
              </p>
              <p
                className="text-[18px] font-bold"
                style={{ fontFamily: "'Poppins',sans-serif", color: '#47CF72' }}
              >
                ₦2,100
              </p>
            </div>
          </div>
          <GreenButton label="Book Economy · ₦2,100" onClick={onBook} />
        </div>
      </BottomSheet>
    </div>
  );
}

export function FindingDriverScreen({ onBack, onFound }) {
  const [dots, setDots] = useState(1);
  useEffect(() => {
    const d = setInterval(() => setDots((p) => (p === 3 ? 1 : p + 1)), 500);
    const e = setTimeout(onFound, 4000);
    return () => {
      clearInterval(d);
      clearTimeout(e);
    };
  }, []);
  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#060E1C' }}
    >
      <div className="relative flex-shrink-0" style={{ height: 280 }}>
        <MapCanvas variant="finding" />
        <div className="absolute inset-0">
          <RideStatusBar />
          <div className="mt-3 px-5">
            <BackArrow onClick={onBack} />
          </div>
        </div>
      </div>
      <BottomSheet peek>
        <div className="flex flex-col items-center gap-5 px-5 pb-8 pt-2">
          <div className="text-center">
            <p
              className="mb-1 text-[20px] font-bold"
              style={{ fontFamily: "'Poppins',sans-serif", color: '#fff' }}
            >
              Finding your driver{'.'.repeat(dots)}
            </p>
            <p
              className="text-[14px]"
              style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.38)' }}
            >
              Matching you with the best driver nearby
            </p>
          </div>
          <div className="flex w-full gap-3">
            {[
              ['4', 'Drivers nearby'],
              ['~3 min', 'Est. pickup'],
              ['4.8★', 'Avg rating'],
            ].map(([v, l]) => (
              <div
                key={l}
                className="flex flex-1 flex-col items-center gap-1 rounded-2xl py-3"
                style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
              >
                <p
                  className="text-[15px] font-bold"
                  style={{ fontFamily: "'Poppins',sans-serif", color: '#47CF72' }}
                >
                  {v}
                </p>
                <p
                  className="text-center text-[11px]"
                  style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.38)' }}
                >
                  {l}
                </p>
              </div>
            ))}
          </div>
          <button
            onClick={onBack}
            className="text-[14px] font-medium"
            style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.38)' }}
          >
            Cancel ride
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}

export function DriverAssignedScreen({ onBack, onArrived }) {
  const [eta, setEta] = useState(3);
  useEffect(() => {
    const t = setInterval(() => setEta((p) => Math.max(0, p - 1)), 8000);
    return () => clearInterval(t);
  }, []);
  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#060E1C' }}
    >
      <div className="relative flex-shrink-0" style={{ height: 300 }}>
        <MapCanvas variant="assigned" />
        <div className="absolute inset-0">
          <RideStatusBar />
          <div className="mt-3 flex justify-between px-5">
            <BackArrow onClick={onBack} />
            <SafetyChip />
          </div>
        </div>
      </div>
      <BottomSheet peek>
        <div className="flex-1 overflow-y-auto px-5 pb-6 pt-2">
          <div
            className="mb-4 flex items-center gap-4 rounded-2xl p-4"
            style={{ background: 'rgba(43,172,82,.08)', border: '1px solid rgba(43,172,82,.2)' }}
          >
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl"
              style={{ background: 'rgba(43,172,82,.12)' }}
            >
              🚗
            </div>
            <div className="flex-1">
              <p
                className="text-[15px] font-bold"
                style={{ fontFamily: "'Poppins',sans-serif", color: '#fff' }}
              >
                Driver on the way
              </p>
              <p
                className="text-[13px]"
                style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.38)' }}
              >
                Arriving in approximately {eta} min
              </p>
            </div>
            <div className="text-center">
              <p
                className="text-[22px] font-bold"
                style={{ fontFamily: "'Poppins',sans-serif", color: '#47CF72' }}
              >
                {eta}
              </p>
              <p
                className="text-[11px]"
                style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.38)' }}
              >
                min
              </p>
            </div>
          </div>
          <div
            className="mb-4 rounded-2xl p-4"
            style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
          >
            <div className="mb-4 flex items-center gap-4">
              <div
                className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl text-xl font-bold"
                style={{
                  background: 'linear-gradient(135deg,#176B30,#2BAC52)',
                  color: '#fff',
                  fontFamily: "'Poppins',sans-serif",
                }}
              >
                AO
              </div>
              <div className="flex-1">
                <p
                  className="text-[16px] font-bold"
                  style={{ fontFamily: "'Poppins',sans-serif", color: '#fff' }}
                >
                  Adeyemi Okafor
                </p>
                <p
                  className="text-[13px]"
                  style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.38)' }}
                >
                  ★ 4.92 · 3,847 trips · Gold Driver
                </p>
              </div>
            </div>
            <div
              className="grid grid-cols-2 gap-2 border-t pt-3"
              style={{ borderColor: 'rgba(255,255,255,.08)' }}
            >
              {[
                ['🚗 Vehicle', 'Toyota Camry (White)'],
                ['🔢 Plate', 'LAG 482 KA'],
              ].map(([l, v]) => (
                <div key={l}>
                  <p
                    className="mb-0.5 text-[11px]"
                    style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.38)' }}
                  >
                    {l}
                  </p>
                  <p
                    className="text-[13px] font-medium"
                    style={{ fontFamily: "'Inter',sans-serif", color: '#fff' }}
                  >
                    {v}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="mb-4 flex gap-3">
            {[
              ['📞', 'Call Driver'],
              ['💬', 'Message'],
            ].map(([icon, label]) => (
              <button
                key={label}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl font-semibold"
                style={{
                  background: '#112238',
                  border: '1px solid rgba(255,255,255,.08)',
                  fontFamily: "'Inter',sans-serif",
                  fontSize: 14,
                  color: '#fff',
                }}
              >
                {icon} {label}
              </button>
            ))}
          </div>
          <button
            onClick={onArrived}
            className="flex h-12 w-full items-center justify-center rounded-2xl text-sm font-medium"
            style={{
              background: '#112238',
              border: '1px solid rgba(255,255,255,.08)',
              fontFamily: "'Inter',sans-serif",
              color: 'rgba(255,255,255,.38)',
            }}
          >
            Simulate: Driver Arrived →
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}

// ============================================================
// PART 2 of 3 — now included verbatim (previously a placeholder; fixed
// during the RIDE-003A design-lock audit, 2026-08-02, since an incomplete
// reference file undermines the exact kind of audit it exists to support).
// ============================================================

export function RideInProgressScreen({ onBack, onComplete }) {
  const [progress, setProgress] = useState(0.15);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const t = setInterval(() => {
      setProgress((p) => {
        const next = Math.min(p + 0.04, 1);
        if (next >= 1) {
          clearInterval(t);
          setTimeout(onComplete, 800);
        }
        return next;
      });
    }, 1200);
    return () => clearInterval(t);
  }, []);
  const remaining = Math.max(0, Math.round(22 * (1 - progress)));
  const distLeft = (14 * (1 - progress)).toFixed(1);
  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#060E1C' }}
    >
      <div className="relative flex-shrink-0" style={{ height: 300 }}>
        <MapCanvas variant="inprogress" progress={progress} />
        <div className="absolute inset-0">
          <RideStatusBar />
          <div className="mt-3 flex justify-between px-5">
            <div />
            <SafetyChip />
          </div>
        </div>
      </div>
      <BottomSheet peek>
        <div className="flex-1 overflow-y-auto px-5 pb-6 pt-2">
          <div className="mb-4">
            <div className="mb-2 flex justify-between">
              <p
                className="text-[13px]"
                style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.38)' }}
              >
                Trip progress
              </p>
              <p
                className="text-[13px] font-semibold"
                style={{ fontFamily: "'Inter',sans-serif", color: '#47CF72' }}
              >
                {Math.round(progress * 100)}%
              </p>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full"
              style={{ background: 'rgba(255,255,255,.06)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-[1200ms]"
                style={{
                  width: `${progress * 100}%`,
                  background: 'linear-gradient(90deg,#176B30,#47CF72)',
                }}
              />
            </div>
          </div>
          <div className="mb-4 flex gap-2">
            {[
              { v: `${remaining}`, u: 'min left', icon: '⏱' },
              { v: distLeft, u: 'km left', icon: '📍' },
              { v: '₦2,100', u: 'fare', icon: '💳' },
            ].map((s) => (
              <div
                key={s.u}
                className="flex flex-1 flex-col items-center gap-1 rounded-2xl py-3"
                style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
              >
                <span style={{ fontSize: 18 }}>{s.icon}</span>
                <p
                  className="text-[15px] font-bold"
                  style={{ fontFamily: "'Poppins',sans-serif", color: '#fff' }}
                >
                  {s.v}
                </p>
                <p
                  className="text-[11px]"
                  style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.38)' }}
                >
                  {s.u}
                </p>
              </div>
            ))}
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="mb-3 flex w-full items-center gap-3 rounded-2xl p-3"
            style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
          >
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold"
              style={{
                background: 'linear-gradient(135deg,#176B30,#2BAC52)',
                color: '#fff',
                fontFamily: "'Poppins',sans-serif",
              }}
            >
              AO
            </div>
            <div className="flex-1 text-left">
              <p
                className="text-[13px] font-semibold"
                style={{ fontFamily: "'Poppins',sans-serif", color: '#fff' }}
              >
                Adeyemi Okafor
              </p>
              <p
                className="text-[12px]"
                style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.38)' }}
              >
                LAG 482 KA · Toyota Camry
              </p>
            </div>
          </button>
          <div
            className="flex items-center gap-2 rounded-2xl p-3"
            style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
          >
            <div className="flex flex-col items-center gap-1">
              <div className="h-2 w-2 rounded-full" style={{ background: '#2BAC52' }} />
              <div className="h-8 w-px" style={{ background: 'rgba(255,255,255,.08)' }} />
              <div className="h-2 w-2 rounded-full" style={{ background: '#EF4444' }} />
            </div>
            <div className="flex-1">
              <p
                className="mb-2 text-[12px]"
                style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.6)' }}
              >
                Ikeja GRA, Lagos
              </p>
              <p
                className="text-[12px]"
                style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.6)' }}
              >
                Victoria Island, Lagos
              </p>
            </div>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}

export function TripCompletedScreen({ onRate, onHome }) {
  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#060E1C' }}
    >
      <RideStatusBar />
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-5">
        <div
          className="flex h-24 w-24 items-center justify-center rounded-full text-5xl"
          style={{
            background: 'linear-gradient(135deg,#176B30,#2BAC52)',
            boxShadow: '0 0 60px rgba(43,172,82,.35)',
          }}
        >
          🏁
        </div>
        <div className="text-center">
          <p
            className="mb-1 text-[10px] font-bold tracking-widest"
            style={{ fontFamily: "'Inter',sans-serif", color: '#47CF72' }}
          >
            TRIP COMPLETED
          </p>
          <p
            className="mb-2 text-[26px] font-bold"
            style={{ fontFamily: "'Poppins',sans-serif", color: '#fff' }}
          >
            You have arrived!
          </p>
          <p
            className="text-[14px]"
            style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.38)' }}
          >
            Victoria Island, Lagos
          </p>
        </div>
        <div
          className="w-full overflow-hidden rounded-3xl"
          style={{ background: '#0D1B2E', border: '1px solid rgba(255,255,255,.08)' }}
        >
          <div className="border-b px-5 py-4" style={{ borderColor: 'rgba(255,255,255,.08)' }}>
            {[
              ['Duration', '22 min'],
              ['Distance', '14.2 km'],
              ['Driver', 'Adeyemi Okafor'],
              ['Vehicle', 'Toyota Camry · LAG 482 KA'],
            ].map(([l, v]) => (
              <div key={l} className="mb-2.5 flex justify-between">
                <p
                  className="text-[13px]"
                  style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.38)' }}
                >
                  {l}
                </p>
                <p
                  className="text-[13px] font-medium"
                  style={{ fontFamily: "'Inter',sans-serif", color: '#fff' }}
                >
                  {v}
                </p>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between px-5 py-4">
            <p
              className="text-[15px] font-bold"
              style={{ fontFamily: "'Poppins',sans-serif", color: '#fff' }}
            >
              Total Charged
            </p>
            <div className="text-right">
              <p
                className="text-[22px] font-bold"
                style={{ fontFamily: "'Poppins',sans-serif", color: '#47CF72' }}
              >
                ₦2,100
              </p>
              <p
                className="text-[11px]"
                style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.38)' }}
              >
                DrippleX Wallet
              </p>
            </div>
          </div>
        </div>
        <div className="flex w-full flex-col gap-3">
          <GreenButton label="Rate Your Ride ★" onClick={onRate} />
          <button
            onClick={onHome}
            className="flex h-12 w-full items-center justify-center rounded-2xl text-[14px] font-medium"
            style={{
              background: '#112238',
              border: '1px solid rgba(255,255,255,.08)',
              fontFamily: "'Inter',sans-serif",
              color: 'rgba(255,255,255,.6)',
            }}
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}

export function RateDriverScreen({ onBack, onSubmit }) {
  const [stars, setStars] = useState(5);
  const [tags, setTags] = useState(['Safe driving', 'Friendly']);
  const [comment, setComment] = useState('');
  const ALL_TAGS = [
    'Safe driving',
    'Friendly',
    'On time',
    'Clean car',
    'Great music',
    'Quiet ride',
    'Professional',
    'Smooth ride',
  ];
  const toggleTag = (t) => setTags((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));
  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#0A1628' }}
    >
      <RideStatusBar />
      <div className="flex-1 overflow-y-auto px-5 pb-6">
        <div className="mb-6 flex items-center gap-3 pt-3">
          <BackArrow onClick={onBack} />
          <p
            className="text-[17px] font-bold"
            style={{ fontFamily: "'Poppins',sans-serif", color: '#fff' }}
          >
            Rate Your Ride
          </p>
        </div>
        <div className="mb-6 flex flex-col items-center">
          <div
            className="mb-3 flex h-20 w-20 items-center justify-center rounded-3xl text-2xl font-bold"
            style={{
              background: 'linear-gradient(135deg,#176B30,#2BAC52)',
              color: '#fff',
              fontFamily: "'Poppins',sans-serif",
            }}
          >
            AO
          </div>
          <p
            className="mb-0.5 text-[18px] font-bold"
            style={{ fontFamily: "'Poppins',sans-serif", color: '#fff' }}
          >
            Adeyemi Okafor
          </p>
        </div>
        <div className="mb-6 flex flex-col items-center gap-3">
          <StarRow value={stars} onChange={setStars} />
        </div>
        <div className="mb-5">
          <p
            className="mb-3 text-[13px] font-semibold"
            style={{ fontFamily: "'Poppins',sans-serif", color: 'rgba(255,255,255,.38)' }}
          >
            WHAT STOOD OUT?
          </p>
          <div className="flex flex-wrap gap-2">
            {ALL_TAGS.map((t) => (
              <button
                key={t}
                onClick={() => toggleTag(t)}
                className="rounded-full px-3 py-1.5 text-[12px] font-medium"
                style={{
                  background: tags.includes(t) ? 'rgba(43,172,82,.15)' : '#112238',
                  border: `1px solid ${tags.includes(t) ? 'rgba(43,172,82,.4)' : 'rgba(255,255,255,.08)'}`,
                  color: tags.includes(t) ? '#47CF72' : 'rgba(255,255,255,.6)',
                  fontFamily: "'Inter',sans-serif",
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="mb-6">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Tell us about your experience..."
            rows={3}
            className="w-full resize-none rounded-2xl px-4 py-3 outline-none"
            style={{
              background: '#112238',
              border: '1px solid rgba(255,255,255,.08)',
              fontFamily: "'Inter',sans-serif",
              fontSize: 14,
              color: '#fff',
            }}
          />
        </div>
        <GreenButton label="Submit Rating" onClick={onSubmit} />
      </div>
    </div>
  );
}

export function RideHistoryScreen({ onBack, onDetail }) {
  const [tab, setTab] = useState('all');
  const filtered = tab === 'all' ? RIDE_HISTORY : RIDE_HISTORY.filter((r) => r.status === tab);
  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#0A1628' }}
    >
      <RideStatusBar />
      <div className="flex-shrink-0 px-5 pb-4 pt-3">
        <div className="mb-4 flex items-center gap-3">
          <BackArrow onClick={onBack} />
          <p
            className="text-[17px] font-bold"
            style={{ fontFamily: "'Poppins',sans-serif", color: '#fff' }}
          >
            Ride History
          </p>
        </div>
        <div className="flex gap-2">
          {['all', 'completed', 'cancelled'].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="h-9 flex-1 rounded-xl text-[12px] font-semibold capitalize"
              style={{
                background: tab === t ? '#2BAC52' : '#112238',
                color: tab === t ? '#fff' : 'rgba(255,255,255,.38)',
                fontFamily: "'Inter',sans-serif",
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 pb-4">
        {filtered.map((ride) => (
          <button
            key={ride.id}
            onClick={() => onDetail(ride.id)}
            className="w-full rounded-2xl p-4 text-left"
            style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
          >
            <div className="mb-3 flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-base"
                  style={{
                    background:
                      ride.status === 'completed' ? 'rgba(43,172,82,.12)' : 'rgba(239,68,68,.1)',
                  }}
                >
                  {ride.status === 'completed' ? '🚗' : '❌'}
                </div>
                <div>
                  <p
                    className="text-[13px] font-semibold"
                    style={{ fontFamily: "'Poppins',sans-serif", color: '#fff' }}
                  >
                    {ride.type} Ride
                  </p>
                  <p
                    className="text-[11px]"
                    style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.38)' }}
                  >
                    {ride.date}
                  </p>
                </div>
              </div>
              <p
                className="text-[15px] font-bold"
                style={{ fontFamily: "'Poppins',sans-serif", color: '#fff' }}
              >
                {ride.amount}
              </p>
            </div>
            <div className="mb-1 flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full" style={{ background: '#2BAC52' }} />
              <p
                className="text-[12px]"
                style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.6)' }}
              >
                {ride.from}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full" style={{ background: '#EF4444' }} />
              <p
                className="text-[12px]"
                style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.6)' }}
              >
                {ride.to}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function PaymentScreen({ onBack, onPay, onChangeMethod }) {
  const [selected, setSelected] = useState('wallet');
  const methods = [
    { id: 'wallet', icon: '💜', label: 'DrippleX Wallet', sub: 'Balance: ₦24,500' },
    { id: 'visa', icon: '💳', label: 'Visa Card', sub: '•••• 4821' },
    { id: 'cash', icon: '💵', label: 'Cash', sub: 'Pay driver directly' },
    { id: 'opay', icon: '🟢', label: 'OPay', sub: 'Link OPay account' },
  ];
  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#0A1628' }}
    >
      <RideStatusBar />
      <div className="flex items-center gap-3 px-5 pb-4 pt-2">
        <BackArrow onClick={onBack} />
        <p
          className="text-[17px] font-bold"
          style={{ fontFamily: "'Poppins',sans-serif", color: '#fff' }}
        >
          Choose Payment
        </p>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div
          className="mx-5 mb-4 rounded-2xl p-4"
          style={{ background: '#0D1B2E', border: '1px solid rgba(255,255,255,.08)' }}
        >
          <p
            style={{
              fontSize: 12,
              color: 'rgba(255,255,255,.38)',
              fontFamily: "'Inter',sans-serif",
            }}
          >
            Ikeja → Victoria Island
          </p>
          <p
            style={{
              fontFamily: "'Poppins',sans-serif",
              fontSize: 32,
              fontWeight: 800,
              color: '#47CF72',
              margin: '4px 0',
            }}
          >
            ₦2,100
          </p>
        </div>
        {methods.map((m) => (
          <button
            key={m.id}
            className="mx-5 mb-3 flex w-[calc(100%-40px)] items-center gap-3 rounded-2xl p-4 text-left"
            style={{
              background: selected === m.id ? 'rgba(34,197,94,.08)' : '#0D1B2E',
              border: selected === m.id ? '1.5px solid #47CF72' : '1px solid rgba(255,255,255,.08)',
            }}
            onClick={() => setSelected(m.id)}
          >
            <span style={{ fontSize: 22 }}>{m.icon}</span>
            <div className="flex-1">
              <p
                style={{
                  fontFamily: "'Poppins',sans-serif",
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#fff',
                }}
              >
                {m.label}
              </p>
              <p
                style={{
                  fontSize: 12,
                  color: 'rgba(255,255,255,.6)',
                  fontFamily: "'Inter',sans-serif",
                }}
              >
                {m.sub}
              </p>
            </div>
            <div
              className="flex h-5 w-5 items-center justify-center rounded-full"
              style={{
                background: selected === m.id ? '#47CF72' : 'transparent',
                border: selected === m.id ? 'none' : '2px solid rgba(255,255,255,.08)',
              }}
            >
              {selected === m.id && <div className="h-2.5 w-2.5 rounded-full bg-white" />}
            </div>
          </button>
        ))}
      </div>
      <div className="px-5 pb-8 pt-3">
        <GreenButton label="Confirm Payment" onClick={onPay} />
      </div>
    </div>
  );
}

export function TipDriverScreen({ onBack, onSubmit }) {
  const presets = ['₦100', '₦200', '₦500', '₦1,000'];
  const [selected, setSelected] = useState('₦200');
  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#0A1628' }}
    >
      <RideStatusBar />
      <div className="flex items-center gap-3 px-5 pb-4 pt-2">
        <BackArrow onClick={onBack} />
        <p
          className="text-[17px] font-bold"
          style={{ fontFamily: "'Poppins',sans-serif", color: '#fff' }}
        >
          Leave a Tip
        </p>
      </div>
      <div className="flex-1 overflow-y-auto px-5">
        <div
          className="mb-6 flex items-center gap-3 rounded-2xl p-4"
          style={{ background: '#0D1B2E', border: '1px solid rgba(255,255,255,.08)' }}
        >
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full"
            style={{
              background: 'linear-gradient(135deg,#176B30,#2BAC52)',
              fontFamily: "'Poppins',sans-serif",
              fontWeight: 700,
              color: '#fff',
              fontSize: 16,
            }}
          >
            AO
          </div>
          <p
            style={{
              fontFamily: "'Poppins',sans-serif",
              fontSize: 15,
              fontWeight: 600,
              color: '#fff',
            }}
          >
            Adeyemi Okafor
          </p>
        </div>
        <div className="mb-6 flex flex-wrap gap-2">
          {presets.map((p) => (
            <button
              key={p}
              className="rounded-full px-5 py-2.5 text-sm font-semibold"
              style={{
                background: selected === p ? '#47CF72' : '#0D1B2E',
                color: selected === p ? '#0A1628' : 'rgba(255,255,255,.6)',
                border: selected === p ? 'none' : '1px solid rgba(255,255,255,.08)',
                fontFamily: "'Poppins',sans-serif",
              }}
              onClick={() => setSelected(p)}
            >
              {p}
            </button>
          ))}
        </div>
        <div
          className="mb-4 rounded-xl p-4"
          style={{ background: 'rgba(34,197,94,.06)', border: '1px solid rgba(34,197,94,.15)' }}
        >
          <p
            style={{
              fontSize: 13,
              color: '#47CF72',
              fontFamily: "'Inter',sans-serif",
              textAlign: 'center',
            }}
          >
            💚 100% goes directly to your driver
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-2 px-5 pb-8 pt-3">
        <GreenButton label={`Send Tip (${selected})`} onClick={onSubmit} />
        <button
          className="h-10 w-full text-sm"
          style={{ color: 'rgba(255,255,255,.38)', fontFamily: "'Inter',sans-serif" }}
        >
          Skip, no tip
        </button>
      </div>
    </div>
  );
}

export function ReportTripScreen({ onBack, onSubmit }) {
  const issues = [
    '🚨 Safety concern',
    '💰 Overcharge',
    '🚗 Driver behaviour',
    '📍 Wrong route',
    '❌ Cancelled by driver',
    '📦 Lost item',
    'Other',
  ];
  const [selected, setSelected] = useState('');
  const [desc, setDesc] = useState('');
  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#0A1628' }}
    >
      <RideStatusBar />
      <div className="flex items-center gap-3 px-5 pb-4 pt-2">
        <BackArrow onClick={onBack} />
        <p
          className="text-[17px] font-bold"
          style={{ fontFamily: "'Poppins',sans-serif", color: '#fff' }}
        >
          Report an Issue
        </p>
      </div>
      <div className="flex-1 overflow-y-auto px-5">
        {issues.map((issue) => (
          <button
            key={issue}
            className="mb-2 flex w-full items-center gap-3 rounded-xl p-3.5 text-left"
            style={{
              background: selected === issue ? 'rgba(34,197,94,.08)' : '#0D1B2E',
              border:
                selected === issue ? '1.5px solid #47CF72' : '1px solid rgba(255,255,255,.08)',
            }}
            onClick={() => setSelected(issue)}
          >
            <p style={{ fontSize: 14, color: '#fff', fontFamily: "'Inter',sans-serif" }}>{issue}</p>
          </button>
        ))}
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Describe what happened..."
          rows={4}
          className="mt-2 w-full resize-none rounded-2xl px-4 py-3 outline-none"
          style={{
            background: '#112238',
            border: '1px solid rgba(255,255,255,.08)',
            fontFamily: "'Inter',sans-serif",
            fontSize: 14,
            color: '#fff',
          }}
        />
      </div>
      <div className="px-5 pb-8 pt-3">
        <GreenButton label="Submit Report" onClick={onSubmit} disabled={!selected} />
      </div>
    </div>
  );
}

export function EmergencySOSScreen({ onBack, onSOS }) {
  const [countdown, setCountdown] = useState(5);
  const [triggered, setTriggered] = useState(false);
  useEffect(() => {
    if (triggered && countdown > 0) {
      const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [triggered, countdown]);
  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#1a0000' }}
    >
      <RideStatusBar />
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-5">
        <div
          className="flex h-32 w-32 items-center justify-center rounded-full"
          style={{ background: 'rgba(239,68,68,.15)', border: '3px solid #EF4444' }}
        >
          <span style={{ fontSize: 56 }}>🆘</span>
        </div>
        <div className="text-center">
          <p
            className="mb-2 text-[26px] font-bold"
            style={{ fontFamily: "'Poppins',sans-serif", color: '#fff' }}
          >
            Emergency SOS
          </p>
          <p
            className="text-[14px]"
            style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.6)' }}
          >
            Your location will be shared with emergency services and DrippleX Safety team
          </p>
        </div>
        <button
          className="flex h-16 w-full items-center justify-center rounded-2xl text-[18px] font-bold"
          style={{
            background: triggered ? 'rgba(239,68,68,.3)' : '#EF4444',
            color: '#fff',
            fontFamily: "'Poppins',sans-serif",
            border: triggered ? '2px solid #EF4444' : 'none',
          }}
          onClick={() => {
            setTriggered(true);
            if (countdown === 0) onSOS?.();
          }}
        >
          {triggered
            ? countdown > 0
              ? `Sending in ${countdown}s... (tap to cancel)`
              : 'SOS Sent ✓'
            : 'HOLD TO SEND SOS'}
        </button>
        <div
          className="w-full rounded-2xl p-4"
          style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)' }}
        >
          {['Police: 112', 'Ambulance: 199', 'DrippleX Safety: In-app'].map((s) => (
            <p
              key={s}
              className="mb-1 text-[13px]"
              style={{ fontFamily: "'Inter',sans-serif", color: '#fff' }}
            >
              • {s}
            </p>
          ))}
        </div>
        <button
          onClick={onBack}
          className="text-[14px]"
          style={{ color: 'rgba(255,255,255,.38)', fontFamily: "'Inter',sans-serif" }}
        >
          ← Go back to ride
        </button>
      </div>
    </div>
  );
}

export function ShareTripScreen({ onBack }) {
  const [copied, setCopied] = useState(false);
  const link = 'https://dripplex.app/track/RX-20241205-0012';
  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#0A1628' }}
    >
      <RideStatusBar />
      <div className="flex items-center gap-3 px-5 pb-4 pt-2">
        <BackArrow onClick={onBack} />
        <p
          className="text-[17px] font-bold"
          style={{ fontFamily: "'Poppins',sans-serif", color: '#fff' }}
        >
          Share Trip
        </p>
      </div>
      <div className="flex flex-1 flex-col items-center gap-5 overflow-y-auto px-5">
        <div
          className="flex h-48 w-48 items-center justify-center rounded-2xl"
          style={{ background: '#fff' }}
        >
          <div className="grid h-40 w-40 grid-cols-5 gap-px">
            {Array.from({ length: 25 }).map((_, i) => (
              <div
                key={i}
                className="rounded-sm"
                style={{ background: Math.random() > 0.5 ? '#0A1628' : 'transparent' }}
              />
            ))}
          </div>
        </div>
        <p
          className="text-center text-[14px]"
          style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.6)' }}
        >
          Scan QR or share the link below to let someone track your ride live
        </p>
        <div
          className="flex w-full gap-2 rounded-xl p-3"
          style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
        >
          <p
            className="flex-1 truncate text-[12px]"
            style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.6)' }}
          >
            {link}
          </p>
          <button
            onClick={() => setCopied(true)}
            className="text-[12px] font-semibold"
            style={{ color: '#47CF72', fontFamily: "'Poppins',sans-serif" }}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <div className="flex w-full gap-3">
          {[
            { icon: '💬', label: 'WhatsApp' },
            { icon: '📱', label: 'SMS' },
            { icon: '📧', label: 'Email' },
          ].map((a) => (
            <button
              key={a.label}
              className="flex flex-1 flex-col items-center gap-1.5 rounded-2xl py-3"
              style={{ background: '#0D1B2E', border: '1px solid rgba(255,255,255,.08)' }}
            >
              <span style={{ fontSize: 22 }}>{a.icon}</span>
              <p
                className="text-[11px]"
                style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.6)' }}
              >
                {a.label}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TripReceiptScreen({ onBack, rideId }) {
  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#0A1628' }}
    >
      <RideStatusBar />
      <div className="flex items-center gap-3 px-5 pb-4 pt-2">
        <BackArrow onClick={onBack} />
        <p
          className="text-[17px] font-bold"
          style={{ fontFamily: "'Poppins',sans-serif", color: '#fff' }}
        >
          Trip Receipt
        </p>
      </div>
      <div className="flex-1 overflow-y-auto px-5 pb-6">
        <div
          className="mb-4 overflow-hidden rounded-2xl"
          style={{ background: '#0D1B2E', border: '1px solid rgba(255,255,255,.08)' }}
        >
          <div
            className="flex items-center justify-between border-b p-4"
            style={{ borderColor: 'rgba(255,255,255,.08)' }}
          >
            <div>
              <p
                className="text-[11px] font-semibold"
                style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.38)' }}
              >
                RECEIPT
              </p>
              <p
                className="text-[13px] font-medium"
                style={{ fontFamily: "'Poppins',sans-serif", color: '#fff' }}
              >
                RX-20241205-0012
              </p>
            </div>
            <span
              className="rounded-full px-3 py-1 text-[11px] font-bold"
              style={{
                background: 'rgba(43,172,82,.12)',
                color: '#47CF72',
                fontFamily: "'Inter',sans-serif",
              }}
            >
              COMPLETED
            </span>
          </div>
          <div className="p-4">
            {[
              ['Date', 'Today, 9:41 AM'],
              ['From', 'Ikeja GRA, Lagos'],
              ['To', 'Victoria Island, Lagos'],
              ['Duration', '22 min'],
              ['Distance', '14.2 km'],
              ['Driver', 'Adeyemi Okafor'],
            ].map(([l, v]) => (
              <div key={l} className="mb-3 flex justify-between">
                <p
                  className="text-[13px]"
                  style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.38)' }}
                >
                  {l}
                </p>
                <p
                  className="text-[13px] font-medium"
                  style={{ fontFamily: "'Inter',sans-serif", color: '#fff' }}
                >
                  {v}
                </p>
              </div>
            ))}
            <div className="my-3 h-px" style={{ background: 'rgba(255,255,255,.08)' }} />
            {[
              ['Base fare', '₦800'],
              ['Distance (14.2 km)', '₦1,120'],
              ['Time fee', '₦180'],
              ['Promo discount', '−₦0'],
            ].map(([l, v]) => (
              <div key={l} className="mb-2 flex justify-between">
                <p
                  className="text-[13px]"
                  style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.6)' }}
                >
                  {l}
                </p>
                <p
                  className="text-[13px]"
                  style={{ fontFamily: "'Inter',sans-serif", color: '#fff' }}
                >
                  {v}
                </p>
              </div>
            ))}
            <div className="my-3 h-px" style={{ background: 'rgba(255,255,255,.08)' }} />
            <div className="flex justify-between">
              <p
                className="text-[15px] font-bold"
                style={{ fontFamily: "'Poppins',sans-serif", color: '#fff' }}
              >
                Total
              </p>
              <p
                className="text-[20px] font-bold"
                style={{ fontFamily: "'Poppins',sans-serif", color: '#47CF72' }}
              >
                ₦2,100
              </p>
            </div>
            <p
              className="mt-1 text-[12px]"
              style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.38)' }}
            >
              Paid via DrippleX Wallet
            </p>
          </div>
        </div>
        <button
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-[14px] font-medium"
          style={{
            background: '#112238',
            border: '1px solid rgba(255,255,255,.08)',
            fontFamily: "'Inter',sans-serif",
            color: 'rgba(255,255,255,.6)',
          }}
        >
          ⬇️ Download PDF Receipt
        </button>
      </div>
    </div>
  );
}

export function WalletPaySuccessScreen({ onDone, onReceipt }) {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-6 px-5"
      style={{ background: '#0A1628' }}
    >
      <div
        className="flex h-28 w-28 items-center justify-center rounded-full"
        style={{
          background: 'linear-gradient(135deg,#176B30,#2BAC52)',
          boxShadow: '0 0 60px rgba(43,172,82,.4)',
        }}
      >
        <span style={{ fontSize: 52 }}>✅</span>
      </div>
      <div className="text-center">
        <p
          className="mb-2 text-[11px] font-bold tracking-widest"
          style={{ fontFamily: "'Inter',sans-serif", color: '#47CF72' }}
        >
          PAYMENT SUCCESSFUL
        </p>
        <p
          className="mb-1 text-[28px] font-bold"
          style={{ fontFamily: "'Poppins',sans-serif", color: '#fff' }}
        >
          ₦2,100 paid
        </p>
        <p
          className="text-[14px]"
          style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.38)' }}
        >
          via DrippleX Wallet · TXN #DRX8821
        </p>
      </div>
      <div
        className="w-full rounded-2xl p-4"
        style={{ background: '#0D1B2E', border: '1px solid rgba(255,255,255,.08)' }}
      >
        {[
          ['Trip', 'Ikeja → Victoria Island'],
          ['Driver', 'Adeyemi Okafor'],
          ['Time', 'Today, 9:41 AM'],
        ].map(([l, v]) => (
          <div key={l} className="mb-2 flex justify-between">
            <p
              className="text-[13px]"
              style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.38)' }}
            >
              {l}
            </p>
            <p
              className="text-[13px] font-medium"
              style={{ fontFamily: "'Inter',sans-serif", color: '#fff' }}
            >
              {v}
            </p>
          </div>
        ))}
      </div>
      <div className="flex w-full flex-col gap-3">
        <GreenButton label="Done" onClick={onDone} />
        <button
          onClick={onReceipt}
          className="flex h-12 w-full items-center justify-center rounded-2xl text-[14px] font-medium"
          style={{
            background: '#112238',
            border: '1px solid rgba(255,255,255,.08)',
            fontFamily: "'Inter',sans-serif",
            color: 'rgba(255,255,255,.6)',
          }}
        >
          View Receipt
        </button>
      </div>
    </div>
  );
}

// ============================================================
// PART 3 of 3 — now included verbatim (same fix as Part 2 above).
// ============================================================

export function SavedPlacesScreen({ onBack, onAdd }) {
  const pinned = [
    { id: 'home', icon: '🏠', label: 'Home', sub: '12 Adewale Close, Ikeja' },
    { id: 'work', icon: '💼', label: 'Work', sub: 'Plot 4, Victoria Island' },
  ];
  const [editingId, setEditingId] = useState(null);
  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#0A1628' }}
    >
      <RideStatusBar />
      <div className="flex items-center gap-3 px-5 pb-4 pt-2">
        <BackArrow onClick={onBack} />
        <p
          className="text-[17px] font-bold"
          style={{ fontFamily: "'Poppins',sans-serif", color: '#fff' }}
        >
          Saved Places
        </p>
      </div>
      <div className="flex-1 overflow-y-auto px-5">
        <p
          className="mb-3 text-[11px] font-semibold"
          style={{ fontFamily: "'Poppins',sans-serif", color: 'rgba(255,255,255,.38)' }}
        >
          PINNED PLACES
        </p>
        {pinned.map((p) => (
          <div
            key={p.id}
            className="mb-3 overflow-hidden rounded-2xl"
            style={{
              background: '#0D1B2E',
              border: '1px solid rgba(255,255,255,.08)',
              borderLeft: '3px solid #47CF72',
            }}
          >
            <div className="flex items-center gap-3 p-4">
              <span style={{ fontSize: 22 }}>{p.icon}</span>
              <div className="flex-1">
                <p
                  style={{
                    fontFamily: "'Poppins',sans-serif",
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#fff',
                  }}
                >
                  {p.label}
                </p>
                <p
                  style={{
                    fontSize: 12,
                    color: 'rgba(255,255,255,.6)',
                    fontFamily: "'Inter',sans-serif",
                  }}
                >
                  {p.sub}
                </p>
              </div>
              <button
                style={{
                  fontSize: 12,
                  color: '#47CF72',
                  fontFamily: "'Poppins',sans-serif",
                  fontWeight: 600,
                }}
              >
                Edit
              </button>
            </div>
          </div>
        ))}
        <p
          className="mb-3 mt-4 text-[11px] font-semibold"
          style={{ fontFamily: "'Poppins',sans-serif", color: 'rgba(255,255,255,.38)' }}
        >
          RECENT PLACES
        </p>
        {[
          { icon: '🏥', label: 'Reddington Hospital', sub: '12 Mosley Rd, Ikoyi' },
          { icon: '✈️', label: 'Murtala Airport', sub: 'Ikeja, Lagos State' },
        ].map((r) => (
          <div
            key={r.label}
            className="mb-2 flex items-center gap-3 rounded-xl p-3.5"
            style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
          >
            <span style={{ fontSize: 18 }}>{r.icon}</span>
            <div className="flex-1">
              <p style={{ fontSize: 13, fontFamily: "'Inter',sans-serif", color: '#fff' }}>
                {r.label}
              </p>
              <p
                style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,.38)',
                  fontFamily: "'Inter',sans-serif",
                }}
              >
                {r.sub}
              </p>
            </div>
          </div>
        ))}
        <button
          className="mb-6 mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl"
          style={{ border: '1.5px dashed rgba(34,197,94,.4)', background: 'transparent' }}
          onClick={onAdd}
        >
          <span style={{ fontSize: 20, color: '#47CF72' }}>+</span>
          <p
            style={{
              fontSize: 14,
              color: '#47CF72',
              fontFamily: "'Poppins',sans-serif",
              fontWeight: 600,
            }}
          >
            Add a place
          </p>
        </button>
      </div>
    </div>
  );
}

export function ScheduleRideScreen({ onBack, onConfirm }) {
  const days = ['Today', 'Tomorrow', 'Mon 9', 'Tue 10', 'Wed 11', 'Thu 12', 'Fri 13'];
  const [selDay, setSelDay] = useState(0);
  const [hour, setHour] = useState(9);
  const [min, setMin] = useState(0);
  const [ampm, setAmpm] = useState('AM');
  const [reminder, setReminder] = useState(true);
  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#0A1628' }}
    >
      <RideStatusBar />
      <div className="flex items-center gap-3 px-5 pb-4 pt-2">
        <BackArrow onClick={onBack} />
        <p
          className="text-[17px] font-bold"
          style={{ fontFamily: "'Poppins',sans-serif", color: '#fff' }}
        >
          Schedule a Ride
        </p>
      </div>
      <div className="flex-1 overflow-y-auto px-5">
        <div
          className="mb-4 rounded-2xl p-4"
          style={{ background: '#0D1B2E', border: '1px solid rgba(255,255,255,.08)' }}
        >
          <p
            style={{
              fontSize: 12,
              color: 'rgba(255,255,255,.38)',
              fontFamily: "'Inter',sans-serif",
            }}
          >
            From
          </p>
          <p
            style={{
              fontSize: 14,
              color: '#fff',
              fontFamily: "'Inter',sans-serif",
              marginBottom: 6,
            }}
          >
            12 Adewale Close, Ikeja
          </p>
          <div className="h-px" style={{ background: 'rgba(255,255,255,.08)' }} />
          <p
            style={{
              fontSize: 12,
              color: 'rgba(255,255,255,.38)',
              fontFamily: "'Inter',sans-serif",
              marginTop: 6,
            }}
          >
            To
          </p>
          <p style={{ fontSize: 14, color: '#fff', fontFamily: "'Inter',sans-serif" }}>
            Plot 4, Victoria Island
          </p>
        </div>
        <p
          style={{
            fontFamily: "'Poppins',sans-serif",
            fontSize: 13,
            fontWeight: 600,
            color: '#fff',
            marginBottom: 10,
          }}
        >
          Select date
        </p>
        <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
          {days.map((d, i) => (
            <button
              key={d}
              className="flex-shrink-0 rounded-full px-4 py-2 text-sm font-semibold"
              style={{
                background: selDay === i ? '#47CF72' : '#0D1B2E',
                color: selDay === i ? '#0A1628' : 'rgba(255,255,255,.6)',
                border: selDay === i ? 'none' : '1px solid rgba(255,255,255,.08)',
                fontFamily: "'Poppins',sans-serif",
              }}
              onClick={() => setSelDay(i)}
            >
              {d}
            </button>
          ))}
        </div>
        <p
          style={{
            fontFamily: "'Poppins',sans-serif",
            fontSize: 13,
            fontWeight: 600,
            color: '#fff',
            marginBottom: 10,
          }}
        >
          Select time
        </p>
        <div className="mb-4 flex gap-3">
          {[
            [
              'Hour',
              hour,
              (h) => setHour(h === 12 ? 1 : h + 1),
              (h) => setHour(h === 1 ? 12 : h - 1),
            ],
            [
              'Minute',
              min,
              (m) => setMin(m === 55 ? 0 : m + 5),
              (m) => setMin(m === 0 ? 55 : m - 5),
            ],
          ].map(([label, val, inc, dec]) => (
            <div
              key={label}
              className="flex-1 rounded-xl p-3"
              style={{ background: '#0D1B2E', border: '1px solid rgba(255,255,255,.08)' }}
            >
              <p
                style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,.38)',
                  fontFamily: "'Inter',sans-serif",
                  textAlign: 'center',
                  marginBottom: 6,
                }}
              >
                {label}
              </p>
              <div className="flex items-center justify-center gap-3">
                <button style={{ color: '#47CF72', fontSize: 20 }} onClick={dec}>
                  ‹
                </button>
                <p
                  style={{
                    fontFamily: "'Poppins',sans-serif",
                    fontSize: 22,
                    fontWeight: 700,
                    color: '#fff',
                    minWidth: 30,
                    textAlign: 'center',
                  }}
                >
                  {String(val).padStart(2, '0')}
                </p>
                <button style={{ color: '#47CF72', fontSize: 20 }} onClick={inc}>
                  ›
                </button>
              </div>
            </div>
          ))}
          <div className="flex flex-col justify-center gap-1">
            {['AM', 'PM'].map((a) => (
              <button
                key={a}
                className="h-10 w-14 rounded-xl text-sm font-semibold"
                style={{
                  background: ampm === a ? '#47CF72' : '#0D1B2E',
                  color: ampm === a ? '#0A1628' : 'rgba(255,255,255,.6)',
                  fontFamily: "'Poppins',sans-serif",
                  border: ampm === a ? 'none' : '1px solid rgba(255,255,255,.08)',
                }}
                onClick={() => setAmpm(a)}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
        <div
          className="mb-4 rounded-2xl p-4"
          style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
        >
          <p
            style={{
              fontSize: 11,
              color: 'rgba(255,255,255,.38)',
              fontFamily: "'Poppins',sans-serif",
              marginBottom: 4,
            }}
          >
            ESTIMATED FARE
          </p>
          <p
            style={{
              fontFamily: "'Poppins',sans-serif",
              fontSize: 20,
              fontWeight: 800,
              color: '#47CF72',
            }}
          >
            ₦2,100 – ₦2,400
          </p>
        </div>
        <div
          className="mb-6 flex items-center justify-between rounded-2xl p-4"
          style={{ background: '#0D1B2E', border: '1px solid rgba(255,255,255,.08)' }}
        >
          <p
            style={{
              fontFamily: "'Poppins',sans-serif",
              fontSize: 14,
              fontWeight: 600,
              color: '#fff',
            }}
          >
            Notify me 15 min before
          </p>
          <button
            className="relative h-6 w-12 rounded-full"
            style={{ background: reminder ? '#47CF72' : '#112238' }}
            onClick={() => setReminder(!reminder)}
          >
            <div
              className="absolute top-0.5 h-5 w-5 rounded-full bg-white"
              style={{ left: reminder ? 'calc(100% - 22px)' : 2, transition: 'left .2s' }}
            />
          </button>
        </div>
      </div>
      <div className="px-5 pb-8 pt-3">
        <GreenButton label="Schedule Ride" onClick={onConfirm} />
      </div>
    </div>
  );
}

export function PromoCodeScreen({ onBack, onApply }) {
  const [code, setCode] = useState('');
  const [applied, setApplied] = useState(false);
  const promos = [
    { code: 'NEWRIDE', desc: '₦500 off your first 3 rides', expires: 'Expires Dec 31' },
    { code: 'WEEKEND', desc: '20% off weekend rides', expires: 'Expires Dec 31' },
  ];
  const handleApply = (c) => {
    setCode(c || code);
    setApplied(true);
    onApply?.();
  };
  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#0A1628' }}
    >
      <RideStatusBar />
      <div className="flex items-center gap-3 px-5 pb-4 pt-2">
        <BackArrow onClick={onBack} />
        <p
          className="text-[17px] font-bold"
          style={{ fontFamily: "'Poppins',sans-serif", color: '#fff' }}
        >
          Promo Code
        </p>
      </div>
      <div className="flex-1 overflow-y-auto px-5">
        <div className="mb-6 flex gap-2">
          <div
            className="flex flex-1 items-center rounded-xl px-4"
            style={{
              background: '#0D1B2E',
              border: `1.5px solid ${applied ? '#47CF72' : 'rgba(255,255,255,.08)'}`,
            }}
          >
            <input
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setApplied(false);
              }}
              placeholder="Enter promo code"
              className="h-12 flex-1 bg-transparent text-sm outline-none"
              style={{ color: '#fff', fontFamily: "'Inter',sans-serif" }}
            />
          </div>
          <button
            className="h-12 rounded-xl px-5 text-sm font-semibold"
            style={{ background: '#47CF72', color: '#0A1628', fontFamily: "'Poppins',sans-serif" }}
            onClick={() => handleApply()}
          >
            Apply
          </button>
        </div>
        {applied && (
          <div
            className="mb-6 flex items-center gap-3 rounded-2xl p-4"
            style={{ background: 'rgba(34,197,94,.08)', border: '1.5px solid #47CF72' }}
          >
            <span style={{ fontSize: 24 }}>✅</span>
            <div>
              <p
                style={{
                  fontFamily: "'Poppins',sans-serif",
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#47CF72',
                }}
              >
                ₦500 discount applied!
              </p>
              <p style={{ fontSize: 12, color: '#47CF72', fontFamily: "'Poppins',sans-serif" }}>
                ₦2,100 → ₦1,600
              </p>
            </div>
          </div>
        )}
        {!applied &&
          promos.map((p) => (
            <div
              key={p.code}
              className="mb-3 rounded-2xl p-4"
              style={{ background: '#0D1B2E', border: '1px solid rgba(255,255,255,.08)' }}
            >
              <div className="mb-1 flex items-center justify-between">
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-bold"
                  style={{
                    background: 'rgba(34,197,94,.15)',
                    color: '#47CF72',
                    fontFamily: "'Poppins',sans-serif",
                  }}
                >
                  {p.code}
                </span>
                <button
                  className="rounded-full px-3 py-1 text-xs"
                  style={{
                    border: '1px solid #47CF72',
                    color: '#47CF72',
                    fontFamily: "'Poppins',sans-serif",
                    fontWeight: 600,
                  }}
                  onClick={() => handleApply(p.code)}
                >
                  Apply
                </button>
              </div>
              <p
                style={{
                  fontSize: 13,
                  color: '#fff',
                  fontFamily: "'Poppins',sans-serif",
                  fontWeight: 600,
                  marginTop: 6,
                }}
              >
                {p.desc}
              </p>
              <p
                style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,.38)',
                  fontFamily: "'Inter',sans-serif",
                  marginTop: 2,
                }}
              >
                {p.expires}
              </p>
            </div>
          ))}
      </div>
    </div>
  );
}

export function ReferralScreen({ onBack }) {
  const [copied, setCopied] = useState(false);
  const code = 'DRIPX-OLA42';
  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#0A1628' }}
    >
      <RideStatusBar />
      <div className="flex items-center gap-3 px-5 pb-4 pt-2">
        <BackArrow onClick={onBack} />
        <p
          className="text-[17px] font-bold"
          style={{ fontFamily: "'Poppins',sans-serif", color: '#fff' }}
        >
          Refer & Earn
        </p>
      </div>
      <div className="flex-1 overflow-y-auto px-5">
        <div
          className="mb-4 rounded-2xl p-6 text-center"
          style={{
            background: 'linear-gradient(135deg,#064e3b,#166534)',
            border: '1px solid rgba(34,197,94,.2)',
          }}
        >
          <p
            style={{
              fontFamily: "'Poppins',sans-serif",
              fontSize: 22,
              fontWeight: 800,
              color: '#fff',
              marginBottom: 6,
            }}
          >
            Give ₦500. Get ₦500.
          </p>
          <p
            style={{
              fontSize: 13,
              color: 'rgba(255,255,255,.7)',
              fontFamily: "'Inter',sans-serif",
            }}
          >
            Your friend gets ₦500 off their first ride. You earn ₦500 when they complete it.
          </p>
        </div>
        <div
          className="mb-4 flex items-center gap-3 rounded-2xl p-4"
          style={{ background: '#0D1B2E', border: '1px solid rgba(255,255,255,.08)' }}
        >
          <p
            style={{
              flex: 1,
              fontFamily: "'Poppins',sans-serif",
              fontSize: 22,
              fontWeight: 800,
              color: '#47CF72',
              letterSpacing: 2,
            }}
          >
            {code}
          </p>
          <button
            className="rounded-xl px-4 py-2 text-sm font-semibold"
            style={{
              background: copied ? 'rgba(34,197,94,.15)' : '#112238',
              color: copied ? '#47CF72' : 'rgba(255,255,255,.6)',
              fontFamily: "'Poppins',sans-serif",
              border: `1px solid ${copied ? '#47CF72' : 'rgba(255,255,255,.08)'}`,
            }}
            onClick={() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <div className="mb-6 flex gap-3">
          {[
            { label: 'WhatsApp', emoji: '💬' },
            { label: 'X', emoji: '𝕏' },
            { label: 'SMS', emoji: '✉️' },
            { label: 'More', emoji: '⋯' },
          ].map((s) => (
            <button
              key={s.label}
              className="flex flex-1 flex-col items-center gap-1 rounded-xl p-3"
              style={{ background: '#0D1B2E', border: '1px solid rgba(255,255,255,.08)' }}
            >
              <span style={{ fontSize: 20 }}>{s.emoji}</span>
              <p
                style={{
                  fontSize: 10,
                  color: 'rgba(255,255,255,.6)',
                  fontFamily: "'Inter',sans-serif",
                }}
              >
                {s.label}
              </p>
            </button>
          ))}
        </div>
        <div className="mb-6 flex gap-3">
          {[
            ['3', 'Friends Referred'],
            ['₦1,500', 'Earned'],
          ].map(([v, l]) => (
            <div
              key={l}
              className="flex-1 rounded-2xl p-4 text-center"
              style={{ background: '#0D1B2E', border: '1px solid rgba(255,255,255,.08)' }}
            >
              <p
                style={{
                  fontFamily: "'Poppins',sans-serif",
                  fontSize: 22,
                  fontWeight: 800,
                  color: '#47CF72',
                }}
              >
                {v}
              </p>
              <p
                style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,.38)',
                  fontFamily: "'Inter',sans-serif",
                }}
              >
                {l}
              </p>
            </div>
          ))}
        </div>
        <div
          className="mb-6 mt-4 rounded-2xl p-4 text-center"
          style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
        >
          <p
            style={{
              fontSize: 14,
              color: '#fff',
              fontFamily: "'Poppins',sans-serif",
              fontWeight: 600,
            }}
          >
            You're #12 this week 🏆
          </p>
        </div>
      </div>
    </div>
  );
}

export function LiveTrackingScreen({ onBack, onShare, onSOS, onChat }) {
  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#0A1628' }}
    >
      <RideStatusBar />
      <div className="absolute inset-0 top-10" style={{ zIndex: 0 }}>
        <MapCanvas variant="inprogress" progress={0.6} />
      </div>
      <div
        className="absolute left-0 right-0 top-10 flex items-center gap-2 px-4 pt-3"
        style={{ zIndex: 10 }}
      >
        <div
          className="flex flex-1 items-center gap-2 rounded-2xl px-3 py-2"
          style={{
            background: 'rgba(10,22,40,.85)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,.08)',
          }}
        >
          <BackArrow onClick={onBack} />
          <p
            style={{
              fontSize: 13,
              color: 'rgba(255,255,255,.6)',
              fontFamily: "'Inter',sans-serif",
              flex: 1,
            }}
          >
            Trip RX-5201
          </p>
          <div
            className="flex items-center gap-1.5 rounded-full px-2 py-0.5"
            style={{ background: 'rgba(34,197,94,.15)' }}
          >
            <div className="h-2 w-2 rounded-full" style={{ background: '#47CF72' }} />
            <p
              style={{
                fontSize: 10,
                fontFamily: "'Poppins',sans-serif",
                fontWeight: 700,
                color: '#47CF72',
              }}
            >
              LIVE
            </p>
          </div>
        </div>
      </div>
      <div
        className="absolute bottom-0 left-0 right-0 rounded-t-3xl px-5 pb-8 pt-5"
        style={{ background: '#0D1B2E', zIndex: 10, border: '1px solid rgba(255,255,255,.08)' }}
      >
        <div
          className="mx-auto mb-4 h-1 w-10 rounded-full"
          style={{ background: 'rgba(255,255,255,.08)' }}
        />
        <p
          style={{
            fontFamily: "'Poppins',sans-serif",
            fontSize: 16,
            fontWeight: 700,
            color: '#fff',
            marginBottom: 4,
          }}
        >
          On the way to Victoria Island
        </p>
        <p
          style={{
            fontSize: 13,
            color: 'rgba(255,255,255,.6)',
            fontFamily: "'Inter',sans-serif",
            marginBottom: 12,
          }}
        >
          8 min • 4.2 km remaining
        </p>
        <div className="mb-4 h-2 rounded-full" style={{ background: '#112238' }}>
          <div className="h-2 rounded-full" style={{ background: '#47CF72', width: '60%' }} />
        </div>
        <div className="mb-3 flex gap-2">
          {[
            { icon: '📍', label: 'Share Trip', fn: onShare },
            { icon: '🚨', label: 'SOS', fn: onSOS },
            { icon: '📞', label: 'Call', fn: undefined },
          ].map((a) => (
            <button
              key={a.label}
              className="flex flex-1 flex-col items-center gap-1 rounded-2xl py-2.5"
              style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
              onClick={a.fn || (() => {})}
            >
              <span style={{ fontSize: 16 }}>{a.icon}</span>
              <p
                style={{
                  fontSize: 10,
                  color: 'rgba(255,255,255,.6)',
                  fontFamily: "'Inter',sans-serif",
                }}
              >
                {a.label}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DriverEnRouteScreen({ onBack, onContact, onCancel }) {
  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#0A1628' }}
    >
      <RideStatusBar />
      <div className="absolute inset-0 top-10" style={{ zIndex: 0 }}>
        <MapCanvas variant="assigned" />
      </div>
      <div
        className="absolute inset-0 top-10"
        style={{
          background: 'linear-gradient(to bottom, transparent 40%, rgba(10,22,40,.95) 100%)',
          zIndex: 1,
        }}
      />
      <div className="absolute left-4 top-14" style={{ zIndex: 10 }}>
        <BackArrow onClick={onBack} />
      </div>
      <div
        className="absolute bottom-0 left-0 right-0 rounded-t-3xl px-5 pb-8 pt-5"
        style={{ background: '#0D1B2E', zIndex: 10, border: '1px solid rgba(255,255,255,.08)' }}
      >
        <div
          className="mx-auto mb-4 h-1 w-10 rounded-full"
          style={{ background: 'rgba(255,255,255,.08)' }}
        />
        <p
          style={{
            fontFamily: "'Poppins',sans-serif",
            fontSize: 17,
            fontWeight: 700,
            color: '#fff',
            marginBottom: 4,
          }}
        >
          Adeyemi is on the way
        </p>
        <p
          style={{
            fontSize: 13,
            color: '#47CF72',
            fontFamily: "'Poppins',sans-serif",
            fontWeight: 600,
            marginBottom: 12,
          }}
        >
          Arriving in 3 min
        </p>
        <div
          className="mb-4 flex items-center gap-3 rounded-2xl p-3.5"
          style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
        >
          <div
            className="flex h-11 w-11 items-center justify-center rounded-full"
            style={{
              background: 'linear-gradient(135deg,#16a34a,#22c55e)',
              fontFamily: "'Poppins',sans-serif",
              fontWeight: 700,
              color: '#fff',
              fontSize: 14,
            }}
          >
            AO
          </div>
          <div className="flex-1">
            <p
              style={{
                fontFamily: "'Poppins',sans-serif",
                fontSize: 14,
                fontWeight: 600,
                color: '#fff',
              }}
            >
              Adeyemi Okafor
            </p>
            <p
              style={{
                fontSize: 12,
                color: 'rgba(255,255,255,.6)',
                fontFamily: "'Inter',sans-serif",
              }}
            >
              Toyota Camry (White) • LAG 482 KA
            </p>
          </div>
        </div>
        <div className="mb-3 flex gap-3">
          {[
            { icon: '📞', label: 'Call', fn: onContact },
            { icon: '💬', label: 'Chat', fn: undefined },
            { icon: '❌', label: 'Cancel', fn: onCancel },
          ].map((a) => (
            <button
              key={a.label}
              className="flex flex-1 flex-col items-center gap-1 rounded-2xl py-2.5"
              style={{
                background: a.label === 'Cancel' ? 'rgba(239,68,68,.08)' : '#112238',
                border:
                  a.label === 'Cancel'
                    ? '1px solid rgba(239,68,68,.15)'
                    : '1px solid rgba(255,255,255,.08)',
              }}
              onClick={a.fn || (() => {})}
            >
              <span style={{ fontSize: 18 }}>{a.icon}</span>
              <p
                style={{
                  fontSize: 11,
                  color: a.label === 'Cancel' ? '#EF4444' : 'rgba(255,255,255,.6)',
                  fontFamily: "'Inter',sans-serif",
                }}
              >
                {a.label}
              </p>
            </button>
          ))}
        </div>
        <p
          style={{
            fontSize: 11,
            color: '#F59E0B',
            fontFamily: "'Inter',sans-serif",
            textAlign: 'center',
          }}
        >
          Free cancellation until driver arrives
        </p>
      </div>
    </div>
  );
}

export function PassengerWaitingScreen({ onBack, onContact, onBoard }) {
  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#0A1628' }}
    >
      <RideStatusBar />
      <div className="absolute inset-0 top-10" style={{ zIndex: 0 }}>
        <MapCanvas variant="arrived" />
      </div>
      <div
        className="absolute inset-0 top-10"
        style={{
          background: 'linear-gradient(to bottom, transparent 30%, rgba(10,22,40,.95) 70%)',
          zIndex: 1,
        }}
      />
      <div className="absolute left-4 top-14" style={{ zIndex: 10 }}>
        <BackArrow onClick={onBack} />
      </div>
      <div
        className="absolute bottom-0 left-0 right-0 rounded-t-3xl px-5 pb-8 pt-5"
        style={{ background: '#0D1B2E', zIndex: 10, border: '1px solid rgba(255,255,255,.08)' }}
      >
        <div
          className="mx-auto mb-4 h-1 w-10 rounded-full"
          style={{ background: 'rgba(255,255,255,.08)' }}
        />
        <div className="mb-4 flex justify-center">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-full"
            style={{ background: 'rgba(34,197,94,.12)' }}
          >
            <span style={{ fontSize: 32 }}>🚗</span>
          </div>
        </div>
        <p
          style={{
            fontFamily: "'Poppins',sans-serif",
            fontSize: 20,
            fontWeight: 800,
            color: '#fff',
            textAlign: 'center',
            marginBottom: 4,
          }}
        >
          Your driver is here!
        </p>
        <p
          style={{
            fontSize: 13,
            color: 'rgba(255,255,255,.6)',
            fontFamily: "'Inter',sans-serif",
            textAlign: 'center',
            marginBottom: 16,
          }}
        >
          Look for white Toyota Camry • LAG 482 KA
        </p>
        <div
          className="mb-4 rounded-2xl p-4 text-center"
          style={{ background: 'rgba(34,197,94,.08)', border: '1.5px solid #47CF72' }}
        >
          <p
            style={{
              fontSize: 12,
              color: 'rgba(255,255,255,.38)',
              fontFamily: "'Inter',sans-serif",
              marginBottom: 4,
            }}
          >
            Show driver code
          </p>
          <p
            style={{
              fontFamily: "'Courier New', monospace",
              fontSize: 36,
              fontWeight: 700,
              color: '#47CF72',
              letterSpacing: 8,
            }}
          >
            7421
          </p>
          <p
            style={{
              fontSize: 11,
              color: 'rgba(255,255,255,.38)',
              fontFamily: "'Inter',sans-serif",
              marginTop: 4,
            }}
          >
            Confirm the code matches before boarding
          </p>
        </div>
        <GreenButton label="I'm in the car → Start Ride" onClick={onBoard} />
        <button
          className="mt-2 w-full py-2 text-center"
          style={{ fontSize: 12, color: 'rgba(255,255,255,.38)', fontFamily: "'Inter',sans-serif" }}
          onClick={onContact}
        >
          Not my driver? Contact support
        </button>
      </div>
    </div>
  );
}

export function DriverArrivedExtendedScreen({ onBack, onStart, onReport }) {
  const [expanded, setExpanded] = useState(false);
  const waitSeconds = 134;
  const freeSeconds = 180;
  const remaining = freeSeconds - waitSeconds;
  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#0A1628' }}
    >
      <RideStatusBar />
      <div className="absolute inset-0 top-10" style={{ zIndex: 0 }}>
        <MapCanvas variant="arrived" />
      </div>
      <div
        className="absolute inset-0 top-10"
        style={{
          background: 'linear-gradient(to bottom, transparent 30%, rgba(10,22,40,.95) 70%)',
          zIndex: 1,
        }}
      />
      <div className="absolute left-4 top-14" style={{ zIndex: 10 }}>
        <BackArrow onClick={onBack} />
      </div>
      <div
        className="absolute bottom-0 left-0 right-0 rounded-t-3xl px-5 pb-8 pt-5"
        style={{ background: '#0D1B2E', zIndex: 10, border: '1px solid rgba(255,255,255,.08)' }}
      >
        <div
          className="mx-auto mb-4 h-1 w-10 rounded-full"
          style={{ background: 'rgba(255,255,255,.08)' }}
        />
        <div className="mb-3 flex justify-center">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-full"
            style={{ background: 'rgba(34,197,94,.12)' }}
          >
            <span style={{ fontSize: 28 }}>🚗</span>
          </div>
        </div>
        <p
          style={{
            fontFamily: "'Poppins',sans-serif",
            fontSize: 18,
            fontWeight: 800,
            color: '#fff',
            textAlign: 'center',
            marginBottom: 4,
          }}
        >
          Your driver is here!
        </p>
        <div
          className="mb-3 flex items-center justify-between rounded-2xl p-3.5"
          style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
        >
          <div>
            <p
              style={{
                fontSize: 12,
                color: 'rgba(255,255,255,.38)',
                fontFamily: "'Inter',sans-serif",
              }}
            >
              Waiting time
            </p>
            <p
              style={{
                fontFamily: "'Courier New', monospace",
                fontSize: 22,
                fontWeight: 700,
                color: '#fff',
              }}
            >
              {fmt(waitSeconds)}
            </p>
          </div>
          <div className="text-right">
            <p
              style={{
                fontSize: 12,
                color: 'rgba(255,255,255,.38)',
                fontFamily: "'Inter',sans-serif",
              }}
            >
              Free time remaining
            </p>
            <p
              style={{
                fontFamily: "'Poppins',sans-serif",
                fontSize: 15,
                fontWeight: 700,
                color: remaining > 0 ? '#47CF72' : '#EF4444',
              }}
            >
              {fmt(remaining)} remaining
            </p>
          </div>
        </div>
        <div
          className="mb-3 rounded-2xl p-3 text-center"
          style={{ background: 'rgba(34,197,94,.08)', border: '1.5px solid #47CF72' }}
        >
          <p
            style={{
              fontSize: 11,
              color: 'rgba(255,255,255,.38)',
              fontFamily: "'Inter',sans-serif",
              marginBottom: 2,
            }}
          >
            Show driver code
          </p>
          <p
            style={{
              fontFamily: "'Courier New', monospace",
              fontSize: 28,
              fontWeight: 700,
              color: '#47CF72',
              letterSpacing: 8,
            }}
          >
            7421
          </p>
        </div>
        <GreenButton label="I'm in the car → Start Ride" onClick={onStart} />
        <button
          className="mt-2 w-full py-2 text-center"
          style={{ fontSize: 12, color: '#EF4444', fontFamily: "'Inter',sans-serif" }}
          onClick={onReport}
        >
          Report an issue
        </button>
      </div>
    </div>
  );
}

export function WalletPaySuccessScreen({ onDone, onReceipt }) {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-6 px-5"
      style={{ background: '#0A1628' }}
    >
      <div className="mb-2" style={{ width: 100, height: 100 }}>
        <svg width="100" height="100" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="none" stroke="#47CF72" strokeWidth="4" />
          <path
            d="M28 50 L44 66 L72 36"
            fill="none"
            stroke="#47CF72"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div className="text-center">
        <p
          style={{
            fontFamily: "'Poppins',sans-serif",
            fontSize: 36,
            fontWeight: 900,
            color: '#fff',
            marginBottom: 4,
          }}
        >
          ₦2,100 paid!
        </p>
        <p
          style={{
            fontSize: 16,
            color: 'rgba(255,255,255,.6)',
            fontFamily: "'Inter',sans-serif",
            marginBottom: 32,
          }}
        >
          Payment successful
        </p>
      </div>
      <div
        className="mb-4 w-full rounded-2xl p-4"
        style={{ background: '#0D1B2E', border: '1px solid rgba(255,255,255,.08)' }}
      >
        {[
          ['Payment method', 'DrippleX Wallet 💜'],
          ['Time', 'Today, 9:41 AM'],
          ['Transaction ID', 'TXN-2024120500841'],
        ].map(([l, v]) => (
          <div key={l} className="mb-2 flex justify-between">
            <p
              style={{
                fontSize: 12,
                color: 'rgba(255,255,255,.38)',
                fontFamily: "'Inter',sans-serif",
              }}
            >
              {l}
            </p>
            <p style={{ fontSize: 12, color: '#fff', fontFamily: "'Inter',sans-serif" }}>{v}</p>
          </div>
        ))}
      </div>
      <div className="flex w-full flex-col gap-3">
        <button
          className="h-12 w-full rounded-2xl text-sm font-semibold"
          style={{
            background: 'transparent',
            border: '1.5px solid rgba(255,255,255,.08)',
            color: 'rgba(255,255,255,.6)',
            fontFamily: "'Poppins',sans-serif",
          }}
          onClick={onReceipt}
        >
          View Receipt
        </button>
        <GreenButton label="Back to Home" onClick={onDone} />
      </div>
    </div>
  );
}

// END OF FILE — 24 unique screens received (31 originally claimed; 7 never
// arrived, see note above). Design tokens: background=#0A1628, card=#0D1B2E,
// surface=#112238. Primary=#2BAC52, light=#47CF72, dark=#176B30. Fonts:
// Poppins (headings/prices), Inter (body). Frame: 390x844px mobile,
// rounded-2xl cards, green gradient buttons.
