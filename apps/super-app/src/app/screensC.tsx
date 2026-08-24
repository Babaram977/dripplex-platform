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
import { api } from '../lib/api';
import type { NotificationDto } from '../lib/api';
import { auth } from '../lib/auth';

// AUTH-018  CONSENT & PRIVACY AGREEMENT
// ═══════════════════════════════════════════════════════════════════════════
export function ConsentScreen({
  onAccept,
  onLater,
}: {
  onAccept: () => void;
  onLater: () => void;
}) {
  const [ai, setAi] = useState(true);
  const [analytics, setAnalytics] = useState(true);
  const [thirdParty, setThirdParty] = useState(false);
  const [marketing, setMarketing] = useState({ push: true, sms: false, email: true });

  const Toggle = ({ on, onToggle }: { on: boolean; onToggle: () => void }) => (
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
  );

  return (
    <div
      className="flex h-full w-full flex-col overflow-y-auto"
      style={{ background: NAVY_BASE, scrollbarWidth: 'none' }}
    >
      <StatusBar />

      {/* Hero */}
      <div className="px-6 pb-3 pt-5">
        <div
          className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl text-2xl"
          style={{ background: 'rgba(43,172,82,.12)', border: `1px solid rgba(43,172,82,.25)` }}
        >
          🔒
        </div>
        <p
          className="text-[22px] font-bold leading-tight"
          style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
        >
          Your Privacy Matters
        </p>
        <p className="mt-1 text-[13px]" style={{ color: MUTED }}>
          Review and manage how DrippleX uses your information.
        </p>
      </div>

      {/* Essential — always on */}
      <div
        className="mx-6 mb-3 rounded-2xl p-4"
        style={{ background: 'rgba(43,172,82,.08)', border: '1.5px solid rgba(43,172,82,.2)' }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl text-xl"
              style={{ background: 'rgba(43,172,82,.15)' }}
            >
              ⚙️
            </div>
            <div>
              <p
                className="text-[14px] font-semibold"
                style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
              >
                Essential Services
              </p>
              <p className="text-[11px]" style={{ color: MUTED }}>
                Required for account operation
              </p>
            </div>
          </div>
          <span
            className="rounded-full px-3 py-1 text-[10px] font-bold"
            style={{ background: G2, color: '#FFF' }}
          >
            Always On
          </span>
        </div>
      </div>

      <p
        className="px-6 pb-2 text-[11px] font-semibold uppercase tracking-widest"
        style={{ color: MUTED }}
      >
        Your Choices
      </p>

      {/* AI Personalization */}
      <div
        className="mx-6 mb-3 rounded-2xl p-4"
        style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl text-xl"
            style={{ background: 'rgba(43,172,82,.1)' }}
          >
            🤖
          </div>
          <div className="flex-1">
            <p
              className="text-[14px] font-semibold"
              style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
            >
              AI Personalization
            </p>
            <p className="text-[11px]" style={{ color: MUTED }}>
              Personalized recommendations, search & suggestions
            </p>
          </div>
          <Toggle on={ai} onToggle={() => setAi((v) => !v)} />
        </div>
      </div>

      {/* Marketing */}
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
              Marketing Communications
            </p>
            <p className="text-[11px]" style={{ color: MUTED }}>
              Receive offers and updates
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {(['push', 'sms', 'email'] as const).map((ch) => {
            const labels = { push: 'Push', sms: 'SMS', email: 'Email' };
            const on = marketing[ch];
            return (
              <button
                key={ch}
                onClick={() => setMarketing((m) => ({ ...m, [ch]: !m[ch] }))}
                className="h-[28px] rounded-full px-3 text-[11px] font-semibold transition-all"
                style={{
                  background: on ? G2 : 'rgba(255,255,255,.06)',
                  border: `1px solid ${on ? G2 : BORDER}`,
                  color: on ? '#FFF' : MUTED,
                }}
              >
                {labels[ch]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Analytics */}
      <div
        className="mx-6 mb-3 flex items-center gap-3 rounded-2xl p-4"
        style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
      >
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl text-xl"
          style={{ background: 'rgba(43,172,82,.1)' }}
        >
          📊
        </div>
        <div className="flex-1">
          <p
            className="text-[14px] font-semibold"
            style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
          >
            Analytics
          </p>
          <p className="text-[11px]" style={{ color: MUTED }}>
            Anonymous usage data to improve DrippleX
          </p>
        </div>
        <Toggle on={analytics} onToggle={() => setAnalytics((v) => !v)} />
      </div>

      {/* Third-party */}
      <div
        className="mx-6 mb-3 flex items-center gap-3 rounded-2xl p-4"
        style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
      >
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl text-xl"
          style={{ background: 'rgba(43,172,82,.1)' }}
        >
          🔗
        </div>
        <div className="flex-1">
          <p
            className="text-[14px] font-semibold"
            style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
          >
            Third-Party Integrations
          </p>
          <p className="text-[11px]" style={{ color: MUTED }}>
            Data sharing with trusted partners
          </p>
        </div>
        <Toggle on={thirdParty} onToggle={() => setThirdParty((v) => !v)} />
      </div>

      {/* Legal notice */}
      <div
        className="mx-6 mb-4 flex items-start gap-3 rounded-2xl p-4"
        style={{ background: 'rgba(96,165,250,.05)', border: '1px solid rgba(96,165,250,.14)' }}
      >
        <span style={{ fontSize: 15, marginTop: 1 }}>ℹ️</span>
        <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,.48)' }}>
          By continuing you agree to our <span style={{ color: '#60A5FA' }}>Privacy Policy</span>{' '}
          and <span style={{ color: '#60A5FA' }}>Terms of Service</span>. You can update your
          preferences at any time in Account Settings.
        </p>
      </div>

      <div className="px-6 pb-3">
        <GreenBtn label="Accept & Continue" onClick={onAccept} />
      </div>
      <div className="px-6 pb-10">
        <button
          onClick={onLater}
          className="flex h-[48px] w-full items-center justify-center rounded-2xl text-[14px] font-medium transition-all active:scale-[.97]"
          style={{
            fontFamily: "'Poppins',sans-serif",
            color: MUTED,
            background: 'rgba(255,255,255,.03)',
            border: `1.5px solid ${BORDER}`,
          }}
        >
          Manage Later
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTH-019  NOTIFICATION PREFERENCES
// ═══════════════════════════════════════════════════════════════════════════
export type NotifChannels = { push: boolean; sms: boolean; email: boolean };

export const DEFAULT_NOTIFS: Record<string, NotifChannels> = {
  Orders: { push: true, sms: true, email: true },
  'Ride Updates': { push: true, sms: true, email: false },
  'Wallet & Payments': { push: true, sms: true, email: true },
  Promotions: { push: false, sms: false, email: true },
};

export function NotificationPrefsScreen({
  onBack,
  onSave,
}: {
  onBack: () => void;
  onSave: () => void;
}) {
  const [prefs, setPrefs] = useState(DEFAULT_NOTIFS);
  const [quietStart, setQuietStart] = useState('22:00');
  const [quietEnd, setQuietEnd] = useState('07:00');
  const [saved, setSaved] = useState(false);

  const toggle = (cat: string, ch: keyof NotifChannels) =>
    setPrefs((p) => ({ ...p, [cat]: { ...p[cat], [ch]: !p[cat][ch] } }));

  const save = () => {
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onSave();
    }, 1400);
  };

  const ChannelPill = ({
    on,
    label,
    onClick,
  }: {
    on: boolean;
    label: string;
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      className="h-[26px] rounded-full px-3 text-[10px] font-semibold transition-all active:scale-95"
      style={{
        background: on ? G2 : 'rgba(255,255,255,.06)',
        border: `1px solid ${on ? G2 : BORDER}`,
        color: on ? '#FFF' : MUTED,
      }}
    >
      {label}
    </button>
  );

  const catIcons: Record<string, string> = {
    Orders: '📦',
    'Ride Updates': '🚖',
    'Wallet & Payments': '💳',
    Promotions: '🎉',
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
            Notifications
          </p>
          <p className="text-[11px]" style={{ color: MUTED }}>
            Choose how DrippleX keeps you informed
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
            Preferences saved.
          </p>
        </div>
      )}

      <p
        className="px-6 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-widest"
        style={{ color: MUTED }}
      >
        Notification Categories
      </p>

      {Object.entries(prefs).map(([cat, ch]) => (
        <div
          key={cat}
          className="mx-6 mb-3 rounded-2xl p-4"
          style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
        >
          <div className="mb-3 flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl text-xl"
              style={{ background: 'rgba(43,172,82,.1)' }}
            >
              {catIcons[cat]}
            </div>
            <p
              className="text-[14px] font-semibold"
              style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
            >
              {cat}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(['push', 'sms', 'email'] as const)
              .filter((c) => (cat === 'Ride Updates' ? c !== 'email' : true))
              .map((c) => (
                <ChannelPill
                  key={c}
                  on={ch[c]}
                  label={{ push: 'Push', sms: 'SMS', email: 'Email' }[c]}
                  onClick={() => toggle(cat, c)}
                />
              ))}
          </div>
        </div>
      ))}

      {/* Security alerts — always on */}
      <div
        className="mx-6 mb-3 flex items-center gap-3 rounded-2xl p-4"
        style={{ background: 'rgba(43,172,82,.07)', border: '1.5px solid rgba(43,172,82,.2)' }}
      >
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl text-xl"
          style={{ background: 'rgba(43,172,82,.15)' }}
        >
          🔐
        </div>
        <div className="flex-1">
          <p
            className="text-[14px] font-semibold"
            style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
          >
            Security Alerts
          </p>
          <p className="text-[11px]" style={{ color: MUTED }}>
            Login attempts, device changes
          </p>
        </div>
        <span
          className="rounded-full px-3 py-1 text-[10px] font-bold"
          style={{ background: G2, color: '#FFF' }}
        >
          Always On
        </span>
      </div>

      {/* Quiet hours */}
      <div
        className="mx-6 mb-4 rounded-2xl p-4"
        style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
      >
        <div className="mb-4 flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl text-xl"
            style={{ background: 'rgba(43,172,82,.1)' }}
          >
            🌙
          </div>
          <div>
            <p
              className="text-[14px] font-semibold"
              style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
            >
              Quiet Hours
            </p>
            <p className="text-[11px]" style={{ color: MUTED }}>
              Pause non-essential notifications
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <p
              className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: MUTED }}
            >
              From
            </p>
            <input
              type="time"
              value={quietStart}
              onChange={(e) => setQuietStart(e.target.value)}
              className="h-[42px] w-full rounded-xl px-3 text-[14px] outline-none"
              style={{
                fontFamily: "'Inter',sans-serif",
                color: '#FFF',
                background: 'rgba(255,255,255,.05)',
                border: `1.5px solid ${BORDER}`,
                colorScheme: 'dark',
              }}
            />
          </div>
          <div className="flex-1">
            <p
              className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: MUTED }}
            >
              To
            </p>
            <input
              type="time"
              value={quietEnd}
              onChange={(e) => setQuietEnd(e.target.value)}
              className="h-[42px] w-full rounded-xl px-3 text-[14px] outline-none"
              style={{
                fontFamily: "'Inter',sans-serif",
                color: '#FFF',
                background: 'rgba(255,255,255,.05)',
                border: `1.5px solid ${BORDER}`,
                colorScheme: 'dark',
              }}
            />
          </div>
        </div>
        <p className="mt-2 text-center text-[11px]" style={{ color: MUTED }}>
          Quiet from {quietStart} → {quietEnd} · Security alerts always delivered
        </p>
      </div>

      <div className="px-6 pb-10">
        <GreenBtn label="Save Preferences" onClick={save} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTH-020  LANGUAGE & REGION
// ═══════════════════════════════════════════════════════════════════════════
export const LANGUAGES = [
  { code: 'en', flag: '🇬🇧', label: 'English', native: 'English' },
  { code: 'ha', flag: '🇳🇬', label: 'Hausa', native: 'Hausa' },
  { code: 'fr', flag: '🇫🇷', label: 'French', native: 'Français' },
  { code: 'ar', flag: '🇸🇦', label: 'Arabic', native: 'العربية' },
];
export const REGIONS = [
  { code: 'ng', flag: '🇳🇬', label: 'Nigeria', currency: '₦ Nigerian Naira', tz: 'WAT (UTC+1)' },
  { code: 'gh', flag: '🇬🇭', label: 'Ghana', currency: '₵ Ghanaian Cedi', tz: 'GMT (UTC+0)' },
  { code: 'ke', flag: '🇰🇪', label: 'Kenya', currency: 'KSh Kenyan Shilling', tz: 'EAT (UTC+3)' },
  {
    code: 'ae',
    flag: '🇦🇪',
    label: 'United Arab Emirates',
    currency: 'د.إ UAE Dirham',
    tz: 'GST (UTC+4)',
  },
];
export const DATE_FORMATS = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'];

export function LanguageRegionScreen({
  onBack,
  onSave,
}: {
  onBack: () => void;
  onSave: () => void;
}) {
  const [lang, setLang] = useState('en');
  const [region, setRegion] = useState('ng');
  const [tzAuto, setTzAuto] = useState(true);
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY');
  const [saved, setSaved] = useState(false);

  const currentRegion = REGIONS.find((r) => r.code === region)!;
  const save = () => {
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onSave();
    }, 1400);
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
            Language & Region
          </p>
          <p className="text-[11px]" style={{ color: MUTED }}>
            Personalize your regional settings
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
            Settings saved.
          </p>
        </div>
      )}

      {/* Language */}
      <p
        className="px-6 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-widest"
        style={{ color: MUTED }}
      >
        Language
      </p>
      <div
        className="mx-6 mb-4 overflow-hidden rounded-2xl"
        style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
      >
        {LANGUAGES.map((l, i) => (
          <button
            key={l.code}
            onClick={() => setLang(l.code)}
            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-all active:scale-[.98]"
            style={{ borderBottom: i < LANGUAGES.length - 1 ? `1px solid ${BORDER}` : 'none' }}
          >
            <span style={{ fontSize: 22 }}>{l.flag}</span>
            <div className="flex-1">
              <p
                className="text-[14px] font-semibold"
                style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
              >
                {l.label}
              </p>
              <p className="text-[11px]" style={{ color: MUTED }}>
                {l.native}
              </p>
            </div>
            {lang === l.code && (
              <div
                className="flex h-5 w-5 items-center justify-center rounded-full"
                style={{ background: G2 }}
              >
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#FFF"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Region */}
      <p
        className="px-6 pb-2 text-[11px] font-semibold uppercase tracking-widest"
        style={{ color: MUTED }}
      >
        Region
      </p>
      <div
        className="mx-6 mb-4 overflow-hidden rounded-2xl"
        style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
      >
        {REGIONS.map((r, i) => (
          <button
            key={r.code}
            onClick={() => setRegion(r.code)}
            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-all active:scale-[.98]"
            style={{ borderBottom: i < REGIONS.length - 1 ? `1px solid ${BORDER}` : 'none' }}
          >
            <span style={{ fontSize: 22 }}>{r.flag}</span>
            <div className="flex-1">
              <p
                className="text-[14px] font-semibold"
                style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
              >
                {r.label}
              </p>
              <p className="text-[11px]" style={{ color: MUTED }}>
                {r.currency}
              </p>
            </div>
            {region === r.code && (
              <div
                className="flex h-5 w-5 items-center justify-center rounded-full"
                style={{ background: G2 }}
              >
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#FFF"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Time zone */}
      <div
        className="mx-6 mb-4 rounded-2xl p-4"
        style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
      >
        <div className="mb-3 flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl text-xl"
            style={{ background: 'rgba(43,172,82,.1)' }}
          >
            🕐
          </div>
          <div className="flex-1">
            <p
              className="text-[14px] font-semibold"
              style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
            >
              Time Zone
            </p>
            <p className="text-[11px]" style={{ color: MUTED }}>
              {currentRegion.tz}
            </p>
          </div>
          <button
            onClick={() => setTzAuto((v) => !v)}
            className="relative h-6 w-12 rounded-full transition-all duration-300"
            style={{ background: tzAuto ? G2 : 'rgba(255,255,255,.1)' }}
          >
            <div
              className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all duration-300"
              style={{ left: tzAuto ? 'calc(100% - 22px)' : 2 }}
            />
          </button>
        </div>
        <p className="text-[11px]" style={{ color: MUTED }}>
          {tzAuto ? 'Automatically detected from region' : 'Manual override enabled'}
        </p>
      </div>

      {/* Currency (read-only derived) */}
      <div
        className="mx-6 mb-4 flex items-center gap-3 rounded-2xl p-4"
        style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
      >
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl text-xl"
          style={{ background: 'rgba(43,172,82,.1)' }}
        >
          💱
        </div>
        <div className="flex-1">
          <p
            className="text-[14px] font-semibold"
            style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
          >
            Currency Display
          </p>
          <p className="text-[11px]" style={{ color: G3 }}>
            {currentRegion.currency}
          </p>
        </div>
        <span
          className="rounded-full px-2 py-1 text-[10px] font-semibold"
          style={{ background: 'rgba(43,172,82,.12)', color: MUTED }}
        >
          Auto
        </span>
      </div>

      {/* Date format */}
      <div
        className="mx-6 mb-4 rounded-2xl p-4"
        style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
      >
        <div className="mb-3 flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl text-xl"
            style={{ background: 'rgba(43,172,82,.1)' }}
          >
            📅
          </div>
          <div>
            <p
              className="text-[14px] font-semibold"
              style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
            >
              Date Format
            </p>
            <p className="text-[11px]" style={{ color: MUTED }}>
              Preview:{' '}
              {new Date()
                .toLocaleDateString('en-GB')
                .replace(/\//g, dateFormat.includes('YYYY-MM') ? '-' : '/')}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {DATE_FORMATS.map((f) => (
            <button
              key={f}
              onClick={() => setDateFormat(f)}
              className="h-[28px] rounded-full px-3 text-[11px] font-semibold transition-all"
              style={{
                background: dateFormat === f ? G2 : 'rgba(255,255,255,.06)',
                border: `1px solid ${dateFormat === f ? G2 : BORDER}`,
                color: dateFormat === f ? '#FFF' : MUTED,
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 pb-10">
        <GreenBtn label="Save Settings" onClick={save} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTH-021  ACCESSIBILITY PREFERENCES
// ═══════════════════════════════════════════════════════════════════════════
export type ColorBlindMode = 'none' | 'Protanopia' | 'Deuteranopia' | 'Tritanopia';

export function AccessibilityScreen({
  onBack,
  onApply,
}: {
  onBack: () => void;
  onApply: () => void;
}) {
  const [largeText, setLargeText] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [screenReader, setScreenReader] = useState(false);
  const [voiceAssist, setVoiceAssist] = useState(false);
  const [colorBlind, setColorBlind] = useState<ColorBlindMode>('none');
  const [applied, setApplied] = useState(false);

  const apply = () => {
    setApplied(true);
    setTimeout(() => {
      setApplied(false);
      onApply();
    }, 1400);
  };

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
      className="flex items-center gap-3 px-4 py-3"
      style={{ borderBottom: `1px solid ${BORDER}` }}
    >
      <div
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-lg"
        style={{ background: 'rgba(43,172,82,.08)' }}
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

  /* live preview text scale */
  const previewScale = largeText ? 1.18 : 1;
  const previewContrast = highContrast ? '#FFFFFF' : 'rgba(255,255,255,.85)';
  const cbTint: Record<ColorBlindMode, string> = {
    none: 'transparent',
    Protanopia: 'rgba(0,0,200,.08)',
    Deuteranopia: 'rgba(200,0,200,.08)',
    Tritanopia: 'rgba(200,100,0,.08)',
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
            Accessibility
          </p>
          <p className="text-[11px]" style={{ color: MUTED }}>
            Customize DrippleX to your needs
          </p>
        </div>
      </div>

      {applied && (
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
            Accessibility settings applied.
          </p>
        </div>
      )}

      <p
        className="px-6 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-widest"
        style={{ color: MUTED }}
      >
        Display
      </p>
      <div
        className="mx-6 mb-4 overflow-hidden rounded-2xl"
        style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
      >
        <SwitchRow
          icon="🔠"
          title="Large Text"
          sub="Increase text size throughout the app"
          on={largeText}
          onToggle={() => setLargeText((v) => !v)}
        />
        <SwitchRow
          icon="🌗"
          title="High Contrast"
          sub="Enhance color contrast for readability"
          on={highContrast}
          onToggle={() => setHighContrast((v) => !v)}
        />
        <SwitchRow
          icon="✋"
          title="Reduce Motion"
          sub="Minimize animations and transitions"
          on={reduceMotion}
          onToggle={() => setReduceMotion((v) => !v)}
        />
      </div>

      <p
        className="px-6 pb-2 text-[11px] font-semibold uppercase tracking-widest"
        style={{ color: MUTED }}
      >
        Assistance
      </p>
      <div
        className="mx-6 mb-4 overflow-hidden rounded-2xl"
        style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
      >
        <SwitchRow
          icon="👁"
          title="Screen Reader"
          sub="Optimize for screen reader software"
          on={screenReader}
          onToggle={() => setScreenReader((v) => !v)}
        />
        <div className="flex items-center gap-3 px-4 py-3">
          <div
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-lg"
            style={{ background: 'rgba(43,172,82,.08)' }}
          >
            🎙
          </div>
          <div className="flex-1">
            <p
              className="text-[14px] font-semibold"
              style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
            >
              Voice Assistance
            </p>
            <p className="text-[11px]" style={{ color: MUTED }}>
              Voice-guided navigation through the app
            </p>
          </div>
          <button
            onClick={() => setVoiceAssist((v) => !v)}
            className="relative h-6 w-12 flex-shrink-0 rounded-full transition-all duration-300"
            style={{ background: voiceAssist ? G2 : 'rgba(255,255,255,.1)' }}
          >
            <div
              className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all duration-300"
              style={{ left: voiceAssist ? 'calc(100% - 22px)' : 2 }}
            />
          </button>
        </div>
      </div>

      {/* Color blind support */}
      <p
        className="px-6 pb-2 text-[11px] font-semibold uppercase tracking-widest"
        style={{ color: MUTED }}
      >
        Color Blind Support
      </p>
      <div
        className="mx-6 mb-4 rounded-2xl p-4"
        style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
      >
        <div className="flex flex-wrap gap-2">
          {(['none', 'Protanopia', 'Deuteranopia', 'Tritanopia'] as ColorBlindMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setColorBlind(m)}
              className="h-[28px] rounded-full px-3 text-[11px] font-semibold transition-all active:scale-95"
              style={{
                background: colorBlind === m ? G2 : 'rgba(255,255,255,.06)',
                border: `1px solid ${colorBlind === m ? G2 : BORDER}`,
                color: colorBlind === m ? '#FFF' : MUTED,
              }}
            >
              {m === 'none' ? 'None' : m}
            </button>
          ))}
        </div>
      </div>

      {/* Live preview card */}
      <p
        className="px-6 pb-2 text-[11px] font-semibold uppercase tracking-widest"
        style={{ color: MUTED }}
      >
        Preview
      </p>
      <div
        className="relative mx-6 mb-6 overflow-hidden rounded-2xl p-5"
        style={{
          background: highContrast ? '#000' : NAVY_CARD,
          border: `1.5px solid ${highContrast ? '#FFF' : BORDER}`,
        }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: cbTint[colorBlind] }}
        />
        <p
          style={{
            fontSize: 14 * previewScale,
            color: previewContrast,
            fontFamily: "'Poppins',sans-serif",
            fontWeight: 600,
            marginBottom: 4,
            transition: 'all .3s',
          }}
        >
          DrippleX Preview
        </p>
        <p
          style={{
            fontSize: 12 * previewScale,
            color: highContrast ? 'rgba(255,255,255,.85)' : MUTED,
            fontFamily: "'Inter',sans-serif",
            lineHeight: 1.5,
            transition: 'all .3s',
          }}
        >
          This preview shows your current accessibility settings. Text size, contrast, and color
          filters apply across the app.
        </p>
        <div className="mt-3 flex gap-2">
          <div
            className="flex h-[28px] items-center rounded-full px-3 text-[11px] font-semibold"
            style={{ background: G2, color: '#FFF', fontSize: 11 * previewScale }}
          >
            Primary Action
          </div>
          <div
            className="flex h-[28px] items-center rounded-full px-3 text-[11px]"
            style={{
              background: 'rgba(255,255,255,.08)',
              color: highContrast ? '#FFF' : MUTED,
              fontSize: 11 * previewScale,
              border: `1px solid ${BORDER}`,
            }}
          >
            Secondary
          </div>
        </div>
      </div>

      <div className="px-6 pb-10">
        <GreenBtn label="Apply Changes" onClick={apply} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTH-022  WELCOME TO DRIPPLEX  (module-complete screen)
// ═══════════════════════════════════════════════════════════════════════════
export const PARTICLES = Array.from({ length: 22 }, (_, i) => ({
  id: i,
  x: 15 + ((i * 37) % 72),
  y: 10 + ((i * 53) % 75),
  size: 4 + (i % 4) * 2,
  color: [G3, G2, '#FCD34D', '#60A5FA', '#FFF'][i % 5],
  delay: (i * 0.11).toFixed(2),
  dur: (0.8 + (i % 5) * 0.15).toFixed(2),
}));

export function WelcomeDrippleXScreen({
  onHome,
  onTour,
  onQuickStart,
}: {
  onHome: () => void;
  onTour: () => void;
  // Route a Quick Start card into the app. Optional so the screen degrades
  // gracefully (cards just no-op) if a caller doesn't wire it.
  onQuickStart?: (key: 'marketplace' | 'ride' | 'wallet' | 'merchant') => void;
}) {
  const [phase, setPhase] = useState<'celebrate' | 'ready'>('celebrate');
  const firstName = auth.greetingName();

  useEffect(() => {
    const t = setTimeout(() => setPhase('ready'), 2200);
    return () => clearTimeout(t);
  }, []);

  const quickStart: {
    icon: string;
    label: string;
    sub: string;
    key: 'marketplace' | 'ride' | 'wallet' | 'merchant';
  }[] = [
    {
      icon: '🛍',
      label: 'Explore Marketplace',
      sub: 'Shop millions of products',
      key: 'marketplace',
    },
    { icon: '🚖', label: 'Book Your First Ride', sub: 'Safe, fast, affordable', key: 'ride' },
    { icon: '💳', label: 'Activate Wallet', sub: 'Send, receive & pay', key: 'wallet' },
    { icon: '🏪', label: 'Become a Merchant', sub: 'Grow your business', key: 'merchant' },
  ];

  const aiCapabilities = [
    'Find products',
    'Book rides',
    'Manage your wallet',
    'Track orders',
    'Discover nearby businesses',
    'Answer your questions',
  ];

  return (
    <div
      className="flex h-full w-full flex-col overflow-y-auto"
      style={{ background: NAVY_DEEP, scrollbarWidth: 'none' }}
    >
      <StatusBar />

      {/* Celebration hero */}
      <div
        className="relative mx-6 mb-4 mt-5 flex flex-col items-center justify-center overflow-hidden rounded-3xl py-8"
        style={{
          background: `radial-gradient(ellipse at 50% 30%,rgba(43,172,82,.18) 0%,transparent 70%)`,
          border: `1.5px solid rgba(43,172,82,.2)`,
          minHeight: 200,
        }}
      >
        {/* Particles */}
        {phase === 'celebrate' &&
          PARTICLES.map((p) => (
            <div
              key={p.id}
              className="pointer-events-none absolute rounded-full"
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: p.size,
                height: p.size,
                background: p.color,
                animation: `pop-in ${p.dur}s ease ${p.delay}s both, fade-out 0.5s ease 1.6s both`,
                boxShadow: `0 0 ${p.size * 2}px ${p.color}88`,
              }}
            />
          ))}

        {/* Logo + orbit */}
        <div
          className="relative mb-4 flex items-center justify-center"
          style={{ width: 96, height: 96 }}
        >
          <div
            className="absolute inset-0 rounded-full"
            style={{ border: `1.5px solid ${G2}44`, animation: 'orbit-once 2s ease forwards' }}
          />
          <div
            className="absolute inset-[-10px] rounded-full"
            style={{
              border: `1px solid rgba(43,172,82,.15)`,
              animation: 'orbit-once 2.4s ease .1s forwards',
            }}
          />
          <div
            className="flex h-[88px] w-[88px] items-center justify-center overflow-hidden rounded-[22px]"
            style={{
              background: NAVY_CARD,
              boxShadow: `0 0 0 2px rgba(43,172,82,.35), 0 0 28px rgba(43,172,82,.25)`,
            }}
          >
            <ImageWithFallback
              src={logoImg}
              alt="DrippleX"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>
        </div>

        <p
          className="text-[13px] font-semibold tracking-widest"
          style={{ color: G3, animation: 'fade-up .6s ease .4s both' }}
        >
          life,Simplified
        </p>
        <p
          className="mt-1 text-[22px] font-bold"
          style={{
            fontFamily: "'Poppins',sans-serif",
            color: '#FFF',
            animation: 'fade-up .5s ease .55s both',
          }}
        >
          {firstName ? `Welcome, ${firstName} 👋` : 'Welcome 👋'}
        </p>
        <p
          className="mt-1 px-8 text-center text-[12px]"
          style={{ color: MUTED, animation: 'fade-up .5s ease .65s both' }}
        >
          Your account is ready. Explore everything DrippleX has to offer.
        </p>
      </div>

      {/* Quick start cards */}
      <p
        className="px-6 pb-2 text-[11px] font-semibold uppercase tracking-widest"
        style={{ color: MUTED }}
      >
        Quick Start
      </p>
      <div className="mb-4 grid grid-cols-2 gap-3 px-6">
        {quickStart.map((qs, i) => (
          <div
            key={qs.label}
            role="button"
            tabIndex={0}
            onClick={() => onQuickStart?.(qs.key)}
            className="flex cursor-pointer flex-col gap-2 rounded-2xl p-4 transition-all active:scale-95"
            style={{
              background: NAVY_CARD,
              border: `1.5px solid ${BORDER}`,
              animation: `fade-up .4s ease ${0.1 + i * 0.08}s both`,
            }}
          >
            <span style={{ fontSize: 26 }}>{qs.icon}</span>
            <div>
              <p
                className="text-[12px] font-semibold leading-tight"
                style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
              >
                {qs.label}
              </p>
              <p className="mt-0.5 text-[10px]" style={{ color: MUTED }}>
                {qs.sub}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* AI Assistant card — taps into Home, where the Ask Drip assistant lives */}
      <div
        role="button"
        tabIndex={0}
        onClick={onHome}
        className="mx-6 mb-4 cursor-pointer rounded-2xl p-5 transition-all active:scale-[.98]"
        style={{
          background: `linear-gradient(135deg,rgba(43,172,82,.12) 0%,rgba(22,55,84,.6) 100%)`,
          border: `1.5px solid rgba(43,172,82,.22)`,
          animation: 'fade-up .4s ease .5s both',
        }}
      >
        <div className="mb-3 flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-2xl text-2xl"
            style={{ background: `linear-gradient(135deg,${G0},${G3})` }}
          >
            🤖
          </div>
          <div>
            <p
              className="text-[14px] font-semibold"
              style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
            >
              Meet Your DrippleX AI
            </p>
            <p className="text-[11px]" style={{ color: MUTED }}>
              Always ready to help you
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {aiCapabilities.map((c) => (
            <span
              key={c}
              className="rounded-full px-2.5 py-1 text-[10px] font-medium"
              style={{
                background: 'rgba(43,172,82,.12)',
                border: '1px solid rgba(43,172,82,.2)',
                color: G3,
              }}
            >
              {c}
            </span>
          ))}
        </div>
      </div>

      {/* CTAs */}
      <div className="px-6 pb-3" style={{ animation: 'fade-up .4s ease .6s both' }}>
        <GreenBtn label="Go to Home →" onClick={onHome} />
      </div>
      <div className="px-6 pb-10" style={{ animation: 'fade-up .4s ease .68s both' }}>
        <button
          onClick={onTour}
          className="flex h-[48px] w-full items-center justify-center gap-2 rounded-2xl text-[14px] font-medium transition-all active:scale-[.97]"
          style={{
            fontFamily: "'Poppins',sans-serif",
            color: MUTED,
            background: 'rgba(255,255,255,.03)',
            border: `1.5px solid ${BORDER}`,
          }}
        >
          🗺 Take a Quick Tour
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTH-023  LINKED ACCOUNTS
// ═══════════════════════════════════════════════════════════════════════════
export type LinkStatus = 'connected' | 'disconnected' | 'coming_soon';
interface LinkedAccount {
  id: string;
  icon: string;
  label: string;
  sub: string;
  status: LinkStatus;
}

export const LINKED_ACCOUNTS_DATA: LinkedAccount[] = [
  {
    id: 'phone',
    icon: '📱',
    label: 'Phone Number',
    // Filled from the signed-in user at render time (see buildLinkedAccounts).
    sub: 'Not connected',
    status: 'disconnected',
  },
  { id: 'email', icon: '📧', label: 'Email Address', sub: 'Not connected', status: 'disconnected' },
  { id: 'apple', icon: '🍎', label: 'Apple ID', sub: 'Not connected', status: 'disconnected' },
  {
    id: 'google',
    icon: '🤖',
    label: 'Google Account',
    sub: 'Not connected',
    status: 'disconnected',
  },
  {
    id: 'biz',
    icon: '💼',
    label: 'Business Account',
    sub: 'Merchant & enterprise access',
    status: 'coming_soon',
  },
  {
    id: 'gov',
    icon: '🏛',
    label: 'Gov. Digital ID',
    sub: 'NIN / BVN integration',
    status: 'coming_soon',
  },
];

// Seeds the phone/email rows from the REAL signed-in user instead of showing a
// hardcoded number as the customer's own primary identity.
function buildLinkedAccounts(): LinkedAccount[] {
  const user = auth.getUser();
  return LINKED_ACCOUNTS_DATA.map((row) => {
    if (row.id === 'phone' && user?.phone) {
      return { ...row, sub: `${user.phone} · Primary`, status: 'connected' as const };
    }
    if (row.id === 'email' && user?.email) {
      return { ...row, sub: user.email, status: 'connected' as const };
    }
    return row;
  });
}

export function LinkedAccountsScreen({ onBack }: { onBack: () => void }) {
  const [accounts, setAccounts] = useState(buildLinkedAccounts);
  const [saved, setSaved] = useState(false);
  const [sheet, setSheet] = useState<string | null>(null);

  const toggle = (id: string) => {
    setAccounts((a) =>
      a.map((x) =>
        x.id === id && x.status !== 'coming_soon'
          ? { ...x, status: x.status === 'connected' ? 'disconnected' : 'connected' }
          : x,
      ),
    );
    setSheet(null);
  };

  const save = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const statusStyle: Record<LinkStatus, { color: string; bg: string; label: string }> = {
    connected: { color: G3, bg: 'rgba(43,172,82,.12)', label: 'Connected' },
    disconnected: { color: MUTED, bg: 'rgba(255,255,255,.06)', label: 'Not Connected' },
    coming_soon: { color: '#FCD34D', bg: 'rgba(251,191,36,.1)', label: 'Coming Soon' },
  };

  const sheetAcc = accounts.find((a) => a.id === sheet);

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
            Linked Accounts
          </p>
          <p className="text-[11px]" style={{ color: MUTED }}>
            Connect accounts to expand your services
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
            Changes saved.
          </p>
        </div>
      )}

      <p
        className="px-6 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-widest"
        style={{ color: MUTED }}
      >
        Available Connections
      </p>

      {accounts.map((acc, i) => {
        const ss = statusStyle[acc.status];
        const isLast = i === accounts.length - 1;
        return (
          <div
            key={acc.id}
            className="mx-6 mb-3 flex items-center gap-3 rounded-2xl p-4"
            style={{
              background: NAVY_CARD,
              border: `1.5px solid ${acc.status === 'connected' ? G2 + '44' : BORDER}`,
            }}
          >
            <div
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-2xl"
              style={{
                background:
                  acc.status === 'connected' ? 'rgba(43,172,82,.15)' : 'rgba(255,255,255,.04)',
              }}
            >
              {acc.icon}
            </div>
            <div className="min-w-0 flex-1">
              <p
                className="truncate text-[14px] font-semibold"
                style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
              >
                {acc.label}
              </p>
              <p className="truncate text-[11px]" style={{ color: MUTED }}>
                {acc.sub}
              </p>
            </div>
            <div className="flex flex-shrink-0 items-center gap-2">
              <span
                className="rounded-full px-2 py-0.5 text-[9px] font-bold"
                style={{ background: ss.bg, color: ss.color }}
              >
                {ss.label}
              </span>
              {acc.status !== 'coming_soon' && acc.id !== 'phone' && (
                <button
                  onClick={() => setSheet(acc.id)}
                  className="h-[30px] rounded-xl px-3 text-[11px] font-semibold transition-all active:scale-95"
                  style={{
                    background:
                      acc.status === 'connected' ? 'rgba(248,113,113,.1)' : 'rgba(43,172,82,.1)',
                    border: `1px solid ${acc.status === 'connected' ? 'rgba(248,113,113,.25)' : 'rgba(43,172,82,.25)'}`,
                    color: acc.status === 'connected' ? '#F87171' : G3,
                  }}
                >
                  {acc.status === 'connected' ? 'Disconnect' : 'Connect'}
                </button>
              )}
              {acc.id === 'phone' && (
                <span
                  className="rounded-full px-2 py-0.5 text-[9px] font-bold"
                  style={{ background: G2, color: '#FFF' }}
                >
                  Primary
                </span>
              )}
            </div>
          </div>
        );
      })}

      {/* Security notice */}
      <div
        className="mx-6 mb-4 flex items-start gap-3 rounded-2xl p-4"
        style={{ background: 'rgba(251,191,36,.06)', border: '1px solid rgba(251,191,36,.18)' }}
      >
        <span style={{ fontSize: 16, marginTop: 1 }}>⚠️</span>
        <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,.55)' }}>
          Removing a linked account may reduce your available login options. Ensure at least one
          sign-in method remains active.
        </p>
      </div>

      <div className="px-6 pb-10">
        <GreenBtn label="Save Changes" onClick={save} />
      </div>

      {/* Confirm sheet */}
      {sheet && sheetAcc && (
        <div
          className="absolute inset-0 z-50 flex flex-col justify-end"
          style={{ background: 'rgba(0,0,0,.72)' }}
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
              className="mb-2 text-[17px] font-bold"
              style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
            >
              {sheetAcc.status === 'connected'
                ? `Disconnect ${sheetAcc.label}?`
                : `Connect ${sheetAcc.label}?`}
            </p>
            <p className="mb-5 text-[13px] leading-relaxed" style={{ color: MUTED }}>
              {sheetAcc.status === 'connected'
                ? 'This will remove this login option from your account. You can reconnect at any time.'
                : `You'll be redirected to authorize ${sheetAcc.label} access to your DrippleX account.`}
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
                onClick={() => toggle(sheet)}
                className="h-[46px] flex-1 rounded-2xl text-[14px] font-bold"
                style={{
                  background:
                    sheetAcc.status === 'connected'
                      ? 'rgba(248,113,113,.18)'
                      : 'rgba(43,172,82,.18)',
                  border: `1px solid ${sheetAcc.status === 'connected' ? 'rgba(248,113,113,.3)' : 'rgba(43,172,82,.3)'}`,
                  color: sheetAcc.status === 'connected' ? '#F87171' : G3,
                }}
              >
                {sheetAcc.status === 'connected' ? 'Disconnect' : 'Connect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTH-024  ACCOUNT VERIFICATION STATUS
// ═══════════════════════════════════════════════════════════════════════════
export function VerificationStatusScreen({
  onBack,
  onContinue,
}: {
  onBack: () => void;
  onContinue: () => void;
}) {
  // Real verification progress from the user record + real KYC status. No
  // hardcoded "Phone Verified ✓"; steps with no backend (address, trusted score)
  // are dropped rather than shown as pending forever.
  const user = auth.getUser();
  const [kycStatus, setKycStatus] = useState<string | null>(null);
  useEffect(() => {
    if (!auth.isLoggedIn()) return;
    api.kyc
      .get()
      .then((k) => setKycStatus(k.status))
      .catch(() => {});
  }, []);
  const phoneOnFile = !!user?.phone;
  const emailOnFile = !!user?.email;
  const profileDone = !!(user?.firstName && user?.lastName);
  const identityVerified = kycStatus === 'VERIFIED';

  const steps = [
    { label: 'Phone number added', done: phoneOnFile, icon: '📱' },
    { label: 'Profile completed', done: profileDone, icon: '👤' },
    { label: 'Email address added', done: emailOnFile, icon: '📧' },
    { label: 'Identity verified', done: identityVerified, icon: '🪪' },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);

  const benefits = [
    { icon: '💳', label: 'Wallet & payments', unlocked: true },
    { icon: '⚡', label: 'Faster support', unlocked: true },
    { icon: '🏦', label: 'Higher wallet limits', unlocked: identityVerified },
    { icon: '🏪', label: 'Full marketplace access', unlocked: identityVerified },
  ];

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
            Verification Status
          </p>
          <p className="text-[11px]" style={{ color: MUTED }}>
            Track your account verification progress
          </p>
        </div>
      </div>

      {/* Completion ring */}
      <div
        className="mx-6 my-3 flex items-center gap-5 rounded-3xl p-5"
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
              strokeDasharray={`${(2 * Math.PI * 34 * pct) / 100} ${2 * Math.PI * 34}`}
              strokeLinecap="round"
              transform="rotate(-90 40 40)"
              style={{ filter: `drop-shadow(0 0 6px ${G2})` }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className="text-[18px] font-bold"
              style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF', lineHeight: 1 }}
            >
              {pct}%
            </span>
            <span className="text-[9px]" style={{ color: G3 }}>
              Done
            </span>
          </div>
        </div>
        <div>
          <p
            className="mb-1 text-[16px] font-bold"
            style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
          >
            {pct < 50 ? 'Getting Started' : pct < 80 ? 'Good Progress' : 'Almost There!'}
          </p>
          <p className="text-[11px] leading-relaxed" style={{ color: MUTED }}>
            {doneCount} of {steps.length} steps complete. Continue to unlock all DrippleX features.
          </p>
        </div>
      </div>

      {/* Step tracker */}
      <p
        className="px-6 pb-2 text-[11px] font-semibold uppercase tracking-widest"
        style={{ color: MUTED }}
      >
        Verification Steps
      </p>
      <div
        className="mx-6 mb-4 rounded-2xl p-4"
        style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
      >
        {steps.map((step, i) => (
          <div key={step.label} className="mb-3 flex items-start gap-3 last:mb-0">
            <div className="flex flex-shrink-0 flex-col items-center">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-[14px]"
                style={{
                  background: step.done ? G2 : 'rgba(255,255,255,.06)',
                  border: `1.5px solid ${step.done ? G2 : BORDER}`,
                }}
              >
                {step.done ? '✓' : step.icon}
              </div>
              {i < steps.length - 1 && (
                <div
                  className="mt-1 w-0.5"
                  style={{ height: 16, background: step.done ? G2 : BORDER }}
                />
              )}
            </div>
            <div className="flex-1 pt-1">
              <div className="flex items-center justify-between">
                <p
                  className="text-[13px] font-medium"
                  style={{ color: step.done ? G3 : '#FFF', fontFamily: "'Inter',sans-serif" }}
                >
                  {step.label}
                </p>
                <span
                  className="rounded-full px-2 py-0.5 text-[9px] font-bold"
                  style={{
                    background: step.done ? 'rgba(43,172,82,.15)' : 'rgba(255,255,255,.06)',
                    color: step.done ? G3 : MUTED,
                  }}
                >
                  {step.done ? '✅ Done' : '⏳ Pending'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Benefits */}
      <p
        className="px-6 pb-2 text-[11px] font-semibold uppercase tracking-widest"
        style={{ color: MUTED }}
      >
        Verification Unlocks
      </p>
      <div
        className="mx-6 mb-4 rounded-2xl p-4"
        style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
      >
        <p className="mb-3 text-[12px]" style={{ color: MUTED }}>
          Complete verification to access all DrippleX services:
        </p>
        {benefits.map((b) => (
          <div key={b.label} className="mb-2.5 flex items-center gap-3 last:mb-0">
            <span style={{ fontSize: 18 }}>{b.icon}</span>
            <p
              className="flex-1 text-[13px]"
              style={{
                fontFamily: "'Inter',sans-serif",
                color: b.unlocked ? '#FFF' : 'rgba(255,255,255,.4)',
              }}
            >
              {b.label}
            </p>
            <span style={{ fontSize: 14 }}>{b.unlocked ? '✅' : '🔒'}</span>
          </div>
        ))}
      </div>

      <div className="px-6 pb-10">
        <GreenBtn label="Continue Verification" onClick={onContinue} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTH-025  EMERGENCY ACCOUNT PROTECTION
// ═══════════════════════════════════════════════════════════════════════════
export function EmergencyProtectionScreen({ onBack }: { onBack: () => void }) {
  const [activated, setActivated] = useState<string[]>([]);
  const [sheet, setSheet] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const actions = [
    {
      id: 'lock',
      icon: '🚨',
      label: 'Lock Account',
      sub: 'Temporarily disable all logins',
      color: '#F87171',
      bg: 'rgba(248,113,113,.08)',
      border: 'rgba(248,113,113,.22)',
    },
    {
      id: 'signout',
      icon: '📱',
      label: 'Sign Out All Devices',
      sub: 'End every active session immediately',
      color: '#FCD34D',
      bg: 'rgba(251,191,36,.07)',
      border: 'rgba(251,191,36,.2)',
    },
    {
      id: 'reset',
      icon: '🔑',
      label: 'Reset Authentication',
      sub: 'Require OTP + biometric on next login',
      color: '#60A5FA',
      bg: 'rgba(96,165,250,.07)',
      border: 'rgba(96,165,250,.18)',
    },
    {
      id: 'support',
      icon: '📞',
      label: 'Contact Security Team',
      sub: '24/7 emergency security support',
      color: G3,
      bg: 'rgba(43,172,82,.07)',
      border: 'rgba(43,172,82,.2)',
    },
  ];

  const activate = (id: string) => {
    setActivated((a) => [...a, id]);
    setSheet(null);
    if (id === 'lock') setTimeout(() => setDone(true), 400);
  };

  const sheetAction = actions.find((a) => a.id === sheet);

  if (done)
    return (
      <div
        className="flex h-full w-full flex-col items-center justify-center gap-5"
        style={{ background: '#060E1C' }}
      >
        <StatusBar />
        <div
          className="flex h-28 w-28 items-center justify-center rounded-full text-5xl"
          style={{ background: 'rgba(248,113,113,.1)', border: '2px solid rgba(248,113,113,.3)' }}
        >
          🔒
        </div>
        <div className="px-10 text-center">
          <p
            className="mb-2 text-[20px] font-bold"
            style={{ fontFamily: "'Poppins',sans-serif", color: '#F87171' }}
          >
            Account Locked
          </p>
          <p className="text-[13px] leading-relaxed" style={{ color: MUTED }}>
            All sessions have been terminated. Contact support to restore access.
          </p>
        </div>
        <button
          onClick={onBack}
          className="mt-2 h-[46px] rounded-2xl px-8 text-[14px] font-semibold"
          style={{
            background: 'rgba(255,255,255,.06)',
            border: `1px solid ${BORDER}`,
            color: MUTED,
          }}
        >
          Back to Safety
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
            Emergency Protection
          </p>
          <p className="text-[11px]" style={{ color: MUTED }}>
            Protect your account immediately
          </p>
        </div>
      </div>

      {/* Warning banner */}
      <div
        className="mx-6 my-3 flex items-start gap-3 rounded-2xl p-4"
        style={{ background: 'rgba(248,113,113,.07)', border: '1.5px solid rgba(248,113,113,.22)' }}
      >
        <span style={{ fontSize: 20 }}>⚠️</span>
        <p className="text-[12px] leading-relaxed" style={{ color: 'rgba(255,255,255,.65)' }}>
          <span className="font-semibold" style={{ color: '#F87171' }}>
            These actions affect every connected device.
          </span>{' '}
          Use only if you suspect unauthorized access or if your account has been compromised.
        </p>
      </div>

      <p
        className="px-6 pb-2 text-[11px] font-semibold uppercase tracking-widest"
        style={{ color: MUTED }}
      >
        Emergency Actions
      </p>

      {actions.map((act) => {
        const isActive = activated.includes(act.id);
        return (
          <div
            key={act.id}
            className="mx-6 mb-3 flex items-center gap-3 rounded-2xl p-4 transition-all"
            style={{
              background: isActive ? act.bg : NAVY_CARD,
              border: `1.5px solid ${isActive ? act.border : BORDER}`,
            }}
          >
            <div
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-2xl"
              style={{ background: act.bg, border: `1px solid ${act.border}` }}
            >
              {act.icon}
            </div>
            <div className="flex-1">
              <p
                className="text-[14px] font-semibold"
                style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
              >
                {act.label}
              </p>
              <p className="text-[11px]" style={{ color: MUTED }}>
                {act.sub}
              </p>
            </div>
            {isActive ? (
              <span
                className="rounded-full px-2 py-1 text-[11px] font-bold"
                style={{ background: act.bg, color: act.color }}
              >
                ✓ Active
              </span>
            ) : (
              <button
                onClick={() => setSheet(act.id)}
                className="h-[34px] rounded-xl px-3 text-[12px] font-semibold transition-all active:scale-95"
                style={{ background: act.bg, border: `1px solid ${act.border}`, color: act.color }}
              >
                Activate
              </button>
            )}
          </div>
        );
      })}

      <div className="mt-2 px-6 pb-10">
        <GreenBtn label="Activate Protection" onClick={() => setSheet('lock')} />
        <p className="mt-2 text-center text-[10px]" style={{ color: 'rgba(255,255,255,.25)' }}>
          Activating will immediately lock your account across all devices.
        </p>
      </div>

      {/* Confirm sheet */}
      {sheet && sheetAction && (
        <div
          className="absolute inset-0 z-50 flex flex-col justify-end"
          style={{ background: 'rgba(0,0,0,.75)' }}
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
            <div className="mb-5 text-center">
              <span style={{ fontSize: 36 }}>{sheetAction.icon}</span>
              <p
                className="mb-1 mt-2 text-[17px] font-bold"
                style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
              >
                {sheetAction.label}
              </p>
              <p className="text-[13px] leading-relaxed" style={{ color: MUTED }}>
                {sheetAction.sub}. Are you sure?
              </p>
            </div>
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
                onClick={() => activate(sheet!)}
                className="h-[46px] flex-1 rounded-2xl text-[14px] font-bold"
                style={{
                  background: sheetAction.bg,
                  border: `1px solid ${sheetAction.border}`,
                  color: sheetAction.color,
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTH-026  ACCOUNT ACTIVITY DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════

export type ActivityFilter = 'today' | 'week' | 'month' | 'custom';

export function ActivityDashboardScreen({ onBack }: { onBack: () => void }) {
  const [filter, setFilter] = useState<ActivityFilter>('week');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [notifLoading, setNotifLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const filters: { key: ActivityFilter; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'Last Week' },
    { key: 'month', label: 'Last Month' },
    { key: 'custom', label: 'Custom Range' },
  ];

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.notifications.list({ page: 1, limit: 50 });
      const items = (res as { items?: NotificationDto[] }).items ?? [];
      setNotifications(items);
    } catch {
      setNotifications([]);
    } finally {
      setNotifLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkRead = async (id: string) => {
    // Optimistic: stamp the same field the server will, so the row settles
    // read immediately and stays read when the list is refetched.
    const now = new Date().toISOString();
    setNotifications((ns) => ns.map((n) => (n.id === id ? { ...n, readAt: now } : n)));
    try {
      await api.notifications.markRead(id);
    } catch {}
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    const now = new Date().toISOString();
    setNotifications((ns) => ns.map((n) => ({ ...n, readAt: n.readAt ?? now })));
    try {
      await api.notifications.markAllRead();
    } catch {}
    setMarkingAll(false);
  };

  const unreadCount = notifications.filter((n) => n.readAt === null).length;

  const notifIconFor = (type: string) => {
    if (type.includes('RIDE') || type.includes('ride')) return '🚖';
    if (type.includes('WALLET') || type.includes('wallet') || type.includes('PAYMENT')) return '💳';
    if (type.includes('ORDER') || type.includes('order')) return '🛍';
    if (type.includes('SECURITY') || type.includes('security')) return '🔐';
    return '🔔';
  };

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
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
            Notifications
          </p>
          <p className="text-[11px]" style={{ color: MUTED }}>
            {notifLoading ? 'Loading…' : `${unreadCount} unread`}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            disabled={markingAll}
            className="h-[30px] rounded-full px-3 text-[11px] font-semibold transition-all"
            style={{
              background: 'rgba(43,172,82,.12)',
              border: `1px solid rgba(43,172,82,.3)`,
              color: G3,
              opacity: markingAll ? 0.5 : 1,
            }}
          >
            Mark all read
          </button>
        )}
      </div>

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

      {/* Notifications list */}
      {notifLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-[13px]" style={{ color: MUTED }}>
            Loading notifications…
          </p>
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-10">
          <span style={{ fontSize: 48 }}>🔔</span>
          <p
            className="text-center text-[15px] font-semibold"
            style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
          >
            No notifications
          </p>
          <p className="text-center text-[12px]" style={{ color: MUTED }}>
            {"You're all caught up!"}
          </p>
        </div>
      ) : (
        <>
          <p
            className="px-6 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-widest"
            style={{ color: MUTED }}
          >
            Recent
          </p>
          {notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => handleMarkRead(n.id)}
              className="mx-6 mb-3 flex w-[calc(100%-48px)] items-start gap-3 rounded-2xl p-4 text-left transition-all active:scale-[.98]"
              style={{
                background: n.readAt !== null ? NAVY_CARD : 'rgba(43,172,82,.07)',
                border: `1.5px solid ${n.readAt !== null ? BORDER : 'rgba(43,172,82,.25)'}`,
              }}
            >
              <div
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-xl"
                style={{
                  background: n.readAt !== null ? 'rgba(255,255,255,.05)' : 'rgba(43,172,82,.12)',
                }}
              >
                {notifIconFor(n.type)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex items-center gap-2">
                  <p
                    className="truncate text-[13px] font-semibold"
                    style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
                  >
                    {n.title}
                  </p>
                  {n.readAt === null && (
                    <div
                      className="h-2 w-2 flex-shrink-0 rounded-full"
                      style={{ background: G2 }}
                    />
                  )}
                </div>
                <p className="text-[11px] leading-relaxed" style={{ color: MUTED }}>
                  {n.body}
                </p>
                <p className="mt-1 text-[10px]" style={{ color: 'rgba(255,255,255,.3)' }}>
                  {timeAgo(n.createdAt)}
                </p>
              </div>
            </button>
          ))}
        </>
      )}

      <div className="pb-10" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTH-027  CONNECTED SERVICES
// ═══════════════════════════════════════════════════════════════════════════
export type ServiceStatus = 'active' | 'inactive' | 'coming_soon';

interface Service {
  id: string;
  icon: string;
  label: string;
  sub: string;
  status: ServiceStatus;
}

export const SERVICES: Service[] = [
  {
    id: 'marketplace',
    icon: '🛍',
    label: 'Marketplace',
    sub: 'Buy, sell, and discover products',
    status: 'active',
  },
  { id: 'ride', icon: '🚖', label: 'Ride', sub: 'Book safe, affordable rides', status: 'active' },
  {
    id: 'wallet',
    icon: '💳',
    label: 'Wallet',
    sub: 'Send, receive, and manage money',
    status: 'active',
  },
  {
    id: 'merchant',
    icon: '🏪',
    label: 'Merchant',
    sub: 'Sell to DrippleX customers',
    status: 'inactive',
  },
  {
    id: 'driver',
    icon: '🚗',
    label: 'Driver',
    sub: 'Earn by driving on DrippleX',
    status: 'inactive',
  },
  {
    id: 'ai',
    icon: '🤖',
    // GAP: no AI backend — was falsely 'active'; the assistant isn't available yet.
    label: 'AI Assistant',
    sub: 'Your smart DrippleX companion',
    status: 'coming_soon',
  },
  {
    id: 'property',
    icon: '🏠',
    label: 'Property',
    sub: 'Buy, sell, and rent properties',
    status: 'coming_soon',
  },
  {
    id: 'health',
    icon: '❤️',
    label: 'Healthcare',
    sub: 'Book appointments and consultations',
    status: 'coming_soon',
  },
  {
    id: 'edu',
    icon: '🎓',
    label: 'Education',
    sub: 'Courses, tutoring, and certifications',
    status: 'coming_soon',
  },
  {
    id: 'gov',
    icon: '🏛',
    label: 'Gov. Services',
    sub: 'NIN, WAEC, and official documents',
    status: 'coming_soon',
  },
];

export function ConnectedServicesScreen({ onBack }: { onBack: () => void }) {
  const [services, setServices] = useState(SERVICES);
  const active = services.filter((s) => s.status === 'active');
  const inactive = services.filter((s) => s.status === 'inactive');
  const coming = services.filter((s) => s.status === 'coming_soon');

  const toggle = (id: string) =>
    setServices((s) =>
      s.map((x) =>
        x.id === id && x.status !== 'coming_soon'
          ? { ...x, status: x.status === 'active' ? 'inactive' : 'active' }
          : x,
      ),
    );

  const statusStyle: Record<ServiceStatus, { color: string; bg: string; label: string }> = {
    active: { color: G3, bg: 'rgba(43,172,82,.12)', label: 'Active' },
    inactive: { color: MUTED, bg: 'rgba(255,255,255,.06)', label: 'Inactive' },
    coming_soon: { color: '#FCD34D', bg: 'rgba(251,191,36,.1)', label: 'Coming Soon' },
  };

  const Section = ({ title, items }: { title: string; items: Service[] }) => (
    <>
      <p
        className="px-6 pb-2 text-[11px] font-semibold uppercase tracking-widest"
        style={{ color: MUTED }}
      >
        {title}
      </p>
      {items.map((svc) => {
        const ss = statusStyle[svc.status];
        return (
          <div
            key={svc.id}
            className="mx-6 mb-3 flex items-center gap-3 rounded-2xl p-4"
            style={{
              background: NAVY_CARD,
              border: `1.5px solid ${svc.status === 'active' ? G2 + '33' : BORDER}`,
              opacity: svc.status === 'coming_soon' ? 0.7 : 1,
            }}
          >
            <div
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-2xl"
              style={{ background: ss.bg }}
            >
              {svc.icon}
            </div>
            <div className="min-w-0 flex-1">
              <p
                className="text-[14px] font-semibold"
                style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
              >
                {svc.label}
              </p>
              <p className="truncate text-[11px]" style={{ color: MUTED }}>
                {svc.sub}
              </p>
            </div>
            <div className="flex flex-shrink-0 items-center gap-2">
              {svc.status === 'coming_soon' ? (
                <span
                  className="rounded-full px-2 py-1 text-[9px] font-bold"
                  style={{ background: ss.bg, color: ss.color }}
                >
                  Soon
                </span>
              ) : (
                <>
                  <span
                    className="rounded-full px-2 py-0.5 text-[9px] font-bold"
                    style={{ background: ss.bg, color: ss.color }}
                  >
                    {ss.label}
                  </span>
                  <button
                    onClick={() => toggle(svc.id)}
                    className="relative h-6 w-11 rounded-full transition-all duration-300"
                    style={{ background: svc.status === 'active' ? G2 : 'rgba(255,255,255,.1)' }}
                  >
                    <div
                      className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all duration-300"
                      style={{ left: svc.status === 'active' ? 'calc(100% - 22px)' : 2 }}
                    />
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </>
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
            Connected Services
          </p>
          <p className="text-[11px]" style={{ color: MUTED }}>
            Manage services on your DrippleX account
          </p>
        </div>
      </div>

      {/* Stats strip */}
      <div className="mx-6 my-2 flex gap-3">
        {[
          { label: 'Active', value: active.length, color: G3 },
          { label: 'Inactive', value: inactive.length, color: MUTED },
          { label: 'Coming Soon', value: coming.length, color: '#FCD34D' },
        ].map((s) => (
          <div
            key={s.label}
            className="flex-1 rounded-2xl py-3 text-center"
            style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
          >
            <p
              className="text-[20px] font-bold"
              style={{ fontFamily: "'Poppins',sans-serif", color: s.color }}
            >
              {s.value}
            </p>
            <p className="text-[10px]" style={{ color: MUTED }}>
              {s.label}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-2">
        <Section title="Active Services" items={active} />
        <Section title="Available to Enable" items={inactive} />
        <Section title="Coming Soon" items={coming} />
      </div>

      <div className="mt-1 px-6 pb-10">
        <GreenBtn label="Manage Services" onClick={onBack} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTH-028  TRUST CENTER
// ═══════════════════════════════════════════════════════════════════════════
export function TrustCenterScreen({
  onBack,
  onSecurity,
  onAddEmail,
  onVerifyId,
}: {
  onBack: () => void;
  onSecurity: () => void;
  onAddEmail?: () => void;
  onVerifyId?: () => void;
}) {
  // Honest trust overview from REAL signals — no fabricated 96% / "biometrics
  // enabled" / fake login timestamps. 2FA, passkeys, trusted devices and login
  // history have no backend yet, so they are not shown as done/known.
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
  const checks = [phoneOnFile, emailOnFile, identityVerified];
  const score = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  const scoreLabel =
    score >= 100 ? 'Fully set up' : score >= 66 ? 'Well protected' : 'Getting started';

  const kycLabel =
    kycStatus === 'VERIFIED'
      ? 'Verified'
      : kycStatus === 'PENDING_REVIEW'
        ? 'In review'
        : kycStatus === 'REJECTED' || kycStatus === 'REQUIRES_RESUBMISSION'
          ? 'Action needed'
          : kycStatus === 'IN_PROGRESS'
            ? 'In progress'
            : kycStatus == null
              ? '—'
              : 'Not started';

  const trustIndicators = [
    { label: 'Phone number added', done: phoneOnFile },
    { label: 'Email address added', done: emailOnFile },
    { label: 'Identity verified', done: identityVerified },
  ];

  const insights = [
    { icon: '🖥️', label: 'Active sessions', value: sessionCount == null ? '—' : `${sessionCount}` },
    { icon: '🪪', label: 'Identity verification', value: kycLabel },
  ];

  const recommendations = [
    !emailOnFile && {
      icon: '📧',
      text: 'Add an email address to improve recovery options',
      action: 'Add Email',
      nav: onAddEmail,
    },
    !identityVerified && {
      icon: '🪪',
      text: 'Complete identity verification to unlock all services',
      action: 'Verify ID',
      nav: onVerifyId,
    },
  ].filter(Boolean) as { icon: string; text: string; action: string; nav?: () => void }[];

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
            Trust Center
          </p>
          <p className="text-[11px]" style={{ color: MUTED }}>
            Your account security and trust overview
          </p>
        </div>
      </div>

      {/* Trust score ring */}
      <div
        className="mx-6 mb-4 mt-2 flex items-center gap-5 rounded-3xl p-5"
        style={{
          background: `linear-gradient(135deg,${NAVY_CARD} 0%,rgba(43,172,82,.1) 100%)`,
          border: `1.5px solid rgba(43,172,82,.25)`,
        }}
      >
        <div className="relative flex-shrink-0" style={{ width: 86, height: 86 }}>
          <svg width="86" height="86" viewBox="0 0 86 86">
            <circle
              cx="43"
              cy="43"
              r="37"
              fill="none"
              stroke="rgba(255,255,255,.06)"
              strokeWidth="7"
            />
            <circle
              cx="43"
              cy="43"
              r="37"
              fill="none"
              stroke={G3}
              strokeWidth="7"
              strokeDasharray={`${(2 * Math.PI * 37 * score) / 100} ${2 * Math.PI * 37}`}
              strokeLinecap="round"
              transform="rotate(-90 43 43)"
              style={{ filter: `drop-shadow(0 0 8px ${G2})` }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className="text-[20px] font-bold"
              style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF', lineHeight: 1 }}
            >
              {score}%
            </span>
            <span className="text-[9px]" style={{ color: G3 }}>
              Trusted
            </span>
          </div>
        </div>
        <div className="flex-1">
          <p
            className="mb-1 text-[17px] font-bold"
            style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
          >
            {scoreLabel}
          </p>
          <p className="mb-2 text-[11px] leading-relaxed" style={{ color: MUTED }}>
            Based on your phone, email and identity verification. Complete the remaining steps to
            reach 100%.
          </p>
        </div>
      </div>

      {/* Trust indicators */}
      <p
        className="px-6 pb-2 text-[11px] font-semibold uppercase tracking-widest"
        style={{ color: MUTED }}
      >
        Trust Indicators
      </p>
      <div
        className="mx-6 mb-4 rounded-2xl p-4"
        style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
      >
        {trustIndicators.map((ind, i) => (
          <div
            key={ind.label}
            className={`flex items-center gap-3 ${i < trustIndicators.length - 1 ? 'mb-3' : ''}`}
          >
            <span style={{ fontSize: 16 }}>{ind.done ? '✅' : '⏳'}</span>
            <p
              className="flex-1 text-[13px]"
              style={{
                fontFamily: "'Inter',sans-serif",
                color: ind.done ? '#FFF' : 'rgba(255,255,255,.45)',
              }}
            >
              {ind.label}
            </p>
            {ind.done && <div className="h-2 w-2 rounded-full" style={{ background: G3 }} />}
          </div>
        ))}
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <>
          <p
            className="px-6 pb-2 text-[11px] font-semibold uppercase tracking-widest"
            style={{ color: MUTED }}
          >
            Recommendations
          </p>
          {recommendations.map((r) => (
            <div
              key={r.text}
              className="mx-6 mb-3 flex items-start gap-3 rounded-2xl p-4"
              style={{
                background: 'rgba(251,191,36,.06)',
                border: '1px solid rgba(251,191,36,.18)',
              }}
            >
              <span style={{ fontSize: 20 }}>{r.icon}</span>
              <p
                className="flex-1 text-[12px] leading-relaxed"
                style={{ color: 'rgba(255,255,255,.65)' }}
              >
                {r.text}
              </p>
              <button
                onClick={r.nav}
                className="flex-shrink-0 rounded-xl px-3 py-1.5 text-[11px] font-semibold"
                style={{ background: 'rgba(251,191,36,.12)', color: '#FCD34D' }}
              >
                {r.action}
              </button>
            </div>
          ))}
        </>
      )}

      {/* Security insights */}
      <p
        className="px-6 pb-2 text-[11px] font-semibold uppercase tracking-widest"
        style={{ color: MUTED }}
      >
        Security Insights
      </p>
      <div
        className="mx-6 mb-4 overflow-hidden rounded-2xl"
        style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
      >
        {insights.map((ins, i) => (
          <div
            key={ins.label}
            className="flex items-center gap-3 px-4 py-3"
            style={{ borderBottom: i < insights.length - 1 ? `1px solid ${BORDER}` : 'none' }}
          >
            <span style={{ fontSize: 16 }}>{ins.icon}</span>
            <p className="flex-1 text-[12px]" style={{ color: MUTED }}>
              {ins.label}
            </p>
            <p
              className="text-[12px] font-semibold"
              style={{ color: '#FFF', fontFamily: "'Inter',sans-serif" }}
            >
              {ins.value}
            </p>
          </div>
        ))}
      </div>

      {/* GAP: no AI / threat-monitoring backend exists — the previous "Security
          Assistant" card claimed live monitoring ("No threats detected") and an
          AI monologue that were entirely fake, so it was removed. */}

      {/* CTAs */}
      <div className="px-6 pb-3">
        <GreenBtn label="Go to Security Center" onClick={onSecurity} />
      </div>
      <div className="px-6 pb-10">
        <button
          onClick={onBack}
          className="flex h-[48px] w-full items-center justify-center rounded-2xl text-[14px] font-medium transition-all active:scale-[.97]"
          style={{
            fontFamily: "'Poppins',sans-serif",
            color: MUTED,
            background: 'rgba(255,255,255,.03)',
            border: `1.5px solid ${BORDER}`,
          }}
        >
          Return to Home
        </button>
      </div>
    </div>
  );
}

// ─── Shared: PIN pad ────────────────────────────────────────────────────────
export function PinDots({ filled, error }: { filled: number; error?: boolean }) {
  return (
    <div className="my-5 flex justify-center gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-4 w-4 rounded-full transition-all duration-200"
          style={{
            background: error ? '#F87171' : i < filled ? G2 : 'rgba(255,255,255,.15)',
            boxShadow: i < filled && !error ? `0 0 8px ${G2}99` : 'none',
            transform: i < filled ? 'scale(1.15)' : 'scale(1)',
          }}
        />
      ))}
    </div>
  );
}

export function PinPad({
  onDigit,
  onDelete,
}: {
  onDigit: (d: string) => void;
  onDelete: () => void;
}) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];
  return (
    <div className="grid grid-cols-3 gap-3 px-8">
      {keys.map((k, i) =>
        k === '' ? (
          <div key={i} />
        ) : (
          <button
            key={i}
            onClick={() => (k === '⌫' ? onDelete() : onDigit(k))}
            className="flex h-[60px] items-center justify-center rounded-2xl text-[22px] font-semibold transition-all active:scale-90"
            style={{
              fontFamily: "'Poppins',sans-serif",
              color: k === '⌫' ? MUTED : '#FFF',
              background: 'rgba(255,255,255,.06)',
              border: `1.5px solid ${BORDER}`,
            }}
          >
            {k}
          </button>
        ),
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
