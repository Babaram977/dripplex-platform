import React, { useState, useEffect, useRef } from 'react';
import { G0, G2, G3, NAVY_DEEP, NAVY_CARD, NAVY_SURFACE, BORDER, MUTED } from './shared';
import {
  COLOR_STAR,
  COLOR_SUCCESS,
  COLOR_ERROR,
  COLOR_WARNING,
  TEXT_SECONDARY,
} from '../tokens/colors';

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER APP — DrippleX Ride Partner Platform
// Screens: Splash · Login · OTP · KYC Status · Upload Docs · Vehicle Reg ·
//          Dashboard · Go Online · Incoming Request · Nav to Pickup ·
//          Passenger Verify · Trip in Progress · Trip Complete · Earnings ·
//          Wallet · Trip History · Profile · Settings
// ─────────────────────────────────────────────────────────────────────────────

const PP = "'Poppins',sans-serif";
const IT = "'Inter',sans-serif";
const NAVY_BASE = '#0A1628';

// ─── Driver data ─────────────────────────────────────────────────────────────
const DRIVER = {
  name: 'Adeyemi Okafor',
  initials: 'AO',
  phone: '+234 801 234 5678',
  rating: 4.92,
  trips: 3847,
  plate: 'LAG 482 KA',
  vehicle: 'Toyota Camry 2019 (White)',
  level: 'Gold Driver',
  online: false,
  todayEarnings: 28400,
  weekEarnings: 142600,
  acceptance: 94,
  completion: 98,
};

const EARNINGS_DATA = [
  { day: 'Mon', amount: 18200, trips: 12 },
  { day: 'Tue', amount: 24500, trips: 16 },
  { day: 'Wed', amount: 21000, trips: 14 },
  { day: 'Thu', amount: 31200, trips: 20 },
  { day: 'Fri', amount: 38900, trips: 25 },
  { day: 'Sat', amount: 44100, trips: 28 },
  { day: 'Sun', amount: 28400, trips: 18 },
];

const TRIP_HISTORY_D = [
  {
    id: 'DRX-4921',
    time: '9:41 AM',
    from: 'Ikeja GRA',
    to: 'Victoria Island',
    fare: '₦2,100',
    duration: '22 min',
    rating: 5,
    status: 'completed',
  },
  {
    id: 'DRX-4920',
    time: '8:02 AM',
    from: 'Surulere',
    to: 'Lekki Phase 1',
    fare: '₦3,400',
    duration: '35 min',
    rating: 5,
    status: 'completed',
  },
  {
    id: 'DRX-4919',
    time: '6:45 AM',
    from: 'Yaba',
    to: 'Ikeja City Mall',
    fare: '₦1,850',
    duration: '18 min',
    rating: 4,
    status: 'completed',
  },
  {
    id: 'DRX-4918',
    time: 'Yesterday',
    from: 'VI',
    to: 'Maryland',
    fare: '₦2,600',
    duration: '28 min',
    rating: 0,
    status: 'cancelled',
  },
  {
    id: 'DRX-4917',
    time: 'Yesterday',
    from: 'Agege',
    to: 'Marina',
    fare: '₦4,100',
    duration: '45 min',
    rating: 5,
    status: 'completed',
  },
];

const WALLET_TXS = [
  {
    type: 'credit',
    label: 'Trip earnings',
    sub: 'DRX-4921 · 9:41 AM',
    amount: '+₦2,100',
    color: G3,
  },
  {
    type: 'credit',
    label: 'Trip earnings',
    sub: 'DRX-4920 · 8:02 AM',
    amount: '+₦3,400',
    color: G3,
  },
  {
    type: 'debit',
    label: 'Withdrawal',
    sub: 'GTBank •••• 1823',
    amount: '−₦20,000',
    color: COLOR_ERROR,
  },
  {
    type: 'credit',
    label: 'Trip earnings',
    sub: 'DRX-4919 · 6:45 AM',
    amount: '+₦1,850',
    color: G3,
  },
  { type: 'debit', label: 'Platform fee', sub: '5% commission', amount: '−₦358', color: '#F59E0B' },
];

const DOC_ITEMS = [
  { id: 'nin', label: 'NIN / National ID', icon: '🪪', status: 'verified' as const },
  { id: 'drivers', label: "Driver's Licence", icon: '🪪', status: 'verified' as const },
  { id: 'vehicle', label: 'Vehicle Paper', icon: '📄', status: 'verified' as const },
  { id: 'insurance', label: 'Insurance Cert', icon: '📋', status: 'pending' as const },
  { id: 'roadwort', label: 'Road Worthiness', icon: '📋', status: 'pending' as const },
  { id: 'photo', label: 'Passport Photo', icon: '🖼', status: 'verified' as const },
];

// ─────────────────────────────────────────────────────────────────────────────
// SHARED SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────
function DStatusBar({ light }: { light?: boolean }) {
  return (
    <div
      className="relative z-10 flex w-full items-center justify-between px-5 pt-[52px]"
      style={{
        fontFamily: IT,
        fontSize: 11,
        color: light ? 'rgba(255,255,255,.7)' : 'rgba(255,255,255,.45)',
      }}
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

function DBackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl transition-all active:scale-95"
      style={{ background: 'rgba(255,255,255,.06)', border: `1px solid ${BORDER}` }}
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
  );
}

function DGreenBtn({
  label,
  onClick,
  disabled,
  loading,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold transition-all duration-200 active:scale-[.97]"
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

function DInput({
  label,
  placeholder,
  value,
  onChange,
  type = 'text',
  prefix,
}: {
  label?: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  prefix?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div className="mb-4">
      {label && (
        <p
          className="mb-1.5 text-[13px] font-medium"
          style={{ fontFamily: IT, color: TEXT_SECONDARY }}
        >
          {label}
        </p>
      )}
      <div
        className="flex h-14 items-center gap-2 rounded-2xl px-4"
        style={{
          background: NAVY_SURFACE,
          border: `1px solid ${focused ? 'rgba(43,172,82,.4)' : BORDER}`,
          transition: 'border-color .2s',
        }}
      >
        {prefix && (
          <span className="text-[15px]" style={{ fontFamily: IT, color: MUTED }}>
            {prefix}
          </span>
        )}
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          type={type}
          placeholder={placeholder}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="flex-1 bg-transparent outline-none"
          style={{ fontFamily: IT, fontSize: 15, color: '#fff' }}
        />
      </div>
    </div>
  );
}

function DriverMapCanvas({ variant = 'default' }: { variant?: string }) {
  const configs: Record<
    string,
    { carX: number; carY: number; pinX: number; pinY: number; routeColor: string }
  > = {
    default: { carX: 195, carY: 200, pinX: 195, pinY: 200, routeColor: G2 },
    topickup: { carX: 80, carY: 240, pinX: 300, pinY: 90, routeColor: '#3B82F6' },
    inprogress: { carX: 160, carY: 160, pinX: 310, pinY: 80, routeColor: G2 },
  };
  const c = configs[variant] || configs.default;
  const midX = (c.carX + c.pinX) / 2;
  const midY = (c.carY + c.pinY) / 2 - 50;

  return (
    <svg width="390" height="280" viewBox="0 0 390 280" style={{ display: 'block' }}>
      <rect width="390" height="280" fill="#0D1B2E" />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
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
      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <line
          key={`v${i}`}
          x1={i * 50}
          y1="0"
          x2={i * 50}
          y2="280"
          stroke="rgba(255,255,255,.04)"
          strokeWidth="1"
        />
      ))}
      <line x1="0" y1="160" x2="390" y2="160" stroke="rgba(255,255,255,.07)" strokeWidth="2.5" />
      <line x1="195" y1="0" x2="195" y2="280" stroke="rgba(255,255,255,.07)" strokeWidth="2.5" />
      <line x1="0" y1="80" x2="390" y2="130" stroke="rgba(255,255,255,.04)" strokeWidth="1.5" />
      {[
        [30, 80, 24, 40],
        [60, 70, 18, 50],
        [130, 90, 28, 36],
        [280, 80, 22, 40],
        [310, 68, 30, 52],
        [340, 86, 20, 34],
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
      {variant !== 'default' && (
        <>
          <path
            d={`M${c.carX},${c.carY} Q${midX},${midY} ${c.pinX},${c.pinY}`}
            fill="none"
            stroke={`${c.routeColor}20`}
            strokeWidth="10"
            strokeLinecap="round"
          />
          <path
            d={`M${c.carX},${c.carY} Q${midX},${midY} ${c.pinX},${c.pinY}`}
            fill="none"
            stroke={c.routeColor}
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray="6 4"
          />
          <circle cx={c.pinX} cy={c.pinY} r="12" fill={`${c.routeColor}20`} />
          <circle cx={c.pinX} cy={c.pinY} r="7" fill={c.routeColor} />
          <circle cx={c.pinX} cy={c.pinY} r="3.5" fill="#fff" />
          <rect
            x={c.pinX - 1.5}
            y={c.pinY - 24}
            width="3"
            height="17"
            rx="1.5"
            fill={c.routeColor}
          />
        </>
      )}
      <g transform={`translate(${c.carX},${c.carY})`}>
        <circle r="20" fill="#0D1B2E" stroke={G2} strokeWidth="2" />
        <text textAnchor="middle" dominantBaseline="central" fontSize="18">
          🚗
        </text>
      </g>
      <defs>
        <linearGradient id="dMapFade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={NAVY_BASE} stopOpacity="0" />
          <stop offset="100%" stopColor={NAVY_BASE} stopOpacity="1" />
        </linearGradient>
      </defs>
      <rect width="390" height="280" fill="url(#dMapFade)" />
    </svg>
  );
}

function StatusPill({ online }: { online: boolean }) {
  return (
    <div
      className="flex items-center gap-1.5 rounded-full px-3 py-1.5"
      style={{
        background: online ? 'rgba(43,172,82,.12)' : 'rgba(255,255,255,.06)',
        border: `1px solid ${online ? 'rgba(43,172,82,.3)' : BORDER}`,
      }}
    >
      <div
        className="h-2 w-2 rounded-full"
        style={{ background: online ? G2 : MUTED, boxShadow: online ? `0 0 6px ${G2}` : 'none' }}
      />
      <span style={{ fontFamily: IT, fontSize: 12, color: online ? G3 : MUTED, fontWeight: 600 }}>
        {online ? 'Online' : 'Offline'}
      </span>
    </div>
  );
}

function EarningsBar({ data }: { data: typeof EARNINGS_DATA }) {
  const max = Math.max(...data.map((d) => d.amount));
  const today = data[data.length - 1];
  return (
    <div className="flex h-20 items-end gap-2">
      {data.map((d, i) => {
        const isToday = i === data.length - 1;
        const pct = (d.amount / max) * 100;
        return (
          <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="w-full overflow-hidden rounded-lg"
              style={{ height: 56, background: 'rgba(255,255,255,.04)' }}
            >
              <div
                className="w-full rounded-lg transition-all duration-700"
                style={{
                  height: `${pct}%`,
                  marginTop: `${100 - pct}%`,
                  background: isToday
                    ? `linear-gradient(180deg,${G3},${G0})`
                    : `rgba(43,172,82,.25)`,
                  boxShadow: isToday ? `0 0 12px rgba(43,172,82,.4)` : 'none',
                }}
              />
            </div>
            <p className="text-[10px]" style={{ fontFamily: IT, color: isToday ? G3 : MUTED }}>
              {d.day}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function DriverBottomNav({
  active,
  onChange,
}: {
  active: 'dash' | 'trips' | 'earnings' | 'wallet' | 'profile';
  onChange: (t: 'dash' | 'trips' | 'earnings' | 'wallet' | 'profile') => void;
}) {
  const tabs = [
    { key: 'dash' as const, icon: '🏠', label: 'Home' },
    { key: 'trips' as const, icon: '🗺', label: 'Trips' },
    { key: 'earnings' as const, icon: '📈', label: 'Earn' },
    { key: 'wallet' as const, icon: '💳', label: 'Wallet' },
    { key: 'profile' as const, icon: '👤', label: 'Profile' },
  ];
  return (
    <div className="flex-shrink-0 border-t" style={{ background: NAVY_BASE, borderColor: BORDER }}>
      <div className="flex">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className="flex flex-1 flex-col items-center gap-1 py-3 transition-all active:scale-95"
          >
            <span
              style={{
                fontSize: 20,
                filter: active === t.key ? 'none' : 'grayscale(1) opacity(.4)',
              }}
            >
              {t.icon}
            </span>
            <span
              style={{
                fontFamily: IT,
                fontSize: 10,
                color: active === t.key ? G3 : MUTED,
                fontWeight: active === t.key ? 600 : 400,
              }}
            >
              {t.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER-001 — SPLASH
// ─────────────────────────────────────────────────────────────────────────────
export function DriverSplashScreen({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2800);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-8"
      style={{ background: `linear-gradient(160deg,#040C18 0%,#060E1C 50%,${G0}18 100%)` }}
    >
      {/* Ambient */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute left-1/2 top-0 h-80 w-80 -translate-x-1/2 rounded-full"
          style={{ background: `radial-gradient(circle,${G2}22 0%,transparent 70%)` }}
        />
      </div>

      <div
        className="flex flex-col items-center gap-6"
        style={{ animation: 'fade-up .7s ease both' }}
      >
        {/* Logo mark */}
        <div className="relative flex h-24 w-24 items-center justify-center">
          <div
            className="absolute inset-0 rounded-3xl"
            style={{
              background: `linear-gradient(135deg,${G0},${G2})`,
              boxShadow: `0 0 64px rgba(43,172,82,.4)`,
            }}
          />
          <span style={{ fontSize: 44, position: 'relative' }}>🚗</span>
        </div>

        <div className="text-center">
          <p
            className="text-[28px] font-bold tracking-tight"
            style={{ fontFamily: PP, color: '#fff' }}
          >
            DrippleX
          </p>
          <div className="mt-1 flex items-center justify-center gap-2">
            <div className="h-px w-8" style={{ background: 'rgba(255,255,255,.15)' }} />
            <p
              className="text-[13px] font-semibold uppercase tracking-widest"
              style={{ fontFamily: IT, color: G3 }}
            >
              Driver
            </p>
            <div className="h-px w-8" style={{ background: 'rgba(255,255,255,.15)' }} />
          </div>
        </div>
      </div>

      <div className="absolute bottom-20 flex flex-col items-center gap-3">
        <div
          className="h-1.5 w-10 overflow-hidden rounded-full"
          style={{ background: 'rgba(255,255,255,.08)' }}
        >
          <div
            className="h-full rounded-full"
            style={{ background: G2, animation: 'bar-fill 2.6s ease-in-out forwards' }}
          />
        </div>
        <p className="text-[12px]" style={{ fontFamily: IT, color: MUTED }}>
          Powered by DrippleX
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER-002 — LOGIN
// ─────────────────────────────────────────────────────────────────────────────
export function DriverLoginScreen({
  onContinue,
  onBack,
}: {
  onContinue: () => void;
  onBack: () => void;
}) {
  const [phone, setPhone] = useState('801 234 5678');
  const [loading, setLoading] = useState(false);

  const handleContinue = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onContinue();
    }, 1200);
  };

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: NAVY_BASE }}
    >
      <DStatusBar />
      <div className="flex-1 overflow-y-auto px-5 pb-8">
        <div className="mb-8 pt-4">
          <DBackBtn onClick={onBack} />
        </div>

        {/* Header */}
        <div className="mb-8">
          <div
            className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-2xl"
            style={{
              background: `linear-gradient(135deg,${G0},${G2})`,
              boxShadow: `0 8px 28px rgba(43,172,82,.3)`,
            }}
          >
            🚗
          </div>
          <p className="mb-1 text-[26px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
            Welcome back,
          </p>
          <p className="mb-2 text-[26px] font-bold" style={{ fontFamily: PP, color: G3 }}>
            Driver Partner
          </p>
          <p className="text-[14px]" style={{ fontFamily: IT, color: MUTED }}>
            Enter your phone number to continue
          </p>
        </div>

        {/* Phone input */}
        <div className="mb-4">
          <p
            className="mb-2 text-[13px] font-medium"
            style={{ fontFamily: IT, color: TEXT_SECONDARY }}
          >
            Phone Number
          </p>
          <div
            className="flex h-14 items-center overflow-hidden rounded-2xl"
            style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
          >
            <div
              className="flex h-full items-center gap-2 border-r px-4"
              style={{ borderColor: BORDER }}
            >
              <span>🇳🇬</span>
              <span style={{ fontFamily: IT, fontSize: 14, color: TEXT_SECONDARY }}>+234</span>
            </div>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="flex-1 bg-transparent px-4 outline-none"
              style={{ fontFamily: IT, fontSize: 15, color: '#fff' }}
            />
          </div>
        </div>

        {/* Stats highlight */}
        <div
          className="mb-8 flex gap-3 rounded-2xl p-4"
          style={{ background: 'rgba(43,172,82,.06)', border: '1px solid rgba(43,172,82,.12)' }}
        >
          {[
            ['₦142K', 'This Week'],
            ['4.92★', 'Rating'],
            ['94%', 'Acceptance'],
          ].map(([v, l]) => (
            <div key={l} className="flex-1 text-center">
              <p className="text-[15px] font-bold" style={{ fontFamily: PP, color: G3 }}>
                {v}
              </p>
              <p className="text-[11px]" style={{ fontFamily: IT, color: MUTED }}>
                {l}
              </p>
            </div>
          ))}
        </div>

        <DGreenBtn label={loading ? '' : 'Continue →'} onClick={handleContinue} loading={loading} />

        <p className="mt-4 text-center text-[12px]" style={{ fontFamily: IT, color: MUTED }}>
          New driver partner? <span style={{ color: G3 }}>Apply to join →</span>
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER-003 — OTP VERIFICATION
// ─────────────────────────────────────────────────────────────────────────────
export function DriverOTPScreen({
  onVerified,
  onBack,
}: {
  onVerified: () => void;
  onBack: () => void;
}) {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [resent, setResent] = useState(false);
  const [countdown, setCountdown] = useState(59);
  const [verified, setVerified] = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [countdown]);

  const handleChange = (i: number, v: string) => {
    if (!/^\d*$/.test(v)) return;
    const next = [...otp];
    next[i] = v.slice(-1);
    setOtp(next);
    if (v && i < 5) refs.current[i + 1]?.focus();
    if (next.every((d) => d) && next.join('') === '123456') {
      setVerified(true);
      setTimeout(onVerified, 800);
    }
  };

  const handleKey = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) refs.current[i - 1]?.focus();
  };

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: NAVY_BASE }}
    >
      <DStatusBar />
      <div className="flex-1 overflow-y-auto px-5 pb-8">
        <div className="mb-8 pt-4">
          <DBackBtn onClick={onBack} />
        </div>
        <div className="mb-8">
          <p className="mb-1 text-[26px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
            Enter OTP
          </p>
          <p className="text-[14px]" style={{ fontFamily: IT, color: MUTED }}>
            Sent to +234 801 234 5678. <span style={{ color: G3, cursor: 'pointer' }}>Change</span>
          </p>
        </div>

        {/* OTP boxes */}
        <div className="mb-3 flex gap-2.5">
          {otp.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                refs.current[i] = el;
              }}
              value={d}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKey(i, e)}
              maxLength={1}
              inputMode="numeric"
              className="h-14 flex-1 rounded-2xl text-center text-[22px] font-bold outline-none transition-all"
              style={{
                background: verified ? 'rgba(43,172,82,.12)' : NAVY_SURFACE,
                border: `1.5px solid ${d ? (verified ? G2 : 'rgba(43,172,82,.5)') : BORDER}`,
                color: '#fff',
                fontFamily: PP,
                boxShadow: d && !verified ? `0 0 12px rgba(43,172,82,.15)` : 'none',
              }}
            />
          ))}
        </div>

        {/* Demo hint */}
        <p className="mb-8 text-center text-[12px]" style={{ fontFamily: IT, color: MUTED }}>
          Demo: enter <span style={{ color: G3 }}>123456</span> to verify
        </p>

        {/* Resend */}
        <div className="mb-8 flex items-center justify-center gap-2">
          {countdown > 0 ? (
            <p style={{ fontFamily: IT, fontSize: 13, color: MUTED }}>
              Resend in <span style={{ color: G3 }}>0:{String(countdown).padStart(2, '0')}</span>
            </p>
          ) : (
            <button
              onClick={() => {
                setResent(true);
                setCountdown(59);
              }}
              style={{ fontFamily: IT, fontSize: 13, color: G3 }}
            >
              Resend OTP
            </button>
          )}
        </div>

        {verified && (
          <div
            className="flex flex-col items-center gap-3"
            style={{ animation: 'success-bounce .5s ease' }}
          >
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full text-3xl"
              style={{
                background: `linear-gradient(135deg,${G0},${G2})`,
                boxShadow: `0 0 32px rgba(43,172,82,.4)`,
              }}
            >
              ✅
            </div>
            <p style={{ fontFamily: PP, fontSize: 16, color: '#fff' }}>Verified!</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER-004 — KYC STATUS
// ─────────────────────────────────────────────────────────────────────────────
export function DriverKYCStatusScreen({
  onContinue,
  onUpload,
  onBack,
}: {
  onContinue: () => void;
  onUpload: () => void;
  onBack: () => void;
}) {
  const verified = DOC_ITEMS.filter((d) => d.status === 'verified').length;
  const total = DOC_ITEMS.length;
  const pct = Math.round((verified / total) * 100);
  const allDone = verified === total;

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: NAVY_BASE }}
    >
      <DStatusBar />
      <div className="flex-1 overflow-y-auto px-5 pb-8">
        <div className="mb-6 flex items-center gap-3 pt-4">
          <DBackBtn onClick={onBack} />
          <p className="text-[17px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
            KYC Verification
          </p>
        </div>

        {/* Progress ring area */}
        <div className="mb-6 flex flex-col items-center">
          <div className="relative mb-4 h-28 w-28">
            <svg width="112" height="112" viewBox="0 0 112 112">
              <circle
                cx="56"
                cy="56"
                r="48"
                fill="none"
                stroke="rgba(255,255,255,.06)"
                strokeWidth="8"
              />
              <circle
                cx="56"
                cy="56"
                r="48"
                fill="none"
                stroke={allDone ? G2 : '#F59E0B'}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${(pct / 100) * 301.6} 301.6`}
                transform="rotate(-90 56 56)"
                style={{
                  transition: 'stroke-dasharray 1s ease',
                  filter: `drop-shadow(0 0 8px ${allDone ? G2 : '#F59E0B'}60)`,
                }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-[22px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
                {pct}%
              </p>
              <p className="text-[11px]" style={{ fontFamily: IT, color: MUTED }}>
                Complete
              </p>
            </div>
          </div>

          <div
            className={`rounded-full px-4 py-1.5 text-[12px] font-bold`}
            style={{
              background: allDone ? 'rgba(43,172,82,.12)' : 'rgba(245,158,11,.1)',
              color: allDone ? G3 : '#F59E0B',
              fontFamily: IT,
            }}
          >
            {allDone ? '✅ All documents verified' : `⏳ ${total - verified} documents pending`}
          </div>
        </div>

        {/* Doc checklist */}
        <div className="mb-6 flex flex-col gap-2.5">
          {DOC_ITEMS.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-3 rounded-2xl p-3.5"
              style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
            >
              <span style={{ fontSize: 22, flexShrink: 0 }}>{doc.icon}</span>
              <p
                className="flex-1 text-[14px] font-medium"
                style={{ fontFamily: IT, color: '#fff' }}
              >
                {doc.label}
              </p>
              <div
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1`}
                style={{
                  background:
                    doc.status === 'verified' ? 'rgba(43,172,82,.1)' : 'rgba(245,158,11,.08)',
                  border: `1px solid ${doc.status === 'verified' ? 'rgba(43,172,82,.2)' : 'rgba(245,158,11,.15)'}`,
                }}
              >
                <span style={{ fontSize: 10 }}>{doc.status === 'verified' ? '✅' : '⏳'}</span>
                <span
                  className="text-[10px] font-bold capitalize"
                  style={{ fontFamily: IT, color: doc.status === 'verified' ? G3 : '#F59E0B' }}
                >
                  {doc.status}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          <DGreenBtn
            label={allDone ? 'Proceed to Dashboard →' : 'Upload Missing Docs →'}
            onClick={allDone ? onContinue : onUpload}
          />
          {!allDone && (
            <button
              onClick={onContinue}
              className="flex h-12 w-full items-center justify-center rounded-2xl text-[14px] font-medium active:scale-[.97]"
              style={{
                background: NAVY_SURFACE,
                border: `1px solid ${BORDER}`,
                fontFamily: IT,
                color: MUTED,
              }}
            >
              Continue anyway (limited access)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER-005 — UPLOAD DOCUMENTS
// ─────────────────────────────────────────────────────────────────────────────
export function DriverUploadDocsScreen({
  onBack,
  onSave,
}: {
  onBack: () => void;
  onSave: () => void;
}) {
  const pending = DOC_ITEMS.filter((d) => d.status === 'pending');
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<string[]>([]);

  const handleUpload = (id: string) => {
    setUploading(id);
    setTimeout(() => {
      setUploading(null);
      setUploaded((p) => [...p, id]);
    }, 1800);
  };

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: NAVY_BASE }}
    >
      <DStatusBar />
      <div className="flex-1 overflow-y-auto px-5 pb-8">
        <div className="mb-6 flex items-center gap-3 pt-4">
          <DBackBtn onClick={onBack} />
          <div>
            <p className="text-[17px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
              Upload Documents
            </p>
            <p className="text-[12px]" style={{ fontFamily: IT, color: MUTED }}>
              {pending.length} pending
            </p>
          </div>
        </div>

        {/* Tips */}
        <div
          className="mb-5 flex gap-3 rounded-2xl p-4"
          style={{ background: 'rgba(59,130,246,.06)', border: '1px solid rgba(59,130,246,.15)' }}
        >
          <span style={{ fontSize: 20, flexShrink: 0 }}>💡</span>
          <p style={{ fontFamily: IT, fontSize: 13, color: TEXT_SECONDARY, lineHeight: 1.5 }}>
            Documents should be clear, unblurred photos. All 4 corners must be visible. Files must
            be under 5MB.
          </p>
        </div>

        <div className="mb-6 flex flex-col gap-4">
          {pending.map((doc) => {
            const done = uploaded.includes(doc.id);
            const busy = uploading === doc.id;
            return (
              <div
                key={doc.id}
                className="overflow-hidden rounded-2xl"
                style={{
                  background: NAVY_SURFACE,
                  border: `1px solid ${done ? 'rgba(43,172,82,.3)' : BORDER}`,
                }}
              >
                <div className="flex items-center gap-3 p-4">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-2xl text-xl"
                    style={{ background: done ? 'rgba(43,172,82,.12)' : 'rgba(255,255,255,.04)' }}
                  >
                    {done ? '✅' : doc.icon}
                  </div>
                  <div className="flex-1">
                    <p
                      className="text-[14px] font-semibold"
                      style={{ fontFamily: PP, color: '#fff' }}
                    >
                      {doc.label}
                    </p>
                    <p className="text-[12px]" style={{ fontFamily: IT, color: done ? G3 : MUTED }}>
                      {done ? 'Uploaded — under review' : 'Required · PDF or image'}
                    </p>
                  </div>
                </div>
                {!done && (
                  <div className="flex gap-2 px-4 pb-4">
                    <button
                      onClick={() => handleUpload(doc.id)}
                      disabled={busy}
                      className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl text-[13px] font-semibold active:scale-[.97]"
                      style={{
                        background: `linear-gradient(135deg,${G0},${G2})`,
                        color: '#fff',
                        fontFamily: IT,
                        boxShadow: `0 4px 16px rgba(43,172,82,.3)`,
                      }}
                    >
                      {busy ? (
                        <>
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            style={{ animation: 'spin 1s linear infinite' }}
                          >
                            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" />
                          </svg>{' '}
                          Uploading...
                        </>
                      ) : (
                        '📤 Upload'
                      )}
                    </button>
                    <button
                      className="h-10 rounded-xl px-4 text-[13px] font-medium active:scale-[.97]"
                      style={{
                        background: 'rgba(255,255,255,.04)',
                        border: `1px solid ${BORDER}`,
                        color: MUTED,
                        fontFamily: IT,
                      }}
                    >
                      📷 Camera
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <DGreenBtn
          label={
            uploaded.length === pending.length ? 'Submit for Review →' : `Upload All to Continue`
          }
          onClick={onSave}
          disabled={uploaded.length < pending.length}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER-006 — VEHICLE REGISTRATION
// ─────────────────────────────────────────────────────────────────────────────
export function DriverVehicleRegScreen({
  onBack,
  onSave,
}: {
  onBack: () => void;
  onSave: () => void;
}) {
  const [make, setMake] = useState('Toyota');
  const [model, setModel] = useState('Camry');
  const [year, setYear] = useState('2019');
  const [colour, setColour] = useState('White');
  const [plate, setPlate] = useState('LAG 482 KA');
  const [seats, setSeats] = useState('4');
  const [loading, setLoading] = useState(false);

  const handleSave = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onSave();
    }, 1400);
  };

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: NAVY_BASE }}
    >
      <DStatusBar />
      <div className="flex-1 overflow-y-auto px-5 pb-8">
        <div className="mb-6 flex items-center gap-3 pt-4">
          <DBackBtn onClick={onBack} />
          <div>
            <p className="text-[17px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
              Vehicle Registration
            </p>
            <p className="text-[12px]" style={{ fontFamily: IT, color: MUTED }}>
              Your ride partner vehicle
            </p>
          </div>
        </div>

        {/* Vehicle preview card */}
        <div
          className="mb-6 flex items-center gap-4 rounded-2xl p-4"
          style={{ background: 'rgba(43,172,82,.06)', border: '1px solid rgba(43,172,82,.14)' }}
        >
          <div
            className="flex h-16 w-16 items-center justify-center rounded-2xl text-3xl"
            style={{ background: 'rgba(43,172,82,.1)' }}
          >
            🚗
          </div>
          <div>
            <p className="text-[16px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
              {make} {model} {year}
            </p>
            <p className="text-[13px]" style={{ fontFamily: IT, color: MUTED }}>
              {colour} · {plate || 'No plate yet'}
            </p>
            <div className="mt-1 flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full" style={{ background: G2 }} />
              <p className="text-[11px]" style={{ fontFamily: IT, color: G3 }}>
                Economy Class
              </p>
            </div>
          </div>
        </div>

        <DInput label="Make (Brand)" placeholder="e.g. Toyota" value={make} onChange={setMake} />
        <DInput label="Model" placeholder="e.g. Camry" value={model} onChange={setModel} />
        <DInput
          label="Year"
          placeholder="e.g. 2019"
          value={year}
          onChange={setYear}
          type="number"
        />
        <DInput label="Colour" placeholder="e.g. White" value={colour} onChange={setColour} />
        <DInput
          label="Plate Number"
          placeholder="e.g. LAG 482 KA"
          value={plate}
          onChange={setPlate}
        />
        <DInput
          label="Passenger Seats"
          placeholder="e.g. 4"
          value={seats}
          onChange={setSeats}
          type="number"
        />

        <div
          className="mb-6 flex gap-3 rounded-2xl p-4"
          style={{ background: 'rgba(245,158,11,.06)', border: '1px solid rgba(245,158,11,.12)' }}
        >
          <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
          <p style={{ fontFamily: IT, fontSize: 12, color: TEXT_SECONDARY, lineHeight: 1.5 }}>
            Vehicle must not be older than 12 years. Ensure all details match your vehicle paper
            exactly.
          </p>
        </div>

        <DGreenBtn label="Save Vehicle →" onClick={handleSave} loading={loading} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER-007 — DASHBOARD (hub for tabs: dash / trips / earnings / wallet / profile)
// ─────────────────────────────────────────────────────────────────────────────
export function DriverDashboardScreen({
  onRequest,
  onSettings,
}: {
  onRequest: () => void;
  onSettings: () => void;
}) {
  const [online, setOnline] = useState(false);
  const [tab, setTab] = useState<'dash' | 'trips' | 'earnings' | 'wallet' | 'profile'>('dash');
  const [toggling, setToggling] = useState(false);

  const handleToggle = () => {
    setToggling(true);
    setTimeout(() => {
      setOnline((o) => !o);
      setToggling(false);
    }, 600);
    if (!online) setTimeout(onRequest, 4000);
  };

  const handleTabChange = (t: typeof tab) => setTab(t);

  if (tab === 'trips') return <DriverTripsTab onBack={() => setTab('dash')} />;
  if (tab === 'earnings') return <DriverEarningsTab onBack={() => setTab('dash')} />;
  if (tab === 'wallet') return <DriverWalletTab onBack={() => setTab('dash')} />;
  if (tab === 'profile')
    return <DriverProfileTab onBack={() => setTab('dash')} onSettings={onSettings} />;

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: NAVY_DEEP }}
    >
      <DStatusBar />
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        {/* Map */}
        <div className="relative flex-shrink-0">
          <DriverMapCanvas variant={online ? 'default' : 'default'} />
          {/* Header overlay */}
          <div className="absolute left-0 right-0 top-0 px-5 pt-1">
            <div className="flex items-center justify-between">
              {/* Driver avatar */}
              <div className="flex items-center gap-2">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-bold"
                  style={{
                    background: `linear-gradient(135deg,${G0},${G2})`,
                    color: '#fff',
                    fontFamily: PP,
                  }}
                >
                  {DRIVER.initials}
                </div>
                <div>
                  <p className="text-[13px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
                    {DRIVER.name.split(' ')[0]}
                  </p>
                  <p className="text-[11px]" style={{ fontFamily: IT, color: MUTED }}>
                    {DRIVER.level}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusPill online={online} />
                <button
                  onClick={onSettings}
                  className="flex h-9 w-9 items-center justify-center rounded-xl"
                  style={{
                    background: 'rgba(6,14,28,.85)',
                    border: `1px solid ${BORDER}`,
                    backdropFilter: 'blur(12px)',
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="rgba(255,255,255,.6)"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom content */}
        <div style={{ background: NAVY_BASE }}>
          {/* Today's stats */}
          <div className="px-5 pb-4 pt-4">
            <div className="mb-4 flex gap-3">
              {[
                {
                  v: `₦${DRIVER.todayEarnings.toLocaleString()}`,
                  l: "Today's Earnings",
                  color: G3,
                },
                {
                  v: TRIP_HISTORY_D.filter((t) => t.status === 'completed').length.toString(),
                  l: 'Trips Today',
                  color: '#fff',
                },
                { v: `${DRIVER.rating}★`, l: 'Rating', color: COLOR_STAR },
              ].map((s) => (
                <div
                  key={s.l}
                  className="flex flex-1 flex-col items-center gap-1 rounded-2xl py-3"
                  style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
                >
                  <p className="text-[16px] font-bold" style={{ fontFamily: PP, color: s.color }}>
                    {s.v}
                  </p>
                  <p
                    className="text-center text-[10px] leading-tight"
                    style={{ fontFamily: IT, color: MUTED }}
                  >
                    {s.l}
                  </p>
                </div>
              ))}
            </div>

            {/* Go online/offline toggle */}
            <button
              onClick={handleToggle}
              disabled={toggling}
              className="flex h-16 w-full items-center justify-center gap-3 rounded-2xl text-[17px] font-bold transition-all duration-300 active:scale-[.97]"
              style={{
                background: toggling
                  ? 'rgba(255,255,255,.06)'
                  : online
                    ? 'rgba(239,68,68,.1)'
                    : `linear-gradient(135deg,${G0},${G2})`,
                border: toggling
                  ? `1px solid ${BORDER}`
                  : online
                    ? '1.5px solid rgba(239,68,68,.3)'
                    : 'none',
                color: toggling ? MUTED : online ? '#EF4444' : '#fff',
                boxShadow: !toggling && !online ? `0 10px 36px rgba(43,172,82,.36)` : 'none',
                fontFamily: PP,
              }}
            >
              {toggling ? (
                <svg
                  width="20"
                  height="20"
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
                <>
                  <span style={{ fontSize: 22 }}>{online ? '⏹' : '▶'}</span>
                  {online ? 'Go Offline' : 'Go Online — Start Earning'}
                </>
              )}
            </button>

            {online && (
              <div
                className="mt-3 flex items-center justify-center gap-2 rounded-2xl py-3"
                style={{
                  background: 'rgba(43,172,82,.06)',
                  border: '1px solid rgba(43,172,82,.12)',
                  animation: 'fade-in .4s ease',
                }}
              >
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ background: G2, animation: 'pulse-ring .8s ease-out infinite' }}
                />
                <p style={{ fontFamily: IT, fontSize: 13, color: G3 }}>
                  You are live · Waiting for ride requests...
                </p>
              </div>
            )}
          </div>

          {/* Performance */}
          <div className="px-5 pb-5">
            <p className="mb-3 text-[13px] font-semibold" style={{ fontFamily: PP, color: MUTED }}>
              PERFORMANCE
            </p>
            {[
              { label: 'Acceptance Rate', value: DRIVER.acceptance, color: G2 },
              { label: 'Completion Rate', value: DRIVER.completion, color: '#3B82F6' },
            ].map((p) => (
              <div key={p.label} className="mb-3">
                <div className="mb-1.5 flex justify-between">
                  <p className="text-[13px]" style={{ fontFamily: IT, color: TEXT_SECONDARY }}>
                    {p.label}
                  </p>
                  <p
                    className="text-[13px] font-semibold"
                    style={{ fontFamily: IT, color: '#fff' }}
                  >
                    {p.value}%
                  </p>
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full"
                  style={{ background: 'rgba(255,255,255,.06)' }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${p.value}%`, background: p.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <DriverBottomNav active={tab} onChange={handleTabChange} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER-008 — INCOMING RIDE REQUEST
// ─────────────────────────────────────────────────────────────────────────────
export function DriverIncomingRequestScreen({
  onAccept,
  onDecline,
}: {
  onAccept: () => void;
  onDecline: () => void;
}) {
  const [countdown, setCountdown] = useState(15);

  useEffect(() => {
    if (countdown <= 0) {
      onDecline();
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const pct = (countdown / 15) * 100;

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: NAVY_DEEP }}
    >
      <DStatusBar />

      {/* Map */}
      <div className="relative flex-shrink-0">
        <DriverMapCanvas variant="topickup" />
        {/* Notification dot */}
        <div
          className="absolute right-5 top-[68px] h-3 w-3 rounded-full"
          style={{
            background: '#EF4444',
            boxShadow: '0 0 8px #EF4444',
            animation: 'pulse-ring .8s ease-out infinite',
          }}
        />
      </div>

      {/* Request card */}
      <div
        className="flex flex-1 flex-col"
        style={{ background: NAVY_BASE, borderRadius: '28px 28px 0 0', marginTop: -24 }}
      >
        <div className="flex justify-center pb-2 pt-3">
          <div className="h-1 w-10 rounded-full" style={{ background: 'rgba(255,255,255,.15)' }} />
        </div>

        {/* Timer bar */}
        <div
          className="mx-5 mb-4 h-1.5 overflow-hidden rounded-full"
          style={{ background: 'rgba(255,255,255,.06)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{
              width: `${pct}%`,
              background: pct > 40 ? G2 : pct > 20 ? '#F59E0B' : '#EF4444',
            }}
          />
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-6">
          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p
                className="mb-0.5 text-[11px] font-bold tracking-widest"
                style={{ fontFamily: IT, color: G3 }}
              >
                NEW RIDE REQUEST
              </p>
              <p className="text-[20px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
                Economy · ₦2,100
              </p>
            </div>
            <div
              className="flex h-14 w-14 flex-col items-center justify-center rounded-2xl"
              style={{
                background: pct > 20 ? 'rgba(43,172,82,.1)' : 'rgba(239,68,68,.1)',
                border: `2px solid ${pct > 20 ? 'rgba(43,172,82,.3)' : 'rgba(239,68,68,.3)'}`,
              }}
            >
              <p
                className="text-[22px] font-bold leading-none"
                style={{ fontFamily: PP, color: pct > 20 ? G3 : '#EF4444' }}
              >
                {countdown}
              </p>
              <p className="text-[10px]" style={{ fontFamily: IT, color: MUTED }}>
                sec
              </p>
            </div>
          </div>

          {/* Route */}
          <div
            className="mb-4 rounded-2xl p-4"
            style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
          >
            <div className="flex gap-3">
              <div className="flex flex-shrink-0 flex-col items-center gap-1 pt-1">
                <div className="h-2.5 w-2.5 rounded-full" style={{ background: G2 }} />
                <div className="h-6 w-px" style={{ background: BORDER }} />
                <div className="h-2.5 w-2.5 rounded-full" style={{ background: '#EF4444' }} />
              </div>
              <div className="flex-1">
                <div className="mb-3">
                  <p className="mb-0.5 text-[11px]" style={{ fontFamily: IT, color: MUTED }}>
                    PICKUP · 1.2 km away
                  </p>
                  <p
                    className="text-[14px] font-semibold"
                    style={{ fontFamily: PP, color: '#fff' }}
                  >
                    Ikeja GRA, Lagos
                  </p>
                </div>
                <div>
                  <p className="mb-0.5 text-[11px]" style={{ fontFamily: IT, color: MUTED }}>
                    DROP-OFF · 14 km
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
            <div className="mt-1 flex gap-3 border-t pt-3" style={{ borderColor: BORDER }}>
              {[
                ['~3 min', 'To Pickup'],
                ['22 min', 'Trip Duration'],
                ['₦2,100', 'Your Fare'],
              ].map(([v, l]) => (
                <div key={l} className="flex-1 text-center">
                  <p className="text-[14px] font-bold" style={{ fontFamily: PP, color: G3 }}>
                    {v}
                  </p>
                  <p className="text-[10px]" style={{ fontFamily: IT, color: MUTED }}>
                    {l}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Passenger preview */}
          <div
            className="mb-5 flex items-center gap-3 rounded-2xl p-3"
            style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
          >
            <div
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl text-lg font-bold"
              style={{ background: 'rgba(59,130,246,.15)', color: '#fff', fontFamily: PP }}
            >
              C
            </div>
            <div className="flex-1">
              <p className="text-[14px] font-semibold" style={{ fontFamily: PP, color: '#fff' }}>
                Chidi O.
              </p>
              <div className="flex items-center gap-1">
                <span style={{ color: COLOR_STAR, fontSize: 12 }}>★</span>
                <span className="text-[12px]" style={{ fontFamily: IT, color: MUTED }}>
                  4.8 · 42 trips
                </span>
              </div>
            </div>
            <div className="text-center">
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={{ background: 'rgba(43,172,82,.1)', color: G3, fontFamily: IT }}
              >
                Verified
              </span>
            </div>
          </div>

          {/* CTA */}
          <div className="flex gap-3">
            <button
              onClick={onDecline}
              className="flex h-14 w-16 flex-shrink-0 items-center justify-center rounded-2xl active:scale-[.95]"
              style={{
                background: 'rgba(239,68,68,.08)',
                border: '1.5px solid rgba(239,68,68,.2)',
              }}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#EF4444"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
            <DGreenBtn label="✓  Accept Ride" onClick={onAccept} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER-009 — NAVIGATION TO PICKUP
// ─────────────────────────────────────────────────────────────────────────────
export function DriverNavToPickupScreen({
  onArrived,
  onBack,
}: {
  onArrived: () => void;
  onBack: () => void;
}) {
  const [eta, setEta] = useState(3);
  const [dist, setDist] = useState(1.2);

  useEffect(() => {
    const t = setInterval(() => {
      setEta((e) => Math.max(0, e - 1));
      setDist((d) => Math.max(0, parseFloat((d - 0.2).toFixed(1))));
    }, 4000);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: NAVY_DEEP }}
    >
      {/* Full-screen map */}
      <div className="relative flex-shrink-0" style={{ height: 360 }}>
        <DriverMapCanvas variant="topickup" />
        <div className="absolute inset-0">
          <DStatusBar />
          <div className="mt-3 flex justify-between px-5">
            <DBackBtn onClick={onBack} />
            <div
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5"
              style={{ background: 'rgba(59,130,246,.85)', backdropFilter: 'blur(12px)' }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#fff"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span style={{ fontFamily: IT, fontSize: 12, color: '#fff', fontWeight: 600 }}>
                To Pickup
              </span>
            </div>
          </div>
        </div>
        {/* ETA overlay */}
        <div className="absolute left-1/2 -translate-x-1/2" style={{ bottom: 80 }}>
          <div
            className="flex items-center gap-3 rounded-2xl px-4 py-2"
            style={{
              background: 'rgba(6,14,28,.9)',
              border: `1px solid ${BORDER}`,
              backdropFilter: 'blur(16px)',
            }}
          >
            <p className="text-[24px] font-bold" style={{ fontFamily: PP, color: '#3B82F6' }}>
              {eta} min
            </p>
            <div className="h-6 w-px" style={{ background: BORDER }} />
            <p className="text-[14px]" style={{ fontFamily: IT, color: TEXT_SECONDARY }}>
              {dist} km
            </p>
          </div>
        </div>
      </div>

      {/* Bottom panel */}
      <div className="flex flex-1 flex-col gap-3 px-5 py-4" style={{ background: NAVY_BASE }}>
        {/* Pickup address */}
        <div
          className="flex items-center gap-3 rounded-2xl p-3"
          style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
        >
          <div className="h-3 w-3 flex-shrink-0 rounded-full" style={{ background: G2 }} />
          <div>
            <p className="text-[12px]" style={{ fontFamily: IT, color: MUTED }}>
              PICKUP POINT
            </p>
            <p className="text-[14px] font-semibold" style={{ fontFamily: PP, color: '#fff' }}>
              Ikeja GRA, Lagos
            </p>
          </div>
        </div>

        {/* Passenger info */}
        <div
          className="flex items-center gap-3 rounded-2xl p-3"
          style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
        >
          <div
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl font-bold"
            style={{ background: 'rgba(59,130,246,.15)', color: '#fff', fontFamily: PP }}
          >
            C
          </div>
          <div className="flex-1">
            <p className="text-[14px] font-semibold" style={{ fontFamily: PP, color: '#fff' }}>
              Chidi O.
            </p>
            <p className="text-[12px]" style={{ fontFamily: IT, color: MUTED }}>
              Passenger · {eta} min ETA
            </p>
          </div>
          <button
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: 'rgba(43,172,82,.1)', border: '1px solid rgba(43,172,82,.2)' }}
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

        <DGreenBtn label="I've Arrived at Pickup →" onClick={onArrived} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER-010 — PASSENGER VERIFICATION (OTP)
// ─────────────────────────────────────────────────────────────────────────────
export function DriverPassengerVerifyScreen({
  onVerified,
  onBack,
}: {
  onVerified: () => void;
  onBack: () => void;
}) {
  const [otp, setOtp] = useState(['', '', '', '']);
  const [verified, setVerified] = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (i: number, v: string) => {
    if (!/^\d*$/.test(v)) return;
    const next = [...otp];
    next[i] = v.slice(-1);
    setOtp(next);
    if (v && i < 3) refs.current[i + 1]?.focus();
    if (next.every((d) => d) && next.join('') === '4729') {
      setVerified(true);
      setTimeout(onVerified, 900);
    }
  };

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: NAVY_BASE }}
    >
      <DStatusBar />
      <div className="flex-1 overflow-y-auto px-5 pb-8">
        <div className="mb-6 flex items-center gap-3 pt-4">
          <DBackBtn onClick={onBack} />
          <p className="text-[17px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
            Verify Passenger
          </p>
        </div>

        {/* Passenger card */}
        <div
          className="mb-8 flex items-center gap-4 rounded-2xl p-4"
          style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
        >
          <div
            className="flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-bold"
            style={{ background: 'rgba(59,130,246,.12)', color: '#fff', fontFamily: PP }}
          >
            C
          </div>
          <div>
            <p className="text-[17px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
              Chidi O.
            </p>
            <p className="text-[13px]" style={{ fontFamily: IT, color: MUTED }}>
              To: Victoria Island, Lagos
            </p>
            <div className="mt-1 flex items-center gap-1">
              <span style={{ color: COLOR_STAR, fontSize: 12 }}>★</span>
              <span style={{ fontFamily: IT, fontSize: 12, color: MUTED }}>
                4.8 · Verified Rider
              </span>
            </div>
          </div>
        </div>

        <div className="mb-6 text-center">
          <p className="mb-1 text-[17px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
            Enter Passenger OTP
          </p>
          <p className="text-[13px]" style={{ fontFamily: IT, color: MUTED }}>
            Ask passenger for their 4-digit trip code
          </p>
        </div>

        {/* OTP boxes */}
        <div className="mb-3 flex justify-center gap-4">
          {otp.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                refs.current[i] = el;
              }}
              value={d}
              onChange={(e) => handleChange(i, e.target.value)}
              maxLength={1}
              inputMode="numeric"
              className="h-16 w-16 rounded-2xl text-center text-[26px] font-bold outline-none transition-all"
              style={{
                background: verified ? 'rgba(43,172,82,.12)' : NAVY_SURFACE,
                border: `2px solid ${d ? (verified ? G2 : 'rgba(43,172,82,.5)') : BORDER}`,
                color: '#fff',
                fontFamily: PP,
              }}
            />
          ))}
        </div>
        <p className="mb-8 text-center text-[12px]" style={{ fontFamily: IT, color: MUTED }}>
          Demo: enter <span style={{ color: G3 }}>4729</span>
        </p>

        {verified && (
          <div
            className="flex flex-col items-center gap-3"
            style={{ animation: 'success-bounce .5s ease' }}
          >
            <div
              className="flex h-20 w-20 items-center justify-center rounded-full text-4xl"
              style={{
                background: `linear-gradient(135deg,${G0},${G2})`,
                boxShadow: `0 0 40px rgba(43,172,82,.4)`,
              }}
            >
              ✅
            </div>
            <p className="text-[17px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
              Passenger Verified!
            </p>
            <p style={{ fontFamily: IT, fontSize: 13, color: MUTED }}>Starting trip...</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER-011 — TRIP IN PROGRESS
// ─────────────────────────────────────────────────────────────────────────────
export function DriverTripInProgressScreen({
  onComplete,
  onBack,
}: {
  onComplete: () => void;
  onBack: () => void;
}) {
  const [progress, setProgress] = useState(0.2);
  const [elapsed, setElapsed] = useState(5);

  useEffect(() => {
    const t = setInterval(() => {
      setProgress((p) => {
        const n = Math.min(p + 0.05, 1);
        if (n >= 1) {
          clearInterval(t);
          setTimeout(onComplete, 600);
        }
        return n;
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
      {/* Map */}
      <div className="relative flex-shrink-0" style={{ height: 320 }}>
        <DriverMapCanvas variant="inprogress" />
        <div className="absolute inset-0">
          <DStatusBar />
          <div className="mt-3 flex justify-between px-5">
            <DBackBtn onClick={onBack} />
            <div
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5"
              style={{ background: 'rgba(43,172,82,.85)', backdropFilter: 'blur(12px)' }}
            >
              <div
                className="h-2 w-2 rounded-full bg-white"
                style={{ animation: 'pulse-ring .6s ease-out infinite' }}
              />
              <span style={{ fontFamily: IT, fontSize: 12, color: '#fff', fontWeight: 600 }}>
                Trip Active
              </span>
            </div>
          </div>
        </div>
        {/* Progress overlay */}
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-3">
          <div
            className="h-2 overflow-hidden rounded-full"
            style={{ background: 'rgba(255,255,255,.1)' }}
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
      </div>

      {/* Bottom */}
      <div className="flex flex-1 flex-col gap-4 px-5 py-4" style={{ background: NAVY_BASE }}>
        {/* Stats */}
        <div className="flex gap-2">
          {[
            { v: `${remaining}m`, l: 'Left', color: '#fff' },
            { v: distLeft, l: 'km left', color: '#fff' },
            { v: `₦2,100`, l: 'Fare', color: G3 },
          ].map((s) => (
            <div
              key={s.l}
              className="flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-3"
              style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
            >
              <p className="text-[17px] font-bold" style={{ fontFamily: PP, color: s.color }}>
                {s.v}
              </p>
              <p className="text-[11px]" style={{ fontFamily: IT, color: MUTED }}>
                {s.l}
              </p>
            </div>
          ))}
        </div>

        {/* Destination */}
        <div
          className="flex items-center gap-3 rounded-2xl p-3"
          style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
        >
          <div className="h-3 w-3 flex-shrink-0 rounded-full" style={{ background: '#EF4444' }} />
          <div>
            <p className="text-[12px]" style={{ fontFamily: IT, color: MUTED }}>
              DESTINATION
            </p>
            <p className="text-[14px] font-semibold" style={{ fontFamily: PP, color: '#fff' }}>
              Victoria Island, Lagos
            </p>
          </div>
        </div>

        {/* Passenger */}
        <div
          className="flex items-center gap-3 rounded-2xl p-3"
          style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
        >
          <div
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl font-bold"
            style={{ background: 'rgba(59,130,246,.12)', color: '#fff', fontFamily: PP }}
          >
            C
          </div>
          <div className="flex-1">
            <p className="text-[14px] font-semibold" style={{ fontFamily: PP, color: '#fff' }}>
              Chidi O.
            </p>
            <p className="text-[12px]" style={{ fontFamily: IT, color: MUTED }}>
              Passenger · {elapsed} min elapsed
            </p>
          </div>
          <button
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: 'rgba(43,172,82,.1)', border: '1px solid rgba(43,172,82,.2)' }}
          >
            <svg
              width="16"
              height="16"
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
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER-012 — TRIP COMPLETED
// ─────────────────────────────────────────────────────────────────────────────
export function DriverTripCompletedScreen({ onDone }: { onDone: () => void }) {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-6 px-5"
      style={{ background: NAVY_BASE, animation: 'fade-up .5s ease both' }}
    >
      <div
        className="relative flex h-28 w-28 items-center justify-center rounded-full text-5xl"
        style={{
          background: `linear-gradient(135deg,${G0},${G2})`,
          boxShadow: `0 0 80px rgba(43,172,82,.4)`,
          animation: 'success-bounce .6s ease both',
        }}
      >
        🏁
        <div
          className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full"
          style={{ background: G2, border: '2px solid #0A1628' }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="3"
            strokeLinecap="round"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
      </div>

      <div className="text-center">
        <p
          className="mb-1 text-[11px] font-bold tracking-widest"
          style={{ fontFamily: IT, color: G3 }}
        >
          TRIP COMPLETED
        </p>
        <p className="mb-1 text-[26px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
          Great job, Adeyemi!
        </p>
        <p className="text-[14px]" style={{ fontFamily: IT, color: MUTED }}>
          Victoria Island, Lagos
        </p>
      </div>

      {/* Earnings card */}
      <div
        className="w-full overflow-hidden rounded-3xl"
        style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
      >
        <div className="border-b px-5 py-4" style={{ borderColor: BORDER }}>
          <p className="mb-3 text-[12px] font-semibold" style={{ fontFamily: PP, color: MUTED }}>
            TRIP SUMMARY
          </p>
          {[
            ['Duration', '22 min'],
            ['Distance', '14.2 km'],
            ['Passenger', 'Chidi O.'],
          ].map(([l, v]) => (
            <div key={l} className="mb-2 flex justify-between">
              <p className="text-[13px]" style={{ fontFamily: IT, color: MUTED }}>
                {l}
              </p>
              <p className="text-[13px] font-medium" style={{ fontFamily: IT, color: '#fff' }}>
                {v}
              </p>
            </div>
          ))}
        </div>
        <div className="px-5 py-4">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-[15px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
              You Earned
            </p>
            <p className="text-[24px] font-bold" style={{ fontFamily: PP, color: G3 }}>
              ₦1,995
            </p>
          </div>
          <p className="text-right text-[11px]" style={{ fontFamily: IT, color: MUTED }}>
            After 5% platform fee · Added to wallet
          </p>
        </div>
      </div>

      {/* CTA */}
      <div className="flex w-full flex-col gap-3">
        <DGreenBtn label="Go Back Online →" onClick={onDone} />
        <button
          onClick={onDone}
          className="flex h-12 w-full items-center justify-center rounded-2xl text-[14px] font-medium active:scale-[.97]"
          style={{
            background: NAVY_SURFACE,
            border: `1px solid ${BORDER}`,
            fontFamily: IT,
            color: TEXT_SECONDARY,
          }}
        >
          Take a Break
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER-013 — EARNINGS TAB  (also standalone screen)
// ─────────────────────────────────────────────────────────────────────────────
function DriverEarningsTab({ onBack }: { onBack: () => void }) {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const total = EARNINGS_DATA.reduce((s, d) => s + d.amount, 0);

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: NAVY_BASE }}
    >
      <DStatusBar />
      <div className="flex-1 overflow-y-auto px-5 pb-4">
        <div className="mb-5 flex items-center gap-3 pt-4">
          <DBackBtn onClick={onBack} />
          <p className="text-[17px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
            Earnings
          </p>
        </div>

        {/* Period tabs */}
        <div className="mb-5 flex gap-2">
          {(['daily', 'weekly', 'monthly'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className="h-9 flex-1 rounded-xl text-[12px] font-semibold capitalize transition-all"
              style={{
                background: period === p ? G2 : NAVY_SURFACE,
                color: period === p ? '#fff' : MUTED,
                fontFamily: IT,
                boxShadow: period === p ? `0 4px 16px rgba(43,172,82,.3)` : 'none',
              }}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Hero */}
        <div
          className="mb-5 rounded-3xl p-5 text-center"
          style={{
            background: `linear-gradient(135deg,${G0}CC,${G2})`,
            boxShadow: `0 16px 56px rgba(43,172,82,.35)`,
          }}
        >
          <p
            className="mb-1 text-[13px] font-medium opacity-80"
            style={{ fontFamily: IT, color: '#fff' }}
          >
            {period === 'daily' ? "Today's" : period === 'weekly' ? "This Week's" : "This Month's"}{' '}
            Earnings
          </p>
          <p className="text-[36px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
            ₦
            {period === 'daily'
              ? DRIVER.todayEarnings.toLocaleString()
              : period === 'weekly'
                ? total.toLocaleString()
                : '612,400'}
          </p>
          <div className="mt-3 flex justify-center gap-4">
            {[
              [TRIP_HISTORY_D.length.toString(), 'Trips'],
              [`${Math.round(total / TRIP_HISTORY_D.length).toLocaleString()}`, 'Avg/Trip'],
              [`${DRIVER.acceptance}%`, 'Acceptance'],
            ].map(([v, l]) => (
              <div key={l} className="text-center">
                <p className="text-[14px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
                  {v}
                </p>
                <p className="text-[10px] opacity-70" style={{ fontFamily: IT, color: '#fff' }}>
                  {l}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Bar chart */}
        <div
          className="mb-5 rounded-2xl p-4"
          style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
        >
          <p className="mb-4 text-[13px] font-semibold" style={{ fontFamily: PP, color: MUTED }}>
            DAILY BREAKDOWN
          </p>
          <EarningsBar data={EARNINGS_DATA} />
        </div>

        {/* Trip breakdown */}
        <p className="mb-3 text-[13px] font-semibold" style={{ fontFamily: PP, color: MUTED }}>
          RECENT TRIPS
        </p>
        {TRIP_HISTORY_D.filter((t) => t.status === 'completed').map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-3 border-b py-3"
            style={{ borderColor: BORDER }}
          >
            <div
              className="flex h-8 w-8 items-center justify-center rounded-xl text-base"
              style={{ background: 'rgba(43,172,82,.1)' }}
            >
              🚗
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-medium" style={{ fontFamily: IT, color: '#fff' }}>
                {t.from} → {t.to}
              </p>
              <p className="text-[11px]" style={{ fontFamily: IT, color: MUTED }}>
                {t.time} · {t.duration}
              </p>
            </div>
            <p className="text-[14px] font-bold" style={{ fontFamily: PP, color: G3 }}>
              {t.fare}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER-014 — WALLET TAB
// ─────────────────────────────────────────────────────────────────────────────
function DriverWalletTab({ onBack }: { onBack: () => void }) {
  const [withdrawing, setWithdrawing] = useState(false);
  const balance = 28640;

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: NAVY_BASE }}
    >
      <DStatusBar />
      <div className="flex-1 overflow-y-auto px-5 pb-4">
        <div className="mb-5 flex items-center gap-3 pt-4">
          <DBackBtn onClick={onBack} />
          <p className="text-[17px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
            Driver Wallet
          </p>
        </div>

        {/* Balance card */}
        <div
          className="mb-5 rounded-3xl p-5"
          style={{
            background: `linear-gradient(135deg,#0D1B2E,${G0}40,#0D1B2E)`,
            border: '1px solid rgba(43,172,82,.2)',
            boxShadow: '0 16px 56px rgba(0,0,0,.4)',
          }}
        >
          <p className="mb-1 text-[13px] font-medium" style={{ fontFamily: IT, color: MUTED }}>
            Available Balance
          </p>
          <p className="mb-4 text-[38px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
            ₦{balance.toLocaleString()}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setWithdrawing(true);
                setTimeout(() => setWithdrawing(false), 2000);
              }}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl text-[13px] font-semibold active:scale-[.97]"
              style={{
                background: `linear-gradient(135deg,${G0},${G2})`,
                color: '#fff',
                fontFamily: IT,
                boxShadow: `0 6px 20px rgba(43,172,82,.3)`,
              }}
            >
              {withdrawing ? 'Sending...' : '💸 Withdraw'}
            </button>
            <button
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl text-[13px] font-semibold active:scale-[.97]"
              style={{
                background: 'rgba(255,255,255,.06)',
                border: `1px solid ${BORDER}`,
                color: TEXT_SECONDARY,
                fontFamily: IT,
              }}
            >
              📋 Statement
            </button>
          </div>
        </div>

        {/* Bank linked */}
        <div
          className="mb-5 flex items-center gap-3 rounded-2xl p-4"
          style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
        >
          <div
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl text-xl"
            style={{ background: 'rgba(59,130,246,.12)' }}
          >
            🏦
          </div>
          <div className="flex-1">
            <p className="text-[14px] font-semibold" style={{ fontFamily: PP, color: '#fff' }}>
              GTBank •••• 1823
            </p>
            <p className="text-[12px]" style={{ fontFamily: IT, color: MUTED }}>
              Linked bank · Instant withdrawal
            </p>
          </div>
          <div
            className="flex h-5 w-5 items-center justify-center rounded-full"
            style={{ background: G2 }}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth="3"
              strokeLinecap="round"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
        </div>

        {/* Transactions */}
        <p className="mb-3 text-[13px] font-semibold" style={{ fontFamily: PP, color: MUTED }}>
          RECENT TRANSACTIONS
        </p>
        {WALLET_TXS.map((tx, i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-b py-3.5"
            style={{ borderColor: BORDER }}
          >
            <div
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl"
              style={{
                background: tx.type === 'credit' ? 'rgba(43,172,82,.1)' : 'rgba(239,68,68,.08)',
              }}
            >
              <span style={{ fontSize: 18 }}>{tx.type === 'credit' ? '↙' : '↗'}</span>
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-medium" style={{ fontFamily: IT, color: '#fff' }}>
                {tx.label}
              </p>
              <p className="text-[11px]" style={{ fontFamily: IT, color: MUTED }}>
                {tx.sub}
              </p>
            </div>
            <p className="text-[14px] font-bold" style={{ fontFamily: PP, color: tx.color }}>
              {tx.amount}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER-015 — TRIP HISTORY TAB
// ─────────────────────────────────────────────────────────────────────────────
function DriverTripsTab({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<'all' | 'completed' | 'cancelled'>('all');
  const filtered = tab === 'all' ? TRIP_HISTORY_D : TRIP_HISTORY_D.filter((t) => t.status === tab);

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: NAVY_BASE }}
    >
      <DStatusBar />
      <div className="flex-1 overflow-y-auto px-5 pb-4">
        <div className="mb-4 flex items-center gap-3 pt-4">
          <DBackBtn onClick={onBack} />
          <p className="text-[17px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
            Trip History
          </p>
        </div>

        {/* Summary */}
        <div
          className="mb-4 flex gap-3 rounded-2xl p-4"
          style={{ background: 'rgba(43,172,82,.06)', border: '1px solid rgba(43,172,82,.12)' }}
        >
          {[
            {
              v: TRIP_HISTORY_D.filter((t) => t.status === 'completed').length.toString(),
              l: 'Completed',
            },
            {
              v: `₦${TRIP_HISTORY_D.filter((t) => t.status === 'completed')
                .reduce((s, t) => s + parseInt(t.fare.replace(/[₦,]/g, '')), 0)
                .toLocaleString()}`,
              l: 'Earned',
            },
            { v: '4.92★', l: 'Rating' },
          ].map((s) => (
            <div key={s.l} className="flex-1 text-center">
              <p className="text-[15px] font-bold" style={{ fontFamily: PP, color: G3 }}>
                {s.v}
              </p>
              <p className="text-[11px]" style={{ fontFamily: IT, color: MUTED }}>
                {s.l}
              </p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="mb-4 flex gap-2">
          {(['all', 'completed', 'cancelled'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="h-9 flex-1 rounded-xl text-[12px] font-semibold capitalize"
              style={{
                background: tab === t ? G2 : NAVY_SURFACE,
                color: tab === t ? '#fff' : MUTED,
                fontFamily: IT,
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {filtered.map((trip) => (
          <div
            key={trip.id}
            className="mb-3 rounded-2xl p-4"
            style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
          >
            <div className="mb-3 flex justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-base"
                  style={{
                    background:
                      trip.status === 'completed' ? 'rgba(43,172,82,.1)' : 'rgba(239,68,68,.08)',
                  }}
                >
                  {trip.status === 'completed' ? '🚗' : '❌'}
                </div>
                <div>
                  <p
                    className="text-[12px] font-semibold"
                    style={{ fontFamily: IT, color: '#fff' }}
                  >
                    {trip.id}
                  </p>
                  <p className="text-[11px]" style={{ fontFamily: IT, color: MUTED }}>
                    {trip.time}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p
                  className="text-[15px] font-bold"
                  style={{ fontFamily: PP, color: trip.status === 'completed' ? G3 : MUTED }}
                >
                  {trip.fare}
                </p>
                <span
                  className="text-[10px] font-bold"
                  style={{ color: trip.status === 'completed' ? G3 : COLOR_ERROR, fontFamily: IT }}
                >
                  {trip.status.toUpperCase()}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex flex-col items-center gap-1">
                <div className="h-1.5 w-1.5 rounded-full" style={{ background: G2 }} />
                <div className="h-4 w-px" style={{ background: BORDER }} />
                <div className="h-1.5 w-1.5 rounded-full" style={{ background: '#EF4444' }} />
              </div>
              <div>
                <p className="mb-1 text-[12px]" style={{ fontFamily: IT, color: TEXT_SECONDARY }}>
                  {trip.from}
                </p>
                <p className="text-[12px]" style={{ fontFamily: IT, color: TEXT_SECONDARY }}>
                  {trip.to}
                </p>
              </div>
            </div>
            {trip.status === 'completed' && trip.rating > 0 && (
              <div className="mt-3 flex gap-0.5 border-t pt-3" style={{ borderColor: BORDER }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <span
                    key={n}
                    style={{
                      fontSize: 12,
                      filter: n <= trip.rating ? 'none' : 'grayscale(1) opacity(.3)',
                    }}
                  >
                    ⭐
                  </span>
                ))}
                <span className="ml-1.5 text-[11px]" style={{ fontFamily: IT, color: MUTED }}>
                  Passenger rated
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER-016 — PROFILE TAB
// ─────────────────────────────────────────────────────────────────────────────
function DriverProfileTab({ onBack, onSettings }: { onBack: () => void; onSettings: () => void }) {
  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: NAVY_BASE }}
    >
      <DStatusBar />
      <div className="flex-1 overflow-y-auto pb-4">
        {/* Hero */}
        <div
          className="relative px-5 pb-6 pt-5"
          style={{ background: `linear-gradient(180deg,rgba(43,172,82,.08) 0%,transparent 100%)` }}
        >
          <div className="mb-4 flex items-center gap-3">
            <DBackBtn onClick={onBack} />
            <p className="text-[17px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
              My Profile
            </p>
          </div>

          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div
                className="flex h-24 w-24 items-center justify-center rounded-3xl text-3xl font-bold"
                style={{
                  background: `linear-gradient(135deg,${G0},${G2})`,
                  color: '#fff',
                  fontFamily: PP,
                  boxShadow: `0 8px 32px rgba(43,172,82,.35)`,
                }}
              >
                {DRIVER.initials}
              </div>
              <div
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full text-sm"
                style={{ background: NAVY_BASE, border: `2px solid ${BORDER}` }}
              >
                📷
              </div>
            </div>
            <div className="text-center">
              <p className="text-[20px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
                {DRIVER.name}
              </p>
              <div className="mt-1 flex items-center justify-center gap-2">
                <span
                  className="rounded-full px-3 py-0.5 text-[12px] font-bold"
                  style={{ background: 'rgba(251,191,36,.12)', color: '#FBBF24', fontFamily: IT }}
                >
                  🏅 {DRIVER.level}
                </span>
                <div className="h-1 w-1 rounded-full" style={{ background: MUTED }} />
                <span className="text-[12px]" style={{ fontFamily: IT, color: G3 }}>
                  {DRIVER.rating}★
                </span>
              </div>
            </div>
          </div>

          {/* Quick stats */}
          <div className="mt-5 flex gap-3">
            {[
              { v: DRIVER.trips.toLocaleString(), l: 'Total Trips' },
              { v: `${DRIVER.acceptance}%`, l: 'Acceptance' },
              { v: `${DRIVER.completion}%`, l: 'Completion' },
            ].map((s) => (
              <div
                key={s.l}
                className="flex-1 rounded-2xl py-2.5 text-center"
                style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
              >
                <p className="text-[15px] font-bold" style={{ fontFamily: PP, color: G3 }}>
                  {s.v}
                </p>
                <p className="text-[10px]" style={{ fontFamily: IT, color: MUTED }}>
                  {s.l}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Info */}
        <div className="px-5">
          <div
            className="mb-4 overflow-hidden rounded-2xl"
            style={{ border: `1px solid ${BORDER}` }}
          >
            {[
              { icon: '📱', label: 'Phone', value: DRIVER.phone },
              { icon: '🚗', label: 'Vehicle', value: DRIVER.vehicle },
              { icon: '🔢', label: 'Plate', value: DRIVER.plate },
              { icon: '📍', label: 'City', value: 'Lagos, Nigeria' },
            ].map((item, i, arr) => (
              <div
                key={item.label}
                className="flex items-center gap-3 px-4 py-3.5"
                style={{
                  background: NAVY_SURFACE,
                  borderBottom: i < arr.length - 1 ? `1px solid ${BORDER}` : 'none',
                }}
              >
                <span style={{ fontSize: 18, flexShrink: 0 }}>{item.icon}</span>
                <div className="flex-1">
                  <p className="text-[11px]" style={{ fontFamily: IT, color: MUTED }}>
                    {item.label}
                  </p>
                  <p className="text-[13px] font-medium" style={{ fontFamily: IT, color: '#fff' }}>
                    {item.value}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2.5">
            {[
              { icon: '📄', label: 'My Documents', sub: 'View & update KYC docs' },
              { icon: '🏦', label: 'Bank Account', sub: 'Manage withdrawal bank' },
              {
                icon: '⚙️',
                label: 'Settings',
                sub: 'Notifications, security & more',
                action: onSettings,
              },
            ].map((item) => (
              <button
                key={item.label}
                onClick={item.action}
                className="flex w-full items-center gap-3 rounded-2xl p-4 transition-all active:scale-[.98]"
                style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
              >
                <span style={{ fontSize: 20, flexShrink: 0 }}>{item.icon}</span>
                <div className="flex-1 text-left">
                  <p className="text-[14px] font-medium" style={{ fontFamily: IT, color: '#fff' }}>
                    {item.label}
                  </p>
                  <p className="text-[12px]" style={{ fontFamily: IT, color: MUTED }}>
                    {item.sub}
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
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER-017 — SETTINGS
// ─────────────────────────────────────────────────────────────────────────────
export function DriverSettingsScreen({ onBack }: { onBack: () => void }) {
  const [notifTrips, setNotifTrips] = useState(true);
  const [notifEarnings, setNotifEarnings] = useState(true);
  const [notifPromos, setNotifPromos] = useState(false);
  const [soundAlerts, setSoundAlerts] = useState(true);
  const [vibration, setVibration] = useState(true);
  const [navApp, setNavApp] = useState('Google Maps');

  const Toggle = ({ value, onChange }: { value: boolean; onChange: () => void }) => (
    <button
      onClick={onChange}
      className="relative flex-shrink-0 transition-all duration-200 active:scale-95"
      style={{ width: 48, height: 28 }}
    >
      <div
        className="absolute inset-0 rounded-full transition-all duration-200"
        style={{ background: value ? G2 : 'rgba(255,255,255,.12)' }}
      />
      <div
        className="absolute top-1 rounded-full transition-all duration-200"
        style={{ width: 20, height: 20, background: '#fff', left: value ? 24 : 4 }}
      />
    </button>
  );

  const sections = [
    {
      title: 'NOTIFICATIONS',
      items: [
        {
          label: 'Trip Requests',
          sub: 'New ride alerts',
          value: notifTrips,
          onChange: () => setNotifTrips(!notifTrips),
        },
        {
          label: 'Earnings Updates',
          sub: 'Payment receipts',
          value: notifEarnings,
          onChange: () => setNotifEarnings(!notifEarnings),
        },
        {
          label: 'Promotions',
          sub: 'Bonuses & offers',
          value: notifPromos,
          onChange: () => setNotifPromos(!notifPromos),
        },
      ],
    },
    {
      title: 'ALERTS',
      items: [
        {
          label: 'Sound Alerts',
          sub: 'Audio on new requests',
          value: soundAlerts,
          onChange: () => setSoundAlerts(!soundAlerts),
        },
        {
          label: 'Vibration',
          sub: 'Haptic feedback',
          value: vibration,
          onChange: () => setVibration(!vibration),
        },
      ],
    },
  ];

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: NAVY_BASE }}
    >
      <DStatusBar />
      <div className="flex-1 overflow-y-auto px-5 pb-8">
        <div className="mb-6 flex items-center gap-3 pt-4">
          <DBackBtn onClick={onBack} />
          <p className="text-[17px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
            Settings
          </p>
        </div>

        {sections.map((sec) => (
          <div key={sec.title} className="mb-5">
            <p
              className="mb-2.5 px-1 text-[12px] font-semibold"
              style={{ fontFamily: IT, color: MUTED, letterSpacing: '0.08em' }}
            >
              {sec.title}
            </p>
            <div className="overflow-hidden rounded-2xl" style={{ border: `1px solid ${BORDER}` }}>
              {sec.items.map((item, i, arr) => (
                <div
                  key={item.label}
                  className="flex items-center gap-3 px-4 py-4"
                  style={{
                    background: NAVY_SURFACE,
                    borderBottom: i < arr.length - 1 ? `1px solid ${BORDER}` : 'none',
                  }}
                >
                  <div className="flex-1">
                    <p
                      className="text-[14px] font-medium"
                      style={{ fontFamily: IT, color: '#fff' }}
                    >
                      {item.label}
                    </p>
                    <p className="text-[12px]" style={{ fontFamily: IT, color: MUTED }}>
                      {item.sub}
                    </p>
                  </div>
                  <Toggle value={item.value} onChange={item.onChange} />
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Navigation app */}
        <div className="mb-5">
          <p
            className="mb-2.5 px-1 text-[12px] font-semibold"
            style={{ fontFamily: IT, color: MUTED, letterSpacing: '0.08em' }}
          >
            NAVIGATION
          </p>
          <div className="overflow-hidden rounded-2xl" style={{ border: `1px solid ${BORDER}` }}>
            {['Google Maps', 'Waze', 'Apple Maps'].map((app, i, arr) => (
              <button
                key={app}
                onClick={() => setNavApp(app)}
                className="flex w-full items-center gap-3 px-4 py-4 active:scale-[.98]"
                style={{
                  background: NAVY_SURFACE,
                  borderBottom: i < arr.length - 1 ? `1px solid ${BORDER}` : 'none',
                }}
              >
                <span style={{ fontSize: 20 }}>{['🗺', '🗺', '🗺'][i]}</span>
                <p
                  className="flex-1 text-left text-[14px]"
                  style={{ fontFamily: IT, color: '#fff' }}
                >
                  {app}
                </p>
                {navApp === app && (
                  <div
                    className="flex h-5 w-5 items-center justify-center rounded-full"
                    style={{ background: G2 }}
                  >
                    <svg
                      width="10"
                      height="10"
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
              </button>
            ))}
          </div>
        </div>

        {/* Account */}
        <div className="mb-5">
          <p
            className="mb-2.5 px-1 text-[12px] font-semibold"
            style={{ fontFamily: IT, color: MUTED, letterSpacing: '0.08em' }}
          >
            ACCOUNT
          </p>
          <div className="overflow-hidden rounded-2xl" style={{ border: `1px solid ${BORDER}` }}>
            {['Change PIN', 'Privacy Policy', 'Terms of Service', 'Help & Support'].map(
              (item, i, arr) => (
                <button
                  key={item}
                  className="flex w-full items-center gap-3 px-4 py-4 active:scale-[.98]"
                  style={{
                    background: NAVY_SURFACE,
                    borderBottom: i < arr.length - 1 ? `1px solid ${BORDER}` : 'none',
                  }}
                >
                  <p
                    className="flex-1 text-left text-[14px]"
                    style={{ fontFamily: IT, color: '#fff' }}
                  >
                    {item}
                  </p>
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
              ),
            )}
          </div>
        </div>

        {/* Logout */}
        <button
          className="flex h-12 w-full items-center justify-center rounded-2xl active:scale-[.97]"
          style={{
            background: 'rgba(239,68,68,.06)',
            border: '1px solid rgba(239,68,68,.12)',
            fontFamily: IT,
            fontSize: 14,
            color: '#EF4444',
            fontWeight: 600,
          }}
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER-REG-A — EMERGENCY CONTACT
// ─────────────────────────────────────────────────────────────────────────────
export function EmergencyContactScreen({
  onBack,
  onContinue,
}: {
  onBack: () => void;
  onContinue: () => void;
}) {
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [relOpen, setRelOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const RELATIONSHIPS = ['Spouse', 'Parent', 'Sibling', 'Child', 'Relative', 'Friend', 'Other'];

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Full name is required';
    if (!relationship) e.relationship = 'Please select a relationship';
    if (!phone.trim()) e.phone = 'Phone number is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleContinue = () => {
    if (validate()) onContinue();
  };

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: NAVY_BASE }}
    >
      <DStatusBar />
      <div className="flex-1 overflow-y-auto px-5 pb-8">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3 pt-4">
          <DBackBtn onClick={onBack} />
          <div>
            <p className="text-[17px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
              Emergency Contact
            </p>
            <p className="text-[12px]" style={{ fontFamily: IT, color: MUTED }}>
              Add someone we can reach if needed
            </p>
          </div>
        </div>

        {/* Step indicator pill */}
        <div className="mb-6 flex items-center gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <div
              key={n}
              className="h-1 flex-1 rounded-full"
              style={{ background: n <= 4 ? G2 : 'rgba(255,255,255,.08)' }}
            />
          ))}
        </div>

        {/* Full Name */}
        <div className="mb-4">
          <p
            className="mb-1.5 text-[13px] font-medium"
            style={{ fontFamily: IT, color: TEXT_SECONDARY }}
          >
            Full Name <span style={{ color: '#EF4444' }}>*</span>
          </p>
          <div
            className="flex h-14 items-center gap-2 rounded-2xl px-4"
            style={{
              background: NAVY_SURFACE,
              border: `1px solid ${errors.name ? '#EF4444' : BORDER}`,
              transition: 'border-color .2s',
            }}
          >
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setErrors((p) => ({ ...p, name: '' }));
              }}
              placeholder="e.g. Fatima Okafor"
              className="flex-1 bg-transparent outline-none"
              style={{ fontFamily: IT, fontSize: 15, color: '#fff' }}
            />
          </div>
          {errors.name && (
            <p className="mt-1 text-[11px]" style={{ fontFamily: IT, color: '#EF4444' }}>
              {errors.name}
            </p>
          )}
        </div>

        {/* Relationship dropdown */}
        <div className="mb-4">
          <p
            className="mb-1.5 text-[13px] font-medium"
            style={{ fontFamily: IT, color: TEXT_SECONDARY }}
          >
            Relationship <span style={{ color: '#EF4444' }}>*</span>
          </p>
          <div className="relative">
            <button
              onClick={() => setRelOpen((o) => !o)}
              className="flex h-14 w-full items-center justify-between rounded-2xl px-4"
              style={{
                background: NAVY_SURFACE,
                border: `1px solid ${errors.relationship ? '#EF4444' : relOpen ? 'rgba(43,172,82,.4)' : BORDER}`,
                transition: 'border-color .2s',
              }}
            >
              <span style={{ fontFamily: IT, fontSize: 15, color: relationship ? '#fff' : MUTED }}>
                {relationship || 'Select relationship'}
              </span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke={MUTED}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  transform: relOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform .2s',
                }}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {relOpen && (
              <div
                className="absolute left-0 right-0 z-10 mt-1 overflow-hidden rounded-2xl"
                style={{
                  background: NAVY_CARD,
                  border: `1px solid ${BORDER}`,
                  boxShadow: '0 8px 32px rgba(0,0,0,.5)',
                }}
              >
                {RELATIONSHIPS.map((r) => (
                  <button
                    key={r}
                    onClick={() => {
                      setRelationship(r);
                      setRelOpen(false);
                      setErrors((p) => ({ ...p, relationship: '' }));
                    }}
                    className="flex w-full items-center justify-between px-4 py-3.5 text-left"
                    style={{ borderBottom: r !== 'Other' ? `1px solid ${BORDER}` : 'none' }}
                  >
                    <span
                      style={{
                        fontFamily: IT,
                        fontSize: 14,
                        color: relationship === r ? G3 : '#fff',
                      }}
                    >
                      {r}
                    </span>
                    {relationship === r && (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={G3}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          {errors.relationship && (
            <p className="mt-1 text-[11px]" style={{ fontFamily: IT, color: '#EF4444' }}>
              {errors.relationship}
            </p>
          )}
        </div>

        {/* Phone */}
        <div className="mb-4">
          <p
            className="mb-1.5 text-[13px] font-medium"
            style={{ fontFamily: IT, color: TEXT_SECONDARY }}
          >
            Phone Number <span style={{ color: '#EF4444' }}>*</span>
          </p>
          <div
            className="flex h-14 items-center gap-2 rounded-2xl px-4"
            style={{
              background: NAVY_SURFACE,
              border: `1px solid ${errors.phone ? '#EF4444' : BORDER}`,
              transition: 'border-color .2s',
            }}
          >
            <span
              style={{
                fontFamily: IT,
                fontSize: 14,
                color: MUTED,
                borderRight: `1px solid ${BORDER}`,
                paddingRight: 10,
              }}
            >
              +234
            </span>
            <input
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setErrors((p) => ({ ...p, phone: '' }));
              }}
              placeholder="801 234 5678"
              type="tel"
              className="flex-1 bg-transparent outline-none"
              style={{ fontFamily: IT, fontSize: 15, color: '#fff' }}
            />
          </div>
          {errors.phone && (
            <p className="mt-1 text-[11px]" style={{ fontFamily: IT, color: '#EF4444' }}>
              {errors.phone}
            </p>
          )}
        </div>

        {/* Email — optional */}
        <DInput
          label="Email Address (optional)"
          placeholder="e.g. fatima@email.com"
          value={email}
          onChange={setEmail}
          type="email"
        />

        {/* Privacy card */}
        <div
          className="mb-6 flex gap-3 rounded-2xl p-4"
          style={{ background: 'rgba(43,172,82,.05)', border: '1px solid rgba(43,172,82,.12)' }}
        >
          <span style={{ fontSize: 16, flexShrink: 0 }}>🔒</span>
          <p style={{ fontFamily: IT, fontSize: 12, color: TEXT_SECONDARY, lineHeight: 1.55 }}>
            Emergency contact information is used only to contact your trusted person when necessary
            for your safety.
          </p>
        </div>

        <DGreenBtn label="Continue →" onClick={handleContinue} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER-REG-B — AGREEMENT ACCEPTANCE
// ─────────────────────────────────────────────────────────────────────────────
export function AgreementAcceptanceScreen({
  onBack,
  onContinue,
}: {
  onBack: () => void;
  onContinue: () => void;
}) {
  const [agreed, setAgreed] = useState(false);

  const SECTIONS = [
    {
      icon: '🚗',
      title: 'Driver Responsibilities',
      body: 'You are responsible for completing accepted trips safely and on time, maintaining professional conduct with passengers, and keeping your vehicle clean and roadworthy at all times.',
    },
    {
      icon: '🛡️',
      title: 'Safety',
      body: "You must comply with all road traffic laws. Passengers' safety is paramount. You agree not to operate the platform while fatigued, impaired, or in any condition that compromises safe driving.",
    },
    {
      icon: '🔧',
      title: 'Vehicle Requirements',
      body: 'Your vehicle must meet DrippleX eligibility standards including valid registration, insurance, and roadworthiness certification. You must promptly notify DrippleX of any changes to your vehicle status.',
    },
    {
      icon: '🤝',
      title: 'Platform Conduct',
      body: 'You agree to treat passengers with respect, maintain accurate availability status, and not engage in fare manipulation, harassment, or any conduct that violates DrippleX community guidelines.',
    },
    {
      icon: '📋',
      title: 'Account & Registration',
      body: 'You confirm that all information submitted during registration is accurate and up to date. You are responsible for keeping your account details current and for all activity under your account.',
    },
    {
      icon: '⚠️',
      title: 'Suspension & Termination',
      body: 'DrippleX reserves the right to suspend or terminate your driver account for violations of this agreement, sustained low ratings, fraudulent activity, or failure to maintain required documentation.',
    },
  ];

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: NAVY_BASE }}
    >
      <DStatusBar />
      <div className="flex-1 overflow-y-auto px-5 pb-8">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3 pt-4">
          <DBackBtn onClick={onBack} />
          <div>
            <p className="text-[17px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
              Driver Agreement
            </p>
            <p className="text-[12px]" style={{ fontFamily: IT, color: MUTED }}>
              Review and accept to complete registration
            </p>
          </div>
        </div>

        {/* Step indicator pill — all steps filled */}
        <div className="mb-6 flex items-center gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="h-1 flex-1 rounded-full" style={{ background: G2 }} />
          ))}
        </div>

        {/* Agreement card */}
        <div className="mb-4 overflow-hidden rounded-2xl" style={{ border: `1px solid ${BORDER}` }}>
          {/* Card header */}
          <div
            className="flex items-center gap-2.5 px-4 py-3"
            style={{ background: 'rgba(43,172,82,.07)', borderBottom: `1px solid ${BORDER}` }}
          >
            <span style={{ fontSize: 16 }}>📄</span>
            <p className="text-[14px] font-semibold" style={{ fontFamily: PP, color: '#fff' }}>
              DrippleX Driver Agreement
            </p>
          </div>

          {/* Sections */}
          {SECTIONS.map((s, i) => (
            <div
              key={s.title}
              className="px-4 py-4"
              style={{
                borderBottom: i < SECTIONS.length - 1 ? `1px solid ${BORDER}` : 'none',
                background: NAVY_CARD,
              }}
            >
              <div className="mb-1.5 flex items-center gap-2">
                <span style={{ fontSize: 14 }}>{s.icon}</span>
                <p className="text-[13px] font-semibold" style={{ fontFamily: PP, color: '#fff' }}>
                  {s.title}
                </p>
              </div>
              <p style={{ fontFamily: IT, fontSize: 12, color: TEXT_SECONDARY, lineHeight: 1.6 }}>
                {s.body}
              </p>
            </div>
          ))}
        </div>

        {/* View full link */}
        <button className="mb-4 w-full py-1 text-center">
          <span
            style={{
              fontFamily: IT,
              fontSize: 13,
              color: G3,
              textDecoration: 'underline',
              textUnderlineOffset: 3,
            }}
          >
            View full Driver Agreement
          </span>
        </button>

        {/* Checkbox row */}
        <button
          onClick={() => setAgreed((a) => !a)}
          className="mb-4 flex w-full items-start gap-3 rounded-2xl p-4 text-left transition-all active:scale-[.98]"
          style={{
            background: agreed ? 'rgba(43,172,82,.07)' : NAVY_SURFACE,
            border: `1.5px solid ${agreed ? 'rgba(43,172,82,.35)' : BORDER}`,
            transition: 'all .2s',
          }}
        >
          {/* Custom checkbox */}
          <div
            className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md"
            style={{
              background: agreed ? G2 : 'transparent',
              border: `2px solid ${agreed ? G2 : MUTED}`,
              transition: 'all .2s',
            }}
          >
            {agreed && (
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#fff"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
            )}
          </div>
          <p style={{ fontFamily: IT, fontSize: 13, color: '#fff', lineHeight: 1.5 }}>
            I have read and agree to the <span style={{ color: G3 }}>Driver Agreement</span> and{' '}
            <span style={{ color: G3 }}>Terms of Service</span>.
          </p>
        </button>

        {/* Submission note */}
        <div
          className="mb-5 flex items-start gap-2.5 rounded-2xl p-3.5"
          style={{ background: 'rgba(255,255,255,.03)', border: `1px solid ${BORDER}` }}
        >
          <span style={{ fontSize: 14, flexShrink: 0 }}>ℹ️</span>
          <p style={{ fontFamily: IT, fontSize: 12, color: MUTED, lineHeight: 1.55 }}>
            After completing this step, you can submit your Driver Registration for review.
          </p>
        </div>

        <DGreenBtn label="Continue →" onClick={onContinue} disabled={!agreed} />
      </div>
    </div>
  );
}
