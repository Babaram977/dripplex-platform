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
import { api, uploadFile } from '../lib/api';
import type { CustomerKycStatusDto, SessionDto } from '../lib/api';
import { auth, endSession } from '../lib/auth';
import { splitFullName } from '../lib/fullName';

// AUTH-010  TWO-FACTOR AUTHENTICATION
// ═══════════════════════════════════════════════════════════════════════════
export function TwoFactorScreen({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  // GAP: no MFA/2FA backend exists — there are no setup/verify/disable endpoints
  // and the login flow has no 2FA challenge. This screen is honest about that
  // rather than faking a code check (the old flow accepted any 6 digits).
  void onDone;
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
            Two-Factor Authentication
          </p>
          <p className="text-[11px]" style={{ color: MUTED }}>
            Extra security for your account
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
        <div
          className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl text-3xl"
          style={{ background: 'rgba(255,255,255,.05)', border: `1px solid ${BORDER}` }}
        >
          🔒
        </div>
        <p
          className="mb-2 text-[16px] font-bold"
          style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
        >
          Not available yet
        </p>
        <p className="text-[13px] leading-relaxed" style={{ color: MUTED }}>
          Two-factor authentication is coming soon. When it&apos;s ready you&apos;ll be able to add
          a second step to your logins from here.
        </p>
      </div>

      <div className="px-6 pb-10">
        <GreenBtn label="Back to Security" onClick={onBack} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTH-011  TRUSTED DEVICES
// ═══════════════════════════════════════════════════════════════════════════
// No backend for trusted-device listing yet → start empty (honest "no devices").
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DEVICES: any[] = [];
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
export function SecurityActivityScreen({
  onBack,
  onSecure,
}: {
  onBack: () => void;
  onSecure: () => void;
}) {
  // GAP: there is no login-event / audit-history backend. Rather than fabricate
  // a feed (the old ACTIVITY_LOG had fake "Failed Login · Berlin" entries), show
  // the REAL active sessions from api.auth.listSessions — the honest available
  // signal. A full login history is a future feature.
  const [sessions, setSessions] = useState<SessionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    if (!auth.isLoggedIn()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    api.auth
      .listSessions()
      .then((r) => setSessions(r.items))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load activity.'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

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
            Devices currently signed in
          </p>
        </div>
      </div>

      <div
        className="mx-6 my-3 flex items-start gap-3 rounded-2xl p-4"
        style={{ background: 'rgba(96,165,250,.05)', border: '1px solid rgba(96,165,250,.15)' }}
      >
        <span style={{ fontSize: 16, marginTop: 1 }}>&#8505;&#65039;</span>
        <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,.5)' }}>
          A full login history is coming soon. For now, these are the devices currently signed in to
          your account.
        </p>
      </div>

      {error && (
        <div
          className="mx-6 mb-2 flex items-center justify-between gap-3 rounded-2xl p-4"
          style={{ background: 'rgba(248,113,113,.08)', border: '1px solid rgba(248,113,113,.22)' }}
        >
          <p className="text-[12px]" style={{ color: '#FCA5A5' }}>
            {error}
          </p>
          <button
            onClick={load}
            className="h-[30px] rounded-lg px-3 text-[11px] font-semibold"
            style={{ background: 'rgba(255,255,255,.08)', color: '#FFF' }}
          >
            Retry
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2 px-6 pt-1">
        {loading && (
          <p className="py-6 text-center text-[12px]" style={{ color: MUTED }}>
            Loading&#8230;
          </p>
        )}
        {!loading &&
          sessions.map((s, idx) => (
            <div
              key={s.sessionId}
              className="flex items-start gap-3 rounded-2xl p-4"
              style={{
                background: NAVY_CARD,
                border: `1.5px solid ${s.current ? G2 + '55' : BORDER}`,
                animation: `fade-up .3s ease ${idx * 0.04}s both`,
              }}
            >
              <div
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-xl"
                style={{ background: 'rgba(43,172,82,.12)' }}
              >
                {sessionIcon(s.deviceType)}
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p
                    className="text-[13px] font-semibold"
                    style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
                  >
                    {s.device || s.operatingSystem || 'Unknown device'}
                  </p>
                  {s.current && (
                    <span
                      className="flex-shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold"
                      style={{ background: G2, color: '#FFF' }}
                    >
                      THIS DEVICE
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[11px]" style={{ color: MUTED }}>
                  {(s.browser || s.portal || 'DrippleX') + ' · ' + (s.location || s.ip || '—')}
                </p>
                <p className="mt-1 text-[10px]" style={{ color: 'rgba(255,255,255,.3)' }}>
                  &#128336; {s.current ? 'Active now' : relTime(s.lastActiveAt)}
                </p>
              </div>
            </div>
          ))}
        {!loading && sessions.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center gap-2 py-12">
            <span style={{ fontSize: 36 }}>&#128237;</span>
            <p className="text-[13px]" style={{ color: MUTED }}>
              No active sessions to show
            </p>
          </div>
        )}
      </div>

      <div className="mx-6 mb-10 mt-3">
        <button
          onClick={onSecure}
          className="flex h-[46px] w-full items-center justify-center gap-2 rounded-2xl text-[13px] font-bold transition-all active:scale-[0.97]"
          style={{
            background: 'rgba(248,113,113,.1)',
            border: '1.5px solid rgba(248,113,113,.25)',
            color: '#F87171',
          }}
        >
          &#128737; Secure My Account
        </button>
        <p className="mt-2 text-center text-[10px]" style={{ color: 'rgba(255,255,255,.25)' }}>
          Don&apos;t recognise a device? Secure your account to sign everyone out.
        </p>
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

  // Honest protection overview from REAL signals — no fabricated "all green".
  // 2FA / recovery codes / trusted devices / biometric have no backend yet, so
  // they read "Coming soon", never "Enabled". Score is computed from what is
  // actually configurable today, not a hardcoded 92.
  const user = auth.getUser();
  const [sessionCount, setSessionCount] = useState<number | null>(null);
  const [kycStatus, setKycStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.isLoggedIn()) return;
    api.auth
      .listSessions()
      .then((r) => setSessionCount(r.items.length))
      .catch(() => {});
    api.kyc
      .get()
      .then((k) => setKycStatus(k.status))
      .catch(() => {});
  }, []);

  const emailOnFile = !!user?.email;
  const phoneOnFile = !!user?.phone;
  const identityVerified = kycStatus === 'VERIFIED';
  const identityWarn = kycStatus === 'REJECTED' || kycStatus === 'REQUIRES_RESUBMISSION';
  const available = [true /* password */, emailOnFile, phoneOnFile, identityVerified];
  const score = Math.round((available.filter(Boolean).length / available.length) * 100);
  const scoreLabel =
    score >= 75 ? 'Strong protection' : score >= 50 ? 'Good protection' : 'Basic protection';

  const kycLabel =
    kycStatus === 'VERIFIED'
      ? 'Verified'
      : kycStatus === 'PENDING_REVIEW'
        ? 'In review'
        : identityWarn
          ? 'Action needed'
          : kycStatus === 'IN_PROGRESS'
            ? 'In progress'
            : kycStatus == null
              ? '—'
              : 'Not started';

  type SegTone = 'ok' | 'soon' | 'warn';
  const segments: { label: string; icon: string; status: string; tone: SegTone }[] = [
    { label: 'Password', icon: '🔑', status: 'Set', tone: 'ok' },
    {
      label: 'Sessions',
      icon: '🖥️',
      status: sessionCount == null ? '—' : `${sessionCount} active`,
      tone: 'ok',
    },
    {
      label: 'Identity',
      icon: '🪪',
      status: kycLabel,
      tone: identityVerified ? 'ok' : identityWarn ? 'warn' : 'soon',
    },
    {
      label: 'Email',
      icon: '📧',
      status: emailOnFile ? 'Added' : 'Not added',
      tone: emailOnFile ? 'ok' : 'warn',
    },
    { label: '2FA', icon: '🔐', status: 'Coming soon', tone: 'soon' },
    { label: 'Recovery', icon: '🧩', status: 'Coming soon', tone: 'soon' },
  ];
  const toneColor: Record<SegTone, string> = { ok: G3, soon: MUTED, warn: '#F87171' };
  const toneBorder: Record<SegTone, string> = {
    ok: 'rgba(43,172,82,.2)',
    soon: BORDER,
    warn: 'rgba(248,113,113,.25)',
  };

  const quickLinks = [
    {
      icon: '🖥️',
      label: 'Active Sessions',
      sub: sessionCount == null ? 'Manage signed-in devices' : `${sessionCount} signed in`,
      nav: 'sessions' as const,
    },
    {
      icon: '🚨',
      label: 'Emergency Protection',
      sub: 'Lock account, end all sessions',
      nav: 'emergency' as const,
    },
    { icon: '🔐', label: 'Two-Factor Auth', sub: 'Coming soon', nav: 'twofa' as const },
    {
      icon: '🔔',
      label: 'Login Approvals',
      sub: 'Coming soon',
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
            {scoreLabel}
          </p>
          <p className="text-[11px] leading-relaxed" style={{ color: MUTED }}>
            Password and session controls are active. Two-factor and passkey sign-in are coming
            soon.
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
              border: `1px solid ${toneBorder[s.tone]}`,
            }}
          >
            <div className="mb-1 text-xl">{s.icon}</div>
            <p
              className="text-[10px] font-semibold"
              style={{ color: '#FFF', fontFamily: "'Poppins',sans-serif" }}
            >
              {s.label}
            </p>
            <p className="mt-0.5 text-[9px]" style={{ color: toneColor[s.tone] }}>
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
                onClick={async () => {
                  setLockSheet(false);
                  try {
                    await api.auth.logoutAll();
                  } catch {}
                  auth.clear();
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
type SessionRow = {
  id: string;
  icon: string;
  device: string;
  browser: string;
  location: string;
  lastActive: string;
  isCurrent: boolean;
};

const sessionIcon = (t: string): string =>
  t === 'mobile' || t === 'tablet' ? '📱' : t === 'desktop' ? '💻' : '🖥️';

const relTime = (iso: string): string => {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return 'Active now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
};

const toSessionRow = (s: SessionDto): SessionRow => ({
  id: s.sessionId,
  icon: sessionIcon(s.deviceType),
  device: s.device || s.operatingSystem || 'Unknown device',
  browser: s.browser || s.portal || 'DrippleX',
  location: s.location || s.ip || '—',
  lastActive: s.current ? 'Active now' : relTime(s.lastActiveAt),
  isCurrent: s.current,
});

export function SessionManagementScreen({ onBack }: { onBack: () => void }) {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [signOutSheet, setSignOutSheet] = useState(false);
  const [allDone, setAllDone] = useState(false);

  const load = () => {
    if (!auth.isLoggedIn()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    api.auth
      .listSessions()
      .then((r) => setSessions(r.items.map(toSessionRow)))
      .catch((e: unknown) =>
        setLoadError(e instanceof Error ? e.message : 'Could not load your sessions.'),
      )
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const signOut = (id: string) => {
    setRemoving(id);
    setLoadError(null);
    api.auth
      .revokeSession(id)
      .then(() => {
        setSessions((s) => s.filter((x) => x.id !== id));
        setExpanded(null);
      })
      .catch((e: unknown) =>
        setLoadError(e instanceof Error ? e.message : 'Could not sign out that session.'),
      )
      .finally(() => setRemoving(null));
  };

  const signOutEverywhere = () => {
    setSignOutSheet(false);
    setLoadError(null);
    api.auth
      .revokeOtherSessions()
      .then(() => {
        setSessions((s) => s.filter((x) => x.isCurrent));
        setAllDone(true);
      })
      .catch((e: unknown) =>
        setLoadError(e instanceof Error ? e.message : 'Could not sign out other sessions.'),
      );
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

      {loadError && (
        <div
          className="mx-6 my-2 flex items-center justify-between gap-3 rounded-2xl p-4"
          style={{ background: 'rgba(248,113,113,.08)', border: '1px solid rgba(248,113,113,.22)' }}
        >
          <p className="text-[12px]" style={{ color: '#FCA5A5' }}>
            {loadError}
          </p>
          <button
            onClick={load}
            className="h-[30px] rounded-lg px-3 text-[11px] font-semibold"
            style={{ background: 'rgba(255,255,255,.08)', color: '#FFF' }}
          >
            Retry
          </button>
        </div>
      )}

      <p
        className="px-6 pb-2 pt-2 text-[11px] font-semibold uppercase tracking-widest"
        style={{ color: MUTED }}
      >
        {loading
          ? 'Loading sessions…'
          : `${sessions.length} Active Session${sessions.length !== 1 ? 's' : ''}`}
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
                  <button
                    onClick={() => signOut(sess.id)}
                    disabled={removing === sess.id}
                    className="h-[38px] w-full rounded-xl text-[12px] font-semibold transition-all active:scale-95 disabled:opacity-60"
                    style={{
                      background: 'rgba(248,113,113,.12)',
                      border: '1px solid rgba(248,113,113,.25)',
                      color: '#F87171',
                    }}
                  >
                    {removing === sess.id ? 'Signing out…' : 'Sign Out'}
                  </button>
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
              This will immediately sign out all devices except the one you're using now. You'll
              need to log back in on those devices.
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
  const [kyc, setKyc] = useState<CustomerKycStatusDto | null>(null);
  const [, setLoading] = useState(true);
  const [docType, setDocType] = useState<'NATIONAL_ID' | 'DRIVER_LICENSE' | 'PASSPORT'>(
    'NATIONAL_ID',
  );
  const [docNumber, setDocNumber] = useState('');
  const [frontUrl, setFrontUrl] = useState<string | null>(null);
  const [backUrl, setBackUrl] = useState<string | null>(null);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState<'front' | 'back' | 'selfie' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const docLabels: Record<string, string> = {
    NATIONAL_ID: 'National ID',
    DRIVER_LICENSE: "Driver's License",
    PASSPORT: 'International Passport',
  };

  // Load the customer's REAL KYC record (GET /kyc/me). Logged-out design-preview
  // just shows the empty form — the account section requires auth in the app.
  const load = () => {
    if (!auth.isLoggedIn()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api.kyc
      .get()
      .then((d) => {
        setKyc(d);
        setFrontUrl(d.frontImageUrl);
        setBackUrl(d.backImageUrl);
        setSelfieUrl(d.selfieUrl);
        if (
          d.documentType === 'NATIONAL_ID' ||
          d.documentType === 'DRIVER_LICENSE' ||
          d.documentType === 'PASSPORT'
        )
          setDocType(d.documentType);
        if (d.documentNumber) setDocNumber(d.documentNumber);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const status = kyc?.status ?? 'NOT_STARTED';
  const locked = status === 'PENDING_REVIEW' || status === 'VERIFIED';

  const statusBadge: Record<string, { color: string; bg: string; label: string; icon: string }> = {
    NOT_STARTED: { color: MUTED, bg: 'rgba(255,255,255,.06)', label: 'Not Started', icon: '⏳' },
    IN_PROGRESS: { color: '#60A5FA', bg: 'rgba(96,165,250,.1)', label: 'In Progress', icon: '✏️' },
    PENDING_REVIEW: { color: '#FCD34D', bg: 'rgba(251,191,36,.1)', label: 'In Review', icon: '🔍' },
    VERIFIED: { color: G3, bg: 'rgba(43,172,82,.12)', label: 'Verified ✅', icon: '✅' },
    REJECTED: { color: '#F87171', bg: 'rgba(248,113,113,.1)', label: 'Rejected', icon: '⚠️' },
    EXPIRED: { color: '#F87171', bg: 'rgba(248,113,113,.1)', label: 'Expired', icon: '⌛' },
    REQUIRES_RESUBMISSION: {
      color: '#FCD34D',
      bg: 'rgba(251,191,36,.1)',
      label: 'Resubmit needed',
      icon: '🔁',
    },
  };
  const sb = statusBadge[status] ?? statusBadge.NOT_STARTED;

  const kycSteps = [
    { label: 'Phone Number', done: kyc?.levelAccess?.level0 ?? true },
    { label: 'Profile Completed', done: kyc?.levelAccess?.level1 ?? false },
    { label: 'Government ID', done: !!frontUrl },
    { label: 'Selfie Verification', done: !!selfieUrl },
    { label: 'Reviewed', done: status === 'VERIFIED' },
  ];

  const pickFile =
    (slot: 'front' | 'back' | 'selfie') => async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      setUploading(slot);
      setError(null);
      try {
        const url = await uploadFile(file, 'kyc-documents');
        if (slot === 'front') setFrontUrl(url);
        else if (slot === 'back') setBackUrl(url);
        else setSelfieUrl(url);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
      } finally {
        setUploading(null);
      }
    };

  const submitKyc = async () => {
    if (!frontUrl) {
      setError('Upload your government ID first.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (status === 'NOT_STARTED') await api.kyc.start().catch(() => {});
      const updated = await api.kyc.submit({
        documentType: docType,
        documentNumber: docNumber.trim() || undefined,
        frontImageUrl: frontUrl,
        backImageUrl: backUrl || undefined,
        selfieUrl: selfieUrl || undefined,
      });
      setKyc(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit verification.');
    } finally {
      setSubmitting(false);
    }
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
          {(['NATIONAL_ID', 'DRIVER_LICENSE', 'PASSPORT'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setDocType(t)}
              disabled={locked}
              className="h-[28px] rounded-full px-3 text-[11px] font-semibold transition-all disabled:opacity-50"
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
        <input
          value={docNumber}
          onChange={(e) => setDocNumber(e.target.value)}
          disabled={locked}
          placeholder="Document number (optional)"
          className="mb-3 h-[38px] w-full rounded-xl px-3 text-[12px] outline-none disabled:opacity-50"
          style={{
            background: 'rgba(255,255,255,.04)',
            border: `1px solid ${BORDER}`,
            color: '#FFF',
          }}
        />
        <label
          className="flex h-[86px] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl transition-all active:scale-[.98]"
          style={{
            background: frontUrl ? 'rgba(43,172,82,.06)' : 'rgba(255,255,255,.03)',
            border: `1.5px dashed ${frontUrl ? G2 + '55' : BORDER}`,
            opacity: locked ? 0.6 : 1,
            pointerEvents: locked ? 'none' : 'auto',
          }}
        >
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="hidden"
            disabled={locked || uploading === 'front'}
            onChange={pickFile('front')}
          />
          <span style={{ fontSize: 24 }}>{frontUrl ? '✅' : '📎'}</span>
          <p className="text-[12px]" style={{ color: frontUrl ? G3 : MUTED }}>
            {uploading === 'front'
              ? 'Uploading…'
              : frontUrl
                ? `${docLabels[docType]} uploaded`
                : `Tap to upload ${docLabels[docType]}`}
          </p>
          <p className="text-[10px]" style={{ color: 'rgba(255,255,255,.22)' }}>
            JPG, PNG, WEBP or PDF · Max 10 MB
          </p>
        </label>
      </div>

      {/* Selfie */}
      <div
        className="mx-6 mb-3 rounded-2xl p-4"
        style={{ background: NAVY_CARD, border: `1.5px solid ${selfieUrl ? G2 + '44' : BORDER}` }}
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
          {selfieUrl && <span style={{ fontSize: 18 }}>✅</span>}
        </div>
        <label
          className="flex h-[40px] w-full cursor-pointer items-center justify-center rounded-xl text-[13px] font-semibold transition-all active:scale-[.98]"
          style={{
            background: selfieUrl ? 'rgba(43,172,82,.1)' : 'rgba(255,255,255,.04)',
            border: `1px solid ${selfieUrl ? G2 + '40' : BORDER}`,
            color: selfieUrl ? G3 : MUTED,
            opacity: locked ? 0.6 : 1,
            pointerEvents: locked ? 'none' : 'auto',
          }}
        >
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="user"
            className="hidden"
            disabled={locked || uploading === 'selfie'}
            onChange={pickFile('selfie')}
          />
          {uploading === 'selfie' ? 'Uploading…' : selfieUrl ? 'Selfie Captured ✅' : 'Take Selfie'}
        </label>
      </div>

      {/* Back of document (optional) — maps to the real backImageUrl field.
          GAP: customer KYC has no separate proof-of-address field, so this card
          collects the back of the ID (optional) rather than an address doc. */}
      <div
        className="mx-6 mb-3 rounded-2xl p-4"
        style={{ background: NAVY_CARD, border: `1.5px solid ${backUrl ? G2 + '44' : BORDER}` }}
      >
        <div className="mb-3 flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl text-xl"
            style={{ background: 'rgba(43,172,82,.1)' }}
          >
            🪪
          </div>
          <div className="flex-1">
            <p
              className="text-[14px] font-semibold"
              style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
            >
              Back of Document
            </p>
            <p className="text-[11px]" style={{ color: MUTED }}>
              Optional — the reverse side of your ID
            </p>
          </div>
          {backUrl && <span style={{ fontSize: 18 }}>✅</span>}
        </div>
        <label
          className="flex h-[72px] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl transition-all active:scale-[.98]"
          style={{
            background: backUrl ? 'rgba(43,172,82,.06)' : 'rgba(255,255,255,.03)',
            border: `1.5px dashed ${backUrl ? G2 + '55' : BORDER}`,
            opacity: locked ? 0.6 : 1,
            pointerEvents: locked ? 'none' : 'auto',
          }}
        >
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="hidden"
            disabled={locked || uploading === 'back'}
            onChange={pickFile('back')}
          />
          <span style={{ fontSize: 20 }}>{backUrl ? '📄' : '📎'}</span>
          <p className="text-[12px]" style={{ color: backUrl ? G3 : MUTED }}>
            {uploading === 'back'
              ? 'Uploading…'
              : backUrl
                ? 'Uploaded ✅'
                : 'Tap to upload (optional)'}
          </p>
        </label>
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
        {kyc?.remarks && (status === 'REJECTED' || status === 'REQUIRES_RESUBMISSION') && (
          <div
            className="mb-3 rounded-xl p-3"
            style={{
              background: 'rgba(248,113,113,.1)',
              border: '1px solid rgba(248,113,113,.25)',
            }}
          >
            <p className="text-[12px]" style={{ color: '#FCA5A5' }}>
              {kyc.remarks}
            </p>
          </div>
        )}
        {error && (
          <p className="mb-3 text-center text-[12px]" style={{ color: '#F87171' }}>
            {error}
          </p>
        )}
        <GreenBtn
          label={
            locked
              ? status === 'VERIFIED'
                ? 'Verified ✅'
                : 'In Review · Submitted'
              : submitting
                ? 'Submitting…'
                : status === 'REJECTED' ||
                    status === 'REQUIRES_RESUBMISSION' ||
                    status === 'EXPIRED'
                  ? 'Resubmit for Verification'
                  : 'Submit for Verification'
          }
          loading={submitting}
          disabled={locked || submitting || !frontUrl}
          onClick={submitKyc}
        />
        {status === 'PENDING_REVIEW' && (
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
  onSignOut,
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
  /** Where to land after ending the session (the app's front door). */
  onSignOut?: () => void;
}) {
  const dxUser = auth.getUser();
  const [name, setName] = useState(auth.displayName(dxUser));
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteSheet, setDeleteSheet] = useState(false);
  const [deleteStep, setDeleteStep] = useState<'confirm' | 'type' | 'done'>('confirm');
  const [deleteInput, setDeleteInput] = useState('');

  /**
   * Save the name. For real, this time.
   *
   * This used to be `setSaved(true)` and a timer — no request, nothing
   * persisted. It showed "Account Updated · Your changes have been saved
   * successfully" over an edit that was discarded the moment the screen
   * re-rendered. A customer correcting a misspelt name was told it worked and
   * it never did.
   *
   * `PATCH /auth/me` takes firstName and lastName separately, so the single
   * Full Name box is split on the first space: everything before it is the
   * first name, the remainder is the surname. A one-word name saves as a
   * first name with no surname, which is what the backend's optional
   * lastName is for.
   *
   * Email is deliberately not here — see the field itself. The success screen
   * now appears only after the server has confirmed the change.
   */
  const saveChanges = () => {
    const split = splitFullName(name);
    if (split === null) {
      setSaveError('Enter your name.');
      return;
    }

    setSaving(true);
    setSaveError(null);
    void api.auth
      .updateMe(split)
      .then((updated) => {
        // Keep the device's copy in step, or every other screen greets them by
        // the old name until they next sign in.
        auth.setUser(updated);
        setSaved(true);
        setTimeout(() => setSaved(false), 2600);
      })
      .catch((cause: unknown) => {
        setSaveError(
          cause instanceof Error ? cause.message : 'Could not save that. Please try again.',
        );
      })
      .finally(() => setSaving(false));
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
        {/* No "@handle" line. DrippleX has no usernames (founder decision:
            identity is phone, primary, plus an optional email and a name), so
            this showed everyone an invented one derived from their email. */}
        <p className="text-[11px]" style={{ color: MUTED }}>
          {dxUser?.phone ?? dxUser?.email ?? ''}
        </p>
      </div>

      {/* Editable fields */}
      <div
        className="mx-6 mb-4 rounded-2xl p-4"
        style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
      >
        <div className="mb-3">
          <p
            className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: MUTED }}
          >
            Full Name
          </p>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSaveError(null);
            }}
            placeholder="Your full name"
            type="text"
            className="h-[46px] w-full rounded-xl px-4 text-[14px] outline-none"
            style={{
              fontFamily: "'Inter',sans-serif",
              color: '#FFF',
              background: 'rgba(255,255,255,.04)',
              border: `1.5px solid ${BORDER}`,
            }}
          />
        </div>

        {/* Email is NOT a free-text box that Save writes.
            Changing an email on this backend is a two-step flow — request a
            code at POST /auth/me/email/change, confirm it at .../confirm —
            because an unverified address silently replacing a verified one is
            an account-takeover route. This field used to accept typing and
            then throw it away on Save, which read as "email changed" and was
            not. It shows the real address and sends them to the flow that can
            actually change it. */}
        <div>
          <p
            className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: MUTED }}
          >
            Email Address
          </p>
          <button
            onClick={onEmailVerify}
            disabled={onEmailVerify === undefined}
            className="flex h-[46px] w-full items-center justify-between rounded-xl px-4 text-left"
            style={{ background: 'rgba(255,255,255,.03)', border: `1.5px solid ${BORDER}` }}
          >
            <span
              className="text-[14px]"
              style={{ color: 'rgba(255,255,255,.55)', fontFamily: "'Inter',sans-serif" }}
            >
              {dxUser?.email ?? 'Not set'}
            </span>
            {onEmailVerify !== undefined && (
              <span className="text-[12px] font-semibold" style={{ color: G3 }}>
                {dxUser?.email ? 'Change' : 'Add'}
              </span>
            )}
          </button>
        </div>
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
            {/* The customer's REAL phone (identity is phone + optional email +
                name). This was a hardcoded number shown to everyone as their
                own. No verification flag exists on the session user, so no
                "Verified" badge is asserted here. */}
            <span
              className="text-[14px]"
              style={{ color: 'rgba(255,255,255,.55)', fontFamily: "'Inter',sans-serif" }}
            >
              {dxUser?.phone ?? 'Not set'}
            </span>
          </div>
        </div>
      </div>

      {/* Sign Out sits ABOVE the settings list, not below eighteen rows of it.
          The founder reported "no sign out option for customer" while this
          button existed — it was simply the last thing on a very long screen
          (and, until the flex fix in shared.tsx, collapsed to a hairline). */}
      <div
        className="mx-6 mb-4 overflow-hidden rounded-2xl"
        style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
      >
        <button
          onClick={() => {
            void endSession(() => api.auth.logout()).finally(() => onSignOut?.());
          }}
          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-all active:scale-[.98]"
        >
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl text-lg"
            style={{ background: 'rgba(255,255,255,.06)' }}
          >
            ⏻
          </div>
          <div className="flex-1">
            <p
              className="text-[13px] font-semibold"
              style={{ fontFamily: "'Poppins',sans-serif", color: '#fff' }}
            >
              Sign Out
            </p>
            <p className="text-[11px]" style={{ color: MUTED }}>
              End this session on this device
            </p>
          </div>
          <ArrowIcon />
        </button>
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
        {saveError !== null && (
          <p className="mb-2 text-center text-[12px]" style={{ color: '#F87171' }}>
            {saveError}
          </p>
        )}
        <GreenBtn
          label={saving ? 'Saving…' : 'Save Changes'}
          onClick={saving ? () => undefined : saveChanges}
        />
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
