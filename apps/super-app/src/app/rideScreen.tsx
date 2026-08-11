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
import { api } from '../lib/api';
import { ws } from '../lib/ws';
import type { RideDto, RideType } from '../lib/api';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const NAVY_BASE = '#0A1628';
const PP = "'Poppins',sans-serif";
const IT = "'Inter',sans-serif";

// Demo geo — real Lagos coordinates so a booked ride carries a real route.
// Pickup is the rider's "current location" shown across the ride screens.
export const RIDE_PICKUP = {
  latitude: 6.5833,
  longitude: 3.35,
  address: 'Ikeja GRA, Lagos',
};

export interface RideDestination {
  latitude: number;
  longitude: number;
  address: string;
  label: string;
}

const RECENT_PLACES = [
  {
    icon: '🏠',
    label: 'Home',
    sub: '12 Adewale Close, Ikeja',
    type: 'saved',
    lat: 6.6018,
    lng: 3.3515,
  },
  {
    icon: '💼',
    label: 'Work',
    sub: 'Plot 4, Victoria Island',
    type: 'saved',
    lat: 6.4281,
    lng: 3.4219,
  },
  {
    icon: '🏥',
    label: 'Reddington Hospital',
    sub: '12 Mosley Rd, Ikoyi',
    type: 'recent',
    lat: 6.4478,
    lng: 3.4341,
  },
  {
    icon: '✈️',
    label: 'Murtala Airport',
    sub: 'Ikeja, Lagos State',
    type: 'recent',
    lat: 6.5774,
    lng: 3.3212,
  },
  {
    icon: '🛒',
    label: 'Shoprite Ikeja',
    sub: '400 Ikorodu Rd, Ikeja',
    type: 'recent',
    lat: 6.6146,
    lng: 3.3586,
  },
];

const POPULAR_PLACES = [
  { icon: '🏖', label: 'Bar Beach', sub: 'Victoria Island', lat: 6.4207, lng: 3.4215 },
  { icon: '🏟', label: 'National Stadium', sub: 'Surulere, Lagos', lat: 6.4998, lng: 3.3628 },
  { icon: '🏛', label: 'Eko Hotel', sub: 'Plot 1415, VI', lat: 6.4331, lng: 3.4271 },
  { icon: '🛍', label: 'Balogun Market', sub: 'Lagos Island', lat: 6.4548, lng: 3.3899 },
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
    color: G2,
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
  { id: 'wallet', icon: '💳', label: 'DrippleX Wallet', balance: '₦24,500', color: G2 },
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

// ─────────────────────────────────────────────────────────────────────────────
// SHARED SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────
function RideStatusBar() {
  return (
    <div
      className="relative z-10 flex w-full items-center justify-between px-5 pt-[52px]"
      style={{ fontFamily: IT, fontSize: 11, color: 'rgba(255,255,255,.55)' }}
    >
      <span>9:41</span>
      <div className="flex items-center gap-1.5">
        <svg width="17" height="12" viewBox="0 0 17 12" fill="currentColor">
          <rect x="0" y="6" width="3" height="6" rx=".6" opacity=".4" />
          <rect x="4.5" y="3.5" width="3" height="8.5" rx=".6" opacity=".6" />
          <rect x="9" y="1" width="3" height="11" rx=".6" opacity=".85" />
          <rect x="13.5" y="0" width="3" height="12" rx=".6" />
        </svg>
        <svg width="26" height="12" viewBox="0 0 26 12" fill="currentColor">
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
          <rect x="2" y="2" width="17" height="8" rx="2" opacity=".65" />
          <path d="M24 4v4a2 2 0 000-4z" opacity=".4" />
        </svg>
      </div>
    </div>
  );
}

function BackArrow({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex h-10 w-10 items-center justify-center rounded-2xl transition-all active:scale-95"
      style={{ background: 'rgba(255,255,255,.06)', border: `1px solid ${BORDER}` }}
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

function GreenButton({
  label,
  onClick,
  disabled,
  loading,
  small,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  small?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`w-full ${small ? 'h-12 rounded-xl text-sm' : 'h-14 rounded-2xl text-[15px]'} flex items-center justify-center gap-2 font-semibold transition-all duration-200 active:scale-[.97]`}
      style={{
        fontFamily: PP,
        background:
          disabled || loading
            ? 'rgba(255,255,255,.06)'
            : `linear-gradient(135deg,${G0} 0%,${G2} 52%,${G3} 100%)`,
        color: disabled || loading ? 'rgba(255,255,255,.22)' : '#fff',
        boxShadow:
          disabled || loading
            ? 'none'
            : `0 10px 36px rgba(43,172,82,.36),0 0 0 1px rgba(43,172,82,.24)`,
      }}
    >
      {loading ? (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          style={{ animation: 'spin 1s linear infinite' }}
        >
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" />
        </svg>
      ) : (
        label
      )}
    </button>
  );
}

function MapCanvas({ variant = 'default', progress = 0 }: { variant?: string; progress?: number }) {
  const routes: Record<string, { cx: number; cy: number; dx: number; dy: number; color: string }> =
    {
      default: { cx: 100, cy: 240, dx: 290, dy: 100, color: G2 },
      finding: { cx: 100, cy: 220, dx: 290, dy: 120, color: '#3B82F6' },
      assigned: { cx: 80, cy: 250, dx: 300, dy: 90, color: G2 },
      arrived: { cx: 195, cy: 180, dx: 195, dy: 180, color: G2 },
      inprogress: { cx: 60, cy: 260, dx: 320, dy: 80, color: G2 },
      complete: { cx: 60, cy: 260, dx: 320, dy: 80, color: '#10B981' },
    };
  const r = routes[variant] || routes.default;
  const midX = (r.cx + r.dx) / 2;
  const midY = (r.cy + r.dy) / 2 - 60;
  const pathD = `M${r.cx},${r.cy} Q${midX},${midY} ${r.dx},${r.dy}`;
  const totalLen = 280;
  const filled = Math.round(totalLen * progress);

  return (
    <svg width="390" height="320" viewBox="0 0 390 320" style={{ display: 'block' }}>
      {/* map bg */}
      <rect width="390" height="320" fill="#0D1B2E" />
      {/* grid lines */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <line
          key={`h${i}`}
          x1="0"
          y1={i * 46}
          x2="390"
          y2={i * 46}
          stroke="rgba(255,255,255,.04)"
          strokeWidth="1"
        />
      ))}
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
        <line
          key={`v${i}`}
          x1={i * 44}
          y1="0"
          x2={i * 44}
          y2="320"
          stroke="rgba(255,255,255,.04)"
          strokeWidth="1"
        />
      ))}
      {/* roads */}
      <line x1="0" y1="180" x2="390" y2="180" stroke="rgba(255,255,255,.07)" strokeWidth="2.5" />
      <line x1="195" y1="0" x2="195" y2="320" stroke="rgba(255,255,255,.07)" strokeWidth="2.5" />
      <line x1="0" y1="90" x2="390" y2="140" stroke="rgba(255,255,255,.04)" strokeWidth="1.5" />
      <line x1="50" y1="0" x2="340" y2="320" stroke="rgba(255,255,255,.04)" strokeWidth="1.5" />
      {/* route shadow */}
      <path
        d={pathD}
        fill="none"
        stroke="rgba(43,172,82,.12)"
        strokeWidth="12"
        strokeLinecap="round"
      />
      {/* route base */}
      <path
        d={pathD}
        fill="none"
        stroke="rgba(43,172,82,.25)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray="8 4"
      />
      {/* route progress */}
      {progress > 0 && (
        <path
          d={pathD}
          fill="none"
          stroke={r.color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${totalLen}`}
        />
      )}
      {/* buildings */}
      {[
        [30, 100, 24, 40],
        [60, 90, 18, 50],
        [130, 110, 28, 36],
        [280, 100, 22, 40],
        [310, 88, 30, 52],
        [340, 106, 20, 34],
      ].map(([x, y, w, h], i) => (
        <rect
          key={i}
          x={x}
          y={y}
          width={w}
          height={h}
          rx="2"
          fill="rgba(255,255,255,.04)"
          stroke="rgba(255,255,255,.06)"
          strokeWidth="1"
        />
      ))}
      {/* green zone */}
      <ellipse cx="195" cy="200" rx="60" ry="30" fill="rgba(43,172,82,.06)" />
      {/* origin pin */}
      <circle cx={r.cx} cy={r.cy} r="10" fill={G2} opacity=".2" />
      <circle cx={r.cx} cy={r.cy} r="5" fill={G2} />
      <circle cx={r.cx} cy={r.cy} r="3" fill="#fff" />
      {/* dest pin */}
      {variant !== 'arrived' && (
        <g>
          <circle cx={r.dx} cy={r.dy} r="14" fill="rgba(43,172,82,.15)" />
          <circle cx={r.dx} cy={r.dy} r="8" fill={G2} />
          <circle cx={r.dx} cy={r.dy} r="4" fill="#fff" />
          <rect x={r.dx - 1.5} y={r.dy - 28} width="3" height="20" rx="1.5" fill={G2} />
        </g>
      )}
      {/* car icon for active states */}
      {['assigned', 'arrived', 'inprogress'].includes(variant) && (
        <g transform={`translate(${r.cx + 20},${r.cy - 20})`}>
          <circle r="18" fill="#0D1B2E" stroke={G2} strokeWidth="2" />
          <text textAnchor="middle" dominantBaseline="central" fontSize="16">
            🚗
          </text>
        </g>
      )}
      {/* ETA bubble */}
      {['assigned', 'inprogress'].includes(variant) && (
        <g>
          <rect x="140" y="22" width="110" height="34" rx="10" fill={G2} />
          <text
            x="195"
            y="44"
            textAnchor="middle"
            fill="#fff"
            fontSize="12"
            fontFamily="Poppins"
            fontWeight="600"
          >
            {variant === 'inprogress' ? '8 min left' : '3 min away'}
          </text>
        </g>
      )}
      {/* gradient overlay bottom */}
      <defs>
        <linearGradient id="mapFade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={NAVY_BASE} stopOpacity="0" />
          <stop offset="100%" stopColor={NAVY_BASE} stopOpacity="1" />
        </linearGradient>
      </defs>
      <rect width="390" height="320" fill="url(#mapFade)" />
    </svg>
  );
}

function BottomSheet({
  children,
  title,
  peek,
}: {
  children: React.ReactNode;
  title?: string;
  peek?: boolean;
}) {
  return (
    <div
      className="relative z-10 flex flex-1 flex-col"
      style={{
        background: NAVY_BASE,
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
          style={{ fontFamily: PP, color: '#fff' }}
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
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={G2} strokeWidth="2.5">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
      <span style={{ fontFamily: IT, fontSize: 11, color: G3, fontWeight: 600 }}>
        DrippleX Safe
      </span>
    </div>
  );
}

function StarRow({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex justify-center gap-3">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          onClick={() => onChange(n)}
          className="transition-transform active:scale-90"
          style={{ fontSize: 36, filter: n <= value ? 'none' : 'grayscale(1) opacity(.3)' }}
        >
          ⭐
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RIDE-001 — RIDE HOME
// ─────────────────────────────────────────────────────────────────────────────
export function RideHomeScreen({
  onBack,
  onSearch,
  onHistory,
}: {
  onBack: () => void;
  onSearch: () => void;
  onHistory: () => void;
}) {
  const [inputFocused, setInputFocused] = useState(false);

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: NAVY_DEEP }}
    >
      {/* Map */}
      <div className="relative flex-shrink-0" style={{ height: 340 }}>
        <MapCanvas variant="default" />
        {/* Status bar overlay */}
        <div className="absolute inset-0 left-0 right-0 top-0">
          <RideStatusBar />
        </div>
        {/* Top bar */}
        <div
          className="absolute left-0 right-0 top-14 flex items-center justify-between px-5"
          style={{ marginTop: 16 }}
        >
          <button
            onClick={onBack}
            className="flex h-10 w-10 items-center justify-center rounded-2xl active:scale-95"
            style={{
              background: 'rgba(6,14,28,.85)',
              border: `1px solid ${BORDER}`,
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
              className="flex h-10 w-10 items-center justify-center rounded-2xl active:scale-95"
              style={{
                background: 'rgba(6,14,28,.85)',
                border: `1px solid ${BORDER}`,
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
        {/* Location btn */}
        <button
          className="absolute bottom-16 right-5 flex h-10 w-10 items-center justify-center rounded-2xl"
          style={{
            background: 'rgba(6,14,28,.85)',
            border: `1px solid ${BORDER}`,
            backdropFilter: 'blur(12px)',
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke={G2}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
        </button>
      </div>

      {/* Bottom sheet */}
      <BottomSheet peek>
        <div className="flex-1 overflow-y-auto px-5 pb-4 pt-2">
          {/* Greeting */}
          <div className="mb-4">
            <p className="mb-0.5 text-[18px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
              Where to, Chidi?
            </p>
            <p className="text-[13px]" style={{ fontFamily: IT, color: MUTED }}>
              Your current location: Ikeja GRA, Lagos
            </p>
          </div>

          {/* Destination input */}
          <button onClick={onSearch} className="mb-4 w-full text-left">
            <div
              className="flex h-14 items-center gap-3 rounded-2xl px-4"
              style={{
                background: NAVY_SURFACE,
                border: `1px solid ${inputFocused ? `rgba(43,172,82,.4)` : BORDER}`,
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke={G2}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <span style={{ fontFamily: IT, fontSize: 15, color: MUTED }}>
                Where are you going?
              </span>
            </div>
          </button>

          {/* Saved places */}
          <div className="mb-5 flex gap-3">
            {[
              { icon: '🏠', label: 'Home', sub: 'Ikeja, Lagos' },
              { icon: '💼', label: 'Work', sub: 'Victoria Island' },
            ].map((p) => (
              <button
                key={p.label}
                onClick={onSearch}
                className="flex flex-1 items-center gap-2.5 rounded-2xl px-3 py-3 transition-all active:scale-[.97]"
                style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
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
                    style={{ fontFamily: PP, color: '#fff' }}
                  >
                    {p.label}
                  </p>
                  <p className="truncate text-[11px]" style={{ fontFamily: IT, color: MUTED }}>
                    {p.sub}
                  </p>
                </div>
              </button>
            ))}
          </div>

          {/* Recent */}
          <p className="mb-3 text-[13px] font-semibold" style={{ fontFamily: PP, color: MUTED }}>
            RECENT
          </p>
          <div className="flex flex-col gap-1">
            {RECENT_PLACES.slice(2, 5).map((p) => (
              <button
                key={p.label}
                onClick={onSearch}
                className="flex items-center gap-3 rounded-xl px-1 py-3 transition-all active:bg-white/[.03]"
              >
                <div
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl text-lg"
                  style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
                >
                  {p.icon}
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-[14px] font-medium" style={{ fontFamily: PP, color: '#fff' }}>
                    {p.label}
                  </p>
                  <p className="truncate text-[12px]" style={{ fontFamily: IT, color: MUTED }}>
                    {p.sub}
                  </p>
                </div>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={MUTED}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RIDE-002 — DESTINATION SEARCH
// ─────────────────────────────────────────────────────────────────────────────
export function DestinationSearchScreen({
  onBack,
  onSelect,
}: {
  onBack: () => void;
  onSelect: (dest: RideDestination) => void;
}) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = (p: { label: string; sub: string; lat?: number; lng?: number }) => {
    // Places without coordinates fall back to a central Lagos point so booking
    // still produces a real route.
    onSelect({
      latitude: p.lat ?? 6.4541,
      longitude: p.lng ?? 3.3947,
      address: `${p.label} · ${p.sub}`,
      label: p.label,
    });
  };

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered =
    query.length > 0
      ? [...RECENT_PLACES, ...POPULAR_PLACES].filter(
          (p) =>
            p.label.toLowerCase().includes(query.toLowerCase()) ||
            p.sub.toLowerCase().includes(query.toLowerCase()),
        )
      : RECENT_PLACES;

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: NAVY_BASE }}
    >
      <RideStatusBar />

      <div className="px-5 pb-4 pt-3">
        <div className="mb-4 flex items-center gap-3">
          <BackArrow onClick={onBack} />
          <p className="text-[17px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
            Set Destination
          </p>
        </div>

        {/* Pickup row */}
        <div
          className="mb-2 flex items-center gap-3 rounded-2xl px-4 py-3"
          style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
        >
          <div className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: G2 }} />
          <span className="flex-1 text-[14px]" style={{ fontFamily: IT, color: TEXT_SECONDARY }}>
            Ikeja GRA, Lagos
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{ background: 'rgba(43,172,82,.12)', color: G3 }}
          >
            Now
          </span>
        </div>

        {/* Destination input */}
        <div
          className="flex h-14 items-center gap-3 rounded-2xl px-4"
          style={{
            background: NAVY_SURFACE,
            border: `1px solid ${focused ? 'rgba(43,172,82,.4)' : BORDER}`,
          }}
        >
          <div
            className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
            style={{ background: '#EF4444' }}
          />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Enter destination..."
            className="flex-1 bg-transparent outline-none"
            style={{ fontFamily: IT, fontSize: 15, color: '#fff' }}
          />
          {query.length > 0 && (
            <button
              onClick={() => setQuery('')}
              className="flex h-6 w-6 items-center justify-center rounded-full"
              style={{ background: 'rgba(255,255,255,.1)' }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5">
        {query.length === 0 && (
          <>
            <p
              className="mb-3 text-[12px] font-semibold"
              style={{ fontFamily: IT, color: MUTED, letterSpacing: '0.08em' }}
            >
              SAVED PLACES
            </p>
            {RECENT_PLACES.slice(0, 2).map((p) => (
              <button
                key={p.label}
                onClick={() => pick(p)}
                className="flex w-full items-center gap-3 rounded-xl px-1 py-3.5 transition-all active:bg-white/[.03]"
              >
                <div
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl text-lg"
                  style={{
                    background: 'rgba(43,172,82,.12)',
                    border: `1px solid rgba(43,172,82,.2)`,
                  }}
                >
                  {p.icon}
                </div>
                <div className="flex-1 text-left">
                  <p
                    className="text-[14px] font-semibold"
                    style={{ fontFamily: PP, color: '#fff' }}
                  >
                    {p.label}
                  </p>
                  <p className="text-[12px]" style={{ fontFamily: IT, color: MUTED }}>
                    {p.sub}
                  </p>
                </div>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={MUTED}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            ))}
            <div className="my-3 h-px" style={{ background: BORDER }} />
            <p
              className="mb-3 text-[12px] font-semibold"
              style={{ fontFamily: IT, color: MUTED, letterSpacing: '0.08em' }}
            >
              RECENT TRIPS
            </p>
          </>
        )}

        {(query.length > 0 ? filtered : RECENT_PLACES.slice(2)).map((p, i) => (
          <button
            key={i}
            onClick={() => pick(p)}
            className="flex w-full items-center gap-3 rounded-xl px-1 py-3.5 transition-all active:bg-white/[.03]"
          >
            <div
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl text-lg"
              style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
            >
              {p.icon}
            </div>
            <div className="flex-1 text-left">
              <p className="text-[14px] font-medium" style={{ fontFamily: PP, color: '#fff' }}>
                {p.label}
              </p>
              <p className="text-[12px]" style={{ fontFamily: IT, color: MUTED }}>
                {p.sub}
              </p>
            </div>
          </button>
        ))}

        {query.length > 0 && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full text-3xl"
              style={{ background: NAVY_SURFACE }}
            >
              🔍
            </div>
            <p className="text-[15px] font-semibold" style={{ fontFamily: PP, color: '#fff' }}>
              No results found
            </p>
            <p className="text-center text-[13px]" style={{ fontFamily: IT, color: MUTED }}>
              Try a different search term
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RIDE-003 — PICKUP CONFIRMATION
// ─────────────────────────────────────────────────────────────────────────────
export function PickupConfirmScreen({
  onBack,
  onConfirm,
}: {
  onBack: () => void;
  onConfirm: () => void;
}) {
  const [note, setNote] = useState('');

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: NAVY_DEEP }}
    >
      <div className="relative flex-shrink-0" style={{ height: 300 }}>
        <MapCanvas variant="default" />
        <div className="absolute inset-0">
          <RideStatusBar />
          <div className="mt-3 px-5">
            <BackArrow onClick={onBack} />
          </div>
        </div>
        {/* Pickup pin center */}
        <div className="absolute left-1/2 -translate-x-1/2" style={{ bottom: 48 }}>
          <div className="flex flex-col items-center">
            <div
              className="mb-1.5 rounded-xl px-3 py-1.5 text-[11px] font-semibold"
              style={{
                background: G2,
                color: '#fff',
                fontFamily: IT,
                boxShadow: `0 4px 16px rgba(43,172,82,.4)`,
              }}
            >
              Drag to adjust
            </div>
            <div
              className="h-4 w-4 flex-shrink-0 rounded-full border-2"
              style={{ background: G2, borderColor: '#fff' }}
            />
            <div className="h-5 w-px" style={{ background: G2 }} />
          </div>
        </div>
      </div>

      <BottomSheet peek title="Confirm Pickup Point">
        <div className="flex-1 overflow-y-auto px-5 pb-6">
          {/* Route summary */}
          <div
            className="mb-4 rounded-2xl p-4"
            style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
          >
            <div className="mb-3 flex items-start gap-3">
              <div className="flex flex-shrink-0 flex-col items-center gap-1 pt-1">
                <div className="h-2.5 w-2.5 rounded-full" style={{ background: G2 }} />
                <div className="min-h-[24px] w-px flex-1" style={{ background: BORDER }} />
                <div className="h-2.5 w-2.5 rounded-full" style={{ background: '#EF4444' }} />
              </div>
              <div className="flex-1">
                <div className="mb-3">
                  <p
                    className="mb-0.5 text-[11px] font-medium"
                    style={{ fontFamily: IT, color: MUTED }}
                  >
                    PICKUP
                  </p>
                  <p
                    className="text-[14px] font-semibold"
                    style={{ fontFamily: PP, color: '#fff' }}
                  >
                    Ikeja GRA, Lagos
                  </p>
                </div>
                <div>
                  <p
                    className="mb-0.5 text-[11px] font-medium"
                    style={{ fontFamily: IT, color: MUTED }}
                  >
                    DROP-OFF
                  </p>
                  <p
                    className="text-[14px] font-semibold"
                    style={{ fontFamily: PP, color: '#fff' }}
                  >
                    Victoria Island, Lagos
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-3 border-t pt-3" style={{ borderColor: BORDER }}>
              {[
                ['~14 km', 'Distance'],
                ['~22 min', 'Est. time'],
                ['Fast Route', 'Traffic'],
              ].map(([v, l]) => (
                <div key={l} className="flex-1 text-center">
                  <p className="text-[13px] font-bold" style={{ fontFamily: PP, color: G3 }}>
                    {v}
                  </p>
                  <p className="text-[11px]" style={{ fontFamily: IT, color: MUTED }}>
                    {l}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Pickup note */}
          <div className="mb-5">
            <p
              className="mb-2 text-[13px] font-medium"
              style={{ fontFamily: PP, color: TEXT_SECONDARY }}
            >
              Pickup note (optional)
            </p>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. I'm at the gate"
              className="h-12 w-full rounded-2xl px-4 outline-none"
              style={{
                background: NAVY_SURFACE,
                border: `1px solid ${BORDER}`,
                fontFamily: IT,
                fontSize: 14,
                color: '#fff',
              }}
            />
          </div>

          <GreenButton label="Confirm Pickup →" onClick={onConfirm} />
        </div>
      </BottomSheet>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RIDE-004 — FARE ESTIMATE
// ─────────────────────────────────────────────────────────────────────────────
export function FareEstimateScreen({
  onBack,
  onBook,
  dropoff,
  rideType = 'ECONOMY',
}: {
  onBack: () => void;
  onBook: (rideId: string) => void;
  dropoff?: RideDestination;
  rideType?: RideType;
}) {
  const [payment, setPayment] = useState('cash');
  const ride = RIDE_TYPES[0];

  const [estimate, setEstimate] = useState<{
    baseFare: number;
    distanceFare: number;
    timeFare: number;
    totalFare: number;
    promoDiscount: number;
    distanceMeters: number;
  } | null>(null);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dropoff) return;
    api.rides
      .estimate({
        rideType,
        pickupLatitude: RIDE_PICKUP.latitude,
        pickupLongitude: RIDE_PICKUP.longitude,
        dropoffLatitude: dropoff.latitude,
        dropoffLongitude: dropoff.longitude,
      })
      .then((e) => setEstimate(e))
      .catch(() => {});
  }, [dropoff, rideType]);

  const naira = (n: number) => `₦${Math.round(n).toLocaleString()}`;
  const fareLabel = estimate ? naira(estimate.totalFare) : ride.price;
  const kmLabel = estimate ? (estimate.distanceMeters / 1000).toFixed(0) : '14';

  const handleBook = async () => {
    if (booking || !dropoff) return;
    setBooking(true);
    setError(null);
    try {
      const created = await api.rides.book({
        rideType,
        pickupLatitude: RIDE_PICKUP.latitude,
        pickupLongitude: RIDE_PICKUP.longitude,
        pickupAddress: RIDE_PICKUP.address,
        dropoffLatitude: dropoff.latitude,
        dropoffLongitude: dropoff.longitude,
        dropoffAddress: dropoff.address,
      });
      onBook(created.id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not book ride');
      setBooking(false);
    }
  };

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: NAVY_DEEP }}
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
          {/* Economy ride card */}
          <div
            className="mb-4 flex items-center gap-4 rounded-2xl p-4"
            style={{ background: 'rgba(43,172,82,.08)', border: '1.5px solid rgba(43,172,82,.3)' }}
          >
            <div
              className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl text-3xl"
              style={{ background: 'rgba(43,172,82,.12)' }}
            >
              {ride.emoji}
            </div>
            <div className="flex-1">
              <div className="mb-0.5 flex items-center gap-2">
                <p className="text-[17px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
                  {ride.name}
                </p>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                  style={{ background: 'rgba(43,172,82,.18)', color: G3 }}
                >
                  MVP
                </span>
              </div>
              <p className="text-[12px]" style={{ fontFamily: IT, color: MUTED }}>
                {ride.desc} · {ride.seats} seats · {ride.time}
              </p>
            </div>
            <div className="flex-shrink-0 text-right">
              <p
                className="text-[22px] font-bold leading-tight"
                style={{ fontFamily: PP, color: G3 }}
              >
                {fareLabel}
              </p>
              <p className="text-[11px]" style={{ fontFamily: IT, color: MUTED }}>
                est. fare
              </p>
            </div>
          </div>

          {/* Payment */}
          <div className="mb-4">
            <p
              className="mb-2.5 text-[13px] font-semibold"
              style={{ fontFamily: PP, color: MUTED }}
            >
              PAYMENT METHOD
            </p>
            <div className="flex gap-2">
              {PAYMENT_METHODS.map((pm) => (
                <button
                  key={pm.id}
                  onClick={() => setPayment(pm.id)}
                  className="flex flex-1 flex-col items-center gap-1.5 rounded-2xl px-2 py-3 transition-all active:scale-[.97]"
                  style={{
                    background: payment === pm.id ? 'rgba(43,172,82,.08)' : NAVY_SURFACE,
                    border: `1.5px solid ${payment === pm.id ? 'rgba(43,172,82,.35)' : BORDER}`,
                  }}
                >
                  <span style={{ fontSize: 20 }}>{pm.icon}</span>
                  <p
                    className="text-center text-[10px] font-semibold leading-tight"
                    style={{ fontFamily: IT, color: payment === pm.id ? G3 : MUTED }}
                  >
                    {pm.id === 'wallet' ? 'Wallet' : pm.id === 'card' ? 'Card' : 'Cash'}
                  </p>
                  {pm.balance && (
                    <p className="text-[10px]" style={{ fontFamily: IT, color: G2 }}>
                      {pm.balance}
                    </p>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Price breakdown */}
          <div
            className="mb-5 rounded-2xl p-4"
            style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
          >
            <p className="mb-3 text-[13px] font-semibold" style={{ fontFamily: PP, color: MUTED }}>
              PRICE BREAKDOWN
            </p>
            {[
              ['Base fare', estimate ? naira(estimate.baseFare) : '—'],
              [`Distance (${kmLabel} km)`, estimate ? naira(estimate.distanceFare) : '—'],
              ['Time fee', estimate ? naira(estimate.timeFare) : '—'],
              ['Promo applied', estimate ? `−${naira(estimate.promoDiscount)}` : '−₦0'],
            ].map(([l, v]) => (
              <div key={l} className="mb-2 flex items-center justify-between">
                <p className="text-[13px]" style={{ fontFamily: IT, color: TEXT_SECONDARY }}>
                  {l}
                </p>
                <p className="text-[13px] font-medium" style={{ fontFamily: IT, color: '#fff' }}>
                  {v}
                </p>
              </div>
            ))}
            <div className="my-2 h-px" style={{ background: BORDER }} />
            <div className="flex items-center justify-between">
              <p className="text-[14px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
                Total
              </p>
              <p className="text-[18px] font-bold" style={{ fontFamily: PP, color: G3 }}>
                {fareLabel}
              </p>
            </div>
          </div>

          {error && (
            <p
              className="mb-3 text-center text-[12px]"
              style={{ fontFamily: IT, color: COLOR_ERROR }}
            >
              {error}
            </p>
          )}

          <GreenButton
            label={booking ? 'Booking…' : `Book Economy · ${fareLabel}`}
            onClick={handleBook}
          />

          <p className="mt-3 text-center text-[11px]" style={{ fontFamily: IT, color: MUTED }}>
            Price may vary with traffic · Ride protected by DrippleX Safe
          </p>
        </div>
      </BottomSheet>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RIDE-005 — FINDING DRIVER
// ─────────────────────────────────────────────────────────────────────────────
export function FindingDriverScreen({
  onBack,
  onFound,
  rideId,
}: {
  onBack: () => void;
  onFound: (ride: RideDto) => void;
  rideId?: string;
}) {
  const [dots, setDots] = useState(1);
  const [eta, setEta] = useState(8);
  const foundRef = useRef(false);

  useEffect(() => {
    const d = setInterval(() => setDots((p) => (p === 3 ? 1 : p + 1)), 500);
    const c = setInterval(() => setEta((p) => Math.max(1, p - 1)), 1000);
    return () => {
      clearInterval(d);
      clearInterval(c);
    };
  }, []);

  // Poll the real ride until a driver is assigned; ws gives us the fast path.
  useEffect(() => {
    if (!rideId) return;
    const settle = (ride: RideDto) => {
      if (foundRef.current) return;
      const assigned =
        !!ride.driverId ||
        ['DRIVER_ASSIGNED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED'].includes(ride.status);
      if (assigned) {
        foundRef.current = true;
        onFound(ride);
      }
    };
    ws.joinRide(rideId);
    const offStatus = ws.onRideStatus(() => {
      api.rides
        .get(rideId)
        .then(settle)
        .catch(() => {});
    });
    const poll = setInterval(() => {
      api.rides
        .get(rideId)
        .then(settle)
        .catch(() => {});
    }, 3000);
    api.rides
      .get(rideId)
      .then(settle)
      .catch(() => {});
    return () => {
      clearInterval(poll);
      offStatus();
    };
  }, [rideId, onFound]);

  const handleCancel = async () => {
    try {
      if (rideId) await api.rides.cancel(rideId);
    } catch {
      /* leave anyway */
    }
    onBack();
  };

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: NAVY_DEEP }}
    >
      <div className="relative flex-shrink-0" style={{ height: 280 }}>
        <MapCanvas variant="finding" />
        <div className="absolute inset-0">
          <RideStatusBar />
          <div className="mt-3 px-5">
            <BackArrow onClick={onBack} />
          </div>
        </div>
        {/* Pulse ring animation */}
        <div className="absolute left-1/2 -translate-x-1/2" style={{ top: 110 }}>
          <div
            className="relative flex items-center justify-center"
            style={{ width: 80, height: 80 }}
          >
            <div
              className="absolute h-20 w-20 rounded-full"
              style={{
                background: 'rgba(43,172,82,.08)',
                animation: 'pulse-ring 1.4s ease-out infinite',
              }}
            />
            <div
              className="absolute h-16 w-16 rounded-full"
              style={{
                background: 'rgba(43,172,82,.12)',
                animation: 'pulse-ring 1.4s ease-out infinite .3s',
              }}
            />
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full text-2xl"
              style={{ background: G2, boxShadow: `0 0 32px rgba(43,172,82,.5)` }}
            >
              🚗
            </div>
          </div>
        </div>
      </div>

      <BottomSheet peek>
        <div className="flex flex-col items-center gap-5 px-5 pb-8 pt-2">
          <div className="text-center">
            <p className="mb-1 text-[20px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
              Finding your driver{'.'.repeat(dots)}
            </p>
            <p className="text-[14px]" style={{ fontFamily: IT, color: MUTED }}>
              Matching you with the best driver nearby
            </p>
          </div>

          {/* Searching indicators */}
          <div className="flex w-full gap-3">
            {[
              ['4', 'Drivers nearby'],
              ['~3 min', 'Est. pickup'],
              ['4.8★', 'Avg rating'],
            ].map(([v, l]) => (
              <div
                key={l}
                className="flex flex-1 flex-col items-center gap-1 rounded-2xl py-3"
                style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
              >
                <p className="text-[15px] font-bold" style={{ fontFamily: PP, color: G3 }}>
                  {v}
                </p>
                <p
                  className="text-center text-[11px] leading-tight"
                  style={{ fontFamily: IT, color: MUTED }}
                >
                  {l}
                </p>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div
            className="h-1.5 w-full overflow-hidden rounded-full"
            style={{ background: 'rgba(255,255,255,.06)' }}
          >
            <div
              className="h-full rounded-full"
              style={{ background: G2, animation: 'bar-fill 4s ease-in-out forwards' }}
            />
          </div>

          <button
            onClick={handleCancel}
            className="text-[14px] font-medium active:opacity-60"
            style={{ fontFamily: IT, color: MUTED }}
          >
            Cancel ride
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RIDE-006 — DRIVER ASSIGNED
// ─────────────────────────────────────────────────────────────────────────────
export function DriverAssignedScreen({
  onBack,
  onArrived,
  onCancel,
}: {
  onBack: () => void;
  onArrived: () => void;
  onCancel?: () => void;
}) {
  const [eta, setEta] = useState(3);

  useEffect(() => {
    const t = setInterval(() => setEta((p) => Math.max(0, p - 1)), 8000);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: NAVY_DEEP }}
    >
      <div className="relative flex-shrink-0" style={{ height: 300 }}>
        <MapCanvas variant="assigned" />
        <div className="absolute inset-0">
          <RideStatusBar />
          <div className="mt-3 flex items-start justify-between px-5">
            <BackArrow onClick={onBack} />
            <SafetyChip />
          </div>
        </div>
      </div>

      <BottomSheet peek>
        <div className="flex-1 overflow-y-auto px-5 pb-6 pt-2">
          {/* ETA banner */}
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
              <p className="text-[15px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
                Driver on the way
              </p>
              <p className="text-[13px]" style={{ fontFamily: IT, color: MUTED }}>
                Arriving in approximately {eta} min
              </p>
            </div>
            <div className="text-center">
              <p
                className="text-[22px] font-bold leading-none"
                style={{ fontFamily: PP, color: G3 }}
              >
                {eta}
              </p>
              <p className="text-[11px]" style={{ fontFamily: IT, color: MUTED }}>
                min
              </p>
            </div>
          </div>

          {/* Driver card */}
          <div
            className="mb-4 rounded-2xl p-4"
            style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
          >
            <div className="mb-4 flex items-center gap-4">
              <div
                className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl text-xl font-bold"
                style={{
                  background: `linear-gradient(135deg,${G0},${G2})`,
                  color: '#fff',
                  fontFamily: PP,
                }}
              >
                {DRIVER_DATA.avatar}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-[16px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
                    {DRIVER_DATA.name}
                  </p>
                  {DRIVER_DATA.verified && (
                    <div
                      className="flex h-4 w-4 items-center justify-center rounded-full"
                      style={{ background: G2 }}
                    >
                      <svg
                        width="8"
                        height="8"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#fff"
                        strokeWidth="3"
                        strokeLinecap="round"
                      >
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <span style={{ color: COLOR_STAR, fontSize: 13 }}>★</span>
                  <span
                    className="text-[13px] font-medium"
                    style={{ fontFamily: IT, color: '#fff' }}
                  >
                    {DRIVER_DATA.rating}
                  </span>
                  <span className="text-[13px]" style={{ fontFamily: IT, color: MUTED }}>
                    · {DRIVER_DATA.trips.toLocaleString()} trips
                  </span>
                </div>
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                  style={{ background: 'rgba(251,191,36,.1)', color: '#FBBF24', fontFamily: IT }}
                >
                  {DRIVER_DATA.level}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 border-t pt-3" style={{ borderColor: BORDER }}>
              {[
                ['🚗 Vehicle', DRIVER_DATA.vehicle],
                ['🔢 Plate', DRIVER_DATA.plate],
              ].map(([l, v]) => (
                <div key={l}>
                  <p className="mb-0.5 text-[11px]" style={{ fontFamily: IT, color: MUTED }}>
                    {l}
                  </p>
                  <p className="text-[13px] font-medium" style={{ fontFamily: IT, color: '#fff' }}>
                    {v}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="mb-4 flex gap-3">
            <button
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl font-semibold transition-all active:scale-[.97]"
              style={{
                background: NAVY_SURFACE,
                border: `1px solid ${BORDER}`,
                fontFamily: IT,
                fontSize: 14,
                color: '#fff',
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke={G2}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 014.95 13 19.79 19.79 0 011.87 4.4 2 2 0 013.86 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
              </svg>
              Call Driver
            </button>
            <button
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl font-semibold transition-all active:scale-[.97]"
              style={{
                background: NAVY_SURFACE,
                border: `1px solid ${BORDER}`,
                fontFamily: IT,
                fontSize: 14,
                color: '#fff',
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke={G2}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
              Message
            </button>
            <button
              onClick={onCancel}
              className="flex h-12 items-center justify-center rounded-2xl px-4 transition-all active:scale-[.97]"
              style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)' }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#EF4444"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M4.93 4.93l14.14 14.14" />
              </svg>
            </button>
          </div>

          <button
            onClick={onArrived}
            className="flex h-12 w-full items-center justify-center rounded-2xl text-sm font-medium transition-all active:scale-[.97]"
            style={{
              background: NAVY_SURFACE,
              border: `1px solid ${BORDER}`,
              fontFamily: IT,
              color: TEXT_SECONDARY,
            }}
          >
            Simulate: Driver Arrived →
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RIDE-007 — DRIVER ARRIVED
// ─────────────────────────────────────────────────────────────────────────────
export function DriverArrivedScreen({
  onBack,
  onStart,
  onShare,
}: {
  onBack: () => void;
  onStart: () => void;
  onShare?: () => void;
}) {
  const [pulse, setPulse] = useState(true);
  useEffect(() => {
    const t = setInterval(() => setPulse((p) => !p), 1200);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: NAVY_DEEP }}
    >
      <div className="relative flex-shrink-0" style={{ height: 260 }}>
        <MapCanvas variant="arrived" />
        <div className="absolute inset-0">
          <RideStatusBar />
          <div className="mt-3 flex justify-between px-5">
            <BackArrow onClick={onBack} />
            <SafetyChip />
          </div>
        </div>
      </div>

      <BottomSheet peek>
        <div className="flex flex-col gap-4 px-5 pb-8 pt-2">
          {/* Arrived banner */}
          <div
            className="flex items-center gap-4 rounded-2xl p-4"
            style={{
              background: 'rgba(43,172,82,.08)',
              border: `1.5px solid ${pulse ? 'rgba(43,172,82,.4)' : 'rgba(43,172,82,.2)'}`,
              transition: 'border-color .6s',
            }}
          >
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full text-2xl"
              style={{
                background: G2,
                boxShadow: pulse ? `0 0 24px rgba(43,172,82,.5)` : 'none',
                transition: 'box-shadow .6s',
              }}
            >
              ✅
            </div>
            <div>
              <p className="text-[16px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
                Your driver has arrived!
              </p>
              <p className="text-[13px]" style={{ fontFamily: IT, color: MUTED }}>
                Look for a white Toyota Camry · {DRIVER_DATA.plate}
              </p>
            </div>
          </div>

          {/* Driver mini card */}
          <div
            className="flex items-center gap-3 rounded-2xl p-3"
            style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
          >
            <div
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl text-lg font-bold"
              style={{
                background: `linear-gradient(135deg,${G0},${G2})`,
                color: '#fff',
                fontFamily: PP,
              }}
            >
              {DRIVER_DATA.avatar}
            </div>
            <div className="flex-1">
              <p className="text-[14px] font-semibold" style={{ fontFamily: PP, color: '#fff' }}>
                {DRIVER_DATA.name}
              </p>
              <div className="flex items-center gap-1">
                <span style={{ color: COLOR_STAR, fontSize: 12 }}>★</span>
                <span className="text-[12px]" style={{ fontFamily: IT, color: MUTED }}>
                  {DRIVER_DATA.rating} · {DRIVER_DATA.vehicle}
                </span>
              </div>
            </div>
            <button
              className="flex h-10 w-10 items-center justify-center rounded-2xl"
              style={{ background: 'rgba(43,172,82,.12)', border: '1px solid rgba(43,172,82,.2)' }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke={G2}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 014.95 13 19.79 19.79 0 011.87 4.4 2 2 0 013.86 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
              </svg>
            </button>
          </div>

          {/* Share trip */}
          <button
            onClick={onShare}
            className="flex items-center gap-3 rounded-2xl p-3.5 transition-all active:scale-[.97]"
            style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke={G2}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
            </svg>
            <div className="flex-1 text-left">
              <p className="text-[14px] font-medium" style={{ fontFamily: PP, color: '#fff' }}>
                Share trip with family
              </p>
              <p className="text-[12px]" style={{ fontFamily: IT, color: MUTED }}>
                Let someone track your ride
              </p>
            </div>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke={MUTED}
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>

          <GreenButton label="Start Trip →" onClick={onStart} />
        </div>
      </BottomSheet>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RIDE-008 — RIDE IN PROGRESS
// ─────────────────────────────────────────────────────────────────────────────
export function RideInProgressScreen({
  onBack,
  onComplete,
  onSOS,
}: {
  onBack: () => void;
  onComplete: () => void;
  onSOS?: () => void;
}) {
  const [progress, setProgress] = useState(0.15);
  const [elapsed, setElapsed] = useState(0);
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
      setElapsed((e) => e + 1);
    }, 1200);
    return () => clearInterval(t);
  }, []);

  const remaining = Math.max(0, Math.round(22 * (1 - progress)));
  const distLeft = (14 * (1 - progress)).toFixed(1);

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: NAVY_DEEP }}
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
          {/* Progress bar */}
          <div className="mb-4">
            <div className="mb-2 flex justify-between">
              <p className="text-[13px] font-medium" style={{ fontFamily: IT, color: MUTED }}>
                Trip progress
              </p>
              <p className="text-[13px] font-semibold" style={{ fontFamily: IT, color: G3 }}>
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
                  background: `linear-gradient(90deg,${G0},${G3})`,
                }}
              />
            </div>
          </div>

          {/* Stats row */}
          <div className="mb-4 flex gap-2">
            {[
              { v: `${remaining}`, u: 'min left', icon: '⏱' },
              { v: distLeft, u: 'km left', icon: '📍' },
              { v: '₦2,100', u: 'fare', icon: '💳' },
            ].map((s) => (
              <div
                key={s.u}
                className="flex flex-1 flex-col items-center gap-1 rounded-2xl py-3"
                style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
              >
                <span style={{ fontSize: 18 }}>{s.icon}</span>
                <p className="text-[15px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
                  {s.v}
                </p>
                <p className="text-[11px]" style={{ fontFamily: IT, color: MUTED }}>
                  {s.u}
                </p>
              </div>
            ))}
          </div>

          {/* Driver row */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="mb-3 flex w-full items-center gap-3 rounded-2xl p-3 transition-all"
            style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
          >
            <div
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-sm font-bold"
              style={{
                background: `linear-gradient(135deg,${G0},${G2})`,
                color: '#fff',
                fontFamily: PP,
              }}
            >
              {DRIVER_DATA.avatar}
            </div>
            <div className="flex-1 text-left">
              <p className="text-[13px] font-semibold" style={{ fontFamily: PP, color: '#fff' }}>
                {DRIVER_DATA.name}
              </p>
              <p className="text-[12px]" style={{ fontFamily: IT, color: MUTED }}>
                {DRIVER_DATA.plate} · {DRIVER_DATA.vehicle}
              </p>
            </div>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke={MUTED}
              strokeWidth="2"
              strokeLinecap="round"
              style={{
                transform: expanded ? 'rotate(180deg)' : 'none',
                transition: 'transform .2s',
              }}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {expanded && (
            <div className="mb-3 flex gap-2">
              {[
                { label: 'Call', icon: '📞', fn: undefined },
                { label: 'Message', icon: '💬', fn: undefined },
                { label: 'Emergency', icon: '🆘', fn: onSOS },
              ].map((a) => (
                <button
                  key={a.label}
                  onClick={a.fn}
                  className="flex flex-1 flex-col items-center gap-1 rounded-xl py-2.5 transition-all active:scale-[.95]"
                  style={{
                    background: NAVY_CARD,
                    border: `1px solid ${BORDER}`,
                    fontFamily: IT,
                    fontSize: 12,
                    color: TEXT_SECONDARY,
                  }}
                >
                  <span>{a.icon}</span>
                  {a.label}
                </button>
              ))}
            </div>
          )}

          {/* Route */}
          <div
            className="flex items-center gap-2 rounded-2xl p-3"
            style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
          >
            <div className="flex flex-col items-center gap-1">
              <div className="h-2 w-2 rounded-full" style={{ background: G2 }} />
              <div className="h-8 w-px" style={{ background: BORDER }} />
              <div className="h-2 w-2 rounded-full" style={{ background: '#EF4444' }} />
            </div>
            <div className="flex-1">
              <p className="mb-2 text-[12px]" style={{ fontFamily: IT, color: TEXT_SECONDARY }}>
                Ikeja GRA, Lagos
              </p>
              <p className="text-[12px]" style={{ fontFamily: IT, color: TEXT_SECONDARY }}>
                Victoria Island, Lagos
              </p>
            </div>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RIDE-009 — TRIP COMPLETED
// ─────────────────────────────────────────────────────────────────────────────
export function TripCompletedScreen({
  onRate,
  onHome,
}: {
  onRate: () => void;
  onHome: () => void;
}) {
  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: NAVY_DEEP }}
    >
      <RideStatusBar />
      <div
        className="flex flex-1 flex-col items-center justify-center gap-6 px-5"
        style={{ animation: 'fade-up .5s ease both' }}
      >
        {/* Success icon */}
        <div
          className="relative flex items-center justify-center"
          style={{ width: 120, height: 120 }}
        >
          <div
            className="absolute inset-0 rounded-full"
            style={{ background: 'rgba(43,172,82,.08)' }}
          />
          <div
            className="flex h-24 w-24 items-center justify-center rounded-full text-5xl"
            style={{
              background: `linear-gradient(135deg,${G0},${G2})`,
              boxShadow: `0 0 60px rgba(43,172,82,.35)`,
              animation: 'success-bounce .6s ease both',
            }}
          >
            🏁
          </div>
        </div>

        <div className="text-center">
          <p
            className="mb-1 text-[10px] font-bold tracking-widest"
            style={{ fontFamily: IT, color: G3 }}
          >
            TRIP COMPLETED
          </p>
          <p className="mb-2 text-[26px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
            You have arrived!
          </p>
          <p className="text-[14px]" style={{ fontFamily: IT, color: MUTED }}>
            Victoria Island, Lagos
          </p>
        </div>

        {/* Receipt card */}
        <div
          className="w-full overflow-hidden rounded-3xl"
          style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
        >
          <div className="border-b px-5 py-4" style={{ borderColor: BORDER }}>
            <p className="mb-3 text-[13px] font-semibold" style={{ fontFamily: PP, color: MUTED }}>
              TRIP SUMMARY
            </p>
            {[
              ['Duration', '22 min'],
              ['Distance', '14.2 km'],
              ['Route', 'Ikeja GRA → Victoria Island'],
              ['Driver', DRIVER_DATA.name],
              ['Vehicle', `${DRIVER_DATA.vehicle} · ${DRIVER_DATA.plate}`],
            ].map(([l, v]) => (
              <div key={l} className="mb-2.5 flex items-start justify-between">
                <p className="text-[13px]" style={{ fontFamily: IT, color: MUTED }}>
                  {l}
                </p>
                <p
                  className="max-w-[55%] text-right text-[13px] font-medium"
                  style={{ fontFamily: IT, color: '#fff' }}
                >
                  {v}
                </p>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between px-5 py-4">
            <p className="text-[15px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
              Total Charged
            </p>
            <div className="text-right">
              <p className="text-[22px] font-bold" style={{ fontFamily: PP, color: G3 }}>
                ₦2,100
              </p>
              <p className="text-[11px]" style={{ fontFamily: IT, color: MUTED }}>
                DrippleX Wallet
              </p>
            </div>
          </div>
        </div>

        {/* Safety rating prompt */}
        <div className="flex w-full flex-col gap-3">
          <GreenButton label="Rate Your Ride ★" onClick={onRate} />
          <button
            onClick={onHome}
            className="flex h-12 w-full items-center justify-center rounded-2xl text-[14px] font-medium transition-all active:scale-[.97]"
            style={{
              background: NAVY_SURFACE,
              border: `1px solid ${BORDER}`,
              fontFamily: IT,
              color: TEXT_SECONDARY,
            }}
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RIDE-010 — RATE DRIVER
// ─────────────────────────────────────────────────────────────────────────────
export function RateDriverScreen({
  onBack,
  onSubmit,
  rideId,
}: {
  onBack: () => void;
  onSubmit: () => void;
  rideId?: string;
}) {
  const [stars, setStars] = useState(5);
  const [tags, setTags] = useState<string[]>(['Safe driving', 'Friendly']);
  const [comment, setComment] = useState('');
  const [tip, setTip] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

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
  const TIPS = [200, 500, 1000];

  const toggleTag = (t: string) =>
    setTags((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));

  const handleSubmit = () => {
    setSubmitted(true);
    if (rideId) {
      const comboComment = [comment, ...tags].filter(Boolean).join(' · ');
      api.rides
        .rateDriver(rideId, { rating: stars, comment: comboComment || undefined })
        .catch(() => {});
      if (tip) api.rides.tip(rideId, tip).catch(() => {});
    }
    setTimeout(onSubmit, 1600);
  };

  if (submitted)
    return (
      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-5"
        style={{ background: NAVY_BASE }}
      >
        <div
          className="flex h-20 w-20 items-center justify-center rounded-full text-4xl"
          style={{
            background: `linear-gradient(135deg,${G0},${G2})`,
            boxShadow: `0 0 40px rgba(43,172,82,.35)`,
            animation: 'success-bounce .5s ease both',
          }}
        >
          🙌
        </div>
        <p className="text-center text-[20px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
          Thanks for the feedback!
        </p>
        <p className="text-center text-[14px]" style={{ fontFamily: IT, color: MUTED }}>
          Your rating helps improve DrippleX Ride for everyone
        </p>
      </div>
    );

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: NAVY_BASE }}
    >
      <RideStatusBar />
      <div className="flex-1 overflow-y-auto px-5 pb-6">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3 pt-3">
          <BackArrow onClick={onBack} />
          <p className="text-[17px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
            Rate Your Ride
          </p>
        </div>

        {/* Driver */}
        <div className="mb-6 flex flex-col items-center">
          <div
            className="mb-3 flex h-20 w-20 items-center justify-center rounded-3xl text-2xl font-bold"
            style={{
              background: `linear-gradient(135deg,${G0},${G2})`,
              color: '#fff',
              fontFamily: PP,
              boxShadow: `0 8px 32px rgba(43,172,82,.3)`,
            }}
          >
            {DRIVER_DATA.avatar}
          </div>
          <p className="mb-0.5 text-[18px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
            {DRIVER_DATA.name}
          </p>
          <p className="text-[13px]" style={{ fontFamily: IT, color: MUTED }}>
            {DRIVER_DATA.vehicle}
          </p>
        </div>

        {/* Stars */}
        <div className="mb-6 flex flex-col items-center gap-3">
          <StarRow value={stars} onChange={setStars} />
          <p className="text-[14px] font-medium" style={{ fontFamily: IT, color: TEXT_SECONDARY }}>
            {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent!'][stars]}
          </p>
        </div>

        {/* Tags */}
        <div className="mb-5">
          <p className="mb-3 text-[13px] font-semibold" style={{ fontFamily: PP, color: MUTED }}>
            WHAT STOOD OUT?
          </p>
          <div className="flex flex-wrap gap-2">
            {ALL_TAGS.map((t) => (
              <button
                key={t}
                onClick={() => toggleTag(t)}
                className="rounded-full px-3 py-1.5 text-[12px] font-medium transition-all active:scale-[.95]"
                style={{
                  background: tags.includes(t) ? 'rgba(43,172,82,.15)' : NAVY_SURFACE,
                  border: `1px solid ${tags.includes(t) ? 'rgba(43,172,82,.4)' : BORDER}`,
                  color: tags.includes(t) ? G3 : TEXT_SECONDARY,
                  fontFamily: IT,
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Tip */}
        <div className="mb-5">
          <p className="mb-3 text-[13px] font-semibold" style={{ fontFamily: PP, color: MUTED }}>
            ADD A TIP (OPTIONAL)
          </p>
          <div className="flex gap-2">
            {TIPS.map((t) => (
              <button
                key={t}
                onClick={() => setTip(tip === t ? null : t)}
                className="flex-1 rounded-2xl py-3 text-[14px] font-semibold transition-all active:scale-[.95]"
                style={{
                  background: tip === t ? 'rgba(43,172,82,.12)' : NAVY_SURFACE,
                  border: `1px solid ${tip === t ? 'rgba(43,172,82,.35)' : BORDER}`,
                  color: tip === t ? G3 : TEXT_SECONDARY,
                  fontFamily: PP,
                }}
              >
                ₦{t.toLocaleString()}
              </button>
            ))}
          </div>
        </div>

        {/* Comment */}
        <div className="mb-6">
          <p className="mb-2 text-[13px] font-semibold" style={{ fontFamily: PP, color: MUTED }}>
            ADD A COMMENT
          </p>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Tell us about your experience..."
            rows={3}
            className="w-full resize-none rounded-2xl px-4 py-3 outline-none"
            style={{
              background: NAVY_SURFACE,
              border: `1px solid ${BORDER}`,
              fontFamily: IT,
              fontSize: 14,
              color: '#fff',
            }}
          />
        </div>

        <GreenButton
          label={tip ? `Submit & Tip ₦${tip.toLocaleString()}` : 'Submit Rating'}
          onClick={handleSubmit}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RIDE-011 — RIDE HISTORY
// ─────────────────────────────────────────────────────────────────────────────
export function RideHistoryScreen({
  onBack,
  onDetail,
}: {
  onBack: () => void;
  onDetail: (id: string) => void;
}) {
  const [tab, setTab] = useState<'all' | 'completed' | 'cancelled'>('all');

  const filtered = tab === 'all' ? RIDE_HISTORY : RIDE_HISTORY.filter((r) => r.status === tab);

  const totalSpent = RIDE_HISTORY.filter((r) => r.status === 'completed').reduce(
    (sum, r) => sum + parseInt(r.amount.replace(/[₦,]/g, '')),
    0,
  );

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: NAVY_BASE }}
    >
      <RideStatusBar />

      <div className="flex-shrink-0 px-5 pb-4 pt-3">
        <div className="mb-4 flex items-center gap-3">
          <BackArrow onClick={onBack} />
          <p className="text-[17px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
            Ride History
          </p>
        </div>

        {/* Summary card */}
        <div
          className="mb-4 flex gap-3 rounded-2xl p-4"
          style={{ background: 'rgba(43,172,82,.06)', border: '1px solid rgba(43,172,82,.15)' }}
        >
          {[
            {
              v: RIDE_HISTORY.filter((r) => r.status === 'completed').length.toString(),
              l: 'Completed',
            },
            { v: `₦${totalSpent.toLocaleString()}`, l: 'Total Spent' },
            { v: '4.6★', l: 'Avg Rating' },
          ].map((s) => (
            <div key={s.l} className="flex-1 text-center">
              <p className="text-[16px] font-bold" style={{ fontFamily: PP, color: G3 }}>
                {s.v}
              </p>
              <p className="text-[11px]" style={{ fontFamily: IT, color: MUTED }}>
                {s.l}
              </p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {(['all', 'completed', 'cancelled'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="h-9 flex-1 rounded-xl text-[12px] font-semibold capitalize transition-all"
              style={{
                background: tab === t ? G2 : NAVY_SURFACE,
                color: tab === t ? '#fff' : MUTED,
                fontFamily: IT,
                boxShadow: tab === t ? `0 4px 16px rgba(43,172,82,.3)` : 'none',
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
            className="w-full rounded-2xl p-4 text-left transition-all active:scale-[.98]"
            style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
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
                    style={{ fontFamily: PP, color: '#fff' }}
                  >
                    {ride.type} Ride
                  </p>
                  <p className="text-[11px]" style={{ fontFamily: IT, color: MUTED }}>
                    {ride.date}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p
                  className="text-[15px] font-bold"
                  style={{ fontFamily: PP, color: ride.status === 'completed' ? '#fff' : MUTED }}
                >
                  {ride.amount}
                </p>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold`}
                  style={{
                    background:
                      ride.status === 'completed' ? 'rgba(43,172,82,.12)' : 'rgba(239,68,68,.1)',
                    color: ride.status === 'completed' ? G3 : COLOR_ERROR,
                    fontFamily: IT,
                  }}
                >
                  {ride.status.toUpperCase()}
                </span>
              </div>
            </div>

            <div className="mb-2 flex items-center gap-2">
              <div className="flex flex-col items-center gap-1">
                <div className="h-1.5 w-1.5 rounded-full" style={{ background: G2 }} />
                <div className="h-4 w-px" style={{ background: BORDER }} />
                <div className="h-1.5 w-1.5 rounded-full" style={{ background: '#EF4444' }} />
              </div>
              <div className="flex-1">
                <p className="mb-1 text-[12px]" style={{ fontFamily: IT, color: TEXT_SECONDARY }}>
                  {ride.from}
                </p>
                <p className="text-[12px]" style={{ fontFamily: IT, color: TEXT_SECONDARY }}>
                  {ride.to}
                </p>
              </div>
            </div>

            {ride.status === 'completed' && ride.rating > 0 && (
              <div
                className="flex items-center gap-1 border-t pt-2"
                style={{ borderColor: BORDER }}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <span
                    key={n}
                    style={{
                      fontSize: 12,
                      filter: n <= ride.rating ? 'none' : 'grayscale(1) opacity(.3)',
                    }}
                  >
                    ⭐
                  </span>
                ))}
                <span className="ml-1 text-[11px]" style={{ fontFamily: IT, color: MUTED }}>
                  {ride.driver}
                </span>
              </div>
            )}
          </button>
        ))}

        {filtered.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-12">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full text-3xl"
              style={{ background: NAVY_SURFACE }}
            >
              🚗
            </div>
            <p className="text-[15px] font-semibold" style={{ fontFamily: PP, color: '#fff' }}>
              No rides here
            </p>
            <p className="text-[13px]" style={{ fontFamily: IT, color: MUTED }}>
              Your {tab} rides will appear here
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RIDE-012 — RIDE DETAILS
// ─────────────────────────────────────────────────────────────────────────────
export function RideDetailScreen({
  onBack,
  rideId,
  onRebook,
  onReport,
}: {
  onBack: () => void;
  rideId?: string;
  onRebook?: () => void;
  onReport?: () => void;
}) {
  const ride = RIDE_HISTORY.find((r) => r.id === rideId) || RIDE_HISTORY[0];
  const [shareVisible, setShareVisible] = useState(false);

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: NAVY_BASE }}
    >
      <RideStatusBar />

      {/* Map snippet */}
      <div className="relative flex-shrink-0" style={{ height: 200 }}>
        <MapCanvas variant={ride.status === 'completed' ? 'complete' : 'default'} progress={1} />
        <div className="absolute inset-0">
          <div className="mt-[52px] flex items-center gap-3 px-5 pt-2">
            <BackArrow onClick={onBack} />
            <p className="text-[17px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
              Ride Details
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-6">
        {/* Status badge */}
        <div className="mb-4 flex items-center justify-between pt-4">
          <div>
            <p
              className="mb-0.5 text-[12px] font-semibold"
              style={{ fontFamily: IT, color: MUTED }}
            >
              {ride.date}
            </p>
            <p className="text-[11px]" style={{ fontFamily: IT, color: MUTED }}>
              ID: {ride.id}
            </p>
          </div>
          <span
            className="rounded-full px-3 py-1.5 text-[11px] font-bold"
            style={{
              background:
                ride.status === 'completed' ? 'rgba(43,172,82,.12)' : 'rgba(239,68,68,.1)',
              color: ride.status === 'completed' ? G3 : COLOR_ERROR,
              fontFamily: IT,
            }}
          >
            {ride.status.toUpperCase()}
          </span>
        </div>

        {/* Route card */}
        <div
          className="mb-4 rounded-2xl p-4"
          style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
        >
          <div className="mb-3 flex items-start gap-3">
            <div className="flex flex-shrink-0 flex-col items-center gap-1 pt-1">
              <div className="h-2.5 w-2.5 rounded-full" style={{ background: G2 }} />
              <div className="h-6 w-px" style={{ background: BORDER }} />
              <div className="h-2.5 w-2.5 rounded-full" style={{ background: '#EF4444' }} />
            </div>
            <div className="flex-1">
              <div className="mb-3">
                <p className="mb-0.5 text-[11px]" style={{ fontFamily: IT, color: MUTED }}>
                  PICKUP
                </p>
                <p className="text-[14px] font-semibold" style={{ fontFamily: PP, color: '#fff' }}>
                  {ride.from}
                </p>
              </div>
              <div>
                <p className="mb-0.5 text-[11px]" style={{ fontFamily: IT, color: MUTED }}>
                  DROP-OFF
                </p>
                <p className="text-[14px] font-semibold" style={{ fontFamily: PP, color: '#fff' }}>
                  {ride.to}
                </p>
              </div>
            </div>
          </div>
          <div className="flex gap-3 border-t pt-3" style={{ borderColor: BORDER }}>
            {[
              ['22 min', 'Duration'],
              ['14.2 km', 'Distance'],
              [ride.type, 'Ride Type'],
            ].map(([v, l]) => (
              <div key={l} className="flex-1 text-center">
                <p className="text-[13px] font-bold" style={{ fontFamily: PP, color: G3 }}>
                  {v}
                </p>
                <p className="text-[11px]" style={{ fontFamily: IT, color: MUTED }}>
                  {l}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Driver card */}
        {ride.status === 'completed' && (
          <div
            className="mb-4 rounded-2xl p-4"
            style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
          >
            <p className="mb-3 text-[12px] font-semibold" style={{ fontFamily: PP, color: MUTED }}>
              DRIVER
            </p>
            <div className="flex items-center gap-3">
              <div
                className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl text-lg font-bold"
                style={{
                  background: `linear-gradient(135deg,${G0},${G2})`,
                  color: '#fff',
                  fontFamily: PP,
                }}
              >
                {DRIVER_DATA.avatar}
              </div>
              <div className="flex-1">
                <p className="text-[14px] font-semibold" style={{ fontFamily: PP, color: '#fff' }}>
                  {ride.driver}
                </p>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span
                      key={n}
                      style={{
                        fontSize: 11,
                        filter: n <= ride.rating ? 'none' : 'grayscale(1) opacity(.3)',
                      }}
                    >
                      ⭐
                    </span>
                  ))}
                  <span className="ml-1 text-[12px]" style={{ fontFamily: IT, color: MUTED }}>
                    You rated
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Payment */}
        <div
          className="mb-4 rounded-2xl p-4"
          style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
        >
          <p className="mb-3 text-[12px] font-semibold" style={{ fontFamily: PP, color: MUTED }}>
            PAYMENT
          </p>
          {[
            ['Base fare', '₦800'],
            ['Distance', '₦1,120'],
            ['Time fee', '₦180'],
          ].map(([l, v]) => (
            <div key={l} className="mb-2 flex justify-between">
              <p className="text-[13px]" style={{ fontFamily: IT, color: TEXT_SECONDARY }}>
                {l}
              </p>
              <p className="text-[13px]" style={{ fontFamily: IT, color: '#fff' }}>
                {v}
              </p>
            </div>
          ))}
          <div className="my-2 h-px" style={{ background: BORDER }} />
          <div className="flex justify-between">
            <p className="text-[14px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
              Total
            </p>
            <p className="text-[16px] font-bold" style={{ fontFamily: PP, color: G3 }}>
              {ride.amount}
            </p>
          </div>
          <p className="mt-1 text-[11px]" style={{ fontFamily: IT, color: MUTED }}>
            Paid via DrippleX Wallet
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2.5">
          <button
            onClick={onRebook}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-[14px] font-medium transition-all active:scale-[.97]"
            style={{
              background: NAVY_SURFACE,
              border: `1px solid ${BORDER}`,
              fontFamily: IT,
              color: TEXT_SECONDARY,
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            Book same route again
          </button>
          <button
            onClick={onReport}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-[14px] font-medium transition-all active:scale-[.97]"
            style={{
              background: 'rgba(239,68,68,.06)',
              border: '1px solid rgba(239,68,68,.12)',
              fontFamily: IT,
              color: '#EF4444',
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            Report an issue
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NEW SCREENS (appended)
// ─────────────────────────────────────────────────────────────────────────────

// 1. DriverProfileSheet
export function DriverProfileSheet({
  onBack,
  onCall,
  onMessage,
}: {
  onBack?: () => void;
  onCall?: () => void;
  onMessage?: () => void;
}) {
  const reviews = [
    { name: 'Tunde A.', text: 'Very professional, knew the city well. 10/10!' },
    { name: 'Ngozi F.', text: 'Smooth ride and very polite. Would book again.' },
    { name: 'Emeka R.', text: 'Clean car, punctual and friendly. Highly recommend.' },
  ];
  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{ background: NAVY_BASE, fontFamily: IT }}
    >
      <RideStatusBar />
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pb-4 pt-2">
        <BackArrow onClick={onBack || (() => {})} />
        <p style={{ fontFamily: PP, fontSize: 18, fontWeight: 700, color: '#fff' }}>
          Driver Profile
        </p>
      </div>
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        {/* Avatar + name card */}
        <div
          className="mx-5 mb-4 flex flex-col items-center rounded-2xl p-5"
          style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
        >
          <div
            className="mb-3 flex h-20 w-20 items-center justify-center rounded-full"
            style={{
              background: 'linear-gradient(135deg,#16a34a,#22c55e)',
              fontSize: 28,
              fontWeight: 700,
              color: '#fff',
              fontFamily: PP,
            }}
          >
            AO
          </div>
          <p style={{ fontFamily: PP, fontSize: 20, fontWeight: 700, color: '#fff' }}>
            Adeyemi Okafor
          </p>
          <div
            className="mt-1 rounded-full px-3 py-1"
            style={{ background: 'rgba(234,179,8,.15)', border: '1px solid rgba(234,179,8,.3)' }}
          >
            <p style={{ fontSize: 12, color: '#EAB308', fontFamily: PP, fontWeight: 600 }}>
              Gold Driver 🏅
            </p>
          </div>
          <div className="mt-2 flex items-center gap-1">
            <StarRow rating={4.92} size={14} />
            <p
              style={{
                fontSize: 13,
                color: '#fff',
                fontFamily: PP,
                fontWeight: 600,
                marginLeft: 4,
              }}
            >
              4.92
            </p>
          </div>
          {/* Stats row */}
          <div className="mt-4 flex w-full justify-around gap-4">
            {[
              ['3,847', 'Trips'],
              ['4 yrs', 'Experience'],
              ['Top 5%', 'Rating'],
            ].map(([v, l]) => (
              <div key={l} className="flex flex-col items-center">
                <p style={{ fontFamily: PP, fontSize: 16, fontWeight: 700, color: G3 }}>{v}</p>
                <p style={{ fontSize: 11, color: MUTED, fontFamily: IT }}>{l}</p>
              </div>
            ))}
          </div>
        </div>
        {/* Vehicle card */}
        <div
          className="mx-5 mb-4 rounded-2xl p-4"
          style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
        >
          <p
            style={{ fontSize: 11, fontFamily: PP, color: MUTED, fontWeight: 600, marginBottom: 8 }}
          >
            VEHICLE
          </p>
          <div className="flex items-center gap-3">
            <span style={{ fontSize: 28 }}>🚗</span>
            <div>
              <p style={{ fontFamily: PP, fontSize: 14, fontWeight: 600, color: '#fff' }}>
                Toyota Camry (White)
              </p>
              <p style={{ fontSize: 12, color: TEXT_SECONDARY, fontFamily: IT }}>LAG 482 KA</p>
            </div>
          </div>
        </div>
        {/* Verified badges */}
        <div className="mx-5 mb-4 flex gap-2">
          {['ID ✓', 'Background ✓', 'Licensed ✓'].map((b) => (
            <div
              key={b}
              className="rounded-full px-3 py-1.5"
              style={{ background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.25)' }}
            >
              <p style={{ fontSize: 11, color: G3, fontFamily: PP, fontWeight: 600 }}>{b}</p>
            </div>
          ))}
        </div>
        {/* Reviews */}
        <div className="mx-5 mb-6">
          <p
            style={{
              fontFamily: PP,
              fontSize: 13,
              fontWeight: 700,
              color: '#fff',
              marginBottom: 10,
            }}
          >
            Passenger Reviews
          </p>
          {reviews.map((r) => (
            <div
              key={r.name}
              className="mb-3 rounded-xl p-3"
              style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
            >
              <p
                style={{
                  fontSize: 12,
                  fontFamily: PP,
                  fontWeight: 600,
                  color: G3,
                  marginBottom: 2,
                }}
              >
                {r.name}
              </p>
              <p style={{ fontSize: 13, color: TEXT_SECONDARY, fontFamily: IT }}>{r.text}</p>
            </div>
          ))}
        </div>
      </div>
      {/* Buttons */}
      <div className="flex gap-3 px-5 pb-8 pt-3">
        <GreenButton label="📞 Call Driver" onClick={onCall || (() => {})} />
        <button
          className="h-12 flex-1 rounded-2xl text-[14px] font-medium transition-all active:scale-[.97]"
          style={{
            background: 'transparent',
            border: `1.5px solid ${BORDER}`,
            fontFamily: IT,
            color: TEXT_SECONDARY,
          }}
          onClick={onMessage || (() => {})}
        >
          💬 Message
        </button>
      </div>
    </div>
  );
}

// 2. PaymentScreen
export function PaymentScreen({
  onBack,
  onPay,
  onChangeMethod,
}: {
  onBack?: () => void;
  onPay?: () => void;
  onChangeMethod?: () => void;
}) {
  const [selected, setSelected] = useState('wallet');
  const [promo, setPromo] = useState('');
  const methods = [
    { id: 'wallet', icon: '💜', label: 'DrippleX Wallet', sub: 'Balance: ₦24,500' },
    { id: 'visa', icon: '💳', label: 'Visa Card', sub: '•••• 4821' },
    { id: 'cash', icon: '💵', label: 'Cash', sub: 'Pay driver directly' },
    { id: 'opay', icon: '🟢', label: 'OPay', sub: 'Link OPay account' },
  ];
  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{ background: NAVY_BASE, fontFamily: IT }}
    >
      <RideStatusBar />
      <div className="flex items-center gap-3 px-5 pb-4 pt-2">
        <BackArrow onClick={onBack || (() => {})} />
        <p style={{ fontFamily: PP, fontSize: 18, fontWeight: 700, color: '#fff' }}>
          Choose Payment
        </p>
      </div>
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        {/* Fare summary */}
        <div
          className="mx-5 mb-4 rounded-2xl p-4"
          style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
        >
          <p style={{ fontSize: 12, color: MUTED, fontFamily: IT }}>Ikeja → Victoria Island</p>
          <p style={{ fontFamily: PP, fontSize: 32, fontWeight: 800, color: G3, margin: '4px 0' }}>
            ₦2,100
          </p>
          <p style={{ fontSize: 12, color: TEXT_SECONDARY, fontFamily: IT }}>Economy • 14.2 km</p>
        </div>
        {/* Payment method list */}
        <div className="mx-5 mb-4">
          <p
            style={{
              fontSize: 11,
              fontFamily: PP,
              fontWeight: 600,
              color: MUTED,
              marginBottom: 10,
            }}
          >
            PAYMENT METHOD
          </p>
          {methods.map((m) => (
            <button
              key={m.id}
              className="mb-3 flex w-full items-center gap-3 rounded-2xl p-4 text-left transition-all active:scale-[.98]"
              style={{
                background: selected === m.id ? 'rgba(34,197,94,.08)' : NAVY_CARD,
                border: selected === m.id ? `1.5px solid ${G3}` : `1px solid ${BORDER}`,
              }}
              onClick={() => setSelected(m.id)}
            >
              <span style={{ fontSize: 22 }}>{m.icon}</span>
              <div className="flex-1">
                <p style={{ fontFamily: PP, fontSize: 14, fontWeight: 600, color: '#fff' }}>
                  {m.label}
                </p>
                <p style={{ fontSize: 12, color: TEXT_SECONDARY, fontFamily: IT }}>{m.sub}</p>
              </div>
              <div
                className="flex h-5 w-5 items-center justify-center rounded-full"
                style={{
                  border: selected === m.id ? 'none' : `2px solid ${BORDER}`,
                  background: selected === m.id ? G3 : 'transparent',
                }}
              >
                {selected === m.id && <div className="h-2.5 w-2.5 rounded-full bg-white" />}
              </div>
            </button>
          ))}
        </div>
        {/* Promo code */}
        <div className="mx-5 mb-4 flex gap-2">
          <input
            value={promo}
            onChange={(e) => setPromo(e.target.value)}
            placeholder="Promo code"
            className="flex-1 rounded-xl px-4 py-3 text-sm outline-none"
            style={{
              background: NAVY_SURFACE,
              border: `1px solid ${BORDER}`,
              color: '#fff',
              fontFamily: IT,
            }}
          />
          <button
            className="rounded-xl px-4 py-3 text-sm font-semibold"
            style={{
              background: 'rgba(34,197,94,.1)',
              color: G3,
              fontFamily: PP,
              border: `1px solid rgba(34,197,94,.25)`,
            }}
          >
            Apply
          </button>
        </div>
        {/* Total row */}
        <div
          className="mx-5 mb-4 flex items-center justify-between rounded-xl px-4 py-3"
          style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
        >
          <p style={{ fontFamily: PP, fontSize: 14, color: '#fff', fontWeight: 600 }}>Total</p>
          <p style={{ fontFamily: PP, fontSize: 18, fontWeight: 800, color: G3 }}>₦2,100</p>
        </div>
      </div>
      <div className="px-5 pb-8 pt-3">
        <GreenButton label="Confirm Payment" onClick={onPay || (() => {})} />
      </div>
    </div>
  );
}

// 3. OPayPaymentScreen
export function OPayPaymentScreen({
  onBack,
  onSuccess,
}: {
  onBack?: () => void;
  onSuccess?: () => void;
}) {
  const [pin, setPin] = useState('');
  const [state, setState] = useState<'input' | 'processing' | 'success'>('input');
  const handleNum = (d: string) => {
    if (pin.length < 6) setPin((p) => p + d);
  };
  const handleDel = () => setPin((p) => p.slice(0, -1));
  const handleSubmit = () => {
    if (pin.length === 6) {
      setState('processing');
      setTimeout(() => setState('success'), 2000);
    }
  };
  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{ background: NAVY_BASE, fontFamily: IT }}
    >
      <RideStatusBar />
      <div className="flex items-center gap-3 px-5 pb-4 pt-2">
        <BackArrow onClick={onBack || (() => {})} />
        <p style={{ fontFamily: PP, fontSize: 18, fontWeight: 700, color: '#00C853' }}>OPay</p>
      </div>
      {/* Step dots */}
      <div className="mb-6 flex justify-center gap-2">
        {['Enter', 'Verify', 'Done'].map((s, i) => (
          <div key={s} className="flex items-center gap-1">
            <div
              className="h-2 w-2 rounded-full"
              style={{
                background:
                  state === 'success'
                    ? G3
                    : i === 0
                      ? G3
                      : i === 1 && state !== 'input'
                        ? G3
                        : BORDER,
              }}
            />
            {i < 2 && <div className="h-px w-6" style={{ background: BORDER }} />}
          </div>
        ))}
      </div>
      {state === 'success' ? (
        <div className="flex flex-1 flex-col items-center justify-center px-5">
          <div
            className="mb-4 flex h-20 w-20 items-center justify-center rounded-full"
            style={{ background: 'rgba(34,197,94,.15)' }}
          >
            <span style={{ fontSize: 40 }}>✅</span>
          </div>
          <p
            style={{
              fontFamily: PP,
              fontSize: 24,
              fontWeight: 800,
              color: '#fff',
              marginBottom: 4,
            }}
          >
            ₦2,100 paid!
          </p>
          <p style={{ fontSize: 14, color: TEXT_SECONDARY, fontFamily: IT, marginBottom: 24 }}>
            Payment via OPay successful
          </p>
          <GreenButton label="Return to ride" onClick={onSuccess || (() => {})} />
        </div>
      ) : state === 'processing' ? (
        <div className="flex flex-1 flex-col items-center justify-center">
          <div
            className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-t-transparent"
            style={{ borderColor: `${G3} transparent transparent transparent` }}
          />
          <p style={{ fontFamily: PP, fontSize: 16, color: '#fff' }}>Connecting to OPay...</p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center px-5">
          <p style={{ fontSize: 13, color: TEXT_SECONDARY, fontFamily: IT, marginBottom: 6 }}>
            Phone: +234 801 234 5678
          </p>
          <p
            style={{
              fontFamily: PP,
              fontSize: 14,
              fontWeight: 600,
              color: '#fff',
              marginBottom: 16,
            }}
          >
            Enter your OPay PIN
          </p>
          {/* PIN dots */}
          <div className="mb-8 flex gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-4 w-4 rounded-full"
                style={{
                  background: i < pin.length ? G3 : NAVY_SURFACE,
                  border: `2px solid ${i < pin.length ? G3 : BORDER}`,
                }}
              />
            ))}
          </div>
          {/* Numpad */}
          <div className="grid w-full max-w-xs grid-cols-3 gap-3">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '⌫'].map((d) => (
              <button
                key={d}
                className="h-14 rounded-2xl text-xl font-semibold transition-all active:scale-95"
                style={{
                  background: NAVY_CARD,
                  border: `1px solid ${BORDER}`,
                  color: '#fff',
                  fontFamily: PP,
                }}
                onClick={() => (d === '⌫' ? handleDel() : handleNum(d))}
              >
                {d}
              </button>
            ))}
          </div>
          <button
            className="mt-6 h-12 w-full max-w-xs rounded-2xl text-sm font-semibold"
            style={{
              background: pin.length === 6 ? G3 : NAVY_SURFACE,
              color: pin.length === 6 ? '#0A1628' : MUTED,
              fontFamily: PP,
            }}
            onClick={handleSubmit}
          >
            Pay ₦2,100
          </button>
        </div>
      )}
    </div>
  );
}

// 4. CashPaymentScreen
export function CashPaymentScreen({
  onBack,
  onConfirm,
  rideId,
}: {
  onBack?: () => void;
  onConfirm?: () => void;
  rideId?: string;
}) {
  const [checked, setChecked] = useState(false);
  const [paying, setPaying] = useState(false);

  const handleConfirm = async () => {
    if (paying) return;
    setPaying(true);
    try {
      if (rideId) await api.rides.pay(rideId, { method: 'CASH' });
    } catch {
      /* proceed to confirmation either way */
    }
    setPaying(false);
    onConfirm?.();
  };
  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{ background: NAVY_BASE, fontFamily: IT }}
    >
      <RideStatusBar />
      <div className="flex items-center gap-3 px-5 pb-4 pt-2">
        <BackArrow onClick={onBack || (() => {})} />
        <p style={{ fontFamily: PP, fontSize: 18, fontWeight: 700, color: '#fff' }}>Cash Payment</p>
      </div>
      <div
        className="flex flex-1 flex-col items-center overflow-y-auto px-5"
        style={{ scrollbarWidth: 'none' }}
      >
        <span style={{ fontSize: 72, marginTop: 24, marginBottom: 16 }}>💵</span>
        {/* Instruction card */}
        <div
          className="mb-4 w-full rounded-2xl p-5"
          style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
        >
          <p
            style={{
              fontFamily: PP,
              fontSize: 15,
              fontWeight: 600,
              color: '#fff',
              textAlign: 'center',
              marginBottom: 12,
            }}
          >
            Have this amount ready
          </p>
          <p
            style={{
              fontFamily: PP,
              fontSize: 40,
              fontWeight: 800,
              color: '#F59E0B',
              textAlign: 'center',
              marginBottom: 4,
            }}
          >
            ₦2,100
          </p>
          <p style={{ fontSize: 12, color: TEXT_SECONDARY, fontFamily: IT, textAlign: 'center' }}>
            Pay your driver at the end of the trip
          </p>
        </div>
        {/* Tips */}
        <div
          className="mb-4 w-full rounded-2xl p-4"
          style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
        >
          <p
            style={{ fontSize: 11, fontFamily: PP, fontWeight: 600, color: MUTED, marginBottom: 8 }}
          >
            TIPS
          </p>
          {['Driver may not have change for large notes', 'Ask for receipt after payment'].map(
            (t) => (
              <div key={t} className="mb-2 flex items-start gap-2">
                <span style={{ color: '#F59E0B', fontSize: 14, marginTop: 1 }}>•</span>
                <p style={{ fontSize: 13, color: TEXT_SECONDARY, fontFamily: IT }}>{t}</p>
              </div>
            ),
          )}
        </div>
        {/* Checkbox */}
        <button
          className="mb-4 flex w-full items-center gap-3 rounded-2xl p-4 transition-all active:scale-[.98]"
          style={{
            background: checked ? 'rgba(34,197,94,.08)' : NAVY_CARD,
            border: checked ? `1.5px solid ${G3}` : `1px solid ${BORDER}`,
          }}
          onClick={() => setChecked(!checked)}
        >
          <div
            className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded"
            style={{
              background: checked ? G3 : 'transparent',
              border: checked ? 'none' : `2px solid ${BORDER}`,
            }}
          >
            {checked && (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <polyline
                  points="2,6 5,9 10,3"
                  stroke="#0A1628"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </div>
          <p style={{ fontSize: 14, fontFamily: IT, color: '#fff' }}>I have the exact amount</p>
        </button>
        <p
          style={{
            fontSize: 11,
            color: MUTED,
            fontFamily: IT,
            textAlign: 'center',
            marginBottom: 12,
          }}
        >
          Cash rides are not refundable
        </p>
      </div>
      <div className="px-5 pb-8 pt-3">
        <GreenButton label={paying ? 'Confirming…' : 'Confirm Cash Ride'} onClick={handleConfirm} />
      </div>
    </div>
  );
}

// 5. TipDriverScreen
export function TipDriverScreen({
  onBack,
  onSubmit,
  onSkip,
}: {
  onBack?: () => void;
  onSubmit?: () => void;
  onSkip?: () => void;
}) {
  const presets = ['₦100', '₦200', '₦500', '₦1,000', 'Custom'];
  const [selected, setSelected] = useState('₦200');
  const [custom, setCustom] = useState('');
  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{ background: NAVY_BASE, fontFamily: IT }}
    >
      <RideStatusBar />
      <div className="flex items-center gap-3 px-5 pb-4 pt-2">
        <BackArrow onClick={onBack || (() => {})} />
        <p style={{ fontFamily: PP, fontSize: 18, fontWeight: 700, color: '#fff' }}>Leave a Tip</p>
      </div>
      <div className="flex-1 overflow-y-auto px-5" style={{ scrollbarWidth: 'none' }}>
        {/* Driver mini-card */}
        <div
          className="mb-6 flex items-center gap-3 rounded-2xl p-4"
          style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
        >
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full"
            style={{
              background: 'linear-gradient(135deg,#16a34a,#22c55e)',
              fontFamily: PP,
              fontWeight: 700,
              color: '#fff',
              fontSize: 16,
            }}
          >
            AO
          </div>
          <div className="flex-1">
            <p style={{ fontFamily: PP, fontSize: 15, fontWeight: 600, color: '#fff' }}>
              Adeyemi Okafor
            </p>
            <div className="mt-0.5 flex items-center gap-1">
              <StarRow rating={4.92} size={12} />
              <p style={{ fontSize: 12, color: TEXT_SECONDARY, fontFamily: IT, marginLeft: 4 }}>
                4.92
              </p>
            </div>
          </div>
        </div>
        {/* Preset chips */}
        <p
          style={{ fontFamily: PP, fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 12 }}
        >
          Select tip amount
        </p>
        <div className="mb-4 flex flex-wrap gap-2">
          {presets.map((p) => (
            <button
              key={p}
              className="rounded-full px-4 py-2 text-sm font-semibold transition-all active:scale-95"
              style={{
                background: selected === p ? G3 : NAVY_CARD,
                color: selected === p ? '#0A1628' : TEXT_SECONDARY,
                border: selected === p ? 'none' : `1px solid ${BORDER}`,
                fontFamily: PP,
                borderRadius: 999,
              }}
              onClick={() => setSelected(p)}
            >
              {p}
            </button>
          ))}
        </div>
        {selected === 'Custom' && (
          <div className="mb-4">
            <input
              type="number"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="Enter amount (₦)"
              className="w-full rounded-xl px-4 py-3 text-sm outline-none"
              style={{
                background: NAVY_SURFACE,
                border: `1.5px solid ${G3}`,
                color: '#fff',
                fontFamily: IT,
              }}
            />
          </div>
        )}
        <div
          className="mb-4 rounded-xl p-4"
          style={{ background: 'rgba(34,197,94,.06)', border: `1px solid rgba(34,197,94,.15)` }}
        >
          <p style={{ fontSize: 13, color: G3, fontFamily: IT, textAlign: 'center' }}>
            💚 100% goes directly to your driver
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-2 px-5 pb-8 pt-3">
        <GreenButton
          label={`Send Tip${selected !== 'Custom' ? ` (${selected})` : custom ? ` (₦${custom})` : ''}`}
          onClick={onSubmit || (() => {})}
        />
        <button
          onClick={onSkip}
          className="h-10 w-full text-sm"
          style={{ color: MUTED, fontFamily: IT, background: 'transparent' }}
        >
          Skip, no tip
        </button>
      </div>
    </div>
  );
}

// 6. ReportTripScreen
export function ReportTripScreen({
  onBack,
  onSubmit,
}: {
  onBack?: () => void;
  onSubmit?: () => void;
}) {
  const issues = [
    { id: 'safety', label: '🚨 Safety concern' },
    { id: 'charge', label: '💰 Overcharge / wrong fare' },
    { id: 'driver', label: '🚗 Driver behaviour' },
    { id: 'route', label: '📍 Wrong route taken' },
    { id: 'cancel', label: '❌ Trip cancelled by driver' },
    { id: 'lost', label: '📦 Lost item' },
    { id: 'other', label: 'Other' },
  ];
  const [selected, setSelected] = useState('');
  const [desc, setDesc] = useState('');
  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{ background: NAVY_BASE, fontFamily: IT }}
    >
      <RideStatusBar />
      <div className="flex items-center gap-3 px-5 pb-4 pt-2">
        <BackArrow onClick={onBack || (() => {})} />
        <p style={{ fontFamily: PP, fontSize: 18, fontWeight: 700, color: '#fff' }}>
          Report an Issue
        </p>
      </div>
      <div className="flex-1 overflow-y-auto px-5" style={{ scrollbarWidth: 'none' }}>
        {/* Trip summary */}
        <div
          className="mb-4 flex items-center gap-3 rounded-xl p-3"
          style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
        >
          <div>
            <p style={{ fontSize: 11, fontFamily: PP, fontWeight: 600, color: MUTED }}>
              RX-20241205-0012
            </p>
            <p style={{ fontSize: 13, color: '#fff', fontFamily: IT }}>
              Ikeja → Victoria Island • Today 9:41 AM
            </p>
          </div>
        </div>
        {/* Issue list */}
        <p
          style={{ fontFamily: PP, fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 10 }}
        >
          What happened?
        </p>
        {issues.map((issue) => (
          <button
            key={issue.id}
            className="mb-2 flex w-full items-center gap-3 rounded-xl p-3.5 text-left transition-all active:scale-[.98]"
            style={{
              background: selected === issue.id ? 'rgba(34,197,94,.08)' : NAVY_CARD,
              border: selected === issue.id ? `1.5px solid ${G3}` : `1px solid ${BORDER}`,
            }}
            onClick={() => setSelected(issue.id)}
          >
            <div className="flex-1">
              <p style={{ fontSize: 14, color: '#fff', fontFamily: IT }}>{issue.label}</p>
            </div>
            <div
              className="h-4 w-4 rounded-full"
              style={{
                border: selected === issue.id ? 'none' : `2px solid ${BORDER}`,
                background: selected === issue.id ? G3 : 'transparent',
              }}
            >
              {selected === issue.id && (
                <div className="mx-auto mt-[1px] h-2 w-2 rounded-full bg-white" />
              )}
            </div>
          </button>
        ))}
        {/* Description */}
        <div className="mb-4 mt-4">
          <textarea
            value={desc}
            onChange={(e) => desc.length <= 140 && setDesc(e.target.value)}
            placeholder="Describe what happened..."
            rows={3}
            className="w-full resize-none rounded-xl px-4 py-3 text-sm outline-none"
            style={{
              background: NAVY_SURFACE,
              border: `1px solid ${BORDER}`,
              color: '#fff',
              fontFamily: IT,
            }}
          />
          <p style={{ fontSize: 11, color: MUTED, fontFamily: IT, textAlign: 'right' }}>
            {desc.length}/140
          </p>
        </div>
        {/* Photo attach */}
        <button
          className="mb-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl"
          style={{ background: NAVY_SURFACE, border: `1px dashed ${BORDER}` }}
        >
          <span style={{ fontSize: 18 }}>📎</span>
          <p style={{ fontSize: 13, color: TEXT_SECONDARY, fontFamily: IT }}>
            Attach photo (optional)
          </p>
        </button>
        <p
          style={{
            fontSize: 11,
            color: MUTED,
            fontFamily: IT,
            textAlign: 'center',
            marginBottom: 16,
          }}
        >
          Your report is reviewed within 24 hours
        </p>
      </div>
      <div className="px-5 pb-8 pt-3">
        <GreenButton label="Submit Report" onClick={onSubmit || (() => {})} />
      </div>
    </div>
  );
}

// 7. SavedPlacesScreen
export function SavedPlacesScreen({ onBack, onAdd }: { onBack?: () => void; onAdd?: () => void }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const pinned = [
    { id: 'home', icon: '🏠', label: 'Home', sub: '12 Adewale Close, Ikeja' },
    { id: 'work', icon: '💼', label: 'Work', sub: 'Plot 4, Victoria Island' },
  ];
  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{ background: NAVY_BASE, fontFamily: IT }}
    >
      <RideStatusBar />
      <div className="flex items-center gap-3 px-5 pb-4 pt-2">
        <BackArrow onClick={onBack || (() => {})} />
        <p style={{ fontFamily: PP, fontSize: 18, fontWeight: 700, color: '#fff' }}>Saved Places</p>
      </div>
      <div className="flex-1 overflow-y-auto px-5" style={{ scrollbarWidth: 'none' }}>
        <p
          style={{ fontSize: 11, fontFamily: PP, fontWeight: 600, color: MUTED, marginBottom: 10 }}
        >
          PINNED PLACES
        </p>
        {pinned.map((p) => (
          <div
            key={p.id}
            className="mb-3 overflow-hidden rounded-2xl"
            style={{
              background: NAVY_CARD,
              border: `1px solid ${BORDER}`,
              borderLeft: `3px solid ${G3}`,
            }}
          >
            {editingId === p.id ? (
              <div className="p-4">
                <input
                  defaultValue={p.sub}
                  className="mb-2 w-full rounded-xl px-3 py-2 text-sm outline-none"
                  style={{
                    background: NAVY_SURFACE,
                    border: `1.5px solid ${G3}`,
                    color: '#fff',
                    fontFamily: IT,
                  }}
                />
                <div className="flex gap-2">
                  <button
                    className="h-9 flex-1 rounded-xl text-sm font-semibold"
                    style={{ background: G3, color: '#0A1628', fontFamily: PP }}
                    onClick={() => setEditingId(null)}
                  >
                    Save
                  </button>
                  <button
                    className="h-9 flex-1 rounded-xl text-sm"
                    style={{
                      background: NAVY_SURFACE,
                      color: MUTED,
                      fontFamily: IT,
                      border: `1px solid ${BORDER}`,
                    }}
                    onClick={() => setEditingId(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-4">
                <span style={{ fontSize: 22 }}>{p.icon}</span>
                <div className="flex-1">
                  <p style={{ fontFamily: PP, fontSize: 14, fontWeight: 600, color: '#fff' }}>
                    {p.label}
                  </p>
                  <p style={{ fontSize: 12, color: TEXT_SECONDARY, fontFamily: IT }}>{p.sub}</p>
                </div>
                <button
                  style={{ fontSize: 12, color: G3, fontFamily: PP, fontWeight: 600 }}
                  onClick={() => setEditingId(p.id)}
                >
                  Edit
                </button>
              </div>
            )}
          </div>
        ))}
        {/* Recent places */}
        <p
          style={{
            fontSize: 11,
            fontFamily: PP,
            fontWeight: 600,
            color: MUTED,
            marginTop: 16,
            marginBottom: 10,
          }}
        >
          RECENT PLACES
        </p>
        {RECENT_PLACES.filter((r) => r.type === 'recent').map((r) => (
          <div
            key={r.label}
            className="mb-2 flex items-center gap-3 rounded-xl p-3.5"
            style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
          >
            <span style={{ fontSize: 18 }}>{r.icon}</span>
            <div className="flex-1">
              <p style={{ fontSize: 13, fontFamily: IT, color: '#fff' }}>{r.label}</p>
              <p style={{ fontSize: 11, color: MUTED, fontFamily: IT }}>{r.sub}</p>
            </div>
          </div>
        ))}
        {/* Add place CTA */}
        <button
          className="mb-6 mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl transition-all active:scale-[.98]"
          style={{ border: `1.5px dashed rgba(34,197,94,.4)`, background: 'transparent' }}
          onClick={onAdd || (() => {})}
        >
          <span style={{ fontSize: 20, color: G3 }}>+</span>
          <p style={{ fontSize: 14, color: G3, fontFamily: PP, fontWeight: 600 }}>Add a place</p>
        </button>
      </div>
    </div>
  );
}

// 8. ScheduleRideScreen
export function ScheduleRideScreen({
  onBack,
  onConfirm,
}: {
  onBack?: () => void;
  onConfirm?: () => void;
}) {
  const days = ['Today', 'Tomorrow', 'Mon 9', 'Tue 10', 'Wed 11', 'Thu 12', 'Fri 13'];
  const [selDay, setSelDay] = useState(0);
  const [hour, setHour] = useState(9);
  const [min, setMin] = useState(0);
  const [ampm, setAmpm] = useState<'AM' | 'PM'>('AM');
  const [reminder, setReminder] = useState(true);
  const [confirm, setConfirm] = useState(false);
  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{ background: NAVY_BASE, fontFamily: IT }}
    >
      <RideStatusBar />
      <div className="flex items-center gap-3 px-5 pb-4 pt-2">
        <BackArrow onClick={onBack || (() => {})} />
        <p style={{ fontFamily: PP, fontSize: 18, fontWeight: 700, color: '#fff' }}>
          Schedule a Ride
        </p>
      </div>
      <div className="flex-1 overflow-y-auto px-5" style={{ scrollbarWidth: 'none' }}>
        {/* Route summary */}
        <div
          className="mb-4 rounded-2xl p-4"
          style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
        >
          <p style={{ fontSize: 12, color: MUTED, fontFamily: IT }}>From</p>
          <p style={{ fontSize: 14, color: '#fff', fontFamily: IT, marginBottom: 6 }}>
            12 Adewale Close, Ikeja
          </p>
          <div className="h-px" style={{ background: BORDER }} />
          <p style={{ fontSize: 12, color: MUTED, fontFamily: IT, marginTop: 6 }}>To</p>
          <p style={{ fontSize: 14, color: '#fff', fontFamily: IT }}>Plot 4, Victoria Island</p>
        </div>
        {/* Day picker */}
        <p
          style={{ fontFamily: PP, fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 10 }}
        >
          Select date
        </p>
        <div className="mb-4 flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
          {days.map((d, i) => (
            <button
              key={d}
              className="flex-shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-all active:scale-95"
              style={{
                background: selDay === i ? G3 : NAVY_CARD,
                color: selDay === i ? '#0A1628' : TEXT_SECONDARY,
                border: selDay === i ? 'none' : `1px solid ${BORDER}`,
                fontFamily: PP,
                borderRadius: 999,
              }}
              onClick={() => setSelDay(i)}
            >
              {d}
            </button>
          ))}
        </div>
        {/* Time picker */}
        <p
          style={{ fontFamily: PP, fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 10 }}
        >
          Select time
        </p>
        <div className="mb-4 flex gap-3">
          {/* Hour */}
          <div
            className="flex-1 rounded-xl p-3"
            style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
          >
            <p
              style={{
                fontSize: 11,
                color: MUTED,
                fontFamily: IT,
                textAlign: 'center',
                marginBottom: 6,
              }}
            >
              Hour
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                style={{ color: G3, fontSize: 20 }}
                onClick={() => setHour((h) => (h === 1 ? 12 : h - 1))}
              >
                ‹
              </button>
              <p
                style={{
                  fontFamily: PP,
                  fontSize: 22,
                  fontWeight: 700,
                  color: '#fff',
                  minWidth: 30,
                  textAlign: 'center',
                }}
              >
                {String(hour).padStart(2, '0')}
              </p>
              <button
                style={{ color: G3, fontSize: 20 }}
                onClick={() => setHour((h) => (h === 12 ? 1 : h + 1))}
              >
                ›
              </button>
            </div>
          </div>
          {/* Minute */}
          <div
            className="flex-1 rounded-xl p-3"
            style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
          >
            <p
              style={{
                fontSize: 11,
                color: MUTED,
                fontFamily: IT,
                textAlign: 'center',
                marginBottom: 6,
              }}
            >
              Minute
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                style={{ color: G3, fontSize: 20 }}
                onClick={() => setMin((m) => (m === 0 ? 55 : m - 5))}
              >
                ‹
              </button>
              <p
                style={{
                  fontFamily: PP,
                  fontSize: 22,
                  fontWeight: 700,
                  color: '#fff',
                  minWidth: 30,
                  textAlign: 'center',
                }}
              >
                {String(min).padStart(2, '0')}
              </p>
              <button
                style={{ color: G3, fontSize: 20 }}
                onClick={() => setMin((m) => (m === 55 ? 0 : m + 5))}
              >
                ›
              </button>
            </div>
          </div>
          {/* AM/PM */}
          <div className="flex flex-col justify-center gap-1">
            {(['AM', 'PM'] as const).map((a) => (
              <button
                key={a}
                className="h-10 w-14 rounded-xl text-sm font-semibold"
                style={{
                  background: ampm === a ? G3 : NAVY_CARD,
                  color: ampm === a ? '#0A1628' : TEXT_SECONDARY,
                  fontFamily: PP,
                  border: ampm === a ? 'none' : `1px solid ${BORDER}`,
                }}
                onClick={() => setAmpm(a)}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
        {/* Fare estimate */}
        <div
          className="mb-4 rounded-2xl p-4"
          style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
        >
          <p
            style={{ fontSize: 11, fontFamily: PP, fontWeight: 600, color: MUTED, marginBottom: 4 }}
          >
            ESTIMATED FARE
          </p>
          <p style={{ fontFamily: PP, fontSize: 20, fontWeight: 800, color: G3 }}>
            ₦2,100 – ₦2,400
          </p>
          <p style={{ fontSize: 11, color: MUTED, fontFamily: IT, marginTop: 2 }}>
            Surge pricing may apply
          </p>
        </div>
        {/* Reminder toggle */}
        <div
          className="mb-6 flex items-center justify-between rounded-2xl p-4"
          style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
        >
          <div>
            <p style={{ fontFamily: PP, fontSize: 14, fontWeight: 600, color: '#fff' }}>
              Notify me 15 min before
            </p>
            <p style={{ fontSize: 12, color: TEXT_SECONDARY, fontFamily: IT }}>
              Push notification reminder
            </p>
          </div>
          <button
            className="relative h-6 w-12 rounded-full transition-all"
            style={{ background: reminder ? G3 : NAVY_SURFACE, border: `1px solid ${BORDER}` }}
            onClick={() => setReminder(!reminder)}
          >
            <div
              className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all"
              style={{ left: reminder ? 'calc(100% - 22px)' : 2 }}
            />
          </button>
        </div>
      </div>
      {/* Confirm bottom sheet */}
      {confirm && (
        <div
          className="absolute inset-0 flex flex-col justify-end"
          style={{ background: 'rgba(0,0,0,.5)', zIndex: 20 }}
        >
          <div className="rounded-t-3xl p-6" style={{ background: NAVY_CARD }}>
            <p
              style={{
                fontFamily: PP,
                fontSize: 16,
                fontWeight: 700,
                color: '#fff',
                marginBottom: 12,
              }}
            >
              Confirm Schedule
            </p>
            <p style={{ fontSize: 14, color: TEXT_SECONDARY, fontFamily: IT, marginBottom: 6 }}>
              📅 {days[selDay]} at {String(hour).padStart(2, '0')}:{String(min).padStart(2, '0')}{' '}
              {ampm}
            </p>
            <p style={{ fontSize: 14, color: TEXT_SECONDARY, fontFamily: IT, marginBottom: 16 }}>
              📍 Ikeja → Victoria Island
            </p>
            <div className="flex gap-3">
              <GreenButton label="Confirm Ride" onClick={onConfirm || (() => {})} />
              <button
                className="h-12 flex-1 rounded-2xl"
                style={{
                  background: NAVY_SURFACE,
                  border: `1px solid ${BORDER}`,
                  color: MUTED,
                  fontFamily: IT,
                }}
                onClick={() => setConfirm(false)}
              >
                Go back
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="px-5 pb-8 pt-3">
        <GreenButton label="Schedule Ride" onClick={() => setConfirm(true)} />
      </div>
    </div>
  );
}

// 9. PromoCodeScreen
export function PromoCodeScreen({
  onBack,
  onApply,
}: {
  onBack?: () => void;
  onApply?: () => void;
}) {
  const [code, setCode] = useState('');
  const [applied, setApplied] = useState(false);
  const availablePromos = [
    { code: 'NEWRIDE', desc: '₦500 off your first 3 rides', expires: 'Expires Dec 31' },
    { code: 'WEEKEND', desc: '20% off weekend rides', expires: 'Expires Dec 31' },
  ];
  const handleApply = (c?: string) => {
    setCode(c || code);
    setApplied(true);
    onApply && onApply();
  };
  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{ background: NAVY_BASE, fontFamily: IT }}
    >
      <RideStatusBar />
      <div className="flex items-center gap-3 px-5 pb-4 pt-2">
        <BackArrow onClick={onBack || (() => {})} />
        <p style={{ fontFamily: PP, fontSize: 18, fontWeight: 700, color: '#fff' }}>Promo Code</p>
      </div>
      <div className="flex-1 overflow-y-auto px-5" style={{ scrollbarWidth: 'none' }}>
        {/* Input row */}
        <div className="mb-6 flex gap-2">
          <div
            className="flex flex-1 items-center rounded-xl px-4"
            style={{ background: NAVY_CARD, border: `1.5px solid ${applied ? G3 : BORDER}` }}
          >
            <input
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setApplied(false);
              }}
              placeholder="Enter promo code"
              className="h-12 flex-1 bg-transparent text-sm outline-none"
              style={{ color: '#fff', fontFamily: IT }}
            />
            {code.length > 0 && (
              <button
                style={{ color: MUTED, fontSize: 18 }}
                onClick={() => {
                  setCode('');
                  setApplied(false);
                }}
              >
                ×
              </button>
            )}
          </div>
          <button
            className="h-12 rounded-xl px-5 text-sm font-semibold"
            style={{ background: G3, color: '#0A1628', fontFamily: PP }}
            onClick={() => handleApply()}
          >
            Apply
          </button>
        </div>
        {/* Success state */}
        {applied && (
          <div
            className="mb-6 flex items-center gap-3 rounded-2xl p-4"
            style={{ background: 'rgba(34,197,94,.08)', border: `1.5px solid ${G3}` }}
          >
            <span style={{ fontSize: 24 }}>✅</span>
            <div>
              <p style={{ fontFamily: PP, fontSize: 14, fontWeight: 600, color: G3 }}>
                ₦500 discount applied!
              </p>
              <div className="mt-0.5 flex gap-2">
                <p
                  style={{
                    fontSize: 12,
                    color: TEXT_SECONDARY,
                    textDecoration: 'line-through',
                    fontFamily: IT,
                  }}
                >
                  ₦2,100
                </p>
                <p style={{ fontSize: 12, color: G3, fontFamily: PP, fontWeight: 600 }}>₦1,600</p>
              </div>
            </div>
          </div>
        )}
        {/* Available promos */}
        {!applied && (
          <>
            <p
              style={{
                fontFamily: PP,
                fontSize: 13,
                fontWeight: 600,
                color: '#fff',
                marginBottom: 12,
              }}
            >
              Available for you
            </p>
            {availablePromos.map((p) => (
              <div
                key={p.code}
                className="mb-3 rounded-2xl p-4"
                style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-bold"
                    style={{ background: 'rgba(34,197,94,.15)', color: G3, fontFamily: PP }}
                  >
                    {p.code}
                  </span>
                  <button
                    className="rounded-full px-3 py-1 text-xs"
                    style={{
                      border: `1px solid ${G3}`,
                      color: G3,
                      fontFamily: PP,
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
                    fontFamily: PP,
                    fontWeight: 600,
                    marginTop: 6,
                  }}
                >
                  {p.desc}
                </p>
                <p style={{ fontSize: 11, color: MUTED, fontFamily: IT, marginTop: 2 }}>
                  {p.expires}
                </p>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// 10. ReferralScreen
export function ReferralScreen({ onBack }: { onBack?: () => void }) {
  const [copied, setCopied] = useState(false);
  const code = 'DRIPX-OLA42';
  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const steps = [
    { n: 1, text: 'Share your referral code with a friend' },
    { n: 2, text: 'Your friend completes their first ride' },
    { n: 3, text: 'You both get ₦500 credited instantly' },
  ];
  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{ background: NAVY_BASE, fontFamily: IT }}
    >
      <RideStatusBar />
      <div className="flex items-center gap-3 px-5 pb-4 pt-2">
        <BackArrow onClick={onBack || (() => {})} />
        <p style={{ fontFamily: PP, fontSize: 18, fontWeight: 700, color: '#fff' }}>Refer & Earn</p>
      </div>
      <div className="flex-1 overflow-y-auto px-5" style={{ scrollbarWidth: 'none' }}>
        {/* Hero card */}
        <div
          className="mb-4 rounded-2xl p-6 text-center"
          style={{
            background: 'linear-gradient(135deg,#064e3b,#166534)',
            border: `1px solid rgba(34,197,94,.2)`,
          }}
        >
          <p
            style={{
              fontFamily: PP,
              fontSize: 22,
              fontWeight: 800,
              color: '#fff',
              marginBottom: 6,
            }}
          >
            Give ₦500. Get ₦500.
          </p>
          <p
            style={{ fontSize: 13, color: 'rgba(255,255,255,.7)', fontFamily: IT, lineHeight: 1.6 }}
          >
            Your friend gets ₦500 off their first ride. You earn ₦500 when they complete it.
          </p>
        </div>
        {/* Referral code */}
        <div
          className="mb-4 flex items-center gap-3 rounded-2xl p-4"
          style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
        >
          <p
            style={{
              flex: 1,
              fontFamily: PP,
              fontSize: 22,
              fontWeight: 800,
              color: G3,
              letterSpacing: 2,
            }}
          >
            {code}
          </p>
          <button
            className="rounded-xl px-4 py-2 text-sm font-semibold transition-all active:scale-95"
            style={{
              background: copied ? 'rgba(34,197,94,.15)' : NAVY_SURFACE,
              color: copied ? G3 : TEXT_SECONDARY,
              fontFamily: PP,
              border: `1px solid ${copied ? G3 : BORDER}`,
            }}
            onClick={handleCopy}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {/* Share row */}
        <p
          style={{ fontSize: 11, fontFamily: PP, fontWeight: 600, color: MUTED, marginBottom: 10 }}
        >
          SHARE VIA
        </p>
        <div className="mb-6 flex gap-3">
          {[
            { label: 'WhatsApp', color: '#25D366', emoji: '💬' },
            { label: 'X', color: '#1DA1F2', emoji: '𝕏' },
            { label: 'Instagram', color: '#E1306C', emoji: '📸' },
            { label: 'SMS', color: '#5856D6', emoji: '✉️' },
          ].map((s) => (
            <button
              key={s.label}
              className="flex flex-1 flex-col items-center gap-1 rounded-xl p-3 transition-all active:scale-95"
              style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
            >
              <span style={{ fontSize: 20 }}>{s.emoji}</span>
              <p style={{ fontSize: 10, color: TEXT_SECONDARY, fontFamily: IT }}>{s.label}</p>
            </button>
          ))}
        </div>
        {/* Stats */}
        <div className="mb-6 flex gap-3">
          {[
            ['3', 'Friends Referred'],
            ['₦1,500', 'Earned'],
          ].map(([v, l]) => (
            <div
              key={l}
              className="flex-1 rounded-2xl p-4 text-center"
              style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
            >
              <p style={{ fontFamily: PP, fontSize: 22, fontWeight: 800, color: G3 }}>{v}</p>
              <p style={{ fontSize: 11, color: MUTED, fontFamily: IT }}>{l}</p>
            </div>
          ))}
        </div>
        {/* How it works */}
        <p
          style={{ fontFamily: PP, fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 12 }}
        >
          How it works
        </p>
        {steps.map((s) => (
          <div key={s.n} className="mb-3 flex items-start gap-3">
            <div
              className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full"
              style={{ background: G3 }}
            >
              <p style={{ fontSize: 11, fontFamily: PP, fontWeight: 700, color: '#0A1628' }}>
                {s.n}
              </p>
            </div>
            <p style={{ fontSize: 13, color: TEXT_SECONDARY, fontFamily: IT }}>{s.text}</p>
          </div>
        ))}
        {/* Leaderboard tease */}
        <div
          className="mb-6 mt-4 rounded-2xl p-4 text-center"
          style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
        >
          <p style={{ fontSize: 14, color: '#fff', fontFamily: PP, fontWeight: 600 }}>
            You're #12 this week 🏆
          </p>
          <p style={{ fontSize: 11, color: MUTED, fontFamily: IT, marginTop: 2 }}>
            Keep referring to climb the leaderboard
          </p>
        </div>
      </div>
    </div>
  );
}

// 11. EmergencySOSScreen
export function EmergencySOSScreen({ onBack, onSOS }: { onBack?: () => void; onSOS?: () => void }) {
  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startHold = () => {
    setHolding(true);
    setProgress(0);
    timerRef.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(timerRef.current!);
          setHolding(false);
          onSOS && onSOS();
          return 100;
        }
        return p + 100 / 30;
      });
    }, 100);
  };
  const stopHold = () => {
    setHolding(false);
    setProgress(0);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const circumference = 2 * Math.PI * 44;

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{ background: '#0D0A14', fontFamily: IT }}
    >
      <RideStatusBar />
      <div className="flex items-center gap-3 px-5 pb-4 pt-2">
        <BackArrow onClick={onBack || (() => {})} />
        <span style={{ fontSize: 18 }}>🛡️</span>
        <p style={{ fontFamily: PP, fontSize: 18, fontWeight: 700, color: '#fff' }}>
          Emergency SOS
        </p>
      </div>
      <div className="flex-1 overflow-y-auto px-5" style={{ scrollbarWidth: 'none' }}>
        {/* Trip info */}
        <div
          className="mb-4 rounded-2xl p-4"
          style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)' }}
        >
          <p
            style={{
              fontFamily: PP,
              fontSize: 13,
              fontWeight: 600,
              color: '#EF4444',
              marginBottom: 6,
            }}
          >
            Current Trip
          </p>
          <p style={{ fontSize: 13, color: '#fff', fontFamily: IT }}>Driver: {DRIVER_DATA.name}</p>
          <p style={{ fontSize: 13, color: TEXT_SECONDARY, fontFamily: IT }}>
            Plate: {DRIVER_DATA.plate}
          </p>
          <p style={{ fontSize: 13, color: TEXT_SECONDARY, fontFamily: IT }}>
            Location: Ozumba Mbadiwe Ave, VI
          </p>
        </div>
        {/* Action cards */}
        {[
          {
            icon: '🚨',
            label: 'Call 911 / Emergency',
            sub: 'Connect to emergency services',
            color: '#EF4444',
            bg: 'rgba(239,68,68,.1)',
          },
          {
            icon: '📍',
            label: 'Share Live Location',
            sub: 'Send trip details to your contacts',
            color: '#3B82F6',
            bg: 'rgba(59,130,246,.1)',
          },
          {
            icon: '💬',
            label: 'Contact DrippleX Safety',
            sub: 'Chat with our safety team',
            color: G3,
            bg: 'rgba(34,197,94,.1)',
          },
        ].map((a) => (
          <button
            key={a.label}
            className="mb-3 flex w-full items-center gap-4 rounded-2xl p-4 text-left transition-all active:scale-[.97]"
            style={{ background: a.bg, border: `1px solid ${a.color}22` }}
          >
            <div
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl"
              style={{ background: `${a.color}22` }}
            >
              <span style={{ fontSize: 22 }}>{a.icon}</span>
            </div>
            <div>
              <p style={{ fontFamily: PP, fontSize: 14, fontWeight: 700, color: a.color }}>
                {a.label}
              </p>
              <p style={{ fontSize: 12, color: TEXT_SECONDARY, fontFamily: IT }}>{a.sub}</p>
            </div>
          </button>
        ))}
        {/* Emergency contacts */}
        <p
          style={{
            fontFamily: PP,
            fontSize: 13,
            fontWeight: 600,
            color: '#fff',
            marginTop: 8,
            marginBottom: 10,
          }}
        >
          Emergency Contacts
        </p>
        <div
          className="mb-2 flex items-center justify-between rounded-xl p-3.5"
          style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
        >
          <div>
            <p style={{ fontSize: 13, color: '#fff', fontFamily: PP, fontWeight: 600 }}>Mum</p>
            <p style={{ fontSize: 12, color: TEXT_SECONDARY, fontFamily: IT }}>+234 803 000 0001</p>
          </div>
          <button
            className="rounded-full px-3 py-1 text-xs"
            style={{
              background: 'rgba(34,197,94,.1)',
              color: G3,
              fontFamily: PP,
              fontWeight: 600,
              border: `1px solid rgba(34,197,94,.2)`,
            }}
          >
            Call
          </button>
        </div>
        <button
          className="mb-6 w-full p-3 text-left"
          style={{ color: G3, fontSize: 13, fontFamily: IT }}
        >
          + Add emergency contact
        </button>
      </div>
      {/* SOS hold button */}
      <div className="flex flex-col items-center pb-6 pt-2">
        <p
          style={{
            fontSize: 11,
            color: MUTED,
            fontFamily: IT,
            marginBottom: 12,
            textAlign: 'center',
          }}
        >
          Your location is shared with our safety team during this ride.
        </p>
        <div
          className="relative flex items-center justify-center"
          style={{ width: 120, height: 120 }}
        >
          <svg
            width={120}
            height={120}
            style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}
          >
            <circle
              cx={60}
              cy={60}
              r={44}
              fill="none"
              stroke="rgba(239,68,68,.2)"
              strokeWidth={8}
            />
            <circle
              cx={60}
              cy={60}
              r={44}
              fill="none"
              stroke="#EF4444"
              strokeWidth={8}
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress / 100)}
              style={{ transition: 'stroke-dashoffset 0.1s linear' }}
            />
          </svg>
          <button
            className="flex h-24 w-24 flex-col items-center justify-center rounded-full transition-all active:scale-95"
            style={{ background: holding ? '#DC2626' : '#EF4444' }}
            onMouseDown={startHold}
            onMouseUp={stopHold}
            onTouchStart={startHold}
            onTouchEnd={stopHold}
          >
            <span style={{ fontSize: 24 }}>🆘</span>
            <p
              style={{ fontSize: 10, fontFamily: PP, fontWeight: 700, color: '#fff', marginTop: 2 }}
            >
              HOLD 3 SEC
            </p>
          </button>
        </div>
        <p style={{ fontSize: 12, color: MUTED, fontFamily: IT, marginTop: 8 }}>
          Hold to Alert Contacts
        </p>
      </div>
    </div>
  );
}

// 12. ShareTripScreen
export function ShareTripScreen({ onBack }: { onBack?: () => void }) {
  const [copied, setCopied] = useState(false);
  const [autoShare, setAutoShare] = useState(false);
  const link = 'drpx.app/t/RX-5201';

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{ background: NAVY_BASE, fontFamily: IT }}
    >
      <RideStatusBar />
      <div className="flex items-center gap-3 px-5 pb-4 pt-2">
        <BackArrow onClick={onBack || (() => {})} />
        <p style={{ fontFamily: PP, fontSize: 18, fontWeight: 700, color: '#fff' }}>
          Share Your Trip
        </p>
        {/* LIVE badge */}
        <div
          className="ml-auto flex items-center gap-1.5 rounded-full px-2.5 py-1"
          style={{ background: 'rgba(34,197,94,.15)', border: `1px solid ${G3}` }}
        >
          <div className="h-2 w-2 animate-pulse rounded-full" style={{ background: G3 }} />
          <p style={{ fontSize: 11, fontFamily: PP, fontWeight: 700, color: G3 }}>LIVE</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5" style={{ scrollbarWidth: 'none' }}>
        {/* Trip snapshot */}
        <div className="mb-4 overflow-hidden rounded-2xl" style={{ border: `1px solid ${BORDER}` }}>
          {/* Map thumbnail */}
          <div
            className="flex h-32 items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#0f2027,#203a43,#2c5364)' }}
          >
            <svg width="100" height="60" viewBox="0 0 100 60">
              <rect width="100" height="60" fill="none" />
              <path
                d="M10 50 Q30 20 50 30 Q70 40 90 10"
                stroke={G3}
                strokeWidth="2.5"
                fill="none"
                strokeLinecap="round"
                strokeDasharray="4 2"
              />
              <circle cx="10" cy="50" r="4" fill={G3} />
              <circle cx="90" cy="10" r="4" fill="#3B82F6" />
            </svg>
          </div>
          <div className="p-4" style={{ background: NAVY_CARD }}>
            <p style={{ fontFamily: PP, fontSize: 14, fontWeight: 600, color: '#fff' }}>
              Adeyemi Okafor • LAG 482 KA
            </p>
            <p style={{ fontSize: 12, color: TEXT_SECONDARY, fontFamily: IT, marginTop: 2 }}>
              ETA: Arriving 9:58 AM
            </p>
          </div>
        </div>
        {/* Share link */}
        <div className="mb-4 flex gap-2">
          <div
            className="flex flex-1 items-center rounded-xl px-4 py-3"
            style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
          >
            <p style={{ fontSize: 13, color: G3, fontFamily: IT, flex: 1 }}>{link}</p>
          </div>
          <button
            className="rounded-xl px-4 text-sm font-semibold"
            style={{
              background: copied ? 'rgba(34,197,94,.1)' : NAVY_SURFACE,
              color: copied ? G3 : TEXT_SECONDARY,
              fontFamily: PP,
              border: `1px solid ${copied ? G3 : BORDER}`,
            }}
            onClick={() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? '✓' : 'Copy'}
          </button>
        </div>
        {/* Share to row */}
        <p
          style={{ fontSize: 11, fontFamily: PP, fontWeight: 600, color: MUTED, marginBottom: 10 }}
        >
          SHARE TO
        </p>
        <div className="mb-6 flex gap-3">
          {[
            { label: 'WhatsApp', color: '#25D366' },
            { label: 'iMessage', color: '#2997FF' },
            { label: 'Telegram', color: '#0088cc' },
            { label: 'More', color: MUTED },
          ].map((s) => (
            <button
              key={s.label}
              className="flex flex-1 flex-col items-center gap-1 rounded-xl p-3 transition-all active:scale-95"
              style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
            >
              <div className="h-8 w-8 rounded-full" style={{ background: s.color + '22' }} />
              <p style={{ fontSize: 10, color: TEXT_SECONDARY, fontFamily: IT }}>{s.label}</p>
            </button>
          ))}
        </div>
        {/* QR code placeholder */}
        <div className="mb-4 flex justify-center">
          <div className="rounded-2xl p-3" style={{ background: '#fff' }}>
            <svg width="80" height="80" viewBox="0 0 80 80">
              {Array.from({ length: 8 }).map((_, r) =>
                Array.from({ length: 8 }).map((_, c) =>
                  (r < 3 && c < 3) ||
                  (r < 3 && c > 4) ||
                  (r > 4 && c < 3) ||
                  Math.random() > 0.5 ? (
                    <rect
                      key={`${r}-${c}`}
                      x={c * 10}
                      y={r * 10}
                      width={9}
                      height={9}
                      fill="#0A1628"
                    />
                  ) : null,
                ),
              )}
            </svg>
          </div>
        </div>
        {/* Auto-share toggle */}
        <div
          className="mb-4 flex items-center justify-between rounded-2xl p-4"
          style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
        >
          <div>
            <p style={{ fontFamily: PP, fontSize: 14, fontWeight: 600, color: '#fff' }}>
              Auto-share with emergency contacts
            </p>
            <p style={{ fontSize: 12, color: TEXT_SECONDARY, fontFamily: IT }}>
              Sends trip link when ride starts
            </p>
          </div>
          <button
            className="relative h-6 w-12 rounded-full transition-all"
            style={{ background: autoShare ? G3 : NAVY_SURFACE, border: `1px solid ${BORDER}` }}
            onClick={() => setAutoShare(!autoShare)}
          >
            <div
              className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all"
              style={{ left: autoShare ? 'calc(100% - 22px)' : 2 }}
            />
          </button>
        </div>
        <p
          style={{
            fontSize: 11,
            color: MUTED,
            fontFamily: IT,
            textAlign: 'center',
            marginBottom: 20,
          }}
        >
          Anyone with this link can see your live trip position.
        </p>
      </div>
    </div>
  );
}

// 13. TripReceiptScreen
export function TripReceiptScreen({
  onBack,
  rideId,
  onReport,
}: {
  onBack?: () => void;
  rideId?: string;
  onReport?: () => void;
}) {
  const breakdown = [
    { label: 'Base fare', amount: '₦800' },
    { label: 'Distance (14.2 km × ₦80)', amount: '₦1,136' },
    { label: 'Time (22 min × ₦7)', amount: '₦154' },
    { label: 'Subtotal', amount: '₦2,090', bold: true },
    { label: 'Promo (NEWRIDE)', amount: '−₦500', color: G3 },
    { label: 'Total', amount: '₦1,590', bold: true, large: true, color: G3 },
  ];
  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{ background: NAVY_BASE, fontFamily: IT }}
    >
      <RideStatusBar />
      <div className="flex items-center gap-3 px-5 pb-4 pt-2">
        <BackArrow onClick={onBack || (() => {})} />
        <p style={{ fontFamily: PP, fontSize: 18, fontWeight: 700, color: '#fff' }}>Trip Receipt</p>
      </div>
      <div className="flex-1 overflow-y-auto px-5" style={{ scrollbarWidth: 'none' }}>
        <p style={{ fontSize: 12, color: MUTED, fontFamily: IT, marginBottom: 16 }}>
          Today, 9:41 AM • {rideId || 'RX-20241205-0012'}
        </p>
        {/* Route visual */}
        <div className="mb-4 flex gap-4">
          <div className="flex flex-col items-center" style={{ paddingTop: 4 }}>
            <div className="h-3 w-3 rounded-full" style={{ background: G3 }} />
            <div
              className="my-1 w-px flex-1"
              style={{ background: BORDER, borderLeft: '2px dashed', borderColor: BORDER }}
            />
            <div className="h-3 w-3 rounded-full" style={{ background: '#3B82F6' }} />
          </div>
          <div className="flex-1">
            <div className="mb-3">
              <p style={{ fontFamily: PP, fontSize: 14, fontWeight: 600, color: '#fff' }}>
                Ikeja, Lagos
              </p>
              <p style={{ fontSize: 11, color: MUTED, fontFamily: IT }}>Pickup</p>
            </div>
            <div>
              <p style={{ fontFamily: PP, fontSize: 14, fontWeight: 600, color: '#fff' }}>
                Victoria Island
              </p>
              <p style={{ fontSize: 11, color: MUTED, fontFamily: IT }}>Dropoff</p>
            </div>
          </div>
          <div className="text-right">
            <p style={{ fontSize: 12, color: TEXT_SECONDARY, fontFamily: IT }}>14.2 km</p>
            <p style={{ fontSize: 12, color: TEXT_SECONDARY, fontFamily: IT }}>22 min</p>
          </div>
        </div>
        {/* Fare breakdown */}
        <div
          className="mb-4 rounded-2xl p-4"
          style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
        >
          <p
            style={{
              fontSize: 11,
              fontFamily: PP,
              fontWeight: 600,
              color: MUTED,
              marginBottom: 10,
            }}
          >
            FARE BREAKDOWN
          </p>
          {breakdown.map((row, i) => (
            <div key={row.label}>
              {row.label === 'Total' && (
                <div className="my-2 h-px" style={{ background: BORDER }} />
              )}
              <div className="mb-2 flex items-center justify-between">
                <p
                  style={{
                    fontSize: row.bold ? 14 : 13,
                    fontFamily: row.bold ? PP : IT,
                    fontWeight: row.bold ? 600 : 400,
                    color: '#fff',
                  }}
                >
                  {row.label}
                </p>
                <p
                  style={{
                    fontSize: row.large ? 18 : 13,
                    fontFamily: row.bold ? PP : IT,
                    fontWeight: row.bold ? 700 : 400,
                    color: row.color || TEXT_SECONDARY,
                  }}
                >
                  {row.amount}
                </p>
              </div>
            </div>
          ))}
        </div>
        {/* Payment method */}
        <div
          className="mb-4 flex items-center gap-3 rounded-2xl p-4"
          style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
        >
          <span style={{ fontSize: 20 }}>💜</span>
          <p style={{ fontFamily: IT, fontSize: 14, color: '#fff', flex: 1 }}>DrippleX Wallet</p>
          <span
            className="rounded-full px-2.5 py-1 text-xs font-semibold"
            style={{ background: 'rgba(34,197,94,.15)', color: G3, fontFamily: PP }}
          >
            Paid
          </span>
        </div>
        {/* Driver row */}
        <div
          className="mb-4 flex items-center gap-3 rounded-2xl p-4"
          style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
        >
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{
              background: 'linear-gradient(135deg,#16a34a,#22c55e)',
              fontFamily: PP,
              fontWeight: 700,
              color: '#fff',
              fontSize: 14,
            }}
          >
            AO
          </div>
          <div className="flex-1">
            <p style={{ fontFamily: PP, fontSize: 14, fontWeight: 600, color: '#fff' }}>
              Adeyemi Okafor
            </p>
            <div className="mt-0.5 flex items-center gap-1">
              <StarRow rating={4.92} size={11} />
              <p style={{ fontSize: 11, color: TEXT_SECONDARY, fontFamily: IT, marginLeft: 3 }}>
                4.92
              </p>
            </div>
          </div>
        </div>
        {/* Share/Download */}
        <div className="mb-4 flex gap-3">
          {['📤 Share Receipt', '⬇️ Download PDF'].map((l) => (
            <button
              key={l}
              className="h-11 flex-1 rounded-xl text-sm font-medium transition-all active:scale-[.97]"
              style={{
                background: 'transparent',
                border: `1px solid ${BORDER}`,
                color: TEXT_SECONDARY,
                fontFamily: IT,
              }}
            >
              {l}
            </button>
          ))}
        </div>
        {/* Support link */}
        <div className="mb-6 text-center">
          <button onClick={onReport} style={{ fontSize: 12, color: '#EF4444', fontFamily: IT }}>
            Issue with this trip?
          </button>
        </div>
      </div>
    </div>
  );
}

// 14. RideHomeExtendedScreen
export function RideHomeExtendedScreen({
  onBack,
  onSearch,
  onSchedule,
  onHistory,
  onSavedPlaces,
  onPromo,
  onReferral,
  onSOS,
}: {
  onBack?: () => void;
  onSearch?: () => void;
  onSchedule?: () => void;
  onHistory?: () => void;
  onSavedPlaces?: () => void;
  onPromo?: () => void;
  onReferral?: () => void;
  onSOS?: () => void;
}) {
  const actions = [
    { icon: '📅', label: 'Schedule', onTap: onSchedule },
    { icon: '📍', label: 'Saved', onTap: onSavedPlaces },
    { icon: '🎟', label: 'Promo', onTap: onPromo },
    { icon: '👥', label: 'Refer', onTap: onReferral },
    { icon: '🚨', label: 'SOS', onTap: onSOS },
    { icon: '📋', label: 'History', onTap: onHistory },
    { icon: '💳', label: 'Payment', onTap: undefined },
    { icon: '⚙️', label: 'Settings', onTap: undefined },
  ];
  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{ background: NAVY_BASE, fontFamily: IT }}
    >
      <RideStatusBar />
      {/* Map background */}
      <div className="absolute inset-0 top-10" style={{ zIndex: 0 }}>
        <MapCanvas variant="home" />
      </div>
      {/* Overlay gradient */}
      <div
        className="absolute inset-0 top-10"
        style={{
          background:
            'linear-gradient(to bottom, rgba(10,22,40,.7) 0%, rgba(10,22,40,.2) 40%, rgba(10,22,40,.6) 70%, rgba(10,22,40,.95) 100%)',
          zIndex: 1,
        }}
      />
      {/* Content */}
      <div className="relative flex flex-1 flex-col px-5 pt-4" style={{ zIndex: 2 }}>
        {/* Greeting */}
        <p
          style={{ fontFamily: PP, fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 12 }}
        >
          Good morning, Chidi 👋
        </p>
        {/* Search bar */}
        <button
          className="mb-4 flex h-14 w-full items-center gap-3 rounded-2xl px-4 transition-all active:scale-[.98]"
          style={{
            background: 'rgba(255,255,255,.08)',
            border: `1px solid rgba(255,255,255,.12)`,
            backdropFilter: 'blur(8px)',
          }}
          onClick={onSearch || (() => {})}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke={MUTED}
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <p style={{ fontSize: 15, color: MUTED, fontFamily: IT }}>Where to?</p>
        </button>
        {/* Quick actions grid */}
        <div className="grid grid-cols-4 gap-3">
          {actions.map((a) => (
            <button
              key={a.label}
              className="flex flex-col items-center gap-1.5 rounded-2xl p-3 transition-all active:scale-95"
              style={{
                background: 'rgba(255,255,255,.07)',
                border: `1px solid rgba(255,255,255,.1)`,
                backdropFilter: 'blur(8px)',
              }}
              onClick={a.onTap || (() => {})}
            >
              <span style={{ fontSize: 22 }}>{a.icon}</span>
              <p style={{ fontSize: 10, color: TEXT_SECONDARY, fontFamily: IT }}>{a.label}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// 15. LiveTrackingScreen
export function LiveTrackingScreen({
  onBack,
  onShare,
  onSOS,
  onChat,
}: {
  onBack?: () => void;
  onShare?: () => void;
  onSOS?: () => void;
  onChat?: () => void;
}) {
  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{ background: NAVY_BASE, fontFamily: IT }}
    >
      <RideStatusBar />
      {/* Full screen map */}
      <div className="absolute inset-0 top-10" style={{ zIndex: 0 }}>
        <MapCanvas variant="inprogress" progress={0.6} />
      </div>
      {/* Top bar */}
      <div
        className="absolute left-0 right-0 top-10 flex items-center gap-2 px-4 pt-3"
        style={{ zIndex: 10 }}
      >
        <div
          className="flex flex-1 items-center gap-2 rounded-2xl px-3 py-2"
          style={{
            background: 'rgba(10,22,40,.85)',
            backdropFilter: 'blur(10px)',
            border: `1px solid ${BORDER}`,
          }}
        >
          <BackArrow onClick={onBack || (() => {})} />
          <p style={{ fontSize: 13, color: TEXT_SECONDARY, fontFamily: IT, flex: 1 }}>
            Trip RX-5201
          </p>
          <div
            className="flex items-center gap-1.5 rounded-full px-2 py-0.5"
            style={{ background: 'rgba(34,197,94,.15)' }}
          >
            <div className="h-2 w-2 animate-pulse rounded-full" style={{ background: G3 }} />
            <p style={{ fontSize: 10, fontFamily: PP, fontWeight: 700, color: G3 }}>LIVE</p>
          </div>
        </div>
      </div>
      {/* Bottom sheet */}
      <div
        className="absolute bottom-0 left-0 right-0 rounded-t-3xl px-5 pb-8 pt-5"
        style={{ background: NAVY_CARD, zIndex: 10, border: `1px solid ${BORDER}` }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full" style={{ background: BORDER }} />
        <p
          style={{ fontFamily: PP, fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 4 }}
        >
          On the way to Victoria Island
        </p>
        <p style={{ fontSize: 13, color: TEXT_SECONDARY, fontFamily: IT, marginBottom: 12 }}>
          8 min • 4.2 km remaining
        </p>
        {/* Driver row */}
        <div className="mb-4 flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{
              background: 'linear-gradient(135deg,#16a34a,#22c55e)',
              fontFamily: PP,
              fontWeight: 700,
              color: '#fff',
              fontSize: 14,
            }}
          >
            AO
          </div>
          <div className="flex-1">
            <p style={{ fontFamily: PP, fontSize: 14, fontWeight: 600, color: '#fff' }}>
              {DRIVER_DATA.name}
            </p>
            <div className="flex items-center gap-1">
              <StarRow rating={DRIVER_DATA.rating} size={11} />
              <p style={{ fontSize: 11, color: TEXT_SECONDARY, fontFamily: IT, marginLeft: 2 }}>
                {DRIVER_DATA.rating}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              className="flex h-9 w-9 items-center justify-center rounded-full"
              style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke={G3}
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.95 10.5a19.79 19.79 0 01-3.07-8.67A2 2 0 012.85 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L7.09 7.62a16 16 0 006.29 6.29l1-1a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0121.9 15a2 2 0 01.1.92z" />
              </svg>
            </button>
            <button
              className="flex h-9 w-9 items-center justify-center rounded-full"
              style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
              onClick={onChat || (() => {})}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke={G3}
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            </button>
          </div>
        </div>
        {/* Progress bar */}
        <div className="mb-4 h-2 rounded-full" style={{ background: NAVY_SURFACE }}>
          <div className="h-2 rounded-full" style={{ background: G3, width: '60%' }} />
        </div>
        {/* Action pills */}
        <div className="mb-3 flex gap-2">
          {[
            { icon: '📍', label: 'Share Trip', fn: onShare },
            { icon: '🚨', label: 'SOS', fn: onSOS },
            { icon: '📞', label: 'Call', fn: undefined },
          ].map((a) => (
            <button
              key={a.label}
              className="flex flex-1 flex-col items-center gap-1 rounded-2xl py-2.5 transition-all active:scale-95"
              style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
              onClick={a.fn || (() => {})}
            >
              <span style={{ fontSize: 16 }}>{a.icon}</span>
              <p style={{ fontSize: 10, color: TEXT_SECONDARY, fontFamily: IT }}>{a.label}</p>
            </button>
          ))}
        </div>
        <p style={{ fontSize: 11, color: MUTED, fontFamily: IT, textAlign: 'center' }}>
          Swipe up for more details
        </p>
      </div>
    </div>
  );
}

// 16. DriverEnRouteScreen
export function DriverEnRouteScreen({
  onBack,
  onContact,
  onCancel,
}: {
  onBack?: () => void;
  onContact?: () => void;
  onCancel?: () => void;
}) {
  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{ background: NAVY_BASE, fontFamily: IT }}
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
      {/* Back button */}
      <div className="absolute left-4 top-14" style={{ zIndex: 10 }}>
        <BackArrow onClick={onBack || (() => {})} />
      </div>
      {/* Bottom sheet */}
      <div
        className="absolute bottom-0 left-0 right-0 rounded-t-3xl px-5 pb-8 pt-5"
        style={{ background: NAVY_CARD, zIndex: 10, border: `1px solid ${BORDER}` }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full" style={{ background: BORDER }} />
        <div className="mb-1 flex items-center justify-between">
          <p style={{ fontFamily: PP, fontSize: 17, fontWeight: 700, color: '#fff' }}>
            Adeyemi is on the way
          </p>
          <SafetyChip />
        </div>
        <div className="mb-4 flex items-center gap-2">
          <div className="h-2 w-2 animate-pulse rounded-full" style={{ background: G3 }} />
          <p style={{ fontSize: 13, color: G3, fontFamily: PP, fontWeight: 600 }}>
            Arriving in 3 min
          </p>
        </div>
        {/* Driver card */}
        <div
          className="mb-4 flex items-center gap-3 rounded-2xl p-3.5"
          style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
        >
          <div
            className="flex h-11 w-11 items-center justify-center rounded-full"
            style={{
              background: 'linear-gradient(135deg,#16a34a,#22c55e)',
              fontFamily: PP,
              fontWeight: 700,
              color: '#fff',
              fontSize: 14,
            }}
          >
            AO
          </div>
          <div className="flex-1">
            <p style={{ fontFamily: PP, fontSize: 14, fontWeight: 600, color: '#fff' }}>
              {DRIVER_DATA.name}
            </p>
            <p style={{ fontSize: 12, color: TEXT_SECONDARY, fontFamily: IT }}>
              {DRIVER_DATA.vehicle} • {DRIVER_DATA.plate}
            </p>
            <div className="mt-0.5 flex items-center gap-1">
              <StarRow rating={DRIVER_DATA.rating} size={11} />
              <p style={{ fontSize: 11, color: TEXT_SECONDARY, fontFamily: IT, marginLeft: 2 }}>
                {DRIVER_DATA.rating}
              </p>
            </div>
          </div>
        </div>
        {/* Actions */}
        <div className="mb-3 flex gap-3">
          {[
            { icon: '📞', label: 'Call', fn: onContact },
            { icon: '💬', label: 'Chat', fn: undefined },
            { icon: '❌', label: 'Cancel', fn: onCancel },
          ].map((a) => (
            <button
              key={a.label}
              className="flex flex-1 flex-col items-center gap-1 rounded-2xl py-2.5 transition-all active:scale-95"
              style={{
                background: a.label === 'Cancel' ? 'rgba(239,68,68,.08)' : NAVY_SURFACE,
                border:
                  a.label === 'Cancel' ? '1px solid rgba(239,68,68,.15)' : `1px solid ${BORDER}`,
              }}
              onClick={a.fn || (() => {})}
            >
              <span style={{ fontSize: 18 }}>{a.icon}</span>
              <p
                style={{
                  fontSize: 11,
                  color: a.label === 'Cancel' ? '#EF4444' : TEXT_SECONDARY,
                  fontFamily: IT,
                }}
              >
                {a.label}
              </p>
            </button>
          ))}
        </div>
        <p style={{ fontSize: 11, color: '#F59E0B', fontFamily: IT, textAlign: 'center' }}>
          Free cancellation until driver arrives
        </p>
      </div>
    </div>
  );
}

// 17. PassengerWaitingScreen
export function PassengerWaitingScreen({
  onBack,
  onContact,
  onBoard,
}: {
  onBack?: () => void;
  onContact?: () => void;
  onBoard?: () => void;
}) {
  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{ background: NAVY_BASE, fontFamily: IT }}
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
        <BackArrow onClick={onBack || (() => {})} />
      </div>
      {/* Bottom sheet */}
      <div
        className="absolute bottom-0 left-0 right-0 rounded-t-3xl px-5 pb-8 pt-5"
        style={{ background: NAVY_CARD, zIndex: 10, border: `1px solid ${BORDER}` }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full" style={{ background: BORDER }} />
        {/* Pulsing car */}
        <div className="mb-4 flex justify-center">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-full"
            style={{
              background: 'rgba(34,197,94,.12)',
              boxShadow: `0 0 0 0 rgba(34,197,94,.4)`,
              animation: 'pulse 1.5s infinite',
            }}
          >
            <span style={{ fontSize: 32 }}>🚗</span>
          </div>
        </div>
        <p
          style={{
            fontFamily: PP,
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
            color: TEXT_SECONDARY,
            fontFamily: IT,
            textAlign: 'center',
            marginBottom: 16,
          }}
        >
          Look for white Toyota Camry • LAG 482 KA
        </p>
        {/* Verify code */}
        <div
          className="mb-4 rounded-2xl p-4 text-center"
          style={{ background: 'rgba(34,197,94,.08)', border: `1.5px solid ${G3}` }}
        >
          <p style={{ fontSize: 12, color: MUTED, fontFamily: IT, marginBottom: 4 }}>
            Show driver code
          </p>
          <p
            style={{
              fontFamily: "'Courier New', monospace",
              fontSize: 36,
              fontWeight: 700,
              color: G3,
              letterSpacing: 8,
            }}
          >
            7421
          </p>
          <p style={{ fontSize: 11, color: MUTED, fontFamily: IT, marginTop: 4 }}>
            Confirm the code matches before boarding
          </p>
        </div>
        <GreenButton label="I'm in the car → Start Ride" onClick={onBoard || (() => {})} />
        <button
          className="mt-2 w-full py-2 text-center"
          style={{ fontSize: 12, color: MUTED, fontFamily: IT, background: 'transparent' }}
          onClick={onContact || (() => {})}
        >
          Not my driver? Contact support
        </button>
      </div>
    </div>
  );
}

// 18. DriverArrivedExtendedScreen
export function DriverArrivedExtendedScreen({
  onBack,
  onStart,
  onReport,
}: {
  onBack?: () => void;
  onStart?: () => void;
  onReport?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const waitSeconds = 134; // 2:14
  const freeSeconds = 180;
  const remaining = freeSeconds - waitSeconds;
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{ background: NAVY_BASE, fontFamily: IT }}
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
        <BackArrow onClick={onBack || (() => {})} />
      </div>
      {/* Bottom sheet */}
      <div
        className="absolute bottom-0 left-0 right-0 rounded-t-3xl px-5 pb-8 pt-5"
        style={{ background: NAVY_CARD, zIndex: 10, border: `1px solid ${BORDER}` }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full" style={{ background: BORDER }} />
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
            fontFamily: PP,
            fontSize: 18,
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
            color: TEXT_SECONDARY,
            fontFamily: IT,
            textAlign: 'center',
            marginBottom: 12,
          }}
        >
          White Toyota Camry • LAG 482 KA
        </p>
        {/* Timer */}
        <div
          className="mb-3 flex items-center justify-between rounded-2xl p-3.5"
          style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
        >
          <div>
            <p style={{ fontSize: 12, color: MUTED, fontFamily: IT }}>Waiting time</p>
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
            <p style={{ fontSize: 12, color: MUTED, fontFamily: IT }}>Free time remaining</p>
            <p
              style={{
                fontFamily: PP,
                fontSize: 15,
                fontWeight: 700,
                color: remaining > 0 ? G3 : '#EF4444',
              }}
            >
              {fmt(remaining)} remaining
            </p>
          </div>
        </div>
        {waitSeconds >= 180 && (
          <div
            className="mb-3 rounded-xl p-3 text-center"
            style={{ background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.2)' }}
          >
            <p style={{ fontSize: 12, color: '#F59E0B', fontFamily: IT }}>
              ₦30/min waiting fee applies
            </p>
          </div>
        )}
        {/* Verify code */}
        <div
          className="mb-3 rounded-2xl p-3 text-center"
          style={{ background: 'rgba(34,197,94,.08)', border: `1.5px solid ${G3}` }}
        >
          <p style={{ fontSize: 11, color: MUTED, fontFamily: IT, marginBottom: 2 }}>
            Show driver code
          </p>
          <p
            style={{
              fontFamily: "'Courier New', monospace",
              fontSize: 28,
              fontWeight: 700,
              color: G3,
              letterSpacing: 8,
            }}
          >
            7421
          </p>
        </div>
        {/* Expandable tips */}
        <button
          className="mb-3 flex w-full items-center justify-between py-2"
          onClick={() => setExpanded(!expanded)}
        >
          <p style={{ fontSize: 13, color: TEXT_SECONDARY, fontFamily: IT }}>
            Having trouble finding your driver?
          </p>
          <span style={{ color: G3, fontSize: 16 }}>{expanded ? '▲' : '▼'}</span>
        </button>
        {expanded && (
          <div
            className="mb-3 rounded-xl px-3 py-3"
            style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
          >
            {[
              'Check the plate number: LAG 482 KA',
              'Driver is in a white Toyota Camry',
              'Try calling — tap the Call button below',
              "Your pin is visible on driver's app",
            ].map((t) => (
              <p
                key={t}
                style={{ fontSize: 12, color: TEXT_SECONDARY, fontFamily: IT, marginBottom: 4 }}
              >
                • {t}
              </p>
            ))}
          </div>
        )}
        <GreenButton label="I'm in the car → Start Ride" onClick={onStart || (() => {})} />
        <button
          className="mt-2 w-full py-2 text-center"
          style={{ fontSize: 12, color: '#EF4444', fontFamily: IT, background: 'transparent' }}
          onClick={onReport || (() => {})}
        >
          Report an issue
        </button>
      </div>
    </div>
  );
}

// 19. WalletPaySuccessScreen
export function WalletPaySuccessScreen({
  onDone,
  onReceipt,
}: {
  onDone?: () => void;
  onReceipt?: () => void;
}) {
  const confettiDots = Array.from({ length: 18 }).map((_, i) => ({
    x: Math.sin(i * 1.4) * 120 + 160,
    y: Math.cos(i * 1.2) * 100 + 200,
    color: [G3, '#3B82F6', '#F59E0B', '#EC4899', '#8B5CF6'][i % 5],
    size: 4 + (i % 3) * 3,
  }));

  return (
    <div
      className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden"
      style={{ background: NAVY_BASE, fontFamily: IT }}
    >
      <RideStatusBar />
      {/* Confetti dots */}
      <div className="pointer-events-none absolute inset-0" style={{ zIndex: 0 }}>
        {confettiDots.map((d, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              left: d.x,
              top: d.y,
              width: d.size,
              height: d.size,
              background: d.color,
              opacity: 0.6,
              animation: `bounce ${1.2 + (i % 3) * 0.3}s ease-in-out infinite alternate`,
            }}
          />
        ))}
      </div>
      <style>{`
        @keyframes drawCheck {
          from { stroke-dashoffset: 120; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes scaleCircle {
          from { stroke-dashoffset: 283; opacity: 0; }
          to { stroke-dashoffset: 0; opacity: 1; }
        }
        @keyframes bounce {
          from { transform: translateY(0); }
          to { transform: translateY(-12px); }
        }
      `}</style>
      {/* Content */}
      <div className="flex flex-col items-center px-6" style={{ zIndex: 1 }}>
        {/* Animated checkmark */}
        <div className="mb-6" style={{ width: 100, height: 100 }}>
          <svg width="100" height="100" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke={G3}
              strokeWidth="4"
              strokeDasharray="283"
              style={{ animation: 'scaleCircle 0.6s ease-out forwards' }}
            />
            <path
              d="M28 50 L44 66 L72 36"
              fill="none"
              stroke={G3}
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="120"
              strokeDashoffset="120"
              style={{ animation: 'drawCheck 0.5s ease-out 0.4s forwards' }}
            />
          </svg>
        </div>
        <p
          style={{ fontFamily: PP, fontSize: 36, fontWeight: 900, color: '#fff', marginBottom: 4 }}
        >
          ₦2,100 paid!
        </p>
        <p style={{ fontSize: 16, color: TEXT_SECONDARY, fontFamily: IT, marginBottom: 32 }}>
          Payment successful
        </p>
        {/* Receipt mini-card */}
        <div
          className="mb-8 w-full rounded-2xl p-4"
          style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
        >
          <div className="mb-2 flex justify-between">
            <p style={{ fontSize: 12, color: MUTED, fontFamily: IT }}>Payment method</p>
            <p style={{ fontSize: 12, color: '#fff', fontFamily: IT }}>DrippleX Wallet 💜</p>
          </div>
          <div className="mb-2 flex justify-between">
            <p style={{ fontSize: 12, color: MUTED, fontFamily: IT }}>Time</p>
            <p style={{ fontSize: 12, color: '#fff', fontFamily: IT }}>Today, 9:41 AM</p>
          </div>
          <div className="my-2 h-px" style={{ background: BORDER }} />
          <div className="flex justify-between">
            <p style={{ fontSize: 11, color: MUTED, fontFamily: IT }}>Transaction ID</p>
            <p
              style={{
                fontSize: 11,
                color: TEXT_SECONDARY,
                fontFamily: "'Courier New', monospace",
              }}
            >
              TXN-2024120500841
            </p>
          </div>
        </div>
        {/* Buttons */}
        <div className="flex w-full flex-col gap-3">
          <button
            className="h-12 w-full rounded-2xl text-sm font-semibold transition-all active:scale-[.97]"
            style={{
              background: 'transparent',
              border: `1.5px solid ${BORDER}`,
              color: TEXT_SECONDARY,
              fontFamily: PP,
            }}
            onClick={onReceipt || (() => {})}
          >
            View Receipt
          </button>
          <GreenButton label="Back to Home" onClick={onDone || (() => {})} />
        </div>
      </div>
    </div>
  );
}
