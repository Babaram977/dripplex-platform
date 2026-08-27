import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  G0,
  G2,
  G3,
  NAVY_DEEP,
  NAVY_CARD,
  NAVY_SURFACE,
  BORDER,
  MUTED,
  DRIPPLEX_SUPPORT_WHATSAPP,
} from './shared';
import {
  COLOR_STAR,
  COLOR_SUCCESS,
  COLOR_ERROR,
  COLOR_WARNING,
  TEXT_SECONDARY,
} from '../tokens/colors';
import { api, uploadFile } from '../lib/api';
import { auth } from '../lib/auth';
import { needsCashConfirmation } from '../lib/cashConfirmation';
import { referralShareUrl } from '../lib/referralLink';
import { AccountPageHost, AccountRows, type AccountPage } from './accountPages';
import { playNotificationSound, startIncomingRideAlarm, stopIncomingRideAlarm } from '../lib/sound';
import { SoundSettings } from './soundSettings';
import { PayoutPanel } from './payoutPanel';
import { useLocationHeartbeat } from '../lib/locationHeartbeat';
import { pushDriverLocationNow, useDriverLocationPing } from './useDriverLocationPing';
import { getCurrentPosition } from '../lib/maps';
// Same cadence for both couriers — see the constant's note for why 30s.
import { LOCATION_PUSH_INTERVAL_MS } from './riderScreen';
import type {
  AdminVehicleDto,
  CommissionAccountDto,
  DriverActivationEligibilityDto,
  DriverCampaignDashboardDto,
  DriverInspectionDto,
  DriverRideDto,
  RiderDeliveryJobDto,
  InspectionCentreDto,
  RideOfferDto,
  RideOfferPreviewDto,
  RideDto,
  RideType,
  ReferralStatsDto,
  WalletDto,
  WalletLedgerEntryDto,
} from '../lib/api';

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

// ─── Helpers ─────────────────────────────────────────────────────────────────
// Real data only. No fabricated driver identity, earnings, trips, or documents.
const naira = (n: number) => `₦${Math.round(n).toLocaleString()}`;

function isToday(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function driverInitials(u: { firstName?: string; lastName?: string } | null): string {
  if (!u) return '—';
  const a = (u.firstName || '').trim()[0] || '';
  const b = (u.lastName || '').trim()[0] || '';
  const s = (a + b).toUpperCase();
  return s || '—';
}

function driverFullName(u: { firstName?: string; lastName?: string } | null): string {
  if (!u) return '—';
  const name = `${u.firstName || ''} ${u.lastName || ''}`.trim();
  return name || '—';
}

function txWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────
function DStatusBar({ light }: { light?: boolean }) {
  return (
    <div
      className="dx-status-mock relative z-10 flex w-full items-center justify-between px-5 pt-[52px]"
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
      aria-label="Back"
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

  // Same fix as the passenger map: 390×280 was the Figma frame width, so the
  // driver's map stopped short of the right edge on any wider handset. Fills
  // its container and crops, instead of drawing at one fixed size.
  return (
    <svg
      viewBox="0 0 390 280"
      preserveAspectRatio="xMidYMid slice"
      style={{ display: 'block', width: '100%', height: '100%' }}
    >
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
  onApply,
  onForgot,
}: {
  onContinue: () => void;
  onBack: () => void;
  onApply?: () => void;
  onForgot?: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleContinue = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await api.auth.loginDriver({ email, password });
      auth.setTokens(resp.accessToken, resp.refreshToken);
      auth.setUser(resp.user);
      onContinue();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setLoading(false);
    }
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
            Sign in to continue
          </p>
        </div>

        {/* Email input */}
        <div className="mb-4">
          <p
            className="mb-2 text-[13px] font-medium"
            style={{ fontFamily: IT, color: TEXT_SECONDARY }}
          >
            Email
          </p>
          <div
            className="flex h-14 items-center overflow-hidden rounded-2xl"
            style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
          >
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoCapitalize="none"
              className="flex-1 bg-transparent px-4 outline-none"
              style={{ fontFamily: IT, fontSize: 15, color: '#fff' }}
            />
          </div>
        </div>

        {/* Password input */}
        <div className="mb-4">
          <p
            className="mb-2 text-[13px] font-medium"
            style={{ fontFamily: IT, color: TEXT_SECONDARY }}
          >
            Password
          </p>
          <div
            className="flex h-14 items-center overflow-hidden rounded-2xl"
            style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
          >
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              className="flex-1 bg-transparent px-4 outline-none"
              style={{ fontFamily: IT, fontSize: 15, color: '#fff' }}
            />
          </div>
        </div>

        {error && (
          <p className="mb-3 text-[13px]" style={{ fontFamily: IT, color: COLOR_ERROR }}>
            {error}
          </p>
        )}

        {onForgot && (
          <button
            type="button"
            onClick={onForgot}
            className="mb-3 ml-auto block active:opacity-70"
            style={{ fontFamily: IT, fontSize: 13, fontWeight: 600, color: G3 }}
          >
            Forgot password?
          </button>
        )}

        <DGreenBtn label={loading ? '' : 'Continue →'} onClick={handleContinue} loading={loading} />

        <p className="mt-4 text-center text-[12px]" style={{ fontFamily: IT, color: MUTED }}>
          New driver partner?{' '}
          <button
            type="button"
            onClick={onApply}
            className="active:opacity-60"
            style={{ color: G3, fontFamily: IT, fontWeight: 600 }}
          >
            Apply to join →
          </button>
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
    return undefined;
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
/**
 * DPX-DRIVER-006 — the driver's onboarding hub.
 *
 * DriverActivationService is the single platform-wide gate: a driver goes Active
 * only when all six of its checks pass. This screen shows those six, read from
 * GET /driver/activation-eligibility, and routes each unmet one to the page that
 * fixes it.
 *
 * Previously it showed a fixed "your documents are under review" with two
 * buttons and no real state — its own comment said no status endpoint existed,
 * which is no longer true. Worse, the only route out was the document upload
 * page, so vehicle registration, the emergency contact and AGREEMENT ACCEPTANCE
 * were unreachable in the running app: a driver could never accept the terms,
 * and therefore could never satisfy the agreementAccepted check.
 */
export function DriverKYCStatusScreen({
  onContinue,
  onUpload,
  onBack,
  onVehicle,
  onAgreement,
  onInspection,
}: {
  onContinue: () => void;
  onUpload: () => void;
  onBack: () => void;
  onVehicle?: () => void;
  onAgreement?: () => void;
  onInspection?: () => void;
}) {
  const [eligibility, setEligibility] = useState<DriverActivationEligibilityDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  // `vehicleApproved` is about approval, not existence — so on its own it cannot
  // tell "you have not registered a car" from "yours is waiting for review". The
  // screen said the former in both cases and offered to register another one.
  const [vehicleCount, setVehicleCount] = useState<number | null>(null);
  // Same problem on the documents row: `requiredDocumentsApproved` is false
  // both when nothing was sent and when all three are sitting in the review
  // queue, and the row prompted for an upload either way.
  const [allRequiredDocsSent, setAllRequiredDocsSent] = useState<boolean | null>(null);
  // Is there an appointment already in the diary? Booking is the DRIVER's job —
  // there is no Operations scheduling endpoint — so this row is only "with
  // Operations" once a slot exists and the inspector has yet to decide.
  const [inspectionBooked, setInspectionBooked] = useState<boolean | null>(null);

  useEffect(() => {
    api.driver
      .listVehicles()
      .then((rows) => setVehicleCount(rows.length))
      .catch(() => setVehicleCount(null));
    api.driver
      .getKyc()
      .then((docs) => {
        // A REJECTED document is outstanding again — it has to be replaced.
        const live = new Set(
          docs
            .filter((doc) => doc.verificationStatus !== 'REJECTED')
            .map((doc) => doc.documentType),
        );
        setAllRequiredDocsSent(REQUIRED_DRIVER_KYC_TYPES.every((type) => live.has(type)));
      })
      .catch(() => setAllRequiredDocsSent(null));
    api.driver
      .listInspections()
      .then((rows) => setInspectionBooked(rows.some((row) => row.status === 'SCHEDULED')))
      .catch(() => setInspectionBooked(null));
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    api.driver
      .getActivationEligibility()
      .then((e) => {
        setEligibility(e);
        setLoadErr(null);
      })
      .catch((e: unknown) =>
        setLoadErr((e as { message?: string }).message ?? 'Could not load your progress.'),
      )
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => load(), [load]);

  const checks = eligibility?.checks;
  // Same order and wording as the six backend checks, so what a driver reads
  // here is exactly what the platform gate measures. `action` is present only
  // where the driver can do something themselves — an inspection is booked by
  // Operations, and identity/account standing are not self-service.
  const STEPS: {
    key: keyof NonNullable<typeof checks>;
    label: string;
    /** Shown once the check passes. */
    done: string;
    /** Shown while it has not — `done` read as a claim the tick contradicted. */
    pending: string;
    /** Who has to move next. Operations-owned rows are not the driver's to do. */
    owner: 'you' | 'ops';
    action?: { label: string; onClick?: () => void };
  }[] = [
    {
      key: 'identityVerified',
      label: 'Identity check',
      done: 'Your identity has been confirmed.',
      pending: 'Your identity has not been confirmed yet.',
      owner: 'ops',
    },
    {
      key: 'requiredDocumentsApproved',
      label: 'Document review',
      done: "Driver's licence, vehicle paper and guarantor ID, all verified.",
      pending:
        allRequiredDocsSent === true
          ? 'All three documents are with Operations and waiting to be verified.'
          : "Driver's licence, vehicle paper or guarantor ID is missing or not yet verified.",
      owner: allRequiredDocsSent === true ? 'ops' : 'you',
      action: {
        label: allRequiredDocsSent === true ? 'View your documents' : 'Upload / update documents',
        onClick: onUpload,
      },
    },
    {
      key: 'vehicleApproved',
      label: 'Vehicle registration',
      done: 'A registered vehicle approved by Operations.',
      pending:
        vehicleCount !== null && vehicleCount > 0
          ? 'Your vehicle is registered and waiting for Operations to approve it.'
          : 'No vehicle registered yet.',
      // Once a vehicle is on file the wait is Operations', not the driver's.
      owner: vehicleCount !== null && vehicleCount > 0 ? 'ops' : 'you',
      ...(onVehicle
        ? {
            action: {
              // Not "Register your vehicle" when they already did — that is the
              // prompt that had drivers registering the same car twice.
              label:
                vehicleCount !== null && vehicleCount > 0
                  ? 'View your vehicle'
                  : 'Register your vehicle',
              onClick: onVehicle,
            },
          }
        : {}),
    },
    {
      key: 'inspectionPassed',
      label: 'Inspection & test',
      done: 'Your vehicle passed its physical inspection.',
      // This row used to read "With Operations" and offer nothing, on the
      // assumption Operations books the appointment. They cannot — the backend
      // exposes scheduling to the driver only. So an unbooked inspection is the
      // driver's move, and it is theirs again after a failure.
      pending:
        inspectionBooked === true
          ? 'Your appointment is booked — the inspector decides on the day.'
          : 'Book your vehicle in for its physical inspection.',
      owner: inspectionBooked === true ? 'ops' : 'you',
      ...(onInspection
        ? {
            action: {
              label: inspectionBooked === true ? 'View your appointment' : 'Book an inspection',
              onClick: onInspection,
            },
          }
        : {}),
    },
    {
      key: 'agreementAccepted',
      label: 'Agreement signing',
      done: 'You have accepted the DrippleX driver terms.',
      pending: 'You have not accepted the DrippleX driver terms yet.',
      owner: 'you',
      ...(onAgreement ? { action: { label: 'Read and accept terms', onClick: onAgreement } } : {}),
    },
    {
      key: 'accountNotLocked',
      label: 'Account standing',
      done: 'Your account is in good standing.',
      pending: 'Your account is locked pending a support review.',
      owner: 'ops',
    },
  ];

  const doneCount = checks ? STEPS.filter((s) => checks[s.key]).length : 0;

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
            Your onboarding
          </p>
        </div>

        {loading && (
          <p className="text-[13px]" style={{ fontFamily: IT, color: MUTED }}>
            Loading your progress…
          </p>
        )}
        {loadErr && !loading && (
          <div
            className="mb-4 rounded-xl px-4 py-3"
            style={{ background: 'rgba(239,68,68,.07)', border: '1px solid rgba(239,68,68,.2)' }}
          >
            <p className="text-[12.5px]" style={{ fontFamily: IT, color: COLOR_ERROR }}>
              {loadErr}
            </p>
          </div>
        )}

        {checks && (
          <>
            <div className="mb-5 flex flex-col items-center text-center">
              <div
                className="mb-4 flex h-24 w-24 items-center justify-center rounded-full text-4xl"
                style={{
                  background: eligibility?.eligible ? 'rgba(43,172,82,.1)' : 'rgba(245,158,11,.1)',
                  border: eligibility?.eligible
                    ? '1px solid rgba(43,172,82,.25)'
                    : '1px solid rgba(245,158,11,.2)',
                }}
              >
                {eligibility?.eligible ? '✅' : '⏳'}
              </div>
              <p className="mb-2 text-[18px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
                {eligibility?.eligible
                  ? 'You are ready to drive'
                  : `${String(doneCount)} of ${String(STEPS.length)} steps complete`}
              </p>
              <p
                className="max-w-[300px] text-[13px] leading-relaxed"
                style={{ fontFamily: IT, color: MUTED }}
              >
                {/* Identity here is phone-primary and email is optional, so
                    promising an email is a promise DrippleX cannot keep. */}
                {eligibility?.eligible
                  ? 'Operations will activate your account shortly.'
                  : 'Steps marked “With Operations” are being handled for you — the rest are yours to finish.'}
              </p>
            </div>

            <div className="mb-5 flex flex-col gap-2.5">
              {STEPS.map((step) => {
                const done = checks[step.key];
                return (
                  <div
                    key={step.key}
                    className="rounded-2xl px-4 py-3"
                    style={{
                      background: NAVY_SURFACE,
                      border: `1px solid ${done ? 'rgba(43,172,82,.25)' : BORDER}`,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px]"
                        style={{
                          background: done ? G2 : 'rgba(255,255,255,.06)',
                          color: done ? '#fff' : MUTED,
                        }}
                      >
                        {done ? '✓' : '•'}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p
                            className="text-[13.5px] font-semibold"
                            style={{ fontFamily: PP, color: '#fff' }}
                          >
                            {step.label}
                          </p>
                          {/* A driver cannot book their own inspection, verify
                              their own identity, or unlock their own account.
                              Listing those as "steps" with nothing to tap is
                              what made the counter read as a stalled to-do. */}
                          {!done && step.owner === 'ops' && (
                            <span
                              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                              style={{
                                fontFamily: IT,
                                background: 'rgba(245,158,11,.10)',
                                color: COLOR_WARNING,
                              }}
                            >
                              With Operations
                            </span>
                          )}
                        </div>
                        <p className="text-[11.5px]" style={{ fontFamily: IT, color: MUTED }}>
                          {done ? step.done : step.pending}
                        </p>
                      </div>
                    </div>
                    {!done && step.action?.onClick && (
                      <button
                        onClick={step.action.onClick}
                        className="mt-2.5 h-9 w-full rounded-xl text-[12.5px] font-semibold active:scale-[.97]"
                        style={{
                          background: 'rgba(43,172,82,.12)',
                          border: '1px solid rgba(43,172,82,.3)',
                          fontFamily: IT,
                          color: G3,
                        }}
                      >
                        {step.action.label} →
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className="flex flex-col gap-3">
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
            Continue to Dashboard →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER-005 — UPLOAD DOCUMENTS
// ─────────────────────────────────────────────────────────────────────────────
// Driver KYC documents. documentType MUST be a real backend KycDocumentType.
// Road Worthiness and Passport Photo have no KycDocumentType and are a documented
// gap (Road Worthiness needs a new enum value + founder decision; the passport
// photo is a profile avatar, not a KYC document), so they are omitted here rather
// than submitted as invalid types.
const DRIVER_KYC_DOCS: {
  type: string;
  label: string;
  icon: string;
  numberLabel: string;
  numberPlaceholder: string;
  /** Required by DriverActivationService (REQUIRED_DRIVER_KYC_DOCUMENT_TYPES).
   * Without all three verified a driver can never be activated. */
  required?: boolean;
}[] = [
  // Order matters, and it was wrong. This list opened with the optional
  // National ID and buried the three documents that actually gate activation
  // in the middle, with nothing on any row saying which was which. A driver
  // working top-down did an optional document first and could finish the page
  // believing they were done while still blocked.
  //
  // Required first, in the order DriverActivationService checks them, then the
  // optional two — and every row now says which it is.
  {
    type: 'DRIVER_LICENSE',
    required: true,
    label: "Driver's Licence",
    icon: '🪪',
    numberLabel: 'Licence number',
    numberPlaceholder: 'e.g. ABC123456',
  },
  {
    type: 'VEHICLE_REGISTRATION',
    required: true,
    label: 'Vehicle Paper',
    icon: '📄',
    numberLabel: 'Registration / plate number',
    numberPlaceholder: 'e.g. LAG 482 KA',
  },
  {
    type: 'GUARANTOR_ID',
    required: true,
    label: 'Guarantor ID',
    icon: '🧑‍🤝‍🧑',
    numberLabel: "Guarantor's ID number",
    numberPlaceholder: 'e.g. 12345678901',
  },
  {
    type: 'NATIONAL_ID',
    label: 'NIN / National ID',
    icon: '🪪',
    numberLabel: 'NIN / ID number',
    numberPlaceholder: 'e.g. 12345678901',
  },
  {
    type: 'INSURANCE',
    label: 'Insurance Certificate',
    icon: '📋',
    numberLabel: 'Policy number',
    numberPlaceholder: 'e.g. POL-000123',
  },
];

/** The three the activation gate actually waits on — derived from the list
 *  above so the two can never drift apart. */
const REQUIRED_DRIVER_KYC_TYPES = DRIVER_KYC_DOCS.filter((doc) => doc.required === true).map(
  (doc) => doc.type,
);

export function DriverUploadDocsScreen({
  onBack,
  onSave,
  onEmergencyContact,
  onAgreement,
}: {
  onBack: () => void;
  onSave: () => void;
  // Submitting for review needs an emergency contact and an accepted driver
  // agreement as well as documents. The backend named both in its refusal, but
  // this screen had no route to either, so a driver who reached it with
  // documents uploaded could read what was missing and still not get there.
  onEmergencyContact?: () => void;
  onAgreement?: () => void;
}) {
  // Inline upload form state (one document at a time).
  const [openType, setOpenType] = useState<string | null>(null);
  const [docNumber, setDocNumber] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formErr, setFormErr] = useState('');
  // Documents submitted this session. There is no GET /driver/kyc, so prior
  // submissions can't be re-hydrated on reload — the data is still saved
  // server-side; this only tracks what was uploaded in this visit.
  // Real review state per document, read from GET /driver/kyc. This used to be
  // a session-only list, so a driver who had already submitted at sign-up was
  // shown every document as outstanding again — which is what read as a second,
  // duplicate upload page.
  const [submitted, setSubmitted] = useState<string[]>([]);
  const [docState, setDocState] = useState<
    Record<string, { status: 'PENDING' | 'VERIFIED' | 'REJECTED'; remarks: string | null }>
  >({});
  const [loadingDocs, setLoadingDocs] = useState(true);

  const loadDocs = useCallback(() => {
    setLoadingDocs(true);
    api.driver
      .getKyc()
      .then((docs) => {
        // Newest first from the backend, so the first entry per type wins.
        const byType: Record<
          string,
          { status: 'PENDING' | 'VERIFIED' | 'REJECTED'; remarks: string | null }
        > = {};
        for (const doc of docs) {
          byType[doc.documentType] ??= {
            status: doc.verificationStatus,
            remarks: doc.remarks,
          };
        }
        setDocState(byType);
      })
      .catch(() => {
        /* Leave the list empty rather than claiming a document was submitted. */
      })
      .finally(() => setLoadingDocs(false));
  }, []);
  useEffect(() => loadDocs(), [loadDocs]);
  const [reviewing, setReviewing] = useState(false);
  const [reviewErr, setReviewErr] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);

  const openForm = (type: string) => {
    setOpenType(type);
    setDocNumber('');
    setFile(null);
    setFormErr('');
  };

  const submitDoc = async (type: string) => {
    setFormErr('');
    if (docNumber.trim().length < 3) {
      setFormErr('Enter the document number (at least 3 characters).');
      return;
    }
    if (!file) {
      setFormErr('Choose a clear photo or scan of the document.');
      return;
    }
    setSubmitting(true);
    try {
      const frontImage = await uploadFile(file, 'kyc-documents');
      await api.driver.submitKyc({
        documentType: type,
        documentNumber: docNumber.trim(),
        frontImage,
      });
      setSubmitted((s) => (s.includes(type) ? s : [...s, type]));
      setOpenType(null);
      setDocNumber('');
      setFile(null);
      // Re-read from the server so a replacement of a REJECTED document flips
      // back to "under review" rather than keeping the old rejection on screen.
      loadDocs();
    } catch (e: unknown) {
      setFormErr(
        (e as { message?: string }).message ?? 'Could not submit the document. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Submit the whole onboarding for Ops review. The backend requires emergency
  // contact + agreement + at least one KYC document; surfaces the exact reason
  // if anything is still missing.
  const submitForReview = async () => {
    setReviewErr('');
    setReviewing(true);
    try {
      await api.driver.submitOnboarding();
      onSave();
    } catch (e: unknown) {
      setReviewErr(
        (e as { message?: string }).message ?? 'Could not submit for review. Please try again.',
      );
      setReviewing(false);
    }
  };

  // Real counts now that the server state is available.
  const requiredDocs = DRIVER_KYC_DOCS.filter((d) => d.required);
  const requiredDone = requiredDocs.filter((d) => {
    const st = docState[d.type]?.status ?? (submitted.includes(d.type) ? 'PENDING' : null);
    return st === 'VERIFIED' || st === 'PENDING';
  }).length;
  const canReview = submitted.length > 0 || Object.keys(docState).length > 0;

  // The backend names precisely what is outstanding
  // ("Onboarding is incomplete (missing: emergency contact, driver agreement
  // acceptance)"), so read its own words rather than second-guessing state.
  const needsEmergencyContact = /emergency contact/i.test(reviewErr);
  const needsAgreement = /agreement/i.test(reviewErr);

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
              Add or replace a document
            </p>
            <p className="text-[12px]" style={{ fontFamily: IT, color: MUTED }}>
              {loadingDocs
                ? 'Loading your documents…'
                : `${String(requiredDone)}/${String(requiredDocs.length)} required documents sent`}
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
            Steps 1–3 are the documents DrippleX must verify before you can go online. Steps 4 and 5
            are optional. Anything you sent when you signed up is already with Operations — you only
            need this page to add a missing document or replace one that was rejected. Photos or
            PDFs, unblurred, all 4 corners visible, under 10MB.
          </p>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          style={{ display: 'none' }}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />

        <div className="mb-6 flex flex-col gap-4">
          {DRIVER_KYC_DOCS.map((doc, index) => {
            // Server state wins; a document sent in this session counts too.
            const state = docState[doc.type];
            const status = state?.status ?? (submitted.includes(doc.type) ? 'PENDING' : null);
            const done = status !== null && status !== 'REJECTED';
            const isOpen = openType === doc.type;
            return (
              <div
                key={doc.type}
                className="overflow-hidden rounded-2xl"
                style={{
                  background: NAVY_SURFACE,
                  border: `1px solid ${done ? 'rgba(43,172,82,.3)' : BORDER}`,
                }}
              >
                <div className="flex items-center gap-3 p-4">
                  {/* Numbered, so "in order" is visible rather than implied. */}
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-2xl text-xl font-bold"
                    style={{
                      background: done ? 'rgba(43,172,82,.12)' : 'rgba(255,255,255,.04)',
                      fontFamily: PP,
                      fontSize: done ? 20 : 15,
                      color: done ? undefined : MUTED,
                    }}
                  >
                    {done ? '✅' : index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p
                        className="text-[14px] font-semibold"
                        style={{ fontFamily: PP, color: '#fff' }}
                      >
                        {doc.icon} {doc.label}
                      </p>
                      {/* Which rows actually gate activation. Without this a
                          driver could complete the optional ones and believe
                          they were finished. */}
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{
                          fontFamily: IT,
                          background:
                            doc.required === true ? 'rgba(239,68,68,.10)' : 'rgba(255,255,255,.05)',
                          color: doc.required === true ? '#F87171' : MUTED,
                        }}
                      >
                        {doc.required === true ? 'Required' : 'Optional'}
                      </span>
                    </div>
                    <p
                      className="text-[12px]"
                      style={{
                        fontFamily: IT,
                        color:
                          status === 'VERIFIED'
                            ? G3
                            : status === 'REJECTED'
                              ? COLOR_ERROR
                              : status === 'PENDING'
                                ? COLOR_WARNING
                                : MUTED,
                      }}
                    >
                      {status === 'VERIFIED'
                        ? 'Verified ✓'
                        : status === 'PENDING'
                          ? 'Submitted — under review'
                          : status === 'REJECTED'
                            ? `Rejected — please replace${state?.remarks ? `: ${state.remarks}` : ''}`
                            : // The chip above already says required/optional —
                              // repeating it here just crowded the row.
                              'PDF or image'}
                    </p>
                  </div>
                  {!done && !isOpen && (
                    <button
                      onClick={() => openForm(doc.type)}
                      className="h-10 rounded-xl px-4 text-[13px] font-semibold active:scale-[.97]"
                      style={{
                        background: `linear-gradient(135deg,${G0},${G2})`,
                        color: '#fff',
                        fontFamily: IT,
                        boxShadow: `0 4px 16px rgba(43,172,82,.3)`,
                      }}
                    >
                      Upload
                    </button>
                  )}
                </div>

                {isOpen && (
                  <div
                    className="px-4 pb-4"
                    style={{ borderTop: '1px solid rgba(255,255,255,.06)', paddingTop: 14 }}
                  >
                    <DInput
                      label={doc.numberLabel}
                      placeholder={doc.numberPlaceholder}
                      value={docNumber}
                      onChange={setDocNumber}
                    />
                    <div className="mb-3 flex items-center gap-3">
                      <button
                        onClick={() => fileRef.current?.click()}
                        className="h-10 rounded-xl px-4 text-[13px] font-medium active:scale-[.97]"
                        style={{
                          background: 'rgba(255,255,255,.04)',
                          border: `1px solid ${BORDER}`,
                          color: '#fff',
                          fontFamily: IT,
                        }}
                      >
                        {file ? 'Change file' : '📤 Choose file'}
                      </button>
                      <span
                        className="flex-1 truncate text-[12px]"
                        style={{ fontFamily: IT, color: file ? '#fff' : MUTED }}
                      >
                        {file ? file.name : 'No file selected'}
                      </span>
                    </div>
                    {formErr && (
                      <div
                        className="mb-3 rounded-xl px-3 py-2"
                        style={{
                          background: 'rgba(239,68,68,.07)',
                          border: '1px solid rgba(239,68,68,.2)',
                        }}
                      >
                        <p style={{ fontFamily: IT, fontSize: 12, color: '#F87171' }}>{formErr}</p>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => submitDoc(doc.type)}
                        disabled={submitting}
                        className="flex h-10 flex-1 items-center justify-center rounded-xl text-[13px] font-semibold active:scale-[.97]"
                        style={{
                          background: submitting
                            ? 'rgba(255,255,255,.08)'
                            : `linear-gradient(135deg,${G0},${G2})`,
                          color: submitting ? MUTED : '#fff',
                          fontFamily: IT,
                        }}
                      >
                        {submitting ? 'Submitting…' : 'Submit for review'}
                      </button>
                      <button
                        onClick={() => setOpenType(null)}
                        disabled={submitting}
                        className="h-10 rounded-xl px-4 text-[13px] font-medium active:scale-[.97]"
                        style={{
                          background: 'rgba(255,255,255,.04)',
                          border: `1px solid ${BORDER}`,
                          color: MUTED,
                          fontFamily: IT,
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {reviewErr && (
          <div
            className="mb-4 rounded-2xl px-4 py-3"
            style={{ background: 'rgba(239,68,68,.07)', border: '1px solid rgba(239,68,68,.2)' }}
          >
            <p style={{ fontFamily: IT, fontSize: 12, color: '#F87171' }}>{reviewErr}</p>
            {/* Turn the refusal into the steps it names. Reading "missing:
                emergency contact, driver agreement acceptance" with no way to
                supply either is a dead end — which is exactly where driver
                registration stopped. */}
            {(needsEmergencyContact || needsAgreement) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {needsEmergencyContact && onEmergencyContact && (
                  <button
                    onClick={onEmergencyContact}
                    className="rounded-xl px-3 py-2 active:opacity-70"
                    style={{
                      background: 'rgba(255,255,255,.06)',
                      border: '1px solid rgba(255,255,255,.14)',
                      fontFamily: IT,
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#fff',
                    }}
                  >
                    Add emergency contact →
                  </button>
                )}
                {needsAgreement && onAgreement && (
                  <button
                    onClick={onAgreement}
                    className="rounded-xl px-3 py-2 active:opacity-70"
                    style={{
                      background: 'rgba(255,255,255,.06)',
                      border: '1px solid rgba(255,255,255,.14)',
                      fontFamily: IT,
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#fff',
                    }}
                  >
                    Accept driver agreement →
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <DGreenBtn
          label={canReview ? 'Submit for Review →' : 'Upload a document to continue'}
          onClick={submitForReview}
          disabled={!canReview}
          loading={reviewing}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER-006 — VEHICLE REGISTRATION
// ─────────────────────────────────────────────────────────────────────────────
/** The four angles the Operations Console vehicle desk renders, in the order it
 * reads Vehicle.photos. Keep in step with ANGLES in adminConsoleScreen.tsx. */
const VEHICLE_PHOTO_ANGLES = ['Front', 'Rear', 'Left Side', 'Right Side'];

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER — VEHICLE INSPECTION
//
// Founder decision (2026-08-17): a vehicle that needs work is a FAILED
// inspection followed by a re-inspection, not a separate "upgrade" state.
// The backend already enforces exactly that — `scheduleInspection` accepts
// `reinspectionOfId` ONLY when the referenced inspection is FAILED.
//
// What was missing was any way to act on it. GET/POST /driver/inspections have
// existed since the inspection module shipped and nothing called them, so a
// driver whose inspection failed had no route back: Operations has no
// scheduling endpoint either, which makes booking the driver's own job.
// ─────────────────────────────────────────────────────────────────────────────
export function DriverInspectionScreen({ onBack }: { onBack: () => void }) {
  const [inspections, setInspections] = useState<DriverInspectionDto[] | null>(null);
  const [centres, setCentres] = useState<InspectionCentreDto[]>([]);
  const [vehicles, setVehicles] = useState<AdminVehicleDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState('');

  // Booking form. `retryOf` is set when this booking replaces a failed one.
  const [booking, setBooking] = useState(false);
  const [retryOf, setRetryOf] = useState<DriverInspectionDto | null>(null);
  const [centreId, setCentreId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [slot, setSlot] = useState('');
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.driver.listInspections(),
      api.driver.listInspectionCentres(),
      api.driver.listVehicles(),
    ])
      .then(([rows, centreRows, vehicleRows]) => {
        setInspections(rows);
        setCentres(centreRows);
        setVehicles(vehicleRows);
        setLoadErr('');
      })
      .catch((e: unknown) =>
        setLoadErr((e as { message?: string }).message ?? 'Could not load your inspections.'),
      )
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => load(), [load]);

  const openBooking = (failed: DriverInspectionDto | null) => {
    setRetryOf(failed);
    // A re-inspection is for the same vehicle by definition; a first booking
    // defaults to the driver's only vehicle when they have just the one.
    setVehicleId(failed?.vehicleId ?? (vehicles.length === 1 ? (vehicles[0]?.id ?? '') : ''));
    setCentreId('');
    setSlot('');
    setFormErr('');
    setBooking(true);
  };

  const submit = async () => {
    setFormErr('');
    if (vehicleId === '') {
      setFormErr('Choose which vehicle is being inspected.');
      return;
    }
    if (centreId === '') {
      setFormErr('Choose an inspection centre.');
      return;
    }
    if (slot === '') {
      setFormErr('Choose the date and time of your appointment.');
      return;
    }
    const when = new Date(slot);
    if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
      setFormErr('Choose a date and time in the future.');
      return;
    }
    setSaving(true);
    try {
      await api.driver.scheduleInspection({
        vehicleId,
        centreId,
        scheduledAt: when.toISOString(),
        ...(retryOf ? { reinspectionOfId: retryOf.id } : {}),
      });
      setBooking(false);
      setRetryOf(null);
      load();
    } catch (e: unknown) {
      setFormErr((e as { message?: string }).message ?? 'Could not book that appointment.');
    } finally {
      setSaving(false);
    }
  };

  const cancel = async (id: string) => {
    try {
      await api.driver.cancelInspection(id);
      load();
    } catch (e: unknown) {
      setLoadErr((e as { message?: string }).message ?? 'Could not cancel that appointment.');
    }
  };

  const vehicleLabel = (id: string): string => {
    const vehicle = vehicles.find((v) => v.id === id);
    return vehicle ? `${vehicle.make} ${vehicle.model} · ${vehicle.plateNumber}` : 'Your vehicle';
  };
  const centreLabel = (id: string): string => centres.find((c) => c.id === id)?.name ?? 'Centre';

  const rows = inspections ?? [];
  const scheduled = rows.filter((row) => row.status === 'SCHEDULED');
  // Only the most recent failure is worth offering a retry on — an older one is
  // already answered by whatever was booked after it.
  const latestFailed = rows
    .filter((row) => row.status === 'FAILED')
    .sort((a, b) => (a.scheduledAt < b.scheduledAt ? 1 : -1))[0];
  const passed = rows.some((row) => row.status === 'PASSED');
  const retryAlreadyBooked =
    latestFailed !== undefined &&
    rows.some((row) => row.reinspectionOfId === latestFailed.id && row.status === 'SCHEDULED');

  const STATUS_STYLE: Record<string, { label: string; color: string }> = {
    SCHEDULED: { label: 'Booked', color: COLOR_WARNING },
    PASSED: { label: 'Passed', color: G3 },
    FAILED: { label: 'Failed', color: COLOR_ERROR },
    CANCELLED: { label: 'Cancelled', color: MUTED },
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
              Vehicle inspection
            </p>
            <p className="text-[12px]" style={{ fontFamily: IT, color: MUTED }}>
              {passed
                ? 'Your vehicle has passed'
                : scheduled.length > 0
                  ? 'Appointment booked'
                  : 'Book your physical check'}
            </p>
          </div>
        </div>

        {loading && (
          <p className="text-[13px]" style={{ fontFamily: IT, color: MUTED }}>
            Loading…
          </p>
        )}
        {loadErr !== '' && (
          <div
            className="mb-4 rounded-xl px-4 py-3"
            style={{ background: 'rgba(239,68,68,.07)', border: '1px solid rgba(239,68,68,.2)' }}
          >
            <p className="text-[12.5px]" style={{ fontFamily: IT, color: COLOR_ERROR }}>
              {loadErr}
            </p>
          </div>
        )}

        {/* A failed inspection is not a dead end — it is a re-inspection. */}
        {latestFailed !== undefined && !passed && !retryAlreadyBooked && (
          <div
            className="mb-4 rounded-2xl px-4 py-3.5"
            style={{ background: 'rgba(239,68,68,.07)', border: '1px solid rgba(239,68,68,.2)' }}
          >
            <p className="text-[13px] font-semibold" style={{ fontFamily: PP, color: '#fff' }}>
              Your vehicle did not pass
            </p>
            <p
              className="mt-1 text-[12px] leading-relaxed"
              style={{ fontFamily: IT, color: MUTED }}
            >
              {latestFailed.notes !== null && latestFailed.notes !== ''
                ? latestFailed.notes
                : 'Put right what the inspector listed, then book a re-inspection.'}
            </p>
            <button
              onClick={() => openBooking(latestFailed)}
              className="mt-3 h-10 w-full rounded-xl text-[13px] font-semibold active:scale-[.97]"
              style={{
                background: `linear-gradient(135deg,${G0},${G2})`,
                color: '#fff',
                fontFamily: IT,
              }}
            >
              Book a re-inspection →
            </button>
          </div>
        )}

        {!loading && rows.length === 0 && (
          <p
            className="mb-4 text-[12.5px] leading-relaxed"
            style={{ fontFamily: IT, color: MUTED }}
          >
            Your vehicle has to pass a physical inspection before you can go online. Book a slot at
            one of the centres below — take the vehicle and your papers with you.
          </p>
        )}

        {rows.map((row) => {
          const style = STATUS_STYLE[row.status] ?? { label: row.status, color: MUTED };
          return (
            <div
              key={row.id}
              className="mb-2.5 rounded-2xl px-4 py-3.5"
              style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p
                      className="text-[13.5px] font-semibold"
                      style={{ fontFamily: PP, color: '#fff' }}
                    >
                      {centreLabel(row.centreId)}
                    </p>
                    {row.reinspectionOfId !== null && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{
                          fontFamily: IT,
                          background: 'rgba(59,130,246,.12)',
                          color: '#60A5FA',
                        }}
                      >
                        Re-inspection
                      </span>
                    )}
                  </div>
                  <p className="text-[11.5px]" style={{ fontFamily: IT, color: MUTED }}>
                    {new Date(row.scheduledAt).toLocaleString()} · {vehicleLabel(row.vehicleId)}
                  </p>
                  {row.notes !== null && row.notes !== '' && (
                    <p className="mt-1 text-[11.5px]" style={{ fontFamily: IT, color: MUTED }}>
                      {row.notes}
                    </p>
                  )}
                </div>
                <span
                  className="shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-semibold"
                  style={{
                    fontFamily: IT,
                    background: 'rgba(255,255,255,.05)',
                    color: style.color,
                  }}
                >
                  {style.label}
                </span>
              </div>
              {row.status === 'SCHEDULED' && (
                <button
                  onClick={() => void cancel(row.id)}
                  className="mt-2.5 h-9 w-full rounded-xl text-[12.5px] font-semibold active:scale-[.97]"
                  style={{
                    background: 'rgba(255,255,255,.04)',
                    border: `1px solid ${BORDER}`,
                    color: MUTED,
                    fontFamily: IT,
                  }}
                >
                  Cancel this appointment
                </button>
              )}
            </div>
          );
        })}

        {!loading && !booking && scheduled.length === 0 && !passed && (
          <DGreenBtn
            label={latestFailed !== undefined ? 'Book a re-inspection →' : 'Book an inspection →'}
            onClick={() => openBooking(latestFailed ?? null)}
          />
        )}

        {booking && (
          <div
            className="mt-2 rounded-2xl px-4 py-4"
            style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
          >
            <p className="mb-3 text-[14px] font-semibold" style={{ fontFamily: PP, color: '#fff' }}>
              {retryOf ? 'Book a re-inspection' : 'Book an inspection'}
            </p>

            {vehicles.length === 0 && (
              <p className="mb-3 text-[12px]" style={{ fontFamily: IT, color: COLOR_WARNING }}>
                Register your vehicle first — there is nothing to inspect yet.
              </p>
            )}

            {vehicles.length > 1 && (
              <>
                <p className="mb-2 text-[12.5px]" style={{ fontFamily: IT, color: TEXT_SECONDARY }}>
                  Vehicle
                </p>
                <div className="mb-3 flex flex-col gap-2">
                  {vehicles.map((vehicle) => (
                    <button
                      key={vehicle.id}
                      onClick={() => setVehicleId(vehicle.id)}
                      disabled={retryOf !== null}
                      className="h-11 rounded-xl px-3 text-left text-[12.5px] active:scale-[.99]"
                      style={{
                        background:
                          vehicleId === vehicle.id
                            ? 'rgba(43,172,82,.12)'
                            : 'rgba(255,255,255,.04)',
                        border: `1px solid ${vehicleId === vehicle.id ? G2 : BORDER}`,
                        color: vehicleId === vehicle.id ? '#fff' : MUTED,
                        fontFamily: IT,
                      }}
                    >
                      {vehicle.make} {vehicle.model} · {vehicle.plateNumber}
                    </button>
                  ))}
                </div>
              </>
            )}

            <p className="mb-2 text-[12.5px]" style={{ fontFamily: IT, color: TEXT_SECONDARY }}>
              Inspection centre
            </p>
            {centres.length === 0 ? (
              <p className="mb-3 text-[12px]" style={{ fontFamily: IT, color: COLOR_WARNING }}>
                No inspection centre is open for booking yet. Message DrippleX support on WhatsApp{' '}
                {DRIPPLEX_SUPPORT_WHATSAPP}.
              </p>
            ) : (
              <div className="mb-3 flex flex-col gap-2">
                {centres.map((centre) => (
                  <button
                    key={centre.id}
                    onClick={() => setCentreId(centre.id)}
                    className="rounded-xl px-3 py-2.5 text-left active:scale-[.99]"
                    style={{
                      background:
                        centreId === centre.id ? 'rgba(43,172,82,.12)' : 'rgba(255,255,255,.04)',
                      border: `1px solid ${centreId === centre.id ? G2 : BORDER}`,
                      fontFamily: IT,
                    }}
                  >
                    <p
                      className="text-[12.5px] font-semibold"
                      style={{ color: centreId === centre.id ? '#fff' : MUTED }}
                    >
                      {centre.name}
                    </p>
                    <p className="text-[11px]" style={{ color: MUTED }}>
                      {/* Most DrippleX centres have no published street address
                          yet — showing "null, Kano" or a stray comma would look
                          like a data fault to the driver. */}
                      {centre.address !== null && centre.address !== ''
                        ? `${centre.address}, ${centre.city}`
                        : centre.city}
                    </p>
                  </button>
                ))}
              </div>
            )}

            {/* Centres carry no address for now (founder decision), so the way
                a driver asks "where exactly?" is support. */}
            <p
              className="mb-3 text-[11.5px] leading-relaxed"
              style={{ fontFamily: IT, color: MUTED }}
            >
              Not sure where to go? Message DrippleX support on WhatsApp{' '}
              <a
                href={`https://wa.me/${DRIPPLEX_SUPPORT_WHATSAPP.replace('+', '')}`}
                target="_blank"
                rel="noreferrer"
                style={{ color: G3, textDecoration: 'underline' }}
              >
                {DRIPPLEX_SUPPORT_WHATSAPP}
              </a>
              .
            </p>

            <p className="mb-2 text-[12.5px]" style={{ fontFamily: IT, color: TEXT_SECONDARY }}>
              Date and time
            </p>
            <input
              type="datetime-local"
              value={slot}
              onChange={(e) => setSlot(e.target.value)}
              className="mb-3 h-11 w-full rounded-xl px-3 text-[13px] text-white outline-none"
              style={{
                background: 'rgba(255,255,255,.04)',
                border: `1px solid ${BORDER}`,
                fontFamily: IT,
              }}
            />

            {formErr !== '' && (
              <p className="mb-3 text-[12px]" style={{ fontFamily: IT, color: COLOR_ERROR }}>
                {formErr}
              </p>
            )}

            <DGreenBtn label="Confirm booking →" onClick={() => void submit()} loading={saving} />
            <button
              onClick={() => {
                setBooking(false);
                setRetryOf(null);
              }}
              className="mt-2 h-10 w-full rounded-xl text-[12.5px] font-medium active:scale-[.97]"
              style={{
                background: 'transparent',
                border: `1px solid ${BORDER}`,
                color: MUTED,
                fontFamily: IT,
              }}
            >
              Not now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function DriverVehicleRegScreen({
  onBack,
  onSave,
}: {
  onBack: () => void;
  onSave: () => void;
}) {
  // Blank, not pre-filled. "Toyota / Camry / 2019 / White" was demo data sitting
  // in a real submission form — a driver who tapped through registered a car
  // that was not theirs.
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [colour, setColour] = useState('');
  const [plate, setPlate] = useState('');
  const [seats, setSeats] = useState('');
  const [category, setCategory] = useState<RideType>('ECONOMY');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  // What the driver already registered — at sign-up, most of the time. Without
  // this the screen was a blank create form every visit, so a driver arriving
  // from the onboarding hub was asked to register the same car a second time.
  const [existing, setExisting] = useState<AdminVehicleDto[] | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(true);
  // Only true once the driver explicitly asks to add another vehicle.
  const [addingAnother, setAddingAnother] = useState(false);

  const loadVehicles = useCallback(() => {
    setLoadingExisting(true);
    api.driver
      .listVehicles()
      .then((rows) => setExisting(rows))
      .catch(() => setExisting(null))
      .finally(() => setLoadingExisting(false));
  }, []);
  useEffect(() => loadVehicles(), [loadVehicles]);

  // The vehicle the photo grid edits: the one already on file, if any.
  const target = existing?.[0] ?? null;
  const showCreateForm = !loadingExisting && (addingAnother || (existing?.length ?? 0) === 0);

  // Show the photos already on the registered vehicle, so a driver who added
  // two angles last time is not asked for all four again.
  useEffect(() => {
    if (!target) return;
    setPhotos([0, 1, 2, 3].map((i) => target.photos[i] ?? null));
  }, [target]);
  // The Operations Console vehicle desk shows four fixed angles and reads them
  // from Vehicle.photos in that order. Nothing in the app ever captured them,
  // so every vehicle reached inspection with four empty placeholders.
  const [photos, setPhotos] = useState<(string | null)[]>([null, null, null, null]);
  const [uploadingAngle, setUploadingAngle] = useState<number | null>(null);
  const [photoNote, setPhotoNote] = useState('');
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const pendingAngleRef = useRef<number>(0);

  const CATEGORIES: { value: RideType; label: string }[] = [
    { value: 'ECONOMY', label: 'Economy' },
    { value: 'COMFORT', label: 'Comfort' },
    { value: 'XL', label: 'XL' },
    { value: 'TRICYCLE', label: 'Keke' },
  ];

  const handleSave = async () => {
    setErr('');
    const yearNum = parseInt(year, 10);
    const seatsNum = parseInt(seats, 10);
    const maxYear = new Date().getFullYear() + 1;
    if (make.trim().length < 2 || model.trim().length < 1 || colour.trim().length < 2) {
      setErr('Enter the make, model and colour of your vehicle.');
      return;
    }
    if (plate.trim().length < 3) {
      setErr('Enter a valid plate number.');
      return;
    }
    if (!Number.isFinite(yearNum) || yearNum < 1990 || yearNum > maxYear) {
      setErr('Enter a valid vehicle year.');
      return;
    }
    if (!Number.isFinite(seatsNum) || seatsNum < 1 || seatsNum > 20) {
      setErr('Enter the number of passenger seats (1–20).');
      return;
    }
    setLoading(true);
    try {
      // Only real URLs. Guarding on `!== null` alone let an undefined through
      // when an upload resolved without a URL, and the vehicle was created with
      // a null entry in photos.
      const uploaded = photos.filter((p): p is string => typeof p === 'string' && p.length > 0);
      await api.driver.createVehicle({
        plateNumber: plate.trim(),
        make: make.trim(),
        model: model.trim(),
        color: colour.trim(),
        year: yearNum,
        rideCategory: category,
        seats: seatsNum,
        ...(uploaded.length > 0 ? { photos: uploaded } : {}),
      });
      setAddingAnother(false);
      onSave();
    } catch (e: unknown) {
      setErr(
        (e as { message?: string }).message ?? 'Could not save the vehicle. Please try again.',
      );
      setLoading(false);
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
          <div>
            <p className="text-[17px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
              Vehicle Registration
            </p>
            <p className="text-[12px]" style={{ fontFamily: IT, color: MUTED }}>
              Your ride partner vehicle
            </p>
          </div>
        </div>

        {/* Vehicle photos — the four angles the Operations Console shows, in the
            order it reads them from Vehicle.photos. Without these an inspector
            has nothing to look at before the physical check. */}
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            const angle = pendingAngleRef.current;
            setUploadingAngle(angle);
            setErr('');
            setPhotoNote('');
            void uploadFile(file, 'product-images')
              .then(async (url) => {
                const next = photos.map((p, i) => (i === angle ? url : p));
                setPhotos(next);
                // A vehicle already on file gets the photo straight away.
                // Otherwise it rides along with the create below. Photos-only
                // updates do not reset an approval, so this is safe to do
                // against a vehicle Operations has already reviewed.
                if (target) {
                  await api.driver.updateVehicle(target.id, {
                    photos: next.filter((p): p is string => typeof p === 'string' && p.length > 0),
                  });
                  setPhotoNote('Saved to your registered vehicle.');
                }
              })
              .catch((uploadError: unknown) =>
                setErr(
                  (uploadError as { message?: string }).message ??
                    'Could not upload that photo. Try again.',
                ),
              )
              .finally(() => setUploadingAngle(null));
          }}
        />
        <div className="mb-6">
          <p className="mb-1 text-[14px] font-semibold" style={{ fontFamily: PP, color: '#fff' }}>
            Vehicle photos
          </p>
          <p className="mb-3 text-[12px]" style={{ fontFamily: IT, color: MUTED }}>
            One clear photo per angle, in daylight. Your inspector reviews these before the physical
            check.
            {target ? ' These are saved to the vehicle you already registered.' : ''}
          </p>
          {photoNote !== '' && (
            <p className="mb-3 text-[12px]" style={{ fontFamily: IT, color: G3 }}>
              {photoNote}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            {VEHICLE_PHOTO_ANGLES.map((angle, idx) => {
              const url = photos[idx];
              const busy = uploadingAngle === idx;
              return (
                <button
                  key={angle}
                  onClick={() => {
                    pendingAngleRef.current = idx;
                    photoInputRef.current?.click();
                  }}
                  disabled={busy}
                  className="relative flex h-28 flex-col items-center justify-center gap-1 overflow-hidden rounded-2xl active:scale-[.98]"
                  style={{
                    background: url ? `center / cover no-repeat url(${url})` : NAVY_SURFACE,
                    border: `1px ${url ? 'solid' : 'dashed'} ${url ? G2 : BORDER}`,
                    cursor: busy ? 'default' : 'pointer',
                  }}
                >
                  {!url && <span style={{ fontSize: 22 }}>📷</span>}
                  <span
                    className="rounded px-2 py-0.5 text-[11.5px] font-medium"
                    style={{
                      fontFamily: IT,
                      color: url ? '#fff' : MUTED,
                      background: url ? 'rgba(0,0,0,.55)' : 'transparent',
                    }}
                  >
                    {busy ? 'Uploading…' : url ? `${angle} ✓` : angle}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* What is already registered. This used to be a preview of the form
            fields above it — with the demo defaults in place it showed
            "Toyota Camry 2019" to every driver, including one whose real car
            was already on file. */}
        {(existing ?? []).map((vehicle) => (
          <div
            key={vehicle.id}
            className="mb-3 flex items-center gap-4 rounded-2xl p-4"
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
                {vehicle.make} {vehicle.model} {vehicle.year}
              </p>
              <p className="text-[13px]" style={{ fontFamily: IT, color: MUTED }}>
                {vehicle.color} · {vehicle.plateNumber}
              </p>
              <div className="mt-1 flex items-center gap-1.5">
                <div
                  className="h-1.5 w-1.5 rounded-full"
                  style={{
                    background: vehicle.approvalStatus === 'APPROVED' ? G2 : COLOR_WARNING,
                  }}
                />
                <p
                  className="text-[11px]"
                  style={{
                    fontFamily: IT,
                    color: vehicle.approvalStatus === 'APPROVED' ? G3 : COLOR_WARNING,
                  }}
                >
                  {vehicle.approvalStatus === 'APPROVED'
                    ? 'Approved by Operations'
                    : vehicle.approvalStatus === 'REJECTED'
                      ? 'Rejected — register a replacement'
                      : 'Registered — waiting for Operations to approve it'}
                </p>
              </div>
            </div>
          </div>
        ))}

        {/* A driver may genuinely run a second car, so this is offered — but
            never assumed. */}
        {!showCreateForm && (
          <button
            onClick={() => setAddingAnother(true)}
            className="mb-6 h-11 w-full rounded-xl text-[13px] font-semibold active:scale-[.97]"
            style={{
              background: 'rgba(43,172,82,.12)',
              border: '1px solid rgba(43,172,82,.3)',
              fontFamily: IT,
              color: G3,
            }}
          >
            Register another vehicle →
          </button>
        )}

        {showCreateForm && (
          <>
            <DInput
              label="Make (Brand)"
              placeholder="e.g. Toyota"
              value={make}
              onChange={setMake}
            />
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

            {/* Ride category */}
            <p
              className="mb-2 text-[13px] font-medium"
              style={{ fontFamily: IT, color: TEXT_SECONDARY }}
            >
              Ride Category
            </p>
            <div className="mb-6 grid grid-cols-4 gap-2">
              {CATEGORIES.map((c) => {
                const active = category === c.value;
                return (
                  <button
                    key={c.value}
                    onClick={() => setCategory(c.value)}
                    className="h-11 rounded-xl text-[13px] font-semibold active:scale-[.97]"
                    style={{
                      background: active ? `linear-gradient(135deg,${G0},${G2})` : NAVY_SURFACE,
                      border: `1px solid ${active ? 'transparent' : BORDER}`,
                      color: active ? '#fff' : MUTED,
                      fontFamily: IT,
                    }}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>

            <div
              className="mb-6 flex gap-3 rounded-2xl p-4"
              style={{
                background: 'rgba(245,158,11,.06)',
                border: '1px solid rgba(245,158,11,.12)',
              }}
            >
              <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
              <p style={{ fontFamily: IT, fontSize: 12, color: TEXT_SECONDARY, lineHeight: 1.5 }}>
                Vehicle must not be older than 12 years. Ensure all details match your vehicle paper
                exactly.
              </p>
            </div>
          </>
        )}

        {err && (
          <div
            className="mb-4 rounded-2xl px-4 py-3"
            style={{ background: 'rgba(239,68,68,.07)', border: '1px solid rgba(239,68,68,.2)' }}
          >
            <p style={{ fontFamily: IT, fontSize: 12, color: '#F87171' }}>{err}</p>
          </div>
        )}

        {showCreateForm ? (
          <DGreenBtn label="Save Vehicle →" onClick={handleSave} loading={loading} />
        ) : (
          <DGreenBtn label="Done →" onClick={onSave} />
        )}
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
  onSignOut,
  onSignIn,
  onFinishSetup,
  onDelivery,
}: {
  onRequest: (offer: RideOfferDto) => void;
  /** Opens a merchant delivery this driver has been offered or accepted.
   *  Reuses the courier job screen — the job, its lifecycle and its proof are
   *  identical work, and drivers now hold the same permission. */
  onDelivery?: (job: RiderDeliveryJobDto) => void;
  onSettings: () => void;
  /** Back to the onboarding hub, so a blocked driver can clear the blocker
   *  without signing out and in again. */
  onFinishSetup?: () => void;
  /** Ends the session and returns the driver to the portal's front door. */
  onSignOut?: () => void;
  onSignIn?: () => void;
}) {
  const [online, setOnline] = useState(false);
  const [acceptingDeliveries, setAcceptingDeliveries] = useState(false);
  const [deliveries, setDeliveries] = useState<RiderDeliveryJobDto[]>([]);
  const [deliveryBusy, setDeliveryBusy] = useState(false);
  const [tab, setTab] = useState<'dash' | 'trips' | 'earnings' | 'wallet' | 'profile'>('dash');
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Signed-in driver identity (may be null before auth resolves).
  const [driver] = useState(() => auth.getUser());
  // Real wallet + completed-trip data for the header stat block.
  const [wallet, setWallet] = useState<WalletDto | null>(null);
  const [tripsToday, setTripsToday] = useState<number | null>(null);
  const [rating, setRating] = useState<{
    averageRating: number | null;
    ratingCount: number;
  } | null>(null);

  useEffect(() => {
    api.driverRides
      .getWallet()
      .then((w) => setWallet(w))
      .catch(() => {});
    api.driverRides
      .performance()
      .then((p) => setRating(p))
      .catch(() => {});
    api.driverRides
      .list({ status: 'COMPLETED', limit: 100 })
      .then((r) => {
        const items = (r as { items?: RideDto[] }).items ?? [];
        setTripsToday(items.filter((t) => isToday(t.completedAt)).length);
      })
      .catch(() => {});
  }, []);

  // Restore availability on mount (driver may already be online).
  useEffect(() => {
    api.driverRides
      .getAvailability()
      .then((a) => {
        const online = !!(a && typeof a === 'object' && (a as { online?: boolean }).online);
        setOnline(online);
        setAcceptingDeliveries(a?.acceptingDeliveries === true);
      })
      .catch(() => {});
  }, []);

  // Merchant deliveries this driver has been offered or is carrying. Polled
  // only while opted in — a driver who wants nothing to do with parcels
  // should not be making this request at all.
  useEffect(() => {
    if (!acceptingDeliveries) {
      setDeliveries([]);
      return;
    }
    let cancelled = false;
    const load = () => {
      api.rider
        .getJobs()
        .then((jobs) => {
          if (!cancelled) setDeliveries(jobs);
        })
        .catch(() => {
          // A driver whose profile is not delivery-eligible gets a 403 here.
          // Nothing to shout about on the dashboard; the list stays empty.
        });
    };
    load();
    const iv = setInterval(load, 10_000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [acceptingDeliveries]);

  // While online, poll for ride offers; navigate to the request screen on first offer.
  useEffect(() => {
    if (!online) return;
    let cancelled = false;
    // Only the *first* sighting of a given offer makes a sound. The poll runs
    // every 5s and an offer lives for 15s, so without this the same request
    // would chime three times and read as three jobs.
    let announcedOfferId: string | null = null;
    const poll = () => {
      api.driverRides
        .getOffers()
        .then((offers) => {
          if (cancelled) return;
          const pending = offers.find((o) => o.status === 'PENDING' || o.status === 'OFFERED');
          if (pending) {
            if (pending.id !== announcedOfferId) {
              announcedOfferId = pending.id;
              // Start ringing the moment the offer is detected, not when the
              // card finishes rendering — and start it here rather than
              // chiming once, so a driver who is not looking at the phone
              // still gets an alarm. startIncomingRideAlarm() is idempotent,
              // so the offer screen re-arming it is a no-op.
              startIncomingRideAlarm();
            }
            onRequest(pending);
          } else {
            // The offer is gone — taken by another driver, cancelled by the
            // passenger, or finally expired. Whatever the reason, an alarm
            // still ringing about it is now ringing about nothing.
            announcedOfferId = null;
            stopIncomingRideAlarm();
          }
        })
        .catch(() => {});
    };
    poll();
    const iv = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      // Going offline, or leaving the driver app, silences it too.
      stopIncomingRideAlarm();
      clearInterval(iv);
    };
  }, [online, onRequest]);

  // Dispatch ranks candidates by distance from the pickup point and DROPS any
  // driver whose availability row has no coordinates
  // (RideDispatchService.findNearestEligibleDriver), and it matches
  // DriverAvailability.vehicleType against the ride type the passenger chose.
  // Going online used to send neither a position nor the driver's real vehicle
  // category — it hardcoded ECONOMY — so an approved, online, waiting driver
  // was invisible to every ride except an ECONOMY one, and invisible to that
  // too for want of a location. That is why a verified driver sat online and
  // no request ever arrived.
  /**
   * Why this driver is, or is not, reachable by dispatch.
   *
   * Going online checks identity verification and commission standing — it
   * does NOT check that the driver is approved or has an approved vehicle.
   * Dispatch requires both (`driverProfile.status === APPROVED` and a
   * DriverAvailability.vehicleType matching the ride), so a driver could sit
   * on "You are live · Waiting for ride requests…" while being structurally
   * unmatchable, with nothing on screen saying so. Every field below is read
   * from an endpoint that already exists; nothing here is inferred.
   */
  const [blockReason, setBlockReason] = useState<string | null>(null);

  const checkReadiness = useCallback(async (): Promise<void> => {
    try {
      const [profile, vehicles, availability] = await Promise.all([
        api.driver.getProfile().catch(() => null),
        api.driver.listVehicles().catch(() => [] as AdminVehicleDto[]),
        api.driverRides.getAvailability().catch(() => null),
      ]);

      if (profile && profile.status !== 'APPROVED') {
        const label = profile.status.toLowerCase().replace(/_/g, ' ');
        setBlockReason(
          profile.status === 'REJECTED' && profile.rejectedReason
            ? `Your account was not approved: ${profile.rejectedReason}. You will not receive ride requests.`
            : `Your account is ${label}. You will not receive ride requests until Operations approves it.`,
        );
        return;
      }

      const usable = vehicles.find((v) => v.approvalStatus === 'APPROVED' && v.isActive);
      if (!usable) {
        setBlockReason(
          vehicles.length === 0
            ? 'No vehicle registered. Requests are matched to your vehicle type, so add one to start receiving them.'
            : 'No approved, active vehicle. Requests are matched to your vehicle type, so none will reach you until one is approved.',
        );
        return;
      }

      if (availability && (availability.latitude === null || availability.longitude === null)) {
        setBlockReason(
          'We do not have your location. Requests are matched by distance — allow location access and go online again.',
        );
        return;
      }

      setBlockReason(null);
    } catch {
      // A failed check must not invent a blocker; the banner stays as it was.
    }
  }, []);

  /**
   * Keep the server's idea of where this driver is from going stale.
   *
   * Position used to be sent once, at go-online. Dispatch ignores anything
   * older than five minutes, so a driver became invisible after five minutes
   * while the app still said "You are live" — which is exactly how a customer
   * ended up searching with an online driver sitting idle.
   */
  const resolveVehicleTypeRef = useRef<() => Promise<RideType>>(async () => 'ECONOMY' as RideType);
  const heartbeat = useLocationHeartbeat(online, async (position) => {
    await api.driverRides.setAvailability({
      online: true,
      acceptingRides: true,
      vehicleType: await resolveVehicleTypeRef.current(),
      latitude: position.latitude,
      longitude: position.longitude,
    });
  });

  const resolveVehicleType = useCallback(async (): Promise<RideType> => {
    try {
      const vehicles = await api.driver.listVehicles();
      const approved = vehicles.find((v) => v.approvalStatus === 'APPROVED' && v.isActive);
      const chosen = approved ?? vehicles[0];
      return (chosen?.rideCategory as RideType | undefined) ?? 'ECONOMY';
    } catch {
      return 'ECONOMY';
    }
  }, []);
  // The heartbeat's callback is deliberately stable, so it reaches the
  // resolver through a ref rather than restarting the timer on every render.
  resolveVehicleTypeRef.current = resolveVehicleType;

  const handleToggle = async () => {
    setToggling(true);
    setError(null);
    const next = !online;
    try {
      if (next) {
        const pos = await getCurrentPosition();
        if (!pos) {
          setError(
            'DrippleX needs your location to send you ride requests. Allow location access, then try again.',
          );
          return;
        }
        await api.driverRides.setAvailability({
          online: true,
          acceptingRides: true,
          vehicleType: await resolveVehicleType(),
          latitude: pos.latitude,
          longitude: pos.longitude,
        });
      } else {
        await api.driverRides.setAvailability({
          online: false,
          acceptingRides: false,
          vehicleType: await resolveVehicleType(),
        });
      }
      setOnline(next);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not update availability');
    } finally {
      setToggling(false);
    }
  };

  /**
   * Opt in or out of merchant deliveries.
   *
   * Sends `acceptingDeliveries` explicitly — this is the one availability
   * write that is ABOUT the preference. Every other call omits the field, and
   * the server reads absence as "leave it alone", which is what stops the
   * location heartbeat from silently opting a driver back out every few
   * seconds.
   */
  const toggleDeliveries = async (next: boolean): Promise<void> => {
    setDeliveryBusy(true);
    setError(null);
    try {
      const pos = online ? await getCurrentPosition() : null;
      await api.driverRides.setAvailability({
        online,
        acceptingRides: online,
        acceptingDeliveries: next,
        vehicleType: await resolveVehicleType(),
        ...(pos ? { latitude: pos.latitude, longitude: pos.longitude } : {}),
      });
      setAcceptingDeliveries(next);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not update delivery preference');
    } finally {
      setDeliveryBusy(false);
    }
  };

  // Drivers move. Dispatch picks the nearest one, so a stale fix costs the
  // driver trips and sends passengers a driver who is no longer close.
  useEffect(() => {
    void checkReadiness();
  }, [checkReadiness, online]);

  useEffect(() => {
    if (!online) return;
    const push = () => {
      void getCurrentPosition().then((pos) => {
        if (!pos) return;
        void resolveVehicleType().then((vehicleType) => {
          void api.driverRides
            .setAvailability({
              online: true,
              acceptingRides: true,
              vehicleType,
              latitude: pos.latitude,
              longitude: pos.longitude,
            })
            .catch(() => {});
        });
      });
    };
    const iv = setInterval(push, LOCATION_PUSH_INTERVAL_MS);
    return () => clearInterval(iv);
  }, [online, resolveVehicleType]);

  const handleTabChange = (t: typeof tab) => setTab(t);

  // Only a driver session can use this app — otherwise every request 403s and
  // the driver-only data is meaningless. Send non-drivers to the driver login.
  if (!auth.hasRole('driver')) {
    return (
      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center"
        style={{ background: NAVY_DEEP }}
      >
        <div className="text-4xl">🚗</div>
        <div
          className="text-[18px] font-bold text-white"
          style={{ fontFamily: "'Poppins',sans-serif" }}
        >
          Sign in as a driver
        </div>
        <div className="text-[13px]" style={{ fontFamily: IT, color: MUTED }}>
          You’re not signed in as a driver. Sign in to your driver account to go online and accept
          trips.
        </div>
        {onSignIn && (
          <div className="mt-2 w-full max-w-[240px]">
            <DGreenBtn label="Go to driver sign-in" onClick={onSignIn} />
          </div>
        )}
      </div>
    );
  }

  if (tab === 'trips') return <DriverTripsTab onBack={() => setTab('dash')} />;
  if (tab === 'earnings') return <DriverEarningsTab onBack={() => setTab('dash')} />;
  if (tab === 'wallet') return <DriverWalletTab onBack={() => setTab('dash')} />;
  if (tab === 'profile')
    return (
      <DriverProfileTab
        onBack={() => setTab('dash')}
        onSettings={onSettings}
        onSignOut={onSignOut}
      />
    );

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: NAVY_DEEP }}
    >
      <DStatusBar />
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        {/* Map. The height lives here now — the canvas fills whatever box it
            is given rather than drawing at one fixed size. */}
        <div className="relative flex-shrink-0" style={{ height: 280 }}>
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
                  {driverInitials(driver)}
                </div>
                <div>
                  <p className="text-[13px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
                    {driver?.firstName || '—'}
                  </p>
                  <p className="text-[11px]" style={{ fontFamily: IT, color: MUTED }}>
                    Driver
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
                  // Available wallet balance — the real spendable earnings figure.
                  v: wallet ? naira(wallet.availableBalance) : '—',
                  l: 'Available Balance',
                  color: G3,
                },
                {
                  v: tripsToday === null ? '—' : tripsToday.toString(),
                  l: 'Trips Today',
                  color: '#fff',
                },
                {
                  // Real, from RideRating. The endpoint existed the whole
                  // time; nothing called it. Still an em dash while loading
                  // and "No ratings" when genuinely unrated — never a 0,
                  // which a driver would read as a bad score rather than an
                  // absent one.
                  v:
                    rating?.averageRating != null
                      ? rating.averageRating.toFixed(2)
                      : rating !== null
                        ? 'No ratings'
                        : '—',
                  l: 'Rating',
                  color: COLOR_STAR,
                },
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

            {/* Merchant deliveries — opt-in, and separate from rides on purpose
                (founder decision, 2026-08-25). A ride fare is worth more than
                a parcel drop, so a driver online for rides is never pulled
                onto one they did not ask for. */}
            <div
              className="mt-3 flex items-center justify-between gap-3 rounded-2xl px-4 py-3"
              style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
            >
              <div className="min-w-0">
                <p className="text-[13px] font-semibold" style={{ fontFamily: PP, color: '#fff' }}>
                  Also take deliveries
                </p>
                <p className="text-[11px]" style={{ fontFamily: IT, color: MUTED }}>
                  {acceptingDeliveries
                    ? 'You can be offered merchant parcel jobs as well as rides.'
                    : 'Off — you will only be offered rides.'}
                </p>
              </div>
              <button
                type="button"
                disabled={deliveryBusy}
                onClick={() => void toggleDeliveries(!acceptingDeliveries)}
                aria-pressed={acceptingDeliveries}
                className="relative h-7 w-12 flex-shrink-0 rounded-full transition-colors disabled:opacity-60"
                style={{ background: acceptingDeliveries ? G2 : 'rgba(255,255,255,.15)' }}
              >
                <span
                  className="absolute top-1 h-5 w-5 rounded-full bg-white transition-all"
                  style={{ left: acceptingDeliveries ? 26 : 4 }}
                />
              </button>
            </div>

            {/* Deliveries in hand. Only rendered when there are some — an
                empty box under the toggle would read as a broken feature
                rather than a quiet night. */}
            {deliveries.length > 0 ? (
              <div className="mt-3 flex flex-col gap-2">
                {deliveries.map((job) => (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => onDelivery?.(job)}
                    className="flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left active:scale-[.99]"
                    style={{
                      background: 'rgba(43,172,82,.08)',
                      border: '1px solid rgba(43,172,82,.25)',
                    }}
                  >
                    <div className="min-w-0">
                      <p
                        className="text-[13px] font-semibold"
                        style={{ fontFamily: PP, color: '#fff' }}
                      >
                        Delivery · {naira(Number(job.deliveryFee))}
                      </p>
                      <p className="text-[11px]" style={{ fontFamily: IT, color: MUTED }}>
                        {job.status === 'ASSIGNED' ? 'Offered to you — tap to view' : job.status}
                      </p>
                    </div>
                    <span style={{ color: G3, fontSize: 18 }}>›</span>
                  </button>
                ))}
              </div>
            ) : null}

            {/* Shown whenever there is something to say, not only when online.
                `checkReadiness` runs on mount either way, so the reason a
                driver cannot be matched — unapproved account, no vehicle, no
                location — was already known and was simply withheld until they
                pressed Go Online. A driver who has not finished registering
                would toggle online, read the reason, toggle off, and lose it.

                It also carries a way to act on itself now. The banner said
                "add one to start receiving them" from a screen with no route
                to vehicle registration: the onboarding hub was reachable only
                by signing in again, because PORTAL_RESUME sends a driver with
                a live session straight here. Naming a blocker without offering
                the step that clears it is where drivers gave up. */}
            {(online || blockReason !== null) && (
              <div
                className="mt-3 flex flex-col items-center gap-2 rounded-2xl px-3 py-3"
                style={{
                  background: 'rgba(43,172,82,.06)',
                  border: '1px solid rgba(43,172,82,.12)',
                  animation: 'fade-in .4s ease',
                }}
              >
                <div className="flex items-center justify-center gap-2">
                  <div
                    className="h-2 w-2 flex-shrink-0 rounded-full"
                    style={{
                      background: blockReason === null ? G2 : COLOR_WARNING,
                      animation: 'pulse-ring .8s ease-out infinite',
                    }}
                  />
                  <p
                    className="text-center"
                    style={{
                      fontFamily: IT,
                      fontSize: 13,
                      color: blockReason === null ? G3 : COLOR_WARNING,
                    }}
                  >
                    {blockReason ??
                      (heartbeat.degraded
                        ? 'Location unavailable — you will stop receiving requests. Check location access.'
                        : 'You are live · Waiting for ride requests...')}
                  </p>
                </div>
                {blockReason !== null && onFinishSetup && (
                  <button
                    onClick={onFinishSetup}
                    className="rounded-xl px-4 py-2 text-[12px] font-semibold transition-all active:scale-95"
                    style={{
                      background: 'rgba(255,255,255,.08)',
                      border: `1px solid ${BORDER}`,
                      color: '#FFF',
                      fontFamily: IT,
                    }}
                  >
                    Finish registration
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Performance — no acceptance/completion endpoint exists yet. */}
          <div className="px-5 pb-5">
            <p className="mb-3 text-[13px] font-semibold" style={{ fontFamily: PP, color: MUTED }}>
              PERFORMANCE
            </p>
            {['Acceptance Rate', 'Completion Rate'].map((label) => (
              <div key={label} className="mb-3 flex items-center justify-between">
                <p className="text-[13px]" style={{ fontFamily: IT, color: TEXT_SECONDARY }}>
                  {label}
                </p>
                <p className="text-[13px] font-semibold" style={{ fontFamily: IT, color: MUTED }}>
                  —
                </p>
              </div>
            ))}
            <p className="mt-1 text-[11px]" style={{ fontFamily: IT, color: MUTED }}>
              Performance stats aren’t available yet.
            </p>
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
  offer,
  onAccept,
  onDecline,
}: {
  offer: RideOfferDto | null;
  onAccept: (ride: RideDto) => void;
  onDecline: () => void;
}) {
  // Derived from the offer's real expiresAt rather than a hardcoded 15. The
  // server window is RIDE_OFFER_TIMEOUT_MS and this used to disagree with it,
  // so the bar and the number on screen described a deadline that was not the
  // actual one.
  const secondsLeft = (o: RideOfferDto | null): number =>
    o ? Math.max(0, Math.round((new Date(o.expiresAt).getTime() - Date.now()) / 1000)) : 0;
  const [countdown, setCountdown] = useState(() => secondsLeft(offer));
  const [total, setTotal] = useState(() => Math.max(1, secondsLeft(offer)));
  const [preview, setPreview] = useState<RideOfferPreviewDto | null>(null);
  const [busy, setBusy] = useState<null | 'accept' | 'decline'>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    const left = secondsLeft(offer);
    setCountdown(left);
    setTotal(Math.max(1, left));
  }, [offer]);

  // Ring until it is answered. Founder decision, 2026-08-19: a driver may be
  // asleep or doing something else, so an offer has to keep announcing itself
  // rather than chime once into an empty room. Stops the moment this screen
  // goes away — accepted, declined, or timed out — so nothing is left ringing
  // at a driver about a ride that is no longer theirs to take.
  useEffect(() => {
    if (!offer) return;
    return startIncomingRideAlarm();
  }, [offer?.id]);

  useEffect(() => {
    if (!offer) return;
    api.driverRides
      .getOfferPreview(offer.id)
      .then(setPreview)
      .catch(() => setErr('Could not load ride details — do not accept until it loads.'));
  }, [offer]);

  const handleDecline = async () => {
    if (busy) return;
    stopIncomingRideAlarm();
    setBusy('decline');
    try {
      if (offer) await api.driverRides.declineOffer(offer.id);
    } catch {
      /* fall through to leave the screen either way */
    } finally {
      setBusy(null);
      onDecline();
    }
  };

  const handleAccept = async () => {
    if (busy || !offer || !preview) return;
    stopIncomingRideAlarm();
    setBusy('accept');
    setErr('');
    try {
      const ride = await api.driverRides.acceptOffer(offer.id);
      onAccept(ride);
    } catch (e: unknown) {
      // Don't silently decline — tell the driver why (usually the ride was
      // already taken/expired). The countdown returns them to the dashboard.
      setErr(
        (e as { message?: string }).message ?? 'Could not accept — the ride may have been taken.',
      );
      setBusy(null);
    }
  };

  useEffect(() => {
    if (countdown <= 0) {
      // Running out of time is NOT declining. This used to call
      // declineOffer() on the tick, which recorded a driver who simply had not
      // tapped yet as having refused the ride — and a refusal excludes them
      // from that ride for good. The server expires the offer on its own; the
      // driver just goes back to waiting for the next one.
      onDecline();
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, onDecline]);

  const expired = countdown <= 0;
  const pct = (countdown / total) * 100;

  const km = preview ? (preview.estimatedDistanceMeters / 1000).toFixed(1) : null;
  const mins = preview ? Math.max(1, Math.round(preview.estimatedDurationSeconds / 60)) : null;
  const fareLabel = preview ? `₦${preview.totalFare.toLocaleString()}` : '—';
  const rideTypeLabel = preview
    ? preview.rideType.charAt(0) + preview.rideType.slice(1).toLowerCase()
    : 'Ride';
  const pickupLabel = preview?.pickupAddress ?? 'Pickup location';
  const dropoffLabel = preview?.dropoffAddress ?? 'Drop-off location';

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: NAVY_DEEP }}
    >
      <DStatusBar />

      {/* Map. The height lives here now — see the canvas comment. */}
      <div className="relative flex-shrink-0" style={{ height: 280 }}>
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
                {rideTypeLabel} · {fareLabel}
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
                    PICKUP
                  </p>
                  <p
                    className="text-[14px] font-semibold"
                    style={{ fontFamily: PP, color: '#fff' }}
                  >
                    {pickupLabel}
                  </p>
                </div>
                <div>
                  <p className="mb-0.5 text-[11px]" style={{ fontFamily: IT, color: MUTED }}>
                    DROP-OFF{km ? ` · ${km} km` : ''}
                  </p>
                  <p
                    className="text-[14px] font-semibold"
                    style={{ fontFamily: PP, color: '#fff' }}
                  >
                    {dropoffLabel}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-1 flex gap-3 border-t pt-3" style={{ borderColor: BORDER }}>
              {[
                [km ? `${km} km` : '—', 'Distance'],
                [mins ? `${mins} min` : '—', 'Trip Duration'],
                [fareLabel, 'Your Fare'],
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

          {/* How this trip pays. The passenger's identity is deliberately not
              here — a driver has not accepted yet, and the API does not hand
              out a name before they do. This card used to invent one, complete
              with a rating and a trip count. */}
          <div
            className="mb-5 flex items-center gap-3 rounded-2xl p-3"
            style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
          >
            <div
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl text-lg"
              style={{ background: 'rgba(59,130,246,.15)', color: '#fff', fontFamily: PP }}
            >
              {preview?.paymentMethod === 'CASH' ? '💵' : '💳'}
            </div>
            <div className="flex-1">
              <p className="text-[14px] font-semibold" style={{ fontFamily: PP, color: '#fff' }}>
                {preview?.paymentMethod === 'CASH'
                  ? 'Cash on completion'
                  : preview?.paymentMethod
                    ? 'Paid in app'
                    : 'Payment at completion'}
              </p>
              <p className="text-[12px]" style={{ fontFamily: IT, color: MUTED }}>
                You meet your passenger at the pickup point
              </p>
            </div>
          </div>

          {err && (
            <div
              className="mb-3 rounded-xl px-3 py-2 text-center"
              style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)' }}
            >
              <span className="text-[12px]" style={{ fontFamily: IT, color: '#F87171' }}>
                {err}
              </span>
            </div>
          )}

          {/* CTA */}
          <div className="flex gap-3">
            <button
              onClick={handleDecline}
              disabled={busy !== null}
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
            <DGreenBtn
              label={
                expired
                  ? 'Request timed out'
                  : busy === 'accept'
                    ? 'Accepting…'
                    : preview
                      ? '✓  Accept Ride'
                      : 'Loading ride…'
              }
              onClick={handleAccept}
              loading={busy === 'accept'}
              // An expired offer cannot be accepted, so the button says so
              // rather than staying green and failing on tap.
              disabled={expired || !preview || busy !== null}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER-009 — NAVIGATION TO PICKUP
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Cancelling an accepted trip.
 *
 * POST /driver/rides/:id/cancel has existed since RIDE-002.4 and the API client
 * has always exposed it — no screen ever called it. A driver whose passenger
 * never showed, or who could not reach the pickup, had no way out of the trip
 * at all: the only exits from these screens were "I've Arrived" and the back
 * arrow, and the ride stayed open against them until Operations killed it.
 *
 * The backend allows this from DRIVER_ASSIGNED and ARRIVED only — once a trip
 * is IN_PROGRESS it ends by completing, not cancelling — so this is offered on
 * the approach and verification screens and nowhere after.
 */
const DRIVER_CANCEL_REASONS = [
  'Passenger is not at the pickup point',
  'Passenger asked me to cancel',
  'I cannot reach the pickup point',
  'Vehicle or mechanical problem',
  'I do not feel safe taking this trip',
] as const;

function DriverCancelTrip({ rideId, onCancelled }: { rideId?: string; onCancelled: () => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [other, setOther] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // "Other" is only accepted once it says something — the API rejects a reason
  // under three characters, and a blank one tells the passenger nothing.
  const chosen = reason === 'Other' ? other.trim() : reason;
  const ready = !!chosen && chosen.length >= 3;

  const confirm = async () => {
    if (!rideId || !ready || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await api.driverRides.cancel(rideId, chosen);
      onCancelled();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not cancel the trip. Try again.');
    } finally {
      setBusy(false);
    }
  };

  if (!rideId) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-2xl py-3 text-[14px] font-semibold"
        style={{
          background: 'transparent',
          border: '1px solid rgba(248,113,113,.35)',
          color: '#F87171',
          fontFamily: PP,
        }}
      >
        Cancel trip
      </button>

      {open && (
        <div
          className="absolute inset-0 z-50 flex flex-col justify-end"
          style={{ background: 'rgba(2,8,20,.75)' }}
          role="dialog"
          aria-modal="true"
          aria-label="Cancel trip"
        >
          <div
            className="flex flex-col gap-3 rounded-t-3xl px-5 pb-8 pt-5"
            style={{ background: NAVY_BASE, border: `1px solid ${BORDER}`, maxHeight: '85%' }}
          >
            <p className="text-[17px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
              Cancel this trip?
            </p>
            <p className="text-[13px]" style={{ fontFamily: IT, color: MUTED }}>
              Your passenger is told the trip was cancelled and why. Frequent cancellations affect
              your standing, so only cancel when you genuinely cannot complete the trip.
            </p>

            <div className="flex flex-col gap-2 overflow-y-auto">
              {[...DRIVER_CANCEL_REASONS, 'Other'].map((r) => (
                <button
                  key={r}
                  onClick={() => setReason(r)}
                  className="rounded-2xl px-4 py-3 text-left text-[14px]"
                  style={{
                    background: reason === r ? 'rgba(43,172,82,.12)' : NAVY_SURFACE,
                    border: `1px solid ${reason === r ? G2 : BORDER}`,
                    color: '#fff',
                    fontFamily: IT,
                  }}
                >
                  {r}
                </button>
              ))}
              {reason === 'Other' && (
                <textarea
                  value={other}
                  onChange={(e) => setOther(e.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder="Tell your passenger what happened"
                  className="rounded-2xl px-4 py-3 text-[14px] outline-none"
                  style={{
                    background: NAVY_SURFACE,
                    border: `1px solid ${BORDER}`,
                    color: '#fff',
                    fontFamily: IT,
                    resize: 'none',
                  }}
                />
              )}
            </div>

            {err && (
              <p className="text-[12px]" style={{ fontFamily: IT, color: '#F87171' }} role="alert">
                {err}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setOpen(false)}
                disabled={busy}
                className="flex-1 rounded-2xl py-3 text-[14px] font-semibold"
                style={{
                  background: NAVY_SURFACE,
                  border: `1px solid ${BORDER}`,
                  color: '#fff',
                  fontFamily: PP,
                }}
              >
                Keep trip
              </button>
              <button
                onClick={() => void confirm()}
                disabled={!ready || busy}
                className="flex-1 rounded-2xl py-3 text-[14px] font-semibold"
                style={{
                  background: ready && !busy ? '#DC2626' : 'rgba(220,38,38,.35)',
                  color: '#fff',
                  fontFamily: PP,
                  cursor: ready && !busy ? 'pointer' : 'not-allowed',
                }}
              >
                {busy ? 'Cancelling…' : 'Cancel trip'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function DriverNavToPickupScreen({
  onArrived,
  onBack,
  onCancelled,
  rideId,
  onMessagePassenger,
}: {
  onArrived: () => void;
  onBack: () => void;
  onCancelled: () => void;
  rideId?: string;
  // A driver on the way to a pickup could not reach their passenger at all:
  // this card carried a hard-coded name and a call button wired to nothing.
  onMessagePassenger?: (rideId: string, passengerName: string | null) => void;
}) {
  const [eta, setEta] = useState(3);
  const [dist, setDist] = useState(1.2);
  const [busy, setBusy] = useState(false);
  // The active ride carries the passenger's NAME (never their phone number)
  // and the address the driver is actually driving to.
  const [ride, setRide] = useState<DriverRideDto | null>(null);
  const passengerName = ride?.customerName ?? null;

  // App.tsx holds the accepted ride in memory only, so a driver who reloads —
  // or whose phone reaps the tab — arrives here with no rideId and every action
  // on this screen silently does nothing. The trip fetched from
  // /driver/rides/active is the same ride; use it when the handoff is missing.
  const tripId = rideId ?? ride?.id;

  // The approach drive is exactly when the stored position must keep moving:
  // it feeds the passenger's map and the 50m gate waiting at the kerb.
  useDriverLocationPing(tripId);

  useEffect(() => {
    api.driverRides
      .getActive()
      .then(setRide)
      .catch(() => {
        /* Leave it unnamed rather than showing someone else's trip. */
      });
  }, [rideId]);

  const handleArrived = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (tripId) await api.driverRides.arrive(tripId);
    } catch {
      /* best-effort — still advance so the driver isn't stuck */
    } finally {
      setBusy(false);
      onArrived();
    }
  };

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
              {ride?.pickupAddress ?? 'Loading pickup…'}
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
            {passengerName?.trim().charAt(0).toUpperCase() ?? '·'}
          </div>
          <div className="flex-1">
            <p className="text-[14px] font-semibold" style={{ fontFamily: PP, color: '#fff' }}>
              {passengerName ?? 'Your passenger'}
            </p>
            <p className="text-[12px]" style={{ fontFamily: IT, color: MUTED }}>
              Passenger · {eta} min ETA
            </p>
          </div>
          {/* Chat, not a phone call. The driver never receives the passenger's
              number, so the only channel is the one that ends with the trip. */}
          {onMessagePassenger && tripId && (
            <button
              onClick={() => onMessagePassenger(tripId, passengerName)}
              aria-label="Message passenger"
              className="flex h-10 items-center justify-center gap-1.5 rounded-xl px-3"
              style={{
                background: 'rgba(43,172,82,.1)',
                border: '1px solid rgba(43,172,82,.2)',
                fontFamily: IT,
                fontSize: 12,
                color: G3,
              }}
            >
              💬 Message
            </button>
          )}
        </div>

        <DGreenBtn
          label={busy ? 'Confirming…' : "I've Arrived at Pickup →"}
          onClick={handleArrived}
          loading={busy}
        />
        <DriverCancelTrip rideId={tripId} onCancelled={onCancelled} />
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
  onCancelled,
  rideId,
}: {
  onVerified: () => void;
  onBack: () => void;
  onCancelled: () => void;
  rideId?: string;
}) {
  const [otp, setOtp] = useState(['', '', '', '']);
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Distance refusals are handled differently from a wrong code — see submit().
  const [tooFar, setTooFar] = useState(false);
  const [lastCode, setLastCode] = useState('');
  const [ride, setRide] = useState<DriverRideDto | null>(null);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  // Without this fallback a reload mid-trip left rideId undefined, and `submit`
  // below skipped POST /start altogether while still showing "Passenger
  // Verified! Starting trip…" — the driver drove a trip the backend never
  // started, and no fare was ever recorded against it.
  const tripId = rideId ?? ride?.id;

  // The start gate measures the driver's last reported position against the
  // pickup point, so this screen keeps reporting while the driver waits.
  const heartbeat = useDriverLocationPing(tripId);

  useEffect(() => {
    api.driverRides
      .getActive()
      .then(setRide)
      .catch(() => {
        /* Leave the card unnamed rather than showing someone else's trip. */
      });
  }, [rideId]);

  /**
   * The trip code is the backend's gate now, not the screen's. The code the
   * passenger reads out goes to POST /driver/rides/:id/start, and the API is
   * what decides whether it matches — this screen no longer knows the answer,
   * which is the whole point.
   */
  const submit = async (code: string) => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    setTooFar(false);
    try {
      // The other half of the gate is distance, and it is measured against the
      // last position this driver reported. Take a fix at the kerb and land it
      // before asking to start, so the check reads where the car is now rather
      // than where it was on the newest scheduled report.
      const fix = await pushDriverLocationNow(tripId);
      if (!fix) {
        setErr(
          'DrippleX cannot read your location, and it has to confirm you are at the pickup before the trip can start. Turn location on for DrippleX, then try again.',
        );
        setOtp(['', '', '', '']);
        refs.current[0]?.focus();
        return;
      }
      if (!tripId) {
        setErr('We lost track of this trip. Go back and reopen it from your dashboard.');
        setOtp(['', '', '', '']);
        return;
      }
      await api.driverRides.start(tripId, code);
      setVerified(true);
      setTimeout(onVerified, 900);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'That code was not accepted. Please check and try again.';
      setErr(message);

      // A distance refusal is not a wrong code, and clearing the boxes treats
      // it as one — the driver retypes four digits that were right the first
      // time, to be refused again by a satellite. Keep the code, remember that
      // this was the distance half, and offer another fix instead. Reported
      // 2026-08-27: a driver at the kerb was refused at 180m and the only
      // control on screen was "Cancel trip".
      const isDistance = /too far from pickup/i.test(message);
      setTooFar(isDistance);
      if (isDistance) {
        setLastCode(code);
        return;
      }
      setOtp(['', '', '', '']);
      refs.current[0]?.focus();
    } finally {
      setBusy(false);
    }
  };

  /** Another go at the distance half, with the code the driver already entered.
   * `submit` takes a fresh GPS fix each time, so this is a real retry and not
   * a resubmission of the same reading. */
  const retryDistance = () => {
    if (busy || !lastCode) return;
    void submit(lastCode);
  };

  const handleChange = (i: number, v: string) => {
    if (!/^\d*$/.test(v) || busy || verified) return;
    const next = [...otp];
    next[i] = v.slice(-1);
    setOtp(next);
    if (v && i < 3) refs.current[i + 1]?.focus();
    if (next.every((d) => d)) void submit(next.join(''));
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
            {ride?.customerName?.trim().charAt(0).toUpperCase() ?? '·'}
          </div>
          <div>
            <p className="text-[17px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
              {ride?.customerName ?? 'Your passenger'}
            </p>
            <p className="text-[13px]" style={{ fontFamily: IT, color: MUTED }}>
              To: {ride?.dropoffAddress ?? '—'}
            </p>
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
              disabled={busy || verified}
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
        {err ? (
          <p
            className="mb-3 text-center text-[12px]"
            style={{ fontFamily: IT, color: '#F87171' }}
            role="alert"
          >
            {err}
          </p>
        ) : (
          <p className="mb-3 text-center text-[12px]" style={{ fontFamily: IT, color: MUTED }}>
            {busy ? 'Checking the code…' : "The code is on your passenger's screen."}
          </p>
        )}

        {/* The distance half of the start gate fails silently until the driver
            taps Start. Say it while they are still waiting, not after. */}
        {heartbeat.degraded && !verified && (
          <p
            className="mb-6 text-center text-[12px]"
            style={{ fontFamily: IT, color: '#FBBF24' }}
            role="status"
          >
            Your phone has stopped reporting your location. DrippleX has to confirm you are at the
            pickup before the trip can start — check that location is on for DrippleX.
          </p>
        )}

        {/* A driver refused on distance used to have exactly one control on
            screen: Cancel trip. Standing beside the passenger with a GPS
            reading 180m out, their only exit penalised them and stranded the
            fare. This is the other exit — a fresh fix, keeping the code they
            already entered correctly. */}
        {tooFar && !verified && (
          <div className="mb-4 mt-5">
            <button
              onClick={retryDistance}
              disabled={busy}
              className="h-12 w-full rounded-2xl text-[15px] font-semibold transition-all active:scale-[.98] disabled:opacity-60"
              style={{
                background: `linear-gradient(135deg,${G0},${G2})`,
                color: '#fff',
                fontFamily: PP,
              }}
            >
              {busy ? 'Checking your location…' : "I'm here — check again"}
            </button>
            <p className="mt-2 text-center text-[11px]" style={{ fontFamily: IT, color: MUTED }}>
              Move into the open if you can — a wall or a covered park throws GPS off.
            </p>
          </div>
        )}

        {!verified && (
          <div className="mb-8 mt-5">
            <DriverCancelTrip rideId={tripId} onCancelled={onCancelled} />
          </div>
        )}

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
  rideId,
  onMessagePassenger,
}: {
  onComplete: (ride: RideDto | null) => void;
  onBack: () => void;
  rideId?: string;
  onMessagePassenger?: (rideId: string, passengerName: string | null) => void;
}) {
  // The live trip, so this screen stops narrating a fictional one. Everything
  // below — passenger, destination, fare, distance — used to be hard-coded.
  const [ride, setRide] = useState<DriverRideDto | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const completedRef = useRef(false);

  // Keeps the passenger's map — and Operations' fleet view — following the car
  // for the whole trip, not just up to the moment it was accepted.
  useDriverLocationPing(rideId);

  useEffect(() => {
    api.driverRides
      .getActive()
      .then(setRide)
      .catch(() => {
        /* Show the trip unnamed rather than showing somebody else's. */
      });
  }, [rideId]);

  // A clock, not a progress simulation. The bar used to fill itself and then
  // CALL /complete on its own — every real trip ended after nineteen seconds,
  // whether or not the driver had arrived. Only the driver ends a trip now.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const completeTrip = async () => {
    if (completedRef.current) return;
    completedRef.current = true;
    setBusy(true);
    let completed: RideDto | null = null;
    try {
      const id = rideId ?? ride?.id;
      if (id) completed = await api.driverRides.complete(id);
    } catch {
      /* best-effort — still advance to the summary */
    }
    onComplete(completed);
  };

  const startedAt = ride?.startedAt ? new Date(ride.startedAt).getTime() : null;
  const elapsed = startedAt ? Math.max(0, Math.floor((now - startedAt) / 60000)) : 0;

  // Booked estimates from the fare quote. Distance actually driven needs live
  // telemetry the backend does not expose yet, so these are labelled as the
  // trip's booked figures rather than dressed up as a countdown.
  const estMinutes = ride ? Math.round(ride.estimatedDurationSeconds / 60) : null;
  const estKm = ride ? (ride.estimatedDistanceMeters / 1000).toFixed(1) : null;
  const fare = ride ? `₦${ride.totalFare.toLocaleString()}` : '—';
  const passengerName = ride?.customerName ?? null;
  const destination = ride?.dropoffAddress ?? 'Destination not shared';
  const initial = passengerName?.trim().charAt(0).toUpperCase() || '👤';

  // Elapsed against the booked duration — a real ratio, capped so a slow trip
  // shows a full bar instead of overflowing it.
  const progress = estMinutes && estMinutes > 0 ? Math.min(elapsed / estMinutes, 1) : 0;

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
            { v: `${elapsed}m`, l: 'Elapsed', color: '#fff' },
            { v: estKm ?? '—', l: 'km booked', color: '#fff' },
            { v: fare, l: 'Fare', color: G3 },
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
              {destination}
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
            {initial}
          </div>
          <div className="flex-1">
            <p className="text-[14px] font-semibold" style={{ fontFamily: PP, color: '#fff' }}>
              {passengerName ?? 'Your passenger'}
            </p>
            <p className="text-[12px]" style={{ fontFamily: IT, color: MUTED }}>
              Passenger · {elapsed} min elapsed
            </p>
          </div>
          <button
            onClick={() => {
              const id = rideId ?? ride?.id;
              if (id) onMessagePassenger?.(id, passengerName);
            }}
            aria-label="Message your passenger"
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

        {/* The driver ends the trip. There was no button here at all — the
            progress bar completed the ride by itself after roughly nineteen
            seconds, so a real trip settled and charged the passenger while the
            driver was still pulling out of the pickup. */}
        <DGreenBtn
          label={busy ? 'Completing…' : 'Complete Trip →'}
          onClick={() => void completeTrip()}
          loading={busy}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER-012 — TRIP COMPLETED
// ─────────────────────────────────────────────────────────────────────────────
export function DriverTripCompletedScreen({
  onDone,
  ride,
}: {
  onDone: () => void;
  ride?: RideDto | null;
}) {
  // `ride` is a snapshot taken the instant the trip ended, and it never
  // updates again. At that instant the fare is NOT settled: the commission
  // split runs when the passenger pays, so platformCommission / driverEarning
  // are still null and paymentMethod has not been chosen yet. Reading
  // `ride.driverEarning.toLocaleString()` off that snapshot is what threw
  // "null is not an object" on a real trip — and it type-checked only because
  // this app's local RideDto wrongly declared the field non-null.
  //
  // Two things follow, and both need the ride re-read rather than assumed:
  //
  //   • There is no earning figure to show until settlement. Printing ₦0 or a
  //     guess would be worse than saying so.
  //   • A CASH fare is settled by the DRIVER's cash-confirm, and that can only
  //     fire once the passenger has chosen cash on their side — which happens
  //     after this screen opens. Against the frozen snapshot paymentMethod is
  //     forever null, the confirm never fires, and the ride never settles at
  //     all: no commission accrued, no earning recorded.
  //
  // There is no GET /driver/rides/:id, so this watches the driver's own ride
  // list — an endpoint that already exists — and stops as soon as the ride
  // settles.
  const [live, setLive] = useState<RideDto | null>(ride ?? null);
  const confirmedRef = useRef(false);

  useEffect(() => {
    setLive(ride ?? null);
    confirmedRef.current = false;
  }, [ride]);

  const rideId = ride?.id;
  const settled = live?.paymentStatus === 'PAID';

  useEffect(() => {
    if (!rideId || settled) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const page = await api.driverRides.list({ limit: 20 });
        const found = page.items.find((r) => r.id === rideId);
        if (!cancelled && found) setLive(found);
      } catch {
        // A failed poll just means the figure appears a few seconds later.
      }
    };
    void tick();
    const t = setInterval(() => void tick(), 4000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [rideId, settled]);

  // For cash rides the driver collected the fare in person — settle it here
  // (10% commission). Fires once, and only once the passenger has actually
  // chosen cash.
  useEffect(() => {
    if (!live || live.paymentMethod !== 'CASH' || live.paymentStatus === 'PAID') return;
    if (confirmedRef.current) return;
    confirmedRef.current = true;
    api.driverRides.confirmCash(live.id).catch(() => {
      // Left for the next poll / the driver's earnings screen to reflect.
      confirmedRef.current = false;
    });
  }, [live]);

  const earning = live?.driverEarning;
  const earned = earning != null ? `₦${earning.toLocaleString()}` : null;
  const dropoff = live?.dropoffAddress ?? ride?.dropoffAddress ?? '';

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
          Great job!
        </p>
        <p className="text-[14px]" style={{ fontFamily: IT, color: MUTED }}>
          {dropoff}
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
            [
              'Duration',
              live ? `${Math.max(1, Math.round(live.estimatedDurationSeconds / 60))} min` : '—',
            ],
            ['Distance', live ? `${(live.estimatedDistanceMeters / 1000).toFixed(1)} km` : '—'],
            ['Total Fare', live ? `₦${live.totalFare.toLocaleString()}` : '—'],
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
            <p
              className="text-[24px] font-bold"
              style={{ fontFamily: PP, color: earned != null ? G3 : MUTED }}
            >
              {earned ?? 'Pending'}
            </p>
          </div>
          <p className="text-right text-[11px]" style={{ fontFamily: IT, color: MUTED }}>
            {earned != null
              ? 'After 10% platform fee · Added to wallet'
              : 'Waiting for the passenger to pay — this updates on its own'}
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
  const [wallet, setWallet] = useState<WalletDto | null>(null);
  const [txs, setTxs] = useState<WalletLedgerEntryDto[]>([]);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.driverRides
        .getWallet()
        .then((w) => setWallet(w))
        .catch((cause: unknown) => {
          setError(cause instanceof Error ? cause.message : 'Could not load your earnings');
        }),
      api.driverRides
        .getWalletTransactions({ pageSize: 20 })
        .then((r) => setTxs((r as { items?: WalletLedgerEntryDto[] }).items ?? []))
        .catch(() => {
          // Reported by the list's own empty state, not by blanking the hero.
        }),
    ]).finally(() => setLoading(false));
  }, []);

  // Only credits (trip earnings, cashback, etc.) count as money earned in.
  const earnedIn = txs.filter((t) => t.direction === 'CREDIT').reduce((s, t) => s + t.amount, 0);

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

        {/* Hero — available wallet balance (real) */}
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
            Available Balance
          </p>
          <p className="text-[36px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
            {wallet ? naira(wallet.availableBalance) : loading ? '…' : '—'}
          </p>
          {error !== null && (
            <p className="mt-1 text-[12px] opacity-90" style={{ fontFamily: IT, color: '#fff' }}>
              {error}
            </p>
          )}
          {wallet && wallet.pendingBalance > 0 && (
            <p className="mt-1 text-[12px] opacity-80" style={{ fontFamily: IT, color: '#fff' }}>
              + {naira(wallet.pendingBalance)} pending
            </p>
          )}
        </div>

        {/* Why a driver who has worked all day can still see zero here.
            A cash fare never enters the digital ledger — the passenger hands
            the notes over and the driver keeps them, so RidePaymentService
            deliberately moves no wallet money (RIDE-002.7). Only wallet and
            card fares land in this balance. Without saying so, the screen
            reads as "DrippleX has not paid me", which is how this was
            reported.

            GAP: the commission a driver owes on cash fares is tracked on
            their CommissionAccount and is readable at
            GET /driver/commercial/account, but there is no approved design
            for showing it here, so it is logged rather than invented. */}
        <p
          className="mb-5 px-1 text-[11px] leading-relaxed"
          style={{ fontFamily: IT, color: MUTED }}
        >
          Cash fares are paid to you directly by the passenger and do not appear here — this balance
          is wallet and card trips only.
        </p>

        {/* Honest summary derived from the loaded transactions */}
        <div
          className="mb-5 flex gap-3 rounded-2xl p-4"
          style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
        >
          {[
            [wallet ? naira(earnedIn) : '—', 'Recent Credits'],
            [txs.length ? txs.length.toString() : '—', 'Transactions'],
          ].map(([v, l]) => (
            <div key={l} className="flex-1 text-center">
              <p className="text-[15px] font-bold" style={{ fontFamily: PP, color: G3 }}>
                {v}
              </p>
              <p className="text-[10px]" style={{ fontFamily: IT, color: MUTED }}>
                {l}
              </p>
            </div>
          ))}
        </div>

        {/* Transactions */}
        <p className="mb-3 text-[13px] font-semibold" style={{ fontFamily: PP, color: MUTED }}>
          RECENT TRANSACTIONS
        </p>
        {loading ? (
          <p className="py-8 text-center text-[13px]" style={{ fontFamily: IT, color: MUTED }}>
            Loading…
          </p>
        ) : txs.length === 0 ? (
          <p className="py-8 text-center text-[13px]" style={{ fontFamily: IT, color: MUTED }}>
            No transactions yet.
          </p>
        ) : (
          txs.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-3 border-b py-3"
              style={{ borderColor: BORDER }}
            >
              <div
                className="flex h-8 w-8 items-center justify-center rounded-xl text-base"
                style={{
                  background:
                    t.direction === 'CREDIT' ? 'rgba(43,172,82,.1)' : 'rgba(239,68,68,.08)',
                }}
              >
                {t.direction === 'CREDIT' ? '↙' : '↗'}
              </div>
              <div className="flex-1">
                <p className="text-[13px] font-medium" style={{ fontFamily: IT, color: '#fff' }}>
                  {t.description || t.type}
                </p>
                <p className="text-[11px]" style={{ fontFamily: IT, color: MUTED }}>
                  {txWhen(t.createdAt)}
                </p>
              </div>
              <p
                className="text-[14px] font-bold"
                style={{ fontFamily: PP, color: t.direction === 'CREDIT' ? G3 : COLOR_ERROR }}
              >
                {t.direction === 'CREDIT' ? '+' : '−'}
                {naira(t.amount)}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER-014 — WALLET TAB
// ─────────────────────────────────────────────────────────────────────────────
/**
 * What the driver owes DrippleX on cash they collected, and whether it has
 * stood them down.
 *
 * Going online has been gated on this since DPX-COMMERCIAL-001 Slice 4 —
 * `rides.service.ts` throws "blocked from going online due to an outstanding
 * commission balance" — and nothing in the app read the account. So the first
 * a driver learned of the debt was being unable to work, from an error that
 * named no figure, no ceiling, and no way to clear it. The balance builds
 * silently: every cash fare accrues commission the driver already holds in
 * their hand, so nothing visibly leaves the wallet as they approach the line.
 *
 * Shown at the top of the wallet, above the balance, whenever anything is
 * owed — not only once blocked. A driver who can see ₦4,200 of ₦5,000 can
 * settle before it costs them a shift; one who sees nothing until the latch
 * closes cannot.
 */
function DriverCommissionCard() {
  const [account, setAccount] = useState<CommissionAccountDto | null>(null);

  useEffect(() => {
    let live = true;
    api.driverCommercial
      .account()
      .then((a) => {
        if (live) setAccount(a);
      })
      .catch(() => {
        // Nothing to show rather than a scary empty figure. The go-online
        // gate is enforced server-side regardless of what this card managed
        // to read.
      });
    return () => {
      live = false;
    };
  }, []);

  if (account === null || account.outstandingBalance <= 0) return null;

  const { blocked, outstandingBalance, creditLimit } = account;
  const accent = blocked ? '#EF4444' : '#F59E0B';

  return (
    <div
      className="mb-5 rounded-2xl p-4"
      style={{
        background: blocked ? 'rgba(239,68,68,.08)' : 'rgba(245,158,11,.08)',
        border: `1px solid ${blocked ? 'rgba(239,68,68,.35)' : 'rgba(245,158,11,.3)'}`,
      }}
    >
      <p className="mb-1 text-[13px] font-bold" style={{ fontFamily: PP, color: accent }}>
        {blocked ? 'You cannot go online until you settle' : 'Commission you owe'}
      </p>
      <p className="mb-2 text-[28px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
        {naira(outstandingBalance)}
      </p>
      <p className="text-[12px]" style={{ fontFamily: IT, color: TEXT_SECONDARY }}>
        {blocked
          ? // The rule is a latch, so "pay it down a bit" is wrong advice —
            // only zero releases the account, and saying otherwise sends a
            // driver to pay and still find themselves stood down.
            `This is DrippleX's commission on cash fares you collected. It passed your ${naira(creditLimit)} limit, so new trips are paused until the full balance is cleared to zero.`
          : `DrippleX's commission on cash fares you collected. At ${naira(creditLimit)} you stop receiving new trips until it is cleared in full.`}
      </p>
    </div>
  );
}

/**
 * The driver's standing referral code — the one that is always on.
 *
 * Founder decision, 2026-08-26: drivers recruited from other apps market
 * DrippleX to passengers, and a passenger who registers with a driver's code
 * earns that driver ₦350 of wallet cash. Not on signup — on that passenger's
 * first completed ride, because paying at signup makes self-registration free
 * money.
 *
 * Deliberately separate from `DriverReferralCard` below, which is the Driver
 * Growth Campaign: a monthly promo with tiers and thresholds that an admin
 * opens and closes. This scheme runs whether or not a campaign does, so the
 * two are shown as two cards rather than merged into one confusing figure.
 *
 * The reward amounts are the server's (`referrerRewardAmount`), not literals
 * here — the backend was already carrying them in the stats response for
 * exactly this reason, so changing the payout never needs an app release.
 */
function DriverStandingReferralCard() {
  const [stats, setStats] = useState<ReferralStatsDto | null>(null);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true;
    // `stats` creates the code on first read and returns it, so this is the
    // only call needed — `me` would fetch the same code a second time.
    api.driverReferrals
      .stats()
      .then((s) => {
        if (live) setStats(s);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, []);

  const share = async (): Promise<void> => {
    if (stats === null) return;
    const shareUrl = referralShareUrl(stats.code);
    const message = `Join me on DrippleX — use my code ${stats.code} when you sign up. ${shareUrl}`;
    const canNativeShare = typeof navigator.share === 'function';
    try {
      if (canNativeShare) {
        await navigator.share({ text: message, url: shareUrl });
        return;
      }
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      // A cancelled share sheet lands here too. Nothing to report.
    }
  };

  // A driver who cannot reach the endpoint sees nothing rather than an error
  // banner on their wallet; the balance above is the screen's real business.
  if (failed || stats === null) return null;

  return (
    <div
      className="mb-5 rounded-2xl p-4"
      style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
    >
      <p className="mb-1 text-[13px] font-semibold" style={{ fontFamily: PP, color: '#fff' }}>
        Your referral code
      </p>
      <p className="mb-3 text-[12px]" style={{ fontFamily: IT, color: TEXT_SECONDARY }}>
        {naira(stats.referrerRewardAmount)} lands in this wallet for every passenger who signs up
        with your code — paid when they complete their first ride. They get{' '}
        {naira(stats.refereeRewardAmount)} too.
      </p>

      <div
        className="mb-3 flex items-center gap-2 rounded-xl p-3"
        style={{ background: 'rgba(43,172,82,.08)', border: '1px solid rgba(43,172,82,.2)' }}
      >
        <p
          className="flex-1 text-[18px] font-bold tracking-[3px]"
          style={{ fontFamily: PP, color: G3 }}
        >
          {stats.code}
        </p>
        <button
          type="button"
          onClick={() => void share()}
          className="rounded-lg px-4 py-2 text-[12px] font-bold"
          style={{ background: G2, color: '#fff', fontFamily: PP }}
        >
          {copied ? 'Copied' : 'Share'}
        </button>
      </div>

      <div className="flex gap-3">
        {[
          { v: stats.totalRedemptions, l: 'Signed up' },
          // "Awaiting first ride" rather than "Pending", which reads as
          // "we are checking it" — the driver is owed nothing until that
          // passenger rides, and the label should say which it is.
          { v: stats.pendingRedemptions, l: 'Awaiting first ride' },
          { v: stats.rewardedRedemptions, l: 'Paid' },
        ].map((s) => (
          <div key={s.l} className="flex-1 text-center">
            <p className="text-[15px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
              {s.v}
            </p>
            <p className="text-[10px]" style={{ fontFamily: IT, color: MUTED }}>
              {s.l}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The Driver Growth Campaign — a promo that runs for a period, on top of the
 * standing referral code above. Distinct programmes: this one pays tiered
 * bonuses at thresholds an admin sets, and only while a campaign is open.
 *
 * The whole loop was already built and running with no way in: the backend
 * has kept a code per driver per campaign since the Driver Growth Campaign
 * shipped, registration already tries a driver code before a customer one,
 * and the app already captures `?ref=` links at boot. The driver portal has
 * screens for it. The app — which is what drivers actually use — had nothing,
 * so no driver could ever see the code being kept for them.
 *
 * Built on `dashboard` rather than `code` because `code` 404s when no
 * campaign is running, while `dashboard` answers with nulls. Between
 * campaigns a driver should be told that plainly, not shown an error.
 *
 * Every figure is the server's. Thresholds, reward amounts and the qualifying
 * trip count are set per campaign by an admin, so a hardcoded "₦40,000 at 50
 * referrals" would be wrong the first time one is edited.
 */
function DriverReferralCard() {
  const [data, setData] = useState<DriverCampaignDashboardDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true;
    api.driverCampaign
      .dashboard()
      .then((d) => {
        if (live) setData(d);
      })
      .catch(() => {
        // A driver who is not eligible yet — unapproved, suspended — is not
        // an error to shout about on the wallet. The card simply stays away.
        if (live) setFailed(true);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, []);

  const code = data?.referral?.code ?? null;
  const shareUrl = code !== null ? referralShareUrl(code) : null;

  const share = async (): Promise<void> => {
    if (code === null || shareUrl === null) return;
    const message = `Join me on DrippleX — use my code ${code} when you sign up. ${shareUrl}`;
    // Counted as a tap, not a page view: the dashboard's invite figure is
    // meant to reflect real sharing. Recorded first and independently of the
    // share itself, because a native share sheet the driver then cancels
    // still tells us nothing, and a failed count must not block the share.
    void api.driverCampaign.recordInvite().catch(() => {});
    const canNativeShare = typeof navigator.share === 'function';
    try {
      if (canNativeShare) {
        await navigator.share({ text: message, url: shareUrl });
        return;
      }
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      // A cancelled share sheet lands here too. Nothing to report.
    }
  };

  if (loading || failed) return null;

  // Between campaigns. Said plainly — a blank space reads as a broken screen,
  // and inventing a "coming soon" date would be a promise nobody made.
  if (!data?.campaign || code === null) {
    return (
      <div
        className="mb-5 rounded-2xl p-4"
        style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
      >
        <p className="mb-1 text-[13px] font-semibold" style={{ fontFamily: PP, color: '#fff' }}>
          Growth campaign
        </p>
        <p className="text-[12px]" style={{ fontFamily: IT, color: MUTED }}>
          No bonus campaign is running at the moment. Your referral code above keeps earning; when a
          campaign opens, the extra tiers appear here.
        </p>
      </div>
    );
  }

  const stats = data.statistics;
  const campaign = data.campaign;
  const daysLeft =
    data.campaignCountdownSeconds !== null
      ? Math.max(0, Math.ceil(data.campaignCountdownSeconds / 86400))
      : null;

  return (
    <div
      className="mb-5 rounded-2xl p-4"
      style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-[13px] font-semibold" style={{ fontFamily: PP, color: '#fff' }}>
            Growth campaign
          </p>
          <p className="text-[11px]" style={{ fontFamily: IT, color: MUTED }}>
            {campaign.name}
            {daysLeft !== null ? ` · ${String(daysLeft)} days left` : ''}
          </p>
        </div>
        {data.estimatedRewardAmount > 0 ? (
          <div className="text-right">
            <p className="text-[15px] font-bold" style={{ fontFamily: PP, color: G3 }}>
              {naira(data.estimatedRewardAmount)}
            </p>
            <p className="text-[10px] font-bold" style={{ fontFamily: IT, color: G3 }}>
              {data.estimatedTier}
            </p>
          </div>
        ) : null}
      </div>

      {/* Said in the campaign's own numbers rather than a fixed sentence —
          an admin can change any of them between campaigns. */}
      <p className="mb-3 text-[12px]" style={{ fontFamily: IT, color: TEXT_SECONDARY }}>
        Passengers who sign up with your code and complete{' '}
        {campaign.requiredTripsPerPassenger === 1
          ? 'a trip'
          : `${String(campaign.requiredTripsPerPassenger)} trips`}{' '}
        count towards your reward. {naira(campaign.silverRewardAmount)} at{' '}
        {campaign.silverThreshold}, {naira(campaign.goldRewardAmount)} at {campaign.goldThreshold}.
      </p>

      <div
        className="mb-3 flex items-center gap-2 rounded-xl p-3"
        style={{ background: 'rgba(43,172,82,.08)', border: '1px solid rgba(43,172,82,.2)' }}
      >
        <p
          className="flex-1 text-[18px] font-bold tracking-[3px]"
          style={{ fontFamily: PP, color: G3 }}
        >
          {code}
        </p>
        <button
          type="button"
          onClick={() => void share()}
          className="rounded-lg px-4 py-2 text-[12px] font-bold"
          style={{ background: G2, color: '#fff', fontFamily: PP }}
        >
          {copied ? 'Copied' : 'Share'}
        </button>
      </div>

      {stats !== null ? (
        <div className="flex gap-3">
          {[
            { v: stats.registeredCount, l: 'Signed up' },
            { v: stats.qualifiedCount, l: 'Qualified' },
            { v: stats.invitesSent, l: 'Invites' },
          ].map((s) => (
            <div key={s.l} className="flex-1 text-center">
              <p className="text-[15px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
                {s.v}
              </p>
              <p className="text-[10px]" style={{ fontFamily: IT, color: MUTED }}>
                {s.l}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DriverWalletTab({ onBack }: { onBack: () => void }) {
  const [wallet, setWallet] = useState<WalletDto | null>(null);
  const [txs, setTxs] = useState<WalletLedgerEntryDto[]>([]);
  const [loading, setLoading] = useState(true);
  // A swallowed error left this screen showing a dash where the balance goes
  // and nothing else — a driver cannot tell "you have earned nothing yet" from
  // "we could not reach the server". Whatever went wrong now says so.
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.driverRides
        .getWallet()
        .then((w) => setWallet(w))
        .catch((cause: unknown) => {
          setError(cause instanceof Error ? cause.message : 'Could not load your wallet');
        }),
      api.driverRides
        .getWalletTransactions({ pageSize: 20 })
        .then((r) => setTxs((r as { items?: WalletLedgerEntryDto[] }).items ?? []))
        .catch(() => {
          // The balance is the headline; a failed history is reported by the
          // list's own empty state rather than by blanking the screen.
        }),
    ]).finally(() => setLoading(false));
  }, []);

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

        {/* Above the balance deliberately: this is the number that decides
            whether the driver can work at all. */}
        <DriverCommissionCard />

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
            {wallet ? naira(wallet.availableBalance) : loading ? '…' : '—'}
          </p>
          <p
            className="text-[12px]"
            style={{ fontFamily: IT, color: error === null ? MUTED : COLOR_ERROR }}
          >
            {error ?? 'Paid out every Monday by bank transfer.'}
          </p>
        </div>

        {/* Bank linking + payout requests. This was "Withdraw · Coming soon"
            next to "Bank linking isn't available yet" — both true at the time,
            because the withdrawal machinery was bolted to customer wallets
            only. It now reaches the DRIVER wallet these earnings live in. */}
        <PayoutPanel
          client={api.driverRides}
          availableBalance={wallet ? Number(wallet.availableBalance) : null}
          onChanged={() => {
            api.driverRides
              .getWallet()
              .then((w) => setWallet(w))
              .catch(() => {});
          }}
        />

        <DriverStandingReferralCard />
        <DriverReferralCard />

        {/* Transactions */}
        <p className="mb-3 text-[13px] font-semibold" style={{ fontFamily: PP, color: MUTED }}>
          RECENT TRANSACTIONS
        </p>
        {loading ? (
          <p className="py-8 text-center text-[13px]" style={{ fontFamily: IT, color: MUTED }}>
            Loading…
          </p>
        ) : txs.length === 0 ? (
          <p className="py-8 text-center text-[13px]" style={{ fontFamily: IT, color: MUTED }}>
            No transactions yet.
          </p>
        ) : (
          txs.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center gap-3 border-b py-3.5"
              style={{ borderColor: BORDER }}
            >
              <div
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl"
                style={{
                  background:
                    tx.direction === 'CREDIT' ? 'rgba(43,172,82,.1)' : 'rgba(239,68,68,.08)',
                }}
              >
                <span style={{ fontSize: 18 }}>{tx.direction === 'CREDIT' ? '↙' : '↗'}</span>
              </div>
              <div className="flex-1">
                <p className="text-[13px] font-medium" style={{ fontFamily: IT, color: '#fff' }}>
                  {tx.description || tx.type}
                </p>
                <p className="text-[11px]" style={{ fontFamily: IT, color: MUTED }}>
                  {txWhen(tx.createdAt)}
                </p>
              </div>
              <p
                className="text-[14px] font-bold"
                style={{ fontFamily: PP, color: tx.direction === 'CREDIT' ? G3 : COLOR_ERROR }}
              >
                {tx.direction === 'CREDIT' ? '+' : '−'}
                {naira(tx.amount)}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER-015 — TRIP HISTORY TAB
// ─────────────────────────────────────────────────────────────────────────────
function DriverTripsTab({ onBack }: { onBack: () => void }) {
  const [trips, setTrips] = useState<RideDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [performance, setPerformance] = useState<{
    averageRating: number | null;
    ratingCount: number;
  } | null>(null);

  useEffect(() => {
    let live = true;
    api.driverRides
      .performance()
      .then((p) => {
        if (live) setPerformance(p);
      })
      .catch(() => {
        // Leaves the em dash. Better than a rating we could not read.
      });
    return () => {
      live = false;
    };
  }, []);

  const load = useCallback(async () => {
    try {
      const r = await api.driverRides.list({ status: 'COMPLETED', limit: 50 });
      setTrips((r as { items?: RideDto[] }).items ?? []);
    } catch {
      // The list simply stays as it was; the driver can pull the tab again.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Settle a cash fare from the history, which is the only place a stuck one
   * can be reached.
   *
   * The completed-trip screen confirms cash by itself, but only while it is
   * mounted — and the passenger chooses cash *after* it opens. A driver who
   * taps "Go Back Online" first leaves a ride that nothing can ever settle:
   * no commission accrued, no earning recorded, and the passenger parked on
   * "Waiting for your driver to confirm" with rating and tipping locked. The
   * driver portal has always been able to settle an old ride from its own
   * history; the app could not, and that is the gap this closes.
   */
  const confirmCash = async (trip: RideDto): Promise<void> => {
    setConfirming(trip.id);
    setConfirmError(null);
    try {
      await api.driverRides.confirmCash(trip.id);
      // Re-read rather than patch the row locally: the earning and the
      // commission split are the server's to compute, and showing a figure we
      // guessed at is how a driver ends up disputing their own history.
      await load();
    } catch (cause) {
      setConfirmError(
        cause instanceof Error
          ? cause.message
          : 'That did not go through. Check your connection and try again.',
      );
    } finally {
      setConfirming(null);
    }
  };

  // driverEarning is null until the fare settles, so `|| 0` quietly turned
  // "not paid yet" into "earned nothing" — a completed trip showing ₦0 next to
  // the word COMPLETED reads as the driver having worked for free. Count only
  // settled trips in the total, and say how many are still waiting.
  const settledTrips = trips.filter((t) => t.driverEarning != null);
  const earned = settledTrips.reduce((s, t) => s + (t.driverEarning ?? 0), 0);
  const awaiting = trips.length - settledTrips.length;

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

        {/* Summary — all three real now. The rating stayed an em dash for
            want of a caller, not an endpoint: GET /driver/profile/performance
            has computed it from RideRating all along. */}
        <div
          className="mb-4 flex gap-3 rounded-2xl p-4"
          style={{ background: 'rgba(43,172,82,.06)', border: '1px solid rgba(43,172,82,.12)' }}
        >
          {[
            { v: trips.length.toString(), l: 'Completed' },
            {
              v: settledTrips.length === 0 && awaiting > 0 ? 'Pending' : naira(earned),
              l: awaiting > 0 ? `Earned · ${String(awaiting)} unpaid` : 'Earned',
            },
            {
              // null, never 0 — a driver nobody has rated yet must not be
              // shown a zero that reads like a bad score.
              v:
                performance?.averageRating != null
                  ? performance.averageRating.toFixed(2)
                  : performance !== null
                    ? 'No ratings'
                    : '—',
              l:
                performance != null && performance.ratingCount > 0
                  ? `Rating · ${String(performance.ratingCount)}`
                  : 'Rating',
            },
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

        {confirmError !== null ? (
          <div
            className="mb-3 rounded-xl p-3 text-[12px]"
            style={{
              background: 'rgba(239,68,68,.1)',
              border: '1px solid rgba(239,68,68,.3)',
              fontFamily: IT,
              color: '#FCA5A5',
            }}
          >
            {confirmError}
          </div>
        ) : null}

        {loading ? (
          <p className="py-10 text-center text-[13px]" style={{ fontFamily: IT, color: MUTED }}>
            Loading…
          </p>
        ) : trips.length === 0 ? (
          <p className="py-10 text-center text-[13px]" style={{ fontFamily: IT, color: MUTED }}>
            No completed trips yet.
          </p>
        ) : (
          trips.map((trip) => (
            <div
              key={trip.id}
              className="mb-3 rounded-2xl p-4"
              style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
            >
              <div className="mb-3 flex justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-xl text-base"
                    style={{ background: 'rgba(43,172,82,.1)' }}
                  >
                    🚗
                  </div>
                  <div>
                    <p
                      className="text-[12px] font-semibold"
                      style={{ fontFamily: IT, color: '#fff' }}
                    >
                      #{trip.id.slice(0, 8)}
                    </p>
                    <p className="text-[11px]" style={{ fontFamily: IT, color: MUTED }}>
                      {txWhen(trip.completedAt || trip.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p
                    className="text-[15px] font-bold"
                    style={{
                      fontFamily: PP,
                      color: trip.driverEarning != null ? G3 : '#F59E0B',
                    }}
                  >
                    {trip.driverEarning != null ? naira(trip.driverEarning) : 'Unpaid'}
                  </p>
                  <span
                    className="text-[10px] font-bold"
                    style={{
                      color: trip.driverEarning != null ? G3 : '#F59E0B',
                      fontFamily: IT,
                    }}
                  >
                    {trip.driverEarning != null ? trip.status : 'AWAITING PAYMENT'}
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
                    {trip.pickupAddress || 'Pickup'}
                  </p>
                  <p className="text-[12px]" style={{ fontFamily: IT, color: TEXT_SECONDARY }}>
                    {trip.dropoffAddress || 'Dropoff'}
                  </p>
                </div>
              </div>

              {/* The way out of AWAITING PAYMENT. Worded as the assertion it
                  is — the driver is stating they hold the cash, which accrues
                  the commission they owe on it — rather than as a tidy-up. */}
              {needsCashConfirmation(trip) ? (
                <div className="mt-3 border-t pt-3" style={{ borderColor: BORDER }}>
                  <p className="mb-2 text-[11px]" style={{ fontFamily: IT, color: MUTED }}>
                    The passenger is waiting on you to confirm this one. They cannot rate or tip
                    until you do.
                  </p>
                  <button
                    type="button"
                    disabled={confirming === trip.id}
                    onClick={() => void confirmCash(trip)}
                    className="w-full rounded-xl py-2.5 text-[13px] font-bold disabled:opacity-60"
                    style={{ background: G2, color: '#fff', fontFamily: PP }}
                  >
                    {confirming === trip.id ? 'Confirming…' : 'I received the cash'}
                  </button>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER-016 — PROFILE TAB
// ─────────────────────────────────────────────────────────────────────────────
function DriverProfileTab({
  onBack,
  onSettings,
  onSignOut,
}: {
  onBack: () => void;
  onSettings: () => void;
  // Drivers had no visible way out: Sign Out existed only inside Settings,
  // so the app looked like it could not be left except by refreshing.
  onSignOut?: () => void;
}) {
  const driver = auth.getUser();
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
                {driverInitials(driver)}
              </div>
            </div>
            <div className="text-center">
              <p className="text-[20px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
                {driverFullName(driver)}
              </p>
              <div className="mt-1 flex items-center justify-center gap-2">
                <span className="text-[12px]" style={{ fontFamily: IT, color: MUTED }}>
                  Driver
                </span>
              </div>
            </div>
          </div>

          {/* Quick stats — no lifetime-stats endpoint exists yet → honest em dash. */}
          <div className="mt-5 flex gap-3">
            {[
              { v: '—', l: 'Total Trips' },
              { v: '—', l: 'Acceptance' },
              { v: '—', l: 'Completion' },
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
              { icon: '📱', label: 'Phone', value: driver?.phone || '—' },
              { icon: '✉️', label: 'Email', value: driver?.email || '—' },
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

          {/* Actions — only Settings is wired; document/bank management has no
              backend yet, so those dead rows are omitted rather than faked. */}
          <div className="flex flex-col gap-2.5">
            {[
              {
                icon: '⚙️',
                label: 'Settings',
                sub: 'Notifications, security & more',
                action: onSettings,
              },
              ...(onSignOut
                ? [
                    {
                      icon: '⏻',
                      label: 'Sign Out',
                      sub: 'End this session on this device',
                      action: onSignOut,
                    },
                  ]
                : []),
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
export function DriverSettingsScreen({
  onBack,
  onLogout,
}: {
  onBack: () => void;
  onLogout?: () => void;
}) {
  const [notifTrips, setNotifTrips] = useState(true);
  const [notifEarnings, setNotifEarnings] = useState(true);
  const [notifPromos, setNotifPromos] = useState(false);
  const [vibration, setVibration] = useState(true);
  const [navApp, setNavApp] = useState('Google Maps');
  // Which ACCOUNT page is open. Kept local so this does not need a new route
  // in App.tsx — the four pages are only ever reached from here.
  const [accountPage, setAccountPage] = useState<AccountPage | null>(null);

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
        // "Sound Alerts" used to be here as a toggle over local state that was
        // written and never read — flipping it changed nothing and it forgot
        // itself on reload. The real control is <SoundSettings /> below, which
        // persists the choice and lets the driver hear each sound first.
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
          {/* These four were <button>s with no onClick — they looked tappable
              and swallowed every tap. AccountRows carries the handlers, and
              the pages are shared with the rider app so the wording of a
              privacy policy cannot drift between the two. */}
          <AccountRows onOpen={setAccountPage} />
        </div>

        <SoundSettings />

        {/* Logout */}
        <button
          onClick={() => {
            auth.clear();
            onLogout?.();
          }}
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

      {/* Rendered over the settings list rather than replacing it, so backing
          out lands the driver exactly where they were. */}
      <AccountPageHost page={accountPage} audience="driver" onClose={() => setAccountPage(null)} />
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
  const [loading, setLoading] = useState(false);
  const [submitErr, setSubmitErr] = useState('');

  // Must mirror the backend EMERGENCY_CONTACT_RELATIONSHIPS set exactly.
  const RELATIONSHIPS = ['Spouse', 'Parent', 'Sibling', 'Child', 'Relative', 'Friend', 'Other'];

  const validate = () => {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = 'Full name is required';
    if (!relationship) e.relationship = 'Please select a relationship';
    if (phone.trim().length < 7) e.phone = 'Enter a valid phone number';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleContinue = async () => {
    if (!validate()) return;
    setSubmitErr('');
    setLoading(true);
    try {
      // The UI shows a fixed +234 prefix, so store the full number.
      const localDigits = phone.replace(/\D/g, '').replace(/^0+/, '');
      await api.driver.submitEmergencyContact({
        emergencyContactName: name.trim(),
        emergencyContactPhone: `+234${localDigits}`,
        emergencyContactRelationship: relationship,
        ...(email.trim() ? { emergencyContactEmail: email.trim() } : {}),
      });
      onContinue();
    } catch (e: unknown) {
      setSubmitErr(
        (e as { message?: string }).message ?? 'Could not save the contact. Please try again.',
      );
      setLoading(false);
    }
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

        {submitErr && (
          <div
            className="mb-4 rounded-2xl px-4 py-3"
            style={{ background: 'rgba(239,68,68,.07)', border: '1px solid rgba(239,68,68,.2)' }}
          >
            <p style={{ fontFamily: IT, fontSize: 12, color: '#F87171' }}>{submitErr}</p>
          </div>
        )}

        <DGreenBtn label="Continue →" onClick={handleContinue} loading={loading} />
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
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const handleAccept = async () => {
    if (!agreed) return;
    setErr('');
    setLoading(true);
    try {
      // Record acceptance. Onboarding is submitted for review from the KYC
      // status screen once at least one document is uploaded (backend requires
      // emergency contact + agreement + a KYC document before review).
      await api.driver.acceptAgreement('v1');
      onContinue();
    } catch (e: unknown) {
      setErr(
        (e as { message?: string }).message ??
          'Could not record your acceptance. Please try again.',
      );
      setLoading(false);
    }
  };

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

        {err && (
          <div
            className="mb-4 rounded-2xl px-4 py-3"
            style={{ background: 'rgba(239,68,68,.07)', border: '1px solid rgba(239,68,68,.2)' }}
          >
            <p style={{ fontFamily: IT, fontSize: 12, color: '#F87171' }}>{err}</p>
          </div>
        )}

        <DGreenBtn label="Continue →" onClick={handleAccept} disabled={!agreed} loading={loading} />
      </div>
    </div>
  );
}
