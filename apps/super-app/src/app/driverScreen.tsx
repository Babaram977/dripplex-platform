import React, { useState, useEffect, useCallback, useRef } from 'react';
import { G0, G2, G3, NAVY_DEEP, NAVY_CARD, NAVY_SURFACE, BORDER, MUTED } from './shared';
import {
  COLOR_STAR,
  COLOR_SUCCESS,
  COLOR_ERROR,
  COLOR_WARNING,
  TEXT_SECONDARY,
} from '../tokens/colors';
import { api, uploadFile } from '../lib/api';
import { auth } from '../lib/auth';
import type {
  DriverActivationEligibilityDto,
  RideOfferDto,
  RideOfferPreviewDto,
  RideDto,
  RideType,
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
}: {
  onContinue: () => void;
  onUpload: () => void;
  onBack: () => void;
  onVehicle?: () => void;
  onAgreement?: () => void;
}) {
  const [eligibility, setEligibility] = useState<DriverActivationEligibilityDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);

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
    blurb: string;
    action?: { label: string; onClick?: () => void };
  }[] = [
    {
      key: 'identityVerified',
      label: 'Identity check',
      blurb: 'Your identity has been confirmed.',
    },
    {
      key: 'requiredDocumentsApproved',
      label: 'Document review',
      blurb: "Driver's licence, vehicle paper and guarantor ID, all verified.",
      action: { label: 'Upload / update documents', onClick: onUpload },
    },
    {
      key: 'vehicleApproved',
      label: 'Vehicle registration',
      blurb: 'A registered vehicle approved by Operations.',
      ...(onVehicle ? { action: { label: 'Register your vehicle', onClick: onVehicle } } : {}),
    },
    {
      key: 'inspectionPassed',
      label: 'Inspection & test',
      blurb: 'Operations books and records your vehicle inspection.',
    },
    {
      key: 'agreementAccepted',
      label: 'Agreement signing',
      blurb: 'Accept the DrippleX driver terms.',
      ...(onAgreement ? { action: { label: 'Read and accept terms', onClick: onAgreement } } : {}),
    },
    {
      key: 'accountNotLocked',
      label: 'Account standing',
      blurb: 'Your account is in good standing.',
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
                {eligibility?.eligible
                  ? 'Operations will activate your account shortly.'
                  : 'Finish the steps below. We will email you as each one is reviewed.'}
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
                        <p
                          className="text-[13.5px] font-semibold"
                          style={{ fontFamily: PP, color: '#fff' }}
                        >
                          {step.label}
                        </p>
                        <p className="text-[11.5px]" style={{ fontFamily: IT, color: MUTED }}>
                          {step.blurb}
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
   * Without all three verified a driver can never be activated — the list used
   * to omit the guarantor ID entirely, so completing this page still left the
   * driver blocked with nothing on screen explaining why. */
  required?: boolean;
}[] = [
  {
    type: 'NATIONAL_ID',
    label: 'NIN / National ID',
    icon: '🪪',
    numberLabel: 'NIN / ID number',
    numberPlaceholder: 'e.g. 12345678901',
  },
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
    type: 'INSURANCE',
    label: 'Insurance Certificate',
    icon: '📋',
    numberLabel: 'Policy number',
    numberPlaceholder: 'e.g. POL-000123',
  },
];

export function DriverUploadDocsScreen({
  onBack,
  onSave,
}: {
  onBack: () => void;
  onSave: () => void;
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
            Anything you sent when you signed up is already with Operations — you only need this
            page to add a missing document or replace one that was rejected. Documents should be
            clear, unblurred photos or PDFs with all 4 corners visible, under 10MB.
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
          {DRIVER_KYC_DOCS.map((doc) => {
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
                            : doc.required
                              ? 'Required · PDF or image'
                              : 'Optional · PDF or image'}
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
  const [plate, setPlate] = useState('');
  const [seats, setSeats] = useState('4');
  const [category, setCategory] = useState<RideType>('ECONOMY');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

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
      await api.driver.createVehicle({
        plateNumber: plate.trim(),
        make: make.trim(),
        model: model.trim(),
        color: colour.trim(),
        year: yearNum,
        rideCategory: category,
        seats: seatsNum,
      });
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
          style={{ background: 'rgba(245,158,11,.06)', border: '1px solid rgba(245,158,11,.12)' }}
        >
          <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
          <p style={{ fontFamily: IT, fontSize: 12, color: TEXT_SECONDARY, lineHeight: 1.5 }}>
            Vehicle must not be older than 12 years. Ensure all details match your vehicle paper
            exactly.
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
  onSignIn,
}: {
  onRequest: (offer: RideOfferDto) => void;
  onSettings: () => void;
  onSignIn?: () => void;
}) {
  const [online, setOnline] = useState(false);
  const [tab, setTab] = useState<'dash' | 'trips' | 'earnings' | 'wallet' | 'profile'>('dash');
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Signed-in driver identity (may be null before auth resolves).
  const [driver] = useState(() => auth.getUser());
  // Real wallet + completed-trip data for the header stat block.
  const [wallet, setWallet] = useState<WalletDto | null>(null);
  const [tripsToday, setTripsToday] = useState<number | null>(null);

  useEffect(() => {
    api.driverRides
      .getWallet()
      .then((w) => setWallet(w))
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
      })
      .catch(() => {});
  }, []);

  // While online, poll for ride offers; navigate to the request screen on first offer.
  useEffect(() => {
    if (!online) return;
    let cancelled = false;
    const poll = () => {
      api.driverRides
        .getOffers()
        .then((offers) => {
          if (cancelled) return;
          const pending = offers.find((o) => o.status === 'PENDING' || o.status === 'OFFERED');
          if (pending) onRequest(pending);
        })
        .catch(() => {});
    };
    poll();
    const iv = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [online, onRequest]);

  const handleToggle = async () => {
    setToggling(true);
    setError(null);
    const next = !online;
    try {
      await api.driverRides.setAvailability({
        online: next,
        acceptingRides: next,
        vehicleType: 'ECONOMY',
      });
      setOnline(next);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not update availability');
    } finally {
      setToggling(false);
    }
  };

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
                // No driver-rating endpoint exists → honest em dash.
                { v: '—', l: 'Rating', color: COLOR_STAR },
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
  const [countdown, setCountdown] = useState(15);
  const [preview, setPreview] = useState<RideOfferPreviewDto | null>(null);
  const [busy, setBusy] = useState<null | 'accept' | 'decline'>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!offer) return;
    api.driverRides
      .getOfferPreview(offer.id)
      .then(setPreview)
      .catch(() => setErr('Could not load ride details — do not accept until it loads.'));
  }, [offer]);

  const handleDecline = async () => {
    if (busy) return;
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
      handleDecline();
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const pct = (countdown / 15) * 100;

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
                busy === 'accept' ? 'Accepting…' : preview ? '✓  Accept Ride' : 'Loading ride…'
              }
              onClick={handleAccept}
              loading={busy === 'accept'}
              disabled={!preview || busy !== null}
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
export function DriverNavToPickupScreen({
  onArrived,
  onBack,
  rideId,
}: {
  onArrived: () => void;
  onBack: () => void;
  rideId?: string;
}) {
  const [eta, setEta] = useState(3);
  const [dist, setDist] = useState(1.2);
  const [busy, setBusy] = useState(false);

  const handleArrived = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (rideId) await api.driverRides.arrive(rideId);
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

        <DGreenBtn
          label={busy ? 'Confirming…' : "I've Arrived at Pickup →"}
          onClick={handleArrived}
          loading={busy}
        />
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
  rideId,
}: {
  onVerified: () => void;
  onBack: () => void;
  rideId?: string;
}) {
  const [otp, setOtp] = useState(['', '', '', '']);
  const [verified, setVerified] = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  // Passenger OTP is a local gate (no backend); starting the trip is the real call.
  const startTrip = async () => {
    try {
      if (rideId) await api.driverRides.start(rideId);
    } catch {
      /* best-effort — still advance so the driver isn't stuck */
    }
    onVerified();
  };

  const handleChange = (i: number, v: string) => {
    if (!/^\d*$/.test(v)) return;
    const next = [...otp];
    next[i] = v.slice(-1);
    setOtp(next);
    if (v && i < 3) refs.current[i + 1]?.focus();
    if (next.every((d) => d) && next.join('') === '4729') {
      setVerified(true);
      setTimeout(startTrip, 900);
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
  rideId,
}: {
  onComplete: (ride: RideDto | null) => void;
  onBack: () => void;
  rideId?: string;
}) {
  const [progress, setProgress] = useState(0.2);
  const [elapsed, setElapsed] = useState(5);
  const completedRef = useRef(false);

  const completeTrip = async () => {
    if (completedRef.current) return;
    completedRef.current = true;
    let ride: RideDto | null = null;
    try {
      if (rideId) ride = await api.driverRides.complete(rideId);
    } catch {
      /* best-effort — still advance to the summary */
    }
    onComplete(ride);
  };

  useEffect(() => {
    const t = setInterval(() => {
      setProgress((p) => {
        const n = Math.min(p + 0.05, 1);
        if (n >= 1) {
          clearInterval(t);
          setTimeout(completeTrip, 600);
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
export function DriverTripCompletedScreen({
  onDone,
  ride,
}: {
  onDone: () => void;
  ride?: RideDto | null;
}) {
  // For cash rides the driver collected fare in person — settle it (10% commission).
  useEffect(() => {
    if (ride && ride.paymentMethod === 'CASH') {
      api.driverRides.confirmCash(ride.id).catch(() => {});
    }
  }, [ride]);

  const earned = ride ? `₦${ride.driverEarning.toLocaleString()}` : '—';
  const dropoff = ride?.dropoffAddress ?? '';

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
              ride ? `${Math.max(1, Math.round(ride.estimatedDurationSeconds / 60))} min` : '—',
            ],
            ['Distance', ride ? `${(ride.estimatedDistanceMeters / 1000).toFixed(1)} km` : '—'],
            ['Total Fare', ride ? `₦${ride.totalFare.toLocaleString()}` : '—'],
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
              {earned}
            </p>
          </div>
          <p className="text-right text-[11px]" style={{ fontFamily: IT, color: MUTED }}>
            After 10% platform fee · Added to wallet
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

  useEffect(() => {
    Promise.all([
      api.driverRides
        .getWallet()
        .then((w) => setWallet(w))
        .catch(() => {}),
      api.driverRides
        .getWalletTransactions({ pageSize: 20 })
        .then((r) => setTxs((r as { items?: WalletLedgerEntryDto[] }).items ?? []))
        .catch(() => {}),
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
            {wallet ? naira(wallet.availableBalance) : '—'}
          </p>
          {wallet && wallet.pendingBalance > 0 && (
            <p className="mt-1 text-[12px] opacity-80" style={{ fontFamily: IT, color: '#fff' }}>
              + {naira(wallet.pendingBalance)} pending
            </p>
          )}
        </div>

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
function DriverWalletTab({ onBack }: { onBack: () => void }) {
  const [wallet, setWallet] = useState<WalletDto | null>(null);
  const [txs, setTxs] = useState<WalletLedgerEntryDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.driverRides
        .getWallet()
        .then((w) => setWallet(w))
        .catch(() => {}),
      api.driverRides
        .getWalletTransactions({ pageSize: 20 })
        .then((r) => setTxs((r as { items?: WalletLedgerEntryDto[] }).items ?? []))
        .catch(() => {}),
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
            {wallet ? naira(wallet.availableBalance) : '—'}
          </p>
          {/* No driver withdraw endpoint exists yet → honestly disabled. */}
          <button
            disabled
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[13px] font-semibold"
            style={{
              background: 'rgba(255,255,255,.06)',
              border: `1px solid ${BORDER}`,
              color: MUTED,
              fontFamily: IT,
              cursor: 'not-allowed',
            }}
          >
            💸 Withdraw · Coming soon
          </button>
        </div>

        {/* Linked bank — no bank-account endpoint for drivers yet. */}
        <div
          className="mb-5 flex items-center gap-3 rounded-2xl p-4"
          style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
        >
          <div
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl text-xl"
            style={{ background: 'rgba(255,255,255,.05)' }}
          >
            🏦
          </div>
          <div className="flex-1">
            <p className="text-[14px] font-semibold" style={{ fontFamily: PP, color: '#fff' }}>
              No bank account linked
            </p>
            <p className="text-[12px]" style={{ fontFamily: IT, color: MUTED }}>
              Bank linking isn’t available yet.
            </p>
          </div>
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

  useEffect(() => {
    api.driverRides
      .list({ status: 'COMPLETED', limit: 50 })
      .then((r) => setTrips((r as { items?: RideDto[] }).items ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const earned = trips.reduce((s, t) => s + (t.driverEarning || 0), 0);

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

        {/* Summary — completed count + earned are real; no rating endpoint. */}
        <div
          className="mb-4 flex gap-3 rounded-2xl p-4"
          style={{ background: 'rgba(43,172,82,.06)', border: '1px solid rgba(43,172,82,.12)' }}
        >
          {[
            { v: trips.length.toString(), l: 'Completed' },
            { v: naira(earned), l: 'Earned' },
            { v: '—', l: 'Rating' },
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
                  <p className="text-[15px] font-bold" style={{ fontFamily: PP, color: G3 }}>
                    {naira(trip.driverEarning || 0)}
                  </p>
                  <span className="text-[10px] font-bold" style={{ color: G3, fontFamily: IT }}>
                    {trip.status}
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
function DriverProfileTab({ onBack, onSettings }: { onBack: () => void; onSettings: () => void }) {
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
