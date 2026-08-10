import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';
import logoImg from '@/imports/C3C48FE4-A0D8-4DA3-8A0D-A09D3D9EA7FB.jpeg';
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
  Logo,
  Ambient,
  StatusBar,
  BackBtn,
  GreenBtn,
  Divider,
  ArrowIcon,
  CheckIcon,
  COUNTRIES,
} from './shared';

// AUTH-010  TWO-FACTOR AUTHENTICATION
// ═══════════════════════════════════════════════════════════════════════════
export function TwoFactorScreen({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const [activeMethod, setActiveMethod] = useState<'sms' | 'auth' | 'email'>('sms');
  const [step, setStep] = useState<'choose' | 'verify' | 'success'>('choose');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [enabled, setEnabled] = useState({ sms: true, auth: false, email: false });
  const r0 = useRef<HTMLInputElement>(null);
  const r1 = useRef<HTMLInputElement>(null);
  const r2 = useRef<HTMLInputElement>(null);
  const r3 = useRef<HTMLInputElement>(null);
  const r4 = useRef<HTMLInputElement>(null);
  const r5 = useRef<HTMLInputElement>(null);
  const refs = [r0, r1, r2, r3, r4, r5];

  useEffect(() => {
    if (step !== 'success') return;
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, [step]);

  const handleDigit = (i: number, val: string) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...code];
    next[i] = val;
    setCode(next);
    setError('');
    if (val && i < 5) refs[i + 1].current?.focus();
    if (next.every((d) => d) && val) {
      const full = next.join('');
      setTimeout(() => {
        if (full === '111111') {
          setError('Code expired. Request a new one.');
          setCode(['', '', '', '', '', '']);
          refs[0].current?.focus();
        } else {
          setStep('success');
        }
      }, 280);
    }
  };

  const handleKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[i] && i > 0) refs[i - 1].current?.focus();
  };

  const methodMeta: Record<string, { icon: string; label: string; sub: string }> = {
    sms: { icon: '💬', label: 'SMS Authentication', sub: '+234 ●●● ●●● 5678' },
    auth: { icon: '🔐', label: 'Authenticator App', sub: 'Google Authenticator / Authy' },
    email: { icon: '📧', label: 'Email Authentication', sub: 's●●●●@gmail.com' },
  };

  if (step === 'success')
    return (
      <div
        className="flex h-full w-full flex-col items-center justify-center gap-5"
        style={{ background: NAVY_BASE }}
      >
        <StatusBar />
        <div
          className="relative flex items-center justify-center"
          style={{ width: 120, height: 120 }}
        >
          <svg width="120" height="120" viewBox="0 0 120 120" style={{ position: 'absolute' }}>
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke={G2}
              strokeWidth="3"
              strokeDasharray="339"
              strokeDashoffset="339"
              style={{ animation: 'circle-draw 0.9s ease forwards' }}
            />
          </svg>
          <span style={{ fontSize: 48 }}>🛡️</span>
        </div>
        <p
          className="text-center text-[22px] font-bold"
          style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
        >
          2FA Enabled!
        </p>
        <p className="px-10 text-center text-[13px]" style={{ color: MUTED }}>
          Your account is now protected with two-factor authentication.
        </p>
        <p className="text-[11px] font-semibold tracking-widest" style={{ color: G3 }}>
          life,Simplified
        </p>
      </div>
    );

  return (
    <div
      className="flex h-full w-full flex-col overflow-y-auto"
      style={{ background: NAVY_BASE, scrollbarWidth: 'none' }}
    >
      <StatusBar />
      <div className="flex items-center gap-3 px-6 pb-2 pt-4">
        <BackBtn onClick={onBack} />
        <div>
          <p
            className="text-[18px] font-bold"
            style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
          >
            Two-Factor Auth
          </p>
          <p className="text-[11px]" style={{ color: MUTED }}>
            Add an extra layer of security
          </p>
        </div>
      </div>

      {/* Security Badge */}
      <div
        className="mx-6 my-3 flex items-center gap-3 rounded-2xl p-4"
        style={{ background: 'rgba(43,172,82,.1)', border: '1px solid rgba(43,172,82,.25)' }}
      >
        <span style={{ fontSize: 24 }}>🔒</span>
        <div>
          <p className="text-[13px] font-semibold" style={{ color: G3 }}>
            2FA Active on This Account
          </p>
          <p className="text-[11px]" style={{ color: MUTED }}>
            Last verified 2 hours ago
          </p>
        </div>
        <div
          className="ml-auto rounded-full px-2 py-1 text-[10px] font-bold"
          style={{ background: G2, color: '#FFF' }}
        >
          ON
        </div>
      </div>

      {/* Methods */}
      <p
        className="px-6 pb-2 pt-2 text-[11px] font-semibold uppercase tracking-widest"
        style={{ color: MUTED }}
      >
        Authentication Methods
      </p>
      {(['sms', 'auth', 'email'] as const).map((m) => {
        const meta = methodMeta[m];
        const isOn = enabled[m];
        return (
          <div
            key={m}
            className="mx-6 mb-3 flex items-center gap-3 rounded-2xl p-4"
            style={{
              background: NAVY_CARD,
              border: `1.5px solid ${activeMethod === m ? G2 + '55' : BORDER}`,
            }}
          >
            <div
              className="flex h-11 w-11 items-center justify-center rounded-xl text-2xl"
              style={{ background: isOn ? 'rgba(43,172,82,.15)' : 'rgba(255,255,255,.04)' }}
            >
              {meta.icon}
            </div>
            <div className="flex-1">
              <p
                className="text-[14px] font-semibold"
                style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
              >
                {meta.label}
              </p>
              <p className="text-[11px]" style={{ color: MUTED }}>
                {meta.sub}
              </p>
            </div>
            {/* toggle */}
            <button
              onClick={() => setEnabled((e) => ({ ...e, [m]: !e[m] }))}
              className="relative h-6 w-12 flex-shrink-0 rounded-full transition-all duration-300"
              style={{ background: isOn ? G2 : 'rgba(255,255,255,.1)' }}
            >
              <div
                className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all duration-300"
                style={{ left: isOn ? 'calc(100% - 22px)' : 2 }}
              />
            </button>
          </div>
        );
      })}

      {/* Verify with code */}
      <div
        className="mx-6 my-2 rounded-2xl p-5"
        style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
      >
        <p
          className="mb-1 text-[14px] font-semibold"
          style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
        >
          Verify Identity
        </p>
        <p className="mb-4 text-[12px]" style={{ color: MUTED }}>
          Enter the 6-digit code sent to your phone to confirm changes.
        </p>
        <div className="mb-3 flex justify-center gap-2">
          {code.map((d, i) => (
            <input
              key={i}
              ref={refs[i]}
              maxLength={1}
              value={d}
              onChange={(e) => handleDigit(i, e.target.value)}
              onKeyDown={(e) => handleKey(i, e)}
              className="h-[48px] w-[42px] rounded-xl text-center text-[18px] font-bold outline-none transition-all"
              inputMode="numeric"
              autoComplete="one-time-code"
              style={{
                fontFamily: "'Poppins',sans-serif",
                color: '#FFF',
                background: d ? 'rgba(43,172,82,.15)' : 'rgba(255,255,255,.05)',
                border: `1.5px solid ${error ? '#F87171' : d ? G2 : BORDER}`,
              }}
            />
          ))}
        </div>
        {error && (
          <p className="text-center text-[11px]" style={{ color: '#F87171' }}>
            {error}
          </p>
        )}
        <GreenBtn label="Confirm Changes" onClick={() => setStep('success')} />
      </div>

      {/* Backup codes */}
      <div
        className="mx-6 my-2 mb-8 flex items-center gap-3 rounded-2xl p-4"
        style={{ background: 'rgba(251,191,36,.06)', border: '1px solid rgba(251,191,36,.2)' }}
      >
        <span style={{ fontSize: 20 }}>🔑</span>
        <div className="flex-1">
          <p className="text-[13px] font-semibold" style={{ color: '#FCD34D' }}>
            Backup Recovery Codes
          </p>
          <p className="text-[11px]" style={{ color: MUTED }}>
            Download codes in case you lose access
          </p>
        </div>
        <button
          className="rounded-xl px-3 py-1.5 text-[11px] font-semibold"
          style={{ background: 'rgba(251,191,36,.12)', color: '#FCD34D' }}
        >
          Download
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTH-011  TRUSTED DEVICES
// ═══════════════════════════════════════════════════════════════════════════
export function TrustedDevicesScreen({ onBack }: { onBack: () => void }) {
  const [devices, setDevices] = useState(DEVICES);
  const [removing, setRemoving] = useState<string | null>(null);
  const [sheet, setSheet] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const removeDevice = (id: string) => {
    setRemoving(id);
    setTimeout(() => {
      setDevices((d) => d.filter((x) => x.id !== id));
      setRemoving(null);
      setSheet(null);
    }, 600);
  };

  const platformIcon: Record<string, string> = { '📱': G3, '💻': '#60A5FA', '🖥️': '#A78BFA' };

  return (
    <div
      className="flex h-full w-full flex-col overflow-y-auto"
      style={{ background: NAVY_BASE, scrollbarWidth: 'none' }}
    >
      <StatusBar />
      <div className="flex items-center gap-3 px-6 pb-2 pt-4">
        <BackBtn onClick={onBack} />
        <div>
          <p
            className="text-[18px] font-bold"
            style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
          >
            Trusted Devices
          </p>
          <p className="text-[11px]" style={{ color: MUTED }}>
            {devices.length} device{devices.length !== 1 ? 's' : ''} authorized
          </p>
        </div>
      </div>

      {/* Info banner */}
      <div
        className="mx-6 my-3 flex items-start gap-3 rounded-2xl p-4"
        style={{ background: 'rgba(43,172,82,.08)', border: '1px solid rgba(43,172,82,.2)' }}
      >
        <span style={{ fontSize: 18, marginTop: 1 }}>ℹ️</span>
        <p className="text-[12px] leading-relaxed" style={{ color: 'rgba(255,255,255,.65)' }}>
          These devices have been verified and can access your DrippleX account. Remove any device
          you don't recognize immediately.
        </p>
      </div>

      {/* Device list */}
      <p
        className="px-6 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-widest"
        style={{ color: MUTED }}
      >
        Your Devices
      </p>
      {devices.map((dev) => (
        <div
          key={dev.id}
          className="mx-6 mb-3 rounded-2xl p-4 transition-all duration-500"
          style={{
            background: NAVY_CARD,
            border: `1.5px solid ${dev.isCurrent ? G2 + '44' : BORDER}`,
            opacity: removing === dev.id ? 0 : 1,
            transform: removing === dev.id ? 'scale(.92)' : 'scale(1)',
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl"
              style={{
                background: dev.isCurrent ? 'rgba(43,172,82,.15)' : 'rgba(255,255,255,.04)',
              }}
            >
              {dev.icon}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p
                  className="text-[14px] font-semibold"
                  style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
                >
                  {dev.name}
                </p>
                {dev.isCurrent && (
                  <span
                    className="rounded-full px-2 py-0.5 text-[9px] font-bold"
                    style={{ background: G2, color: '#FFF' }}
                  >
                    THIS DEVICE
                  </span>
                )}
              </div>
              <p className="text-[11px]" style={{ color: MUTED }}>
                📍 {dev.location}
              </p>
              <p className="text-[11px]" style={{ color: MUTED }}>
                Last active: {dev.lastActive}
              </p>
            </div>
            {!dev.isCurrent && (
              <button
                onClick={() => setSheet(dev.id)}
                className="flex h-9 w-9 items-center justify-center rounded-xl transition-all active:scale-90"
                style={{
                  background: 'rgba(248,113,113,.1)',
                  border: '1px solid rgba(248,113,113,.2)',
                }}
              >
                <span style={{ fontSize: 14 }}>🗑</span>
              </button>
            )}
          </div>
          {dev.isCurrent && (
            <div
              className="mt-3 flex items-center gap-2 pt-3"
              style={{ borderTop: `1px solid ${BORDER}` }}
            >
              <div
                className="h-2 w-2 rounded-full"
                style={{ background: G3, boxShadow: `0 0 6px ${G3}` }}
              />
              <p className="text-[11px]" style={{ color: G3 }}>
                Secure session active · DrippleX Verified
              </p>
            </div>
          )}
        </div>
      ))}

      {/* Remove all */}
      <div className="mx-6 mb-10 mt-2">
        <button
          className="flex h-[46px] w-full items-center justify-center gap-2 rounded-2xl text-[13px] font-semibold transition-all active:scale-[0.97]"
          style={{
            background: 'rgba(248,113,113,.07)',
            border: '1.5px solid rgba(248,113,113,.2)',
            color: '#F87171',
          }}
        >
          <span>🚫</span> Remove All Other Devices
        </button>
      </div>

      {/* Bottom sheet confirmation */}
      {sheet && (
        <div
          className="absolute inset-0 z-50 flex flex-col justify-end"
          style={{ background: 'rgba(0,0,0,.7)' }}
          onClick={() => setSheet(null)}
        >
          <div
            className="rounded-t-3xl p-6"
            style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="mx-auto mb-5 h-1 w-10 rounded-full"
              style={{ background: 'rgba(255,255,255,.2)' }}
            />
            <p
              className="mb-1 text-[16px] font-bold"
              style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
            >
              Remove Device?
            </p>
            <p className="mb-5 text-[13px]" style={{ color: MUTED }}>
              {devices.find((d) => d.id === sheet)?.name} will be signed out immediately.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setSheet(null)}
                className="h-[46px] flex-1 rounded-2xl text-[14px] font-medium"
                style={{
                  background: 'rgba(255,255,255,.06)',
                  border: `1px solid ${BORDER}`,
                  color: MUTED,
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => removeDevice(sheet!)}
                className="h-[46px] flex-1 rounded-2xl text-[14px] font-semibold"
                style={{
                  background: 'rgba(248,113,113,.18)',
                  border: '1px solid rgba(248,113,113,.3)',
                  color: '#F87171',
                }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTH-012  LOGIN HISTORY & SECURITY ACTIVITY
// ═══════════════════════════════════════════════════════════════════════════
export const ACTIVITY_LOG = [
  {
    id: 1,
    type: 'login',
    icon: '✅',
    title: 'Successful Login',
    sub: 'iPhone 16 Pro · Kano, Nigeria',
    time: 'Today, 9:14 AM',
    badge: 'success',
    day: 'today',
  },
  {
    id: 2,
    type: 'security',
    icon: '🔐',
    title: '2FA Verification',
    sub: 'SMS code verified',
    time: 'Today, 9:14 AM',
    badge: 'success',
    day: 'today',
  },
  {
    id: 3,
    type: 'login',
    icon: '⚠️',
    title: 'Failed Login Attempt',
    sub: 'Unknown Device · Berlin, Germany',
    time: 'Today, 3:02 AM',
    badge: 'warning',
    day: 'today',
  },
  {
    id: 4,
    type: 'device',
    icon: '📱',
    title: 'New Device Added',
    sub: 'iPad Pro · Abuja, Nigeria',
    time: 'Yesterday, 6:45 PM',
    badge: 'info',
    day: 'week',
  },
  {
    id: 5,
    type: 'login',
    icon: '✅',
    title: 'Successful Login',
    sub: 'Windows Laptop · Lagos, Nigeria',
    time: 'Yesterday, 11:22 AM',
    badge: 'success',
    day: 'week',
  },
  {
    id: 6,
    type: 'security',
    icon: '🔑',
    title: 'Password Changed',
    sub: 'Via account recovery flow',
    time: '3 days ago',
    badge: 'warning',
    day: 'week',
  },
  {
    id: 7,
    type: 'login',
    icon: '✅',
    title: 'Successful Login',
    sub: 'iPhone 16 Pro · Kano, Nigeria',
    time: '5 days ago',
    badge: 'success',
    day: 'week',
  },
  {
    id: 8,
    type: 'device',
    icon: '🗑',
    title: 'Device Removed',
    sub: 'Old Android Phone',
    time: '12 days ago',
    badge: 'info',
    day: 'month',
  },
  {
    id: 9,
    type: 'security',
    icon: '🛡',
    title: 'Security Scan Passed',
    sub: 'No threats detected',
    time: '18 days ago',
    badge: 'success',
    day: 'month',
  },
  {
    id: 10,
    type: 'login',
    icon: '⚠️',
    title: 'Unusual Location Detected',
    sub: 'Attempted from Dubai, UAE',
    time: '22 days ago',
    badge: 'alert',
    day: 'month',
  },
];

export function SecurityActivityScreen({
  onBack,
  onSecure,
}: {
  onBack: () => void;
  onSecure: () => void;
}) {
  const [filter, setFilter] = useState<'today' | 'week' | 'month' | 'all'>('all');
  const filters: { key: typeof filter; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'Last 7 Days' },
    { key: 'month', label: 'Last 30 Days' },
    { key: 'all', label: 'All Activity' },
  ];
  const filtered =
    filter === 'all'
      ? ACTIVITY_LOG
      : ACTIVITY_LOG.filter((a) => {
          if (filter === 'today') return a.day === 'today';
          if (filter === 'week') return a.day === 'today' || a.day === 'week';
          return true;
        });

  const badgeStyle: Record<string, { bg: string; color: string }> = {
    success: { bg: 'rgba(43,172,82,.15)', color: G3 },
    warning: { bg: 'rgba(251,191,36,.12)', color: '#FCD34D' },
    info: { bg: 'rgba(96,165,250,.12)', color: '#60A5FA' },
    alert: { bg: 'rgba(248,113,113,.12)', color: '#F87171' },
  };

  const hasAlert = filtered.some((a) => a.badge === 'alert' || a.badge === 'warning');

  return (
    <div
      className="flex h-full w-full flex-col overflow-y-auto"
      style={{ background: NAVY_BASE, scrollbarWidth: 'none' }}
    >
      <StatusBar />
      <div className="flex items-center gap-3 px-6 pb-2 pt-4">
        <BackBtn onClick={onBack} />
        <div>
          <p
            className="text-[18px] font-bold"
            style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
          >
            Security Activity
          </p>
          <p className="text-[11px]" style={{ color: MUTED }}>
            Login history & account events
          </p>
        </div>
      </div>

      {/* Suspicious alert card */}
      {hasAlert && (
        <div
          className="mx-6 my-3 rounded-2xl p-4"
          style={{
            background: 'rgba(248,113,113,.08)',
            border: '1.5px solid rgba(248,113,113,.25)',
          }}
        >
          <div className="mb-3 flex items-start gap-3">
            <span style={{ fontSize: 20 }}>🚨</span>
            <div>
              <p
                className="text-[14px] font-semibold"
                style={{ color: '#F87171', fontFamily: "'Poppins',sans-serif" }}
              >
                Suspicious Activity Detected
              </p>
              <p className="mt-0.5 text-[12px]" style={{ color: 'rgba(255,255,255,.6)' }}>
                Didn't recognize this activity?
              </p>
            </div>
          </div>
          <button
            onClick={onSecure}
            className="flex h-[42px] w-full items-center justify-center gap-2 rounded-xl text-[13px] font-bold transition-all active:scale-[0.97]"
            style={{
              background: 'rgba(248,113,113,.2)',
              border: '1px solid rgba(248,113,113,.35)',
              color: '#F87171',
            }}
          >
            🛡 Secure My Account
          </button>
        </div>
      )}

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto px-6 py-2" style={{ scrollbarWidth: 'none' }}>
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className="h-[32px] flex-shrink-0 rounded-full px-4 text-[12px] font-semibold transition-all"
            style={{
              background: filter === f.key ? G2 : 'rgba(255,255,255,.06)',
              border: `1px solid ${filter === f.key ? G2 : BORDER}`,
              color: filter === f.key ? '#FFF' : MUTED,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Activity feed */}
      <div className="flex flex-col gap-2 px-6 pb-10 pt-1">
        {filtered.map((a, idx) => (
          <div
            key={a.id}
            className="flex items-start gap-3 rounded-2xl p-4"
            style={{
              background: NAVY_CARD,
              border: `1.5px solid ${a.badge === 'alert' ? 'rgba(248,113,113,.25)' : BORDER}`,
              animation: `fade-up .3s ease ${idx * 0.04}s both`,
            }}
          >
            <div
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-xl"
              style={{ background: badgeStyle[a.badge].bg }}
            >
              {a.icon}
            </div>
            <div className="flex-1">
              <div className="flex items-start justify-between gap-2">
                <p
                  className="text-[13px] font-semibold"
                  style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
                >
                  {a.title}
                </p>
                <span
                  className="flex-shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold"
                  style={{ background: badgeStyle[a.badge].bg, color: badgeStyle[a.badge].color }}
                >
                  {a.badge.toUpperCase()}
                </span>
              </div>
              <p className="mt-0.5 text-[11px]" style={{ color: MUTED }}>
                {a.sub}
              </p>
              <p className="mt-1 text-[10px]" style={{ color: 'rgba(255,255,255,.3)' }}>
                🕐 {a.time}
              </p>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-12">
            <span style={{ fontSize: 36 }}>📭</span>
            <p className="text-[13px]" style={{ color: MUTED }}>
              No activity for this period
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTH-013  SECURITY CENTER
// ═══════════════════════════════════════════════════════════════════════════
export function SecurityCenterScreen({
  onBack,
  onNav,
}: {
  onBack: () => void;
  onNav: (
    s: 'twofa' | 'devices' | 'activity' | 'sessions' | 'emergency' | 'trust' | 'loginapproval',
  ) => void;
}) {
  const [lockSheet, setLockSheet] = useState(false);
  const [locked, setLocked] = useState(false);
  const score = 92;

  const segments = [
    { label: '2FA Auth', icon: '🔐', status: 'Enabled', ok: true },
    { label: 'Biometric', icon: '👆', status: 'Active', ok: true },
    { label: 'Trusted Device', icon: '📱', status: '3 Devices', ok: true },
    { label: 'PIN Lock', icon: '🔢', status: 'Set', ok: true },
    { label: 'Recovery Email', icon: '📧', status: 'Verified', ok: true },
    { label: 'Passcode', icon: '🗝', status: 'Enabled', ok: true },
  ];

  const quickLinks = [
    { icon: '🔐', label: 'Two-Factor Auth', sub: 'Manage 2FA methods', nav: 'twofa' as const },
    { icon: '📱', label: 'Trusted Devices', sub: '3 devices authorized', nav: 'devices' as const },
    { icon: '📋', label: 'Security Activity', sub: 'View login history', nav: 'activity' as const },
    {
      icon: '🖥️',
      label: 'Active Sessions',
      sub: 'Manage signed-in devices',
      nav: 'sessions' as const,
    },
    {
      icon: '🚨',
      label: 'Emergency Protection',
      sub: 'Lock account, reset auth',
      nav: 'emergency' as const,
    },
    {
      icon: '🏆',
      label: 'Trust Center',
      sub: '96% trusted · Full overview',
      nav: 'trust' as const,
    },
    {
      icon: '🔔',
      label: 'Login Approvals',
      sub: 'Review new device requests',
      nav: 'loginapproval' as const,
    },
  ];

  if (locked)
    return (
      <div
        className="flex h-full w-full flex-col items-center justify-center gap-6"
        style={{ background: NAVY_DEEP }}
      >
        <StatusBar />
        <div className="relative">
          <div
            className="flex h-28 w-28 items-center justify-center rounded-full text-5xl"
            style={{ background: 'rgba(248,113,113,.1)', border: '2px solid rgba(248,113,113,.3)' }}
          >
            🔒
          </div>
          <div
            className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full text-sm"
            style={{ background: '#EF4444' }}
          >
            !
          </div>
        </div>
        <div className="px-10 text-center">
          <p
            className="mb-2 text-[20px] font-bold"
            style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
          >
            Account Locked
          </p>
          <p className="text-[13px] leading-relaxed" style={{ color: MUTED }}>
            Your DrippleX account has been locked for security. Contact support to regain access.
          </p>
        </div>
        <button
          onClick={onBack}
          className="h-[46px] rounded-2xl px-8 text-[14px] font-semibold"
          style={{
            background: 'rgba(255,255,255,.06)',
            border: `1px solid ${BORDER}`,
            color: MUTED,
          }}
        >
          Back to Safety
        </button>
        <p className="text-[11px] font-semibold tracking-widest" style={{ color: G3 }}>
          life,Simplified
        </p>
      </div>
    );

  return (
    <div
      className="flex h-full w-full flex-col overflow-y-auto"
      style={{ background: NAVY_BASE, scrollbarWidth: 'none' }}
    >
      <StatusBar />
      <div className="flex items-center gap-3 px-6 pb-2 pt-4">
        <BackBtn onClick={onBack} />
        <div>
          <p
            className="text-[18px] font-bold"
            style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
          >
            Security Center
          </p>
          <p className="text-[11px]" style={{ color: MUTED }}>
            Your account protection overview
          </p>
        </div>
      </div>

      {/* Security Score Ring */}
      <div
        className="mx-6 mb-4 mt-2 flex items-center gap-5 rounded-3xl p-5"
        style={{
          background: `linear-gradient(135deg,${NAVY_CARD} 0%,rgba(43,172,82,.08) 100%)`,
          border: `1.5px solid rgba(43,172,82,.2)`,
        }}
      >
        <div className="relative flex-shrink-0" style={{ width: 80, height: 80 }}>
          <svg width="80" height="80" viewBox="0 0 80 80">
            <circle
              cx="40"
              cy="40"
              r="34"
              fill="none"
              stroke="rgba(255,255,255,.06)"
              strokeWidth="7"
            />
            <circle
              cx="40"
              cy="40"
              r="34"
              fill="none"
              stroke={G2}
              strokeWidth="7"
              strokeDasharray={`${(2 * Math.PI * 34 * score) / 100} ${2 * Math.PI * 34}`}
              strokeLinecap="round"
              transform="rotate(-90 40 40)"
              style={{ filter: `drop-shadow(0 0 6px ${G2})`, animation: 'bar-fill 1.2s ease both' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className="text-[18px] font-bold"
              style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF', lineHeight: 1 }}
            >
              {score}%
            </span>
            <span className="text-[9px]" style={{ color: G3 }}>
              Secure
            </span>
          </div>
        </div>
        <div>
          <p
            className="mb-1 text-[16px] font-bold"
            style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
          >
            Excellent Security
          </p>
          <p className="text-[11px] leading-relaxed" style={{ color: MUTED }}>
            Your account is protected.
          </p>
          <p className="mt-1 text-[12px] font-semibold" style={{ color: G3 }}>
            life,Simplified
          </p>
        </div>
      </div>

      {/* Security segments */}
      <p
        className="px-6 pb-2 text-[11px] font-semibold uppercase tracking-widest"
        style={{ color: MUTED }}
      >
        Protection Status
      </p>
      <div className="mb-4 grid grid-cols-3 gap-2 px-6">
        {segments.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl p-3 text-center"
            style={{
              background: NAVY_CARD,
              border: `1px solid ${s.ok ? 'rgba(43,172,82,.2)' : BORDER}`,
            }}
          >
            <div className="mb-1 text-xl">{s.icon}</div>
            <p
              className="text-[10px] font-semibold"
              style={{ color: '#FFF', fontFamily: "'Poppins',sans-serif" }}
            >
              {s.label}
            </p>
            <p className="mt-0.5 text-[9px]" style={{ color: s.ok ? G3 : '#F87171' }}>
              {s.status}
            </p>
          </div>
        ))}
      </div>

      {/* Quick links */}
      <p
        className="px-6 pb-2 text-[11px] font-semibold uppercase tracking-widest"
        style={{ color: MUTED }}
      >
        Manage Security
      </p>
      {quickLinks.map((ql) => (
        <button
          key={ql.label}
          onClick={() => onNav(ql.nav)}
          className="mx-6 mb-3 flex w-[calc(100%-48px)] items-center gap-3 rounded-2xl p-4 text-left transition-all active:scale-[0.98]"
          style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
        >
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl text-xl"
            style={{ background: 'rgba(43,172,82,.1)' }}
          >
            {ql.icon}
          </div>
          <div className="flex-1">
            <p
              className="text-[13px] font-semibold"
              style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
            >
              {ql.label}
            </p>
            <p className="text-[11px]" style={{ color: MUTED }}>
              {ql.sub}
            </p>
          </div>
          <ArrowIcon />
        </button>
      ))}

      {/* Emergency lock */}
      <div className="mx-6 mb-10 mt-2">
        <button
          onClick={() => setLockSheet(true)}
          className="flex h-[50px] w-full items-center justify-center gap-2 rounded-2xl text-[14px] font-bold transition-all active:scale-[0.97]"
          style={{
            background: 'rgba(248,113,113,.08)',
            border: '1.5px solid rgba(248,113,113,.25)',
            color: '#F87171',
          }}
        >
          🚨 Lock My Account
        </button>
        <p className="mt-2 text-center text-[10px]" style={{ color: 'rgba(255,255,255,.25)' }}>
          Emergency use only. Immediately ends all sessions.
        </p>
      </div>

      {/* Lock confirmation sheet */}
      {lockSheet && (
        <div
          className="absolute inset-0 z-50 flex flex-col justify-end"
          style={{ background: 'rgba(0,0,0,.75)' }}
          onClick={() => setLockSheet(false)}
        >
          <div
            className="rounded-t-3xl p-6"
            style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="mx-auto mb-5 h-1 w-10 rounded-full"
              style={{ background: 'rgba(255,255,255,.2)' }}
            />
            <div className="mb-5 text-center">
              <span style={{ fontSize: 40 }}>🚨</span>
              <p
                className="mb-1 mt-2 text-[18px] font-bold"
                style={{ fontFamily: "'Poppins',sans-serif", color: '#F87171' }}
              >
                Emergency Lock
              </p>
              <p className="text-[13px] leading-relaxed" style={{ color: MUTED }}>
                This will immediately log out all devices and lock your account. Are you sure?
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setLockSheet(false)}
                className="h-[46px] flex-1 rounded-2xl text-[14px] font-medium"
                style={{
                  background: 'rgba(255,255,255,.06)',
                  border: `1px solid ${BORDER}`,
                  color: MUTED,
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setLockSheet(false);
                  setLocked(true);
                }}
                className="h-[46px] flex-1 rounded-2xl text-[14px] font-bold"
                style={{
                  background: 'rgba(248,113,113,.2)',
                  border: '1px solid rgba(248,113,113,.35)',
                  color: '#F87171',
                }}
              >
                Lock Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTH-014  SESSION MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════
export const SESSION_LIST = [
  {
    id: 's1',
    icon: '📱',
    device: 'iPhone 16 Pro',
    browser: 'DrippleX App',
    location: 'Kano, Nigeria',
    lastActive: 'Active Now',
    isCurrent: true,
  },
  {
    id: 's2',
    icon: '💻',
    device: 'MacBook Pro',
    browser: 'Chrome Browser',
    location: 'Abuja, Nigeria',
    lastActive: '2 hours ago',
    isCurrent: false,
  },
  {
    id: 's3',
    icon: '📱',
    device: 'Samsung Galaxy',
    browser: 'DrippleX App',
    location: 'Kano, Nigeria',
    lastActive: 'Yesterday',
    isCurrent: false,
  },
];

export function SessionManagementScreen({ onBack }: { onBack: () => void }) {
  const [sessions, setSessions] = useState(SESSION_LIST);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [signOutSheet, setSignOutSheet] = useState(false);
  const [allDone, setAllDone] = useState(false);

  const signOut = (id: string) => {
    setRemoving(id);
    setTimeout(() => {
      setSessions((s) => s.filter((x) => x.id !== id));
      setRemoving(null);
      setExpanded(null);
    }, 500);
  };

  const signOutEverywhere = () => {
    setSignOutSheet(false);
    setSessions((s) => s.filter((x) => x.isCurrent));
    setAllDone(true);
  };

  return (
    <div
      className="flex h-full w-full flex-col overflow-y-auto"
      style={{ background: NAVY_BASE, scrollbarWidth: 'none' }}
    >
      <StatusBar />
      <div className="flex items-center gap-3 px-6 pb-2 pt-4">
        <BackBtn onClick={onBack} />
        <div>
          <p
            className="text-[18px] font-bold"
            style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
          >
            Active Sessions
          </p>
          <p className="text-[11px]" style={{ color: MUTED }}>
            Review and manage where you're signed in
          </p>
        </div>
      </div>

      {allDone && (
        <div
          className="mx-6 my-2 flex items-center gap-3 rounded-2xl p-4"
          style={{
            background: 'rgba(43,172,82,.1)',
            border: '1px solid rgba(43,172,82,.25)',
            animation: 'fade-up .3s ease both',
          }}
        >
          <span style={{ fontSize: 18 }}>✅</span>
          <p className="text-[13px] font-semibold" style={{ color: G3 }}>
            All other sessions signed out.
          </p>
        </div>
      )}

      <p
        className="px-6 pb-2 pt-2 text-[11px] font-semibold uppercase tracking-widest"
        style={{ color: MUTED }}
      >
        {sessions.length} Active Session{sessions.length !== 1 ? 's' : ''}
      </p>

      {sessions.map((sess) => {
        const isOpen = expanded === sess.id;
        return (
          <div
            key={sess.id}
            className="mx-6 mb-3 overflow-hidden rounded-2xl transition-all duration-500"
            style={{
              background: NAVY_CARD,
              border: `1.5px solid ${sess.isCurrent ? G2 + '55' : isOpen ? 'rgba(255,255,255,.14)' : BORDER}`,
              opacity: removing === sess.id ? 0 : 1,
              transform: removing === sess.id ? 'scale(.92)' : 'scale(1)',
            }}
          >
            <button
              className="flex w-full items-center gap-3 p-4 text-left"
              onClick={() => setExpanded(isOpen ? null : sess.id)}
            >
              <div
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-2xl"
                style={{
                  background: sess.isCurrent ? 'rgba(43,172,82,.15)' : 'rgba(255,255,255,.05)',
                }}
              >
                {sess.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p
                    className="truncate text-[14px] font-semibold"
                    style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
                  >
                    {sess.device}
                  </p>
                  {sess.isCurrent && (
                    <span
                      className="flex-shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold"
                      style={{ background: G2, color: '#FFF' }}
                    >
                      CURRENT
                    </span>
                  )}
                </div>
                <p className="text-[11px]" style={{ color: MUTED }}>
                  {sess.browser} · {sess.location}
                </p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  {sess.isCurrent && (
                    <div
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: G3, boxShadow: `0 0 5px ${G3}` }}
                    />
                  )}
                  <p
                    className="text-[11px]"
                    style={{ color: sess.isCurrent ? G3 : 'rgba(255,255,255,.38)' }}
                  >
                    {sess.lastActive}
                  </p>
                </div>
              </div>
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
                  transform: isOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform .25s',
                  flexShrink: 0,
                }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {isOpen && (
              <div className="px-4 pb-4" style={{ borderTop: `1px solid ${BORDER}` }}>
                <p
                  className="mb-2 pt-3 text-[10px] font-semibold uppercase tracking-widest"
                  style={{ color: MUTED }}
                >
                  Session Details
                </p>
                <div
                  className="mb-3 flex flex-col gap-1.5 rounded-xl px-4 py-3"
                  style={{ background: 'rgba(255,255,255,.03)' }}
                >
                  <p className="text-[12px]" style={{ color: MUTED }}>
                    📍 {sess.location}
                  </p>
                  <p className="text-[12px]" style={{ color: MUTED }}>
                    🌐 {sess.browser}
                  </p>
                  <p className="text-[12px]" style={{ color: MUTED }}>
                    🕐 {sess.lastActive}
                  </p>
                </div>
                {!sess.isCurrent && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => signOut(sess.id)}
                      className="h-[38px] flex-1 rounded-xl text-[12px] font-semibold transition-all active:scale-95"
                      style={{
                        background: 'rgba(248,113,113,.12)',
                        border: '1px solid rgba(248,113,113,.25)',
                        color: '#F87171',
                      }}
                    >
                      Sign Out
                    </button>
                    <button
                      className="h-[38px] flex-1 rounded-xl text-[12px] font-semibold transition-all active:scale-95"
                      style={{
                        background: 'rgba(251,191,36,.08)',
                        border: '1px solid rgba(251,191,36,.18)',
                        color: '#FCD34D',
                      }}
                    >
                      Report Device
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Sign Out Everywhere warning card */}
      <div
        className="mx-6 mb-3 mt-1 rounded-2xl p-4"
        style={{ background: 'rgba(248,113,113,.06)', border: '1.5px solid rgba(248,113,113,.2)' }}
      >
        <div className="mb-3 flex items-start gap-3">
          <span style={{ fontSize: 22 }}>⚠️</span>
          <div>
            <p
              className="text-[14px] font-semibold"
              style={{ fontFamily: "'Poppins',sans-serif", color: '#F87171' }}
            >
              Sign Out Everywhere
            </p>
            <p className="mt-0.5 text-[12px] leading-relaxed" style={{ color: MUTED }}>
              Immediately end all active sessions except your current device.
            </p>
          </div>
        </div>
        <button
          onClick={() => setSignOutSheet(true)}
          className="flex h-[42px] w-full items-center justify-center gap-2 rounded-xl text-[13px] font-bold transition-all active:scale-[.97]"
          style={{
            background: 'rgba(248,113,113,.15)',
            border: '1px solid rgba(248,113,113,.3)',
            color: '#F87171',
          }}
        >
          🚫 Sign Out All Other Devices
        </button>
      </div>

      <div className="mt-1 px-6 pb-10">
        <GreenBtn label="Done" onClick={onBack} />
      </div>

      {signOutSheet && (
        <div
          className="absolute inset-0 z-50 flex flex-col justify-end"
          style={{ background: 'rgba(0,0,0,.72)' }}
          onClick={() => setSignOutSheet(false)}
        >
          <div
            className="rounded-t-3xl p-6"
            style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="mx-auto mb-5 h-1 w-10 rounded-full"
              style={{ background: 'rgba(255,255,255,.2)' }}
            />
            <p
              className="mb-2 text-[17px] font-bold"
              style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
            >
              Sign Out Everywhere?
            </p>
            <p className="mb-5 text-[13px] leading-relaxed" style={{ color: MUTED }}>
              This will immediately sign out all devices except your iPhone 16 Pro. You'll need to
              log back in on those devices.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setSignOutSheet(false)}
                className="h-[46px] flex-1 rounded-2xl text-[14px] font-medium"
                style={{
                  background: 'rgba(255,255,255,.06)',
                  border: `1px solid ${BORDER}`,
                  color: MUTED,
                }}
              >
                Cancel
              </button>
              <button
                onClick={signOutEverywhere}
                className="h-[46px] flex-1 rounded-2xl text-[14px] font-bold"
                style={{
                  background: 'rgba(248,113,113,.2)',
                  border: '1px solid rgba(248,113,113,.35)',
                  color: '#F87171',
                }}
              >
                Sign Out All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTH-015  PRIVACY & DATA CONTROLS
// ═══════════════════════════════════════════════════════════════════════════
export function PrivacyControlsScreen({ onBack }: { onBack: () => void }) {
  const [visibility, setVisibility] = useState<'Public' | 'Friends' | 'Private'>('Friends');
  const [location, setLocation] = useState<'Always' | 'While Using' | 'Never'>('While Using');
  const [personalization, setPersonalization] = useState(true);
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState({ Email: true, SMS: false, Push: true, None: false });
  const [saved, setSaved] = useState(false);

  const save = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const PillRow = ({
    opts,
    active,
    onPick,
  }: {
    opts: string[];
    active: string;
    onPick: (v: string) => void;
  }) => (
    <div className="mt-2 flex flex-wrap gap-2">
      {opts.map((o) => (
        <button
          key={o}
          onClick={() => onPick(o)}
          className="h-[30px] rounded-full px-4 text-[11px] font-semibold transition-all active:scale-95"
          style={{
            background: active === o ? G2 : 'rgba(255,255,255,.06)',
            border: `1px solid ${active === o ? G2 : BORDER}`,
            color: active === o ? '#FFF' : MUTED,
          }}
        >
          {o}
        </button>
      ))}
    </div>
  );

  const SwitchRow = ({
    icon,
    title,
    sub,
    on,
    onToggle,
  }: {
    icon: string;
    title: string;
    sub: string;
    on: boolean;
    onToggle: () => void;
  }) => (
    <div
      className="mx-6 mb-3 flex items-center gap-3 rounded-2xl p-4"
      style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
    >
      <div
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-xl"
        style={{ background: 'rgba(43,172,82,.1)' }}
      >
        {icon}
      </div>
      <div className="flex-1">
        <p
          className="text-[14px] font-semibold"
          style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
        >
          {title}
        </p>
        <p className="text-[11px]" style={{ color: MUTED }}>
          {sub}
        </p>
      </div>
      <button
        onClick={onToggle}
        className="relative h-6 w-12 flex-shrink-0 rounded-full transition-all duration-300"
        style={{ background: on ? G2 : 'rgba(255,255,255,.1)' }}
      >
        <div
          className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all duration-300"
          style={{ left: on ? 'calc(100% - 22px)' : 2 }}
        />
      </button>
    </div>
  );

  return (
    <div
      className="flex h-full w-full flex-col overflow-y-auto"
      style={{ background: NAVY_BASE, scrollbarWidth: 'none' }}
    >
      <StatusBar />
      <div className="flex items-center gap-3 px-6 pb-2 pt-4">
        <BackBtn onClick={onBack} />
        <div>
          <p
            className="text-[18px] font-bold"
            style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
          >
            Privacy Controls
          </p>
          <p className="text-[11px]" style={{ color: MUTED }}>
            Control how your information is used
          </p>
        </div>
      </div>

      {saved && (
        <div
          className="mx-6 mb-2 flex items-center gap-3 rounded-2xl p-3"
          style={{
            background: 'rgba(43,172,82,.1)',
            border: '1px solid rgba(43,172,82,.25)',
            animation: 'fade-up .25s ease both',
          }}
        >
          <span style={{ fontSize: 15 }}>✅</span>
          <p className="text-[13px] font-semibold" style={{ color: G3 }}>
            Preferences saved successfully.
          </p>
        </div>
      )}

      <p
        className="px-6 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-widest"
        style={{ color: MUTED }}
      >
        Visibility
      </p>

      <div
        className="mx-6 mb-3 rounded-2xl p-4"
        style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl text-xl"
            style={{ background: 'rgba(43,172,82,.1)' }}
          >
            👤
          </div>
          <div>
            <p
              className="text-[14px] font-semibold"
              style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
            >
              Profile Visibility
            </p>
            <p className="text-[11px]" style={{ color: MUTED }}>
              Who can see your profile
            </p>
          </div>
        </div>
        <PillRow
          opts={['Public', 'Friends', 'Private']}
          active={visibility}
          onPick={(v) => setVisibility(v as typeof visibility)}
        />
      </div>

      <div
        className="mx-6 mb-3 rounded-2xl p-4"
        style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl text-xl"
            style={{ background: 'rgba(43,172,82,.1)' }}
          >
            📍
          </div>
          <div>
            <p
              className="text-[14px] font-semibold"
              style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
            >
              Location Sharing
            </p>
            <p className="text-[11px]" style={{ color: MUTED }}>
              When DrippleX accesses location
            </p>
          </div>
        </div>
        <PillRow
          opts={['Always', 'While Using', 'Never']}
          active={location}
          onPick={(v) => setLocation(v as typeof location)}
        />
      </div>

      <p
        className="px-6 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-widest"
        style={{ color: MUTED }}
      >
        Data & Personalization
      </p>

      <SwitchRow
        icon="📈"
        title="Personalization"
        sub="AI recommendations based on your activity"
        on={personalization}
        onToggle={() => setPersonalization((v) => !v)}
      />
      <SwitchRow
        icon="📊"
        title="Analytics"
        sub="Share anonymous usage data to improve DrippleX"
        on={analytics}
        onToggle={() => setAnalytics((v) => !v)}
      />

      <div
        className="mx-6 mb-3 rounded-2xl p-4"
        style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
      >
        <div className="mb-3 flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl text-xl"
            style={{ background: 'rgba(43,172,82,.1)' }}
          >
            📢
          </div>
          <div>
            <p
              className="text-[14px] font-semibold"
              style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
            >
              Marketing Preferences
            </p>
            <p className="text-[11px]" style={{ color: MUTED }}>
              Choose how we reach you
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {(['Email', 'SMS', 'Push', 'None'] as const).map((opt) => {
            const on = marketing[opt];
            return (
              <button
                key={opt}
                onClick={() => setMarketing((m) => ({ ...m, [opt]: !m[opt] }))}
                className="h-[30px] rounded-full px-4 text-[11px] font-semibold transition-all active:scale-95"
                style={{
                  background: on ? G2 : 'rgba(255,255,255,.06)',
                  border: `1px solid ${on ? G2 : BORDER}`,
                  color: on ? '#FFF' : MUTED,
                }}
              >
                {opt === 'Push' ? 'Push Notifications' : opt}
              </button>
            );
          })}
        </div>
      </div>

      <div
        className="mx-6 mb-3 flex items-center gap-3 rounded-2xl p-4"
        style={{ background: 'rgba(251,191,36,.05)', border: '1px solid rgba(251,191,36,.15)' }}
      >
        <span style={{ fontSize: 20 }}>📥</span>
        <div className="flex-1">
          <p className="text-[13px] font-semibold" style={{ color: '#FCD34D' }}>
            Download My Data
          </p>
          <p className="text-[11px]" style={{ color: MUTED }}>
            Request an export of your DrippleX data
          </p>
        </div>
        <button
          className="rounded-xl px-3 py-1.5 text-[11px] font-semibold"
          style={{ background: 'rgba(251,191,36,.1)', color: '#FCD34D' }}
        >
          Request
        </button>
      </div>

      <div className="mt-1 px-6 pb-10">
        <GreenBtn label="Save Preferences" onClick={save} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTH-016  IDENTITY VERIFICATION (KYC)
// ═══════════════════════════════════════════════════════════════════════════
export type KYCStatus = 'idle' | 'uploading' | 'review' | 'verified';

export function IdentityVerificationScreen({ onBack }: { onBack: () => void }) {
  const [kycStatus, setKycStatus] = useState<KYCStatus>('idle');
  const [docType, setDocType] = useState<'nid' | 'dl' | 'passport'>('nid');
  const [selfie, setSelfie] = useState(false);
  const [address, setAddress] = useState(false);

  const docLabels: Record<string, string> = {
    nid: 'National ID',
    dl: "Driver's License",
    passport: 'International Passport',
  };

  const statusBadge: Record<KYCStatus, { color: string; bg: string; label: string; icon: string }> =
    {
      idle: { color: MUTED, bg: 'rgba(255,255,255,.06)', label: 'Not Started', icon: '⏳' },
      uploading: { color: '#60A5FA', bg: 'rgba(96,165,250,.1)', label: 'Uploading…', icon: '⬆️' },
      review: { color: '#FCD34D', bg: 'rgba(251,191,36,.1)', label: 'In Review', icon: '🔍' },
      verified: { color: G3, bg: 'rgba(43,172,82,.12)', label: 'Verified ✅', icon: '✅' },
    };
  const sb = statusBadge[kycStatus];

  const kycSteps = [
    { label: 'Phone Number', done: true },
    { label: 'Profile Completed', done: true },
    { label: 'Government ID', done: kycStatus === 'verified' },
    { label: 'Selfie Verification', done: kycStatus === 'verified' && selfie },
    { label: 'Address Verification', done: kycStatus === 'verified' && address },
  ];

  const startVerification = () => {
    setKycStatus('uploading');
    setTimeout(() => setKycStatus('review'), 1600);
  };

  return (
    <div
      className="flex h-full w-full flex-col overflow-y-auto"
      style={{ background: NAVY_BASE, scrollbarWidth: 'none' }}
    >
      <StatusBar />
      <div className="flex items-center gap-3 px-6 pb-2 pt-4">
        <BackBtn onClick={onBack} />
        <div className="flex-1">
          <p
            className="text-[18px] font-bold"
            style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
          >
            Verify Your Identity
          </p>
          <p className="text-[11px]" style={{ color: MUTED }}>
            Unlock all DrippleX features
          </p>
        </div>
        <div
          className="flex-shrink-0 rounded-full px-3 py-1 text-[10px] font-bold"
          style={{ background: sb.bg, color: sb.color }}
        >
          {sb.icon} {sb.label}
        </div>
      </div>

      {/* Progress tracker */}
      <div
        className="mx-6 my-3 rounded-2xl p-4"
        style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
      >
        <p
          className="mb-4 text-[11px] font-semibold uppercase tracking-widest"
          style={{ color: MUTED }}
        >
          Verification Progress
        </p>
        {kycSteps.map((step, i) => (
          <div key={step.label} className="mb-3 flex items-start gap-3 last:mb-0">
            <div className="flex flex-shrink-0 flex-col items-center">
              <div
                className="flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-bold"
                style={{
                  background: step.done ? G2 : 'rgba(255,255,255,.06)',
                  border: `1.5px solid ${step.done ? G2 : BORDER}`,
                }}
              >
                {step.done ? (
                  '✓'
                ) : (
                  <span style={{ color: 'rgba(255,255,255,.3)', fontSize: 11 }}>{i + 1}</span>
                )}
              </div>
              {i < kycSteps.length - 1 && (
                <div
                  className="mt-1 w-0.5 flex-1"
                  style={{ minHeight: 14, background: step.done ? G2 : BORDER }}
                />
              )}
            </div>
            <p
              className="pt-1 text-[13px]"
              style={{ color: step.done ? G3 : '#FFF', fontFamily: "'Inter',sans-serif" }}
            >
              {step.label} {step.done ? '✅' : '⏳'}
            </p>
          </div>
        ))}
      </div>

      {/* Government ID */}
      <p
        className="px-6 pb-2 text-[11px] font-semibold uppercase tracking-widest"
        style={{ color: MUTED }}
      >
        Upload Documents
      </p>

      <div
        className="mx-6 mb-3 rounded-2xl p-4"
        style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
      >
        <div className="mb-3 flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl text-xl"
            style={{ background: 'rgba(43,172,82,.1)' }}
          >
            🪪
          </div>
          <div>
            <p
              className="text-[14px] font-semibold"
              style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
            >
              Government ID
            </p>
            <p className="text-[11px]" style={{ color: MUTED }}>
              National ID, Driver's License, or Passport
            </p>
          </div>
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          {(['nid', 'dl', 'passport'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setDocType(t)}
              className="h-[28px] rounded-full px-3 text-[11px] font-semibold transition-all"
              style={{
                background: docType === t ? G2 : 'rgba(255,255,255,.06)',
                border: `1px solid ${docType === t ? G2 : BORDER}`,
                color: docType === t ? '#FFF' : MUTED,
              }}
            >
              {docLabels[t]}
            </button>
          ))}
        </div>
        <div
          className="flex h-[86px] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl transition-all active:scale-[.98]"
          style={{ background: 'rgba(255,255,255,.03)', border: `1.5px dashed ${BORDER}` }}
        >
          <span style={{ fontSize: 24 }}>📎</span>
          <p className="text-[12px]" style={{ color: MUTED }}>
            Tap to upload {docLabels[docType]}
          </p>
          <p className="text-[10px]" style={{ color: 'rgba(255,255,255,.22)' }}>
            JPG, PNG or PDF · Max 5 MB
          </p>
        </div>
      </div>

      {/* Selfie */}
      <div
        className="mx-6 mb-3 rounded-2xl p-4"
        style={{ background: NAVY_CARD, border: `1.5px solid ${selfie ? G2 + '44' : BORDER}` }}
      >
        <div className="mb-3 flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl text-xl"
            style={{ background: 'rgba(43,172,82,.1)' }}
          >
            🤳
          </div>
          <div className="flex-1">
            <p
              className="text-[14px] font-semibold"
              style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
            >
              Selfie Verification
            </p>
            <p className="text-[11px]" style={{ color: MUTED }}>
              Live face capture · Liveness detection
            </p>
          </div>
          {selfie && <span style={{ fontSize: 18 }}>✅</span>}
        </div>
        <button
          onClick={() => setSelfie(true)}
          className="h-[40px] w-full rounded-xl text-[13px] font-semibold transition-all active:scale-[.98]"
          style={{
            background: selfie ? 'rgba(43,172,82,.1)' : 'rgba(255,255,255,.04)',
            border: `1px solid ${selfie ? G2 + '40' : BORDER}`,
            color: selfie ? G3 : MUTED,
          }}
        >
          {selfie ? 'Selfie Captured ✅' : 'Open Camera'}
        </button>
      </div>

      {/* Address */}
      <div
        className="mx-6 mb-3 rounded-2xl p-4"
        style={{ background: NAVY_CARD, border: `1.5px solid ${address ? G2 + '44' : BORDER}` }}
      >
        <div className="mb-3 flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl text-xl"
            style={{ background: 'rgba(43,172,82,.1)' }}
          >
            🏠
          </div>
          <div className="flex-1">
            <p
              className="text-[14px] font-semibold"
              style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
            >
              Address Verification
            </p>
            <p className="text-[11px]" style={{ color: MUTED }}>
              Utility bill or bank statement (recent)
            </p>
          </div>
          {address && <span style={{ fontSize: 18 }}>✅</span>}
        </div>
        <div
          onClick={() => setAddress(true)}
          className="flex h-[72px] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl transition-all active:scale-[.98]"
          style={{
            background: address ? 'rgba(43,172,82,.06)' : 'rgba(255,255,255,.03)',
            border: `1.5px dashed ${address ? G2 + '55' : BORDER}`,
          }}
        >
          <span style={{ fontSize: 20 }}>{address ? '📄' : '📎'}</span>
          <p className="text-[12px]" style={{ color: address ? G3 : MUTED }}>
            {address ? 'Document uploaded ✅' : 'Tap to upload proof of address'}
          </p>
        </div>
      </div>

      {/* Security notice */}
      <div
        className="mx-6 mb-3 flex items-start gap-3 rounded-2xl p-4"
        style={{ background: 'rgba(96,165,250,.05)', border: '1px solid rgba(96,165,250,.15)' }}
      >
        <span style={{ fontSize: 16, marginTop: 1 }}>🔒</span>
        <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,.5)' }}>
          <span className="font-semibold" style={{ color: '#60A5FA' }}>
            Your data is protected.
          </span>{' '}
          Personal information is encrypted and securely stored in accordance with applicable
          privacy regulations.
        </p>
      </div>

      <div className="px-6 pb-10">
        <GreenBtn
          label={
            kycStatus === 'uploading'
              ? 'Uploading…'
              : kycStatus === 'review'
                ? 'In Review · Submitted'
                : 'Start Verification'
          }
          loading={kycStatus === 'uploading'}
          disabled={kycStatus === 'review'}
          onClick={startVerification}
        />
        {kycStatus === 'review' && (
          <p className="mt-2 text-center text-[11px]" style={{ color: MUTED }}>
            Verification usually takes 1–3 business days.
          </p>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTH-017  ACCOUNT MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════
export function AccountManagementScreen({
  onBack,
  onKYC,
  onSecurity,
  onPrivacy,
  onSessions,
  onLinked,
  onVerifStatus,
  onActivity,
  onServices,
  onTrust,
  onPinSetup,
  onEmailVerify,
  onChangePhone,
  onUsername,
  onRecoveryCodes,
  onSecurityQs,
  onAccTransfer,
  onSuspension,
  onAuthSummary,
}: {
  onBack: () => void;
  onKYC: () => void;
  onSecurity: () => void;
  onPrivacy: () => void;
  onSessions: () => void;
  onLinked: () => void;
  onVerifStatus: () => void;
  onActivity: () => void;
  onServices: () => void;
  onTrust: () => void;
  onPinSetup?: () => void;
  onEmailVerify?: () => void;
  onChangePhone?: () => void;
  onUsername?: () => void;
  onRecoveryCodes?: () => void;
  onSecurityQs?: () => void;
  onAccTransfer?: () => void;
  onSuspension?: () => void;
  onAuthSummary?: () => void;
}) {
  const [name, setName] = useState('Saeed Danwakili');
  const [username, setUsername] = useState('saeed.d');
  const [email, setEmail] = useState('');
  const [saved, setSaved] = useState(false);
  const [deleteSheet, setDeleteSheet] = useState(false);
  const [deleteStep, setDeleteStep] = useState<'confirm' | 'type' | 'done'>('confirm');
  const [deleteInput, setDeleteInput] = useState('');

  const saveChanges = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2600);
  };

  if (saved)
    return (
      <div
        className="flex h-full w-full flex-col items-center justify-center gap-5"
        style={{ background: NAVY_BASE }}
      >
        <StatusBar />
        <div
          className="relative flex items-center justify-center"
          style={{ width: 110, height: 110 }}
        >
          <svg width="110" height="110" viewBox="0 0 110 110" style={{ position: 'absolute' }}>
            <circle
              cx="55"
              cy="55"
              r="48"
              fill="none"
              stroke={G2}
              strokeWidth="3"
              strokeDasharray="301"
              strokeDashoffset="301"
              style={{ animation: 'circle-draw .85s ease forwards' }}
            />
          </svg>
          <span style={{ fontSize: 44 }}>✅</span>
        </div>
        <div className="px-10 text-center">
          <p
            className="mb-1 text-[22px] font-bold"
            style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
          >
            Account Updated
          </p>
          <p className="text-[13px]" style={{ color: MUTED }}>
            Your changes have been saved successfully.
          </p>
          <p className="mt-3 text-[12px] font-semibold tracking-widest" style={{ color: G3 }}>
            life,Simplified
          </p>
        </div>
        <button
          onClick={() => setSaved(false)}
          className="mt-2 h-[46px] rounded-2xl px-8 text-[14px] font-semibold"
          style={{
            background: 'rgba(255,255,255,.06)',
            border: `1px solid ${BORDER}`,
            color: MUTED,
          }}
        >
          Done
        </button>
      </div>
    );

  return (
    <div
      className="flex h-full w-full flex-col overflow-y-auto"
      style={{ background: NAVY_BASE, scrollbarWidth: 'none' }}
    >
      <StatusBar />
      <div className="flex items-center gap-3 px-6 pb-2 pt-4">
        <BackBtn onClick={onBack} />
        <div>
          <p
            className="text-[18px] font-bold"
            style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
          >
            Manage Account
          </p>
          <p className="text-[11px]" style={{ color: MUTED }}>
            Control your DrippleX account
          </p>
        </div>
      </div>

      {/* Avatar */}
      <div className="flex flex-col items-center py-5">
        <div className="relative">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-full text-[26px] font-bold"
            style={{
              background: `linear-gradient(135deg,${G0},${G3})`,
              boxShadow: `0 0 0 3px ${NAVY_BASE}, 0 0 0 5px ${G2}55`,
              color: '#FFF',
              fontFamily: "'Poppins',sans-serif",
            }}
          >
            SD
          </div>
          <button
            className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full text-sm"
            style={{ background: G2, border: `2.5px solid ${NAVY_BASE}` }}
          >
            ✏️
          </button>
        </div>
        <p
          className="mt-2.5 text-[15px] font-semibold"
          style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
        >
          {name}
        </p>
        <p className="text-[11px]" style={{ color: MUTED }}>
          @{username}
        </p>
      </div>

      {/* Editable fields */}
      <div
        className="mx-6 mb-4 rounded-2xl p-4"
        style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
      >
        {[
          {
            label: 'Full Name',
            value: name,
            onChange: setName,
            placeholder: 'Your full name',
            type: 'text',
          },
          {
            label: 'Username',
            value: username,
            onChange: setUsername,
            placeholder: 'username',
            type: 'text',
          },
          {
            label: 'Email Address',
            value: email,
            onChange: setEmail,
            placeholder: 'you@email.com',
            type: 'email',
          },
        ].map((f, i) => (
          <div key={f.label} className={i < 2 ? 'mb-3' : ''}>
            <p
              className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: MUTED }}
            >
              {f.label}
            </p>
            <input
              value={f.value}
              onChange={(e) => f.onChange(e.target.value)}
              placeholder={f.placeholder}
              type={f.type}
              className="h-[46px] w-full rounded-xl px-4 text-[14px] outline-none"
              style={{
                fontFamily: "'Inter',sans-serif",
                color: '#FFF',
                background: 'rgba(255,255,255,.04)',
                border: `1.5px solid ${BORDER}`,
              }}
            />
          </div>
        ))}
        <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${BORDER}` }}>
          <p
            className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: MUTED }}
          >
            Phone Number
          </p>
          <div
            className="flex h-[46px] items-center gap-2 rounded-xl px-4"
            style={{ background: 'rgba(255,255,255,.03)', border: `1.5px solid ${BORDER}` }}
          >
            <span style={{ fontSize: 16 }}>🇳🇬</span>
            <span
              className="text-[14px]"
              style={{ color: 'rgba(255,255,255,.55)', fontFamily: "'Inter',sans-serif" }}
            >
              +234 801 234 5678
            </span>
            <span
              className="ml-auto rounded-full px-2 py-0.5 text-[9px] font-bold"
              style={{ background: 'rgba(43,172,82,.15)', color: G3 }}
            >
              Verified
            </span>
          </div>
        </div>
      </div>

      {/* Account settings menu */}
      <p
        className="px-6 pb-2 text-[11px] font-semibold uppercase tracking-widest"
        style={{ color: MUTED }}
      >
        Account Settings
      </p>
      <div
        className="mx-6 mb-4 overflow-hidden rounded-2xl"
        style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
      >
        {[
          {
            icon: '🔑',
            label: 'Security Settings',
            sub: 'Biometrics, 2FA, trusted devices',
            onClick: onSecurity,
          },
          {
            icon: '🛡',
            label: 'Privacy Controls',
            sub: 'Visibility, location, marketing',
            onClick: onPrivacy,
          },
          {
            icon: '🖥️',
            label: 'Active Sessions',
            sub: 'Manage signed-in devices',
            onClick: onSessions,
          },
          {
            icon: '🔗',
            label: 'Linked Accounts',
            sub: 'Phone, email, Apple, Google',
            onClick: onLinked,
          },
          {
            icon: '✅',
            label: 'Verification Status',
            sub: 'Track your KYC progress',
            onClick: onVerifStatus,
          },
          {
            icon: '📊',
            label: 'Account Activity',
            sub: 'Monitor usage across services',
            onClick: onActivity,
          },
          {
            icon: '📡',
            label: 'Connected Services',
            sub: 'Marketplace, Ride, Wallet & more',
            onClick: onServices,
          },
          {
            icon: '🏆',
            label: 'Trust Center',
            sub: '96% trusted · Security overview',
            onClick: onTrust,
          },
          {
            icon: '🪪',
            label: 'Identity Verification',
            sub: 'KYC status · Complete to unlock features',
            onClick: onKYC,
          },
          {
            icon: '📥',
            label: 'Download My Data',
            sub: 'Request an export of your account data',
            onClick: undefined,
          },
          {
            icon: '🔢',
            label: 'PIN Setup',
            sub: 'Create or update your 6-digit PIN',
            onClick: onPinSetup,
          },
          {
            icon: '📧',
            label: 'Email Verification',
            sub: 'Link and verify your email address',
            onClick: onEmailVerify,
          },
          {
            icon: '📱',
            label: 'Change Phone Number',
            sub: 'Update your primary phone number',
            onClick: onChangePhone,
          },
          {
            icon: '@',
            label: 'Username',
            sub: 'Manage your public DrippleX identity',
            onClick: onUsername,
          },
          {
            icon: '🔑',
            label: 'Recovery Codes',
            sub: '10 one-time emergency access codes',
            onClick: onRecoveryCodes,
          },
          {
            icon: '❓',
            label: 'Security Questions',
            sub: 'Additional recovery option',
            onClick: onSecurityQs,
          },
          {
            icon: '💼',
            label: 'Account Transfer',
            sub: 'Business, estate & corporate transfer',
            onClick: onAccTransfer,
          },
          {
            icon: '📋',
            label: 'Auth Summary',
            sub: 'Full security dashboard · Trust Score',
            onClick: onAuthSummary,
          },
        ].map((item, i, arr) => (
          <button
            key={item.label}
            onClick={item.onClick}
            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-all active:scale-[.98]"
            style={{ borderBottom: i < arr.length - 1 ? `1px solid ${BORDER}` : 'none' }}
          >
            <div
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-lg"
              style={{ background: 'rgba(43,172,82,.08)' }}
            >
              {item.icon}
            </div>
            <div className="flex-1">
              <p
                className="text-[13px] font-semibold"
                style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
              >
                {item.label}
              </p>
              <p className="text-[11px]" style={{ color: MUTED }}>
                {item.sub}
              </p>
            </div>
            <ArrowIcon />
          </button>
        ))}
      </div>

      {/* Delete account */}
      <div
        className="mx-6 mb-4 overflow-hidden rounded-2xl"
        style={{ background: NAVY_CARD, border: `1.5px solid rgba(248,113,113,.2)` }}
      >
        <button
          onClick={() => setDeleteSheet(true)}
          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-all active:scale-[.98]"
        >
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl text-lg"
            style={{ background: 'rgba(248,113,113,.1)' }}
          >
            🗑
          </div>
          <div className="flex-1">
            <p
              className="text-[13px] font-semibold"
              style={{ fontFamily: "'Poppins',sans-serif", color: '#F87171' }}
            >
              Delete Account
            </p>
            <p className="text-[11px]" style={{ color: MUTED }}>
              Permanently remove your account and data
            </p>
          </div>
          <ArrowIcon />
        </button>
      </div>

      {/* Save button */}
      <div className="mt-1 px-6 pb-4">
        <GreenBtn label="Save Changes" onClick={saveChanges} />
      </div>

      {/* Footer */}
      <div className="flex flex-col items-center gap-3 px-6 pb-10">
        <p className="text-[10px]" style={{ color: 'rgba(255,255,255,.18)' }}>
          DrippleX Account · Version 1.0.0
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          {['Terms of Service', 'Privacy Policy', 'Help Center', 'Contact Support'].map((l) => (
            <button
              key={l}
              className="text-[10px] transition-opacity active:opacity-60"
              style={{ color: 'rgba(255,255,255,.3)' }}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Delete sheet */}
      {deleteSheet && (
        <div
          className="absolute inset-0 z-50 flex flex-col justify-end"
          style={{ background: 'rgba(0,0,0,.75)' }}
          onClick={() => {
            setDeleteSheet(false);
            setDeleteStep('confirm');
            setDeleteInput('');
          }}
        >
          <div
            className="rounded-t-3xl p-6"
            style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="mx-auto mb-5 h-1 w-10 rounded-full"
              style={{ background: 'rgba(255,255,255,.2)' }}
            />

            {deleteStep === 'confirm' && (
              <>
                <div className="mb-5 text-center">
                  <span style={{ fontSize: 40 }}>🗑</span>
                  <p
                    className="mb-1 mt-2 text-[18px] font-bold"
                    style={{ fontFamily: "'Poppins',sans-serif", color: '#F87171' }}
                  >
                    Delete Account?
                  </p>
                  <p className="text-[13px] leading-relaxed" style={{ color: MUTED }}>
                    This requires identity verification and a confirmation step. Your data will be
                    permanently removed after a 30-day grace period.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setDeleteSheet(false);
                      setDeleteStep('confirm');
                    }}
                    className="h-[46px] flex-1 rounded-2xl text-[14px] font-medium"
                    style={{
                      background: 'rgba(255,255,255,.06)',
                      border: `1px solid ${BORDER}`,
                      color: MUTED,
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setDeleteStep('type')}
                    className="h-[46px] flex-1 rounded-2xl text-[14px] font-bold"
                    style={{
                      background: 'rgba(248,113,113,.15)',
                      border: '1px solid rgba(248,113,113,.3)',
                      color: '#F87171',
                    }}
                  >
                    Continue
                  </button>
                </div>
              </>
            )}

            {deleteStep === 'type' && (
              <>
                <p
                  className="mb-2 text-[16px] font-bold"
                  style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
                >
                  Confirm Deletion
                </p>
                <p className="mb-4 text-[13px]" style={{ color: MUTED }}>
                  Type{' '}
                  <span className="font-bold" style={{ color: '#F87171' }}>
                    DELETE
                  </span>{' '}
                  to permanently remove your account.
                </p>
                <input
                  value={deleteInput}
                  onChange={(e) => setDeleteInput(e.target.value)}
                  placeholder="Type DELETE"
                  className="mb-4 h-[48px] w-full rounded-2xl px-4 text-[14px] outline-none"
                  style={{
                    fontFamily: "'Inter',sans-serif",
                    color: '#F87171',
                    background: 'rgba(248,113,113,.06)',
                    border: '1.5px solid rgba(248,113,113,.25)',
                  }}
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => setDeleteStep('confirm')}
                    className="h-[46px] flex-1 rounded-2xl text-[14px] font-medium"
                    style={{
                      background: 'rgba(255,255,255,.06)',
                      border: `1px solid ${BORDER}`,
                      color: MUTED,
                    }}
                  >
                    Back
                  </button>
                  <button
                    onClick={() => {
                      if (deleteInput === 'DELETE') setDeleteStep('done');
                    }}
                    className="h-[46px] flex-1 rounded-2xl text-[14px] font-bold transition-all"
                    style={{
                      background:
                        deleteInput === 'DELETE' ? 'rgba(248,113,113,.2)' : 'rgba(255,255,255,.04)',
                      border: `1px solid ${deleteInput === 'DELETE' ? 'rgba(248,113,113,.35)' : BORDER}`,
                      color: deleteInput === 'DELETE' ? '#F87171' : 'rgba(255,255,255,.2)',
                    }}
                  >
                    Delete Forever
                  </button>
                </div>
              </>
            )}

            {deleteStep === 'done' && (
              <div className="py-2 text-center">
                <span style={{ fontSize: 38 }}>✅</span>
                <p
                  className="mb-2 mt-3 text-[17px] font-bold"
                  style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
                >
                  Request Submitted
                </p>
                <p className="mb-5 text-[13px] leading-relaxed" style={{ color: MUTED }}>
                  Your account deletion request has been received. You have 30 days to cancel this
                  request.
                </p>
                <button
                  onClick={() => {
                    setDeleteSheet(false);
                    setDeleteStep('confirm');
                    setDeleteInput('');
                  }}
                  className="h-[46px] w-full rounded-2xl text-[14px] font-semibold"
                  style={{
                    background: 'rgba(255,255,255,.06)',
                    border: `1px solid ${BORDER}`,
                    color: MUTED,
                  }}
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
