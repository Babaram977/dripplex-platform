// ─── DrippleX Partner Onboarding ──────────────────────────────────────────────
// Figma-designed partner sign-up + document + pending-review screens, wired to the
// real backend (2026-08-10). Merchant / Driver / Rider self-register by EMAIL while
// the Termii SMS sender ID is pending (backend PORTAL_EMAIL_ACTIVATION). Each signup
// creates the account, then App routes to the shared OTP screen (email code →
// activate → portal login) and finally to the persona's pending-review state.
//
// Backend contract used (verified — no invented fields):
//   POST /auth/register/merchant | /driver | /rider   (PortalRegistrationDto:
//     firstName, lastName, email, password[strong]; phone required for driver/rider)
//   → email OTP handled by the shared OTPScreen (POST /auth/verify/email) + portal login.
//
// Documented gaps (NOT faked):
//   • Merchant business name/type are collected here but there is no registration
//     field / POST /merchant/business — the merchant sets them later in the merchant
//     dashboard (registration auto-creates the blank merchant profile).
//   • Driver document IMAGES need a file-upload/storage service that doesn't exist yet,
//     so DriverDocumentsScreen stays visual; the driver still creates the account and
//     lands in pending review. Wire uploads once storage ships.

import React, { useState, useRef, useEffect } from 'react';

import { api, ApiError, uploadFile } from '../lib/api';
import type { MerchantCategory } from '../lib/api';
import { auth } from '../lib/auth';

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
  StatusBar,
  BackBtn,
  GreenBtn,
  ArrowIcon,
  Ambient,
  Logo,
} from './shared';

// ─── Local constants ──────────────────────────────────────────────────────────
const PP = "'Poppins',sans-serif";
const IT = "'Inter',sans-serif";
const GG = `linear-gradient(135deg,${G0} 0%,${G2} 52%,${G3} 100%)`;
const BG = `linear-gradient(155deg,${NAVY_DEEP} 0%,${NAVY_BASE} 55%,#0B1D2F 100%)`;

export type PartnerPersona = 'merchant' | 'driver' | 'rider' | 'fleet';

// Split a "Full Name" field into the backend's required firstName + lastName.
function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] ?? '';
  const lastName = parts.length > 1 ? parts.slice(1).join(' ') : firstName;
  return { firstName, lastName };
}

// Local Nigerian number → E.164 (+234…), matching the +234 prefix shown in the UI.
function toE164(local: string): string {
  const digits = local.replace(/\D/g, '').replace(/^0/, '');
  return `+234${digits}`;
}

function messageFor(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 409)
      return 'This email or phone is already registered. Please sign in instead.';
    return e.message || 'Something went wrong. Please try again.';
  }
  return 'Network error. Please check your connection and try again.';
}

// ─── Shared field primitives ──────────────────────────────────────────────────
function FieldLabel({ children }: { children: string }) {
  return (
    <p
      className="text-[11px] font-medium uppercase tracking-widest"
      style={{ fontFamily: IT, color: 'rgba(255,255,255,.32)' }}
    >
      {children}
    </p>
  );
}

function TextInput({
  id,
  type = 'text',
  placeholder,
  value,
  onChange,
  suffix,
  focused,
  onFocus,
  onBlur,
}: {
  id: string;
  type?: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  suffix?: React.ReactNode;
  focused: string | null;
  onFocus: (id: string) => void;
  onBlur: () => void;
}) {
  const isFocused = focused === id;
  return (
    <div
      className="flex h-[56px] min-w-0 items-center gap-3 rounded-2xl px-4 transition-all duration-200"
      style={{
        background: 'rgba(255,255,255,.045)',
        border: `1.5px solid ${isFocused ? G2 : BORDER}`,
        boxShadow: isFocused ? '0 0 0 3px rgba(43,172,82,.12)' : 'none',
      }}
    >
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => onFocus(id)}
        onBlur={onBlur}
        className="w-full min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none"
        style={{ fontFamily: IT, caretColor: G3 }}
      />
      {suffix}
    </div>
  );
}

function FieldGroup({
  label,
  id,
  type = 'text',
  placeholder,
  value,
  onChange,
  focused,
  onFocus,
  onBlur,
  helper,
  suffix,
}: {
  label: string;
  id: string;
  type?: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  focused: string | null;
  onFocus: (id: string) => void;
  onBlur: () => void;
  helper?: React.ReactNode;
  suffix?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <FieldLabel>{label}</FieldLabel>
      <TextInput
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        focused={focused}
        onFocus={onFocus}
        onBlur={onBlur}
        suffix={suffix}
      />
      {helper}
    </div>
  );
}

function PasswordHelper() {
  return (
    <div className="flex items-start gap-2 px-1">
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke={G2}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mt-0.5 shrink-0"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4m0 4h.01" />
      </svg>
      <p
        className="text-[12px] leading-snug"
        style={{ fontFamily: IT, color: 'rgba(255,255,255,.34)' }}
      >
        At least 8 characters, with an uppercase letter and a number
      </p>
    </div>
  );
}

function PasswordField({
  value,
  onChange,
  focused,
  onFocus,
  onBlur,
}: {
  value: string;
  onChange: (v: string) => void;
  focused: string | null;
  onFocus: (id: string) => void;
  onBlur: () => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <FieldLabel>Password</FieldLabel>
      <TextInput
        id="password"
        type={show ? 'text' : 'password'}
        placeholder="Create a password"
        value={value}
        onChange={onChange}
        focused={focused}
        onFocus={onFocus}
        onBlur={onBlur}
        suffix={
          <button
            onClick={() => setShow((s) => !s)}
            className="shrink-0 opacity-40 transition-opacity hover:opacity-80"
          >
            {show ? (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        }
      />
      <PasswordHelper />
    </div>
  );
}

/**
 * A select that opens a panel beneath itself.
 *
 * The panel carries `z-50` and that was not enough, for a reason worth writing
 * down. Every card on these screens animates in with
 * `fade-up … both`, and `animation-fill-mode: both` leaves the final keyframe
 * applied forever — including `transform: translateY(0)`. A transform creates a
 * stacking context, so each animated card became one, and the panel's z-50
 * could only ever stack *within its own card*. Against the submit button in the
 * next card — a sibling stacking context, later in the DOM — it always lost.
 *
 * On the merchant sign-up that put "Create merchant account" on top of the open
 * list: the option under it looked visible but every tap hit the button, so
 * "Pharmacy & Health" could not be selected at all.
 *
 * Fixed at the cause: those animations now use `backwards`, which holds the
 * opening frame through the delay and then lets the element fall back to its
 * natural state. The end state and the natural state are identical here
 * (opacity 1, no transform), so nothing looks different — but the stacking
 * context goes away once the animation ends, and z-50 means what it says.
 */
function Dropdown({
  id,
  label,
  placeholder,
  value,
  onChange,
  options,
  focused,
  onFocus,
  onBlur,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  focused: string | null;
  onFocus: (id: string) => void;
  onBlur: () => void;
}) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  // The Business Type field sits low on the sign-up form, so even a capped
  // panel opens past the bottom of a phone screen and the lower options are
  // unreachable without scrolling the page behind it. Bring the panel into
  // view when it opens.
  useEffect(() => {
    if (open) {
      const t = setTimeout(
        () => panelRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }),
        30,
      );
      return () => clearTimeout(t);
    }
    return undefined;
  }, [open]);
  const isFocused = focused === id;
  return (
    <div className="relative flex flex-col gap-2">
      <FieldLabel>{label}</FieldLabel>
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          open ? onBlur() : onFocus(id);
        }}
        className="flex h-[56px] w-full items-center gap-3 rounded-2xl px-4 text-left transition-all duration-200"
        style={{
          background: 'rgba(255,255,255,.045)',
          border: `1.5px solid ${isFocused || open ? G2 : BORDER}`,
          boxShadow: isFocused || open ? '0 0 0 3px rgba(43,172,82,.12)' : 'none',
          fontFamily: IT,
        }}
      >
        <span
          className="flex-1 text-[15px]"
          style={{ color: value ? '#fff' : 'rgba(255,255,255,.28)' }}
        >
          {value || placeholder}
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke={MUTED}
          strokeWidth="2"
          strokeLinecap="round"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div
          ref={panelRef}
          className="dx-scroll absolute left-0 right-0 z-50 overflow-y-auto rounded-2xl"
          style={{
            top: 'calc(100% + 6px)',
            // Twelve business types ran past the bottom of a phone screen, so
            // the last few could only be reached by scrolling the page behind
            // the panel. The list scrolls inside itself instead.
            maxHeight: 260,
            background: NAVY_SURFACE,
            border: `1.5px solid ${G2}`,
            boxShadow: '0 16px 40px rgba(0,0,0,.55)',
            overscrollBehavior: 'contain',
          }}
        >
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                onChange(opt);
                setOpen(false);
                onBlur();
              }}
              className="w-full px-4 py-3 text-left text-[15px] transition-colors"
              style={{
                fontFamily: IT,
                color: value === opt ? G3 : 'rgba(255,255,255,.8)',
                background: value === opt ? 'rgba(43,172,82,.08)' : 'transparent',
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ErrorNote({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div
      className="flex items-start gap-2 rounded-2xl px-4 py-3"
      style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.22)' }}
    >
      <span className="text-[13px]">⚠️</span>
      <p className="text-[13px] leading-snug" style={{ fontFamily: IT, color: '#FCA5A5' }}>
        {message}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN 1 — PARTNER CHOICE
// ─────────────────────────────────────────────────────────────────────────────
const ROLES: {
  persona: PartnerPersona;
  icon: string;
  title: string;
  copy: string;
  accent: string;
  bg: string;
}[] = [
  {
    persona: 'merchant',
    icon: '🛍',
    title: 'Sell on DrippleX',
    copy: 'List your products and reach thousands of local shoppers',
    accent: '#F97316',
    bg: 'linear-gradient(135deg,rgba(124,45,12,.55),rgba(249,115,22,.18))',
  },
  {
    persona: 'driver',
    icon: '🚗',
    title: 'Drive & earn',
    copy: 'Set your own hours and earn on every trip you complete',
    accent: '#3B82F6',
    bg: 'linear-gradient(135deg,rgba(30,58,138,.55),rgba(59,130,246,.18))',
  },
  {
    persona: 'rider',
    icon: '🚴',
    title: 'Deliver & earn',
    copy: 'Make deliveries on your schedule, at your own pace',
    accent: G2,
    bg: 'linear-gradient(135deg,rgba(23,107,48,.55),rgba(43,172,82,.18))',
  },
  // DPX-FLEET, founder decision 2026-08-30: fleet owners register themselves
  // online rather than being created by Operations. Same card as the other
  // three — a fleet is another way to partner with DrippleX, not a new kind of
  // thing needing its own visual language.
  {
    persona: 'fleet',
    icon: '🏢',
    title: 'Register your fleet',
    copy: 'Run your riders and drivers on DrippleX and watch them work',
    accent: '#A855F7',
    bg: 'linear-gradient(135deg,rgba(76,29,149,.55),rgba(168,85,247,.18))',
  },
];

export function PartnerChoiceScreen({
  onSelect,
  onSignIn,
  onBack,
  partnerStats,
}: {
  onSelect: (p: PartnerPersona) => void;
  onSignIn: () => void;
  // Shown only when the hub is reached from somewhere it can return to (e.g. the
  // Home "Become a Partner" card). Omitted on the pre-auth onboarding flow.
  onBack?: () => void;
  // Optional live partner counts (from the API); the stats strip is hidden when
  // absent rather than showing zeros.
  partnerStats?: { merchant?: number; driver?: number; rider?: number };
}) {
  const [pressed, setPressed] = useState<PartnerPersona | null>(null);

  const handleTap = (p: PartnerPersona) => {
    setPressed(p);
    setTimeout(() => {
      setPressed(null);
      onSelect(p);
    }, 160);
  };

  const statItems = partnerStats
    ? ([
        { label: 'Merchants', value: partnerStats.merchant },
        { label: 'Drivers', value: partnerStats.driver },
        { label: 'Riders', value: partnerStats.rider },
      ].filter((s) => typeof s.value === 'number') as { label: string; value: number }[])
    : [];

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{ background: BG }}
    >
      <Ambient />
      <StatusBar />

      <div
        className="relative z-10 flex flex-1 flex-col gap-7 overflow-y-auto px-7 pt-6"
        style={{ scrollbarWidth: 'none' }}
      >
        {onBack && (
          <button
            onClick={onBack}
            className="absolute left-6 top-5 z-20 flex h-9 w-9 items-center justify-center rounded-full transition-opacity active:opacity-70"
            style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
            aria-label="Back"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}
        <div style={{ animation: 'fade-up .45s ease backwards', marginTop: onBack ? 40 : 0 }}>
          <Logo width={140} />
          <h1
            className="mt-5 text-[26px] font-bold leading-tight"
            style={{ fontFamily: PP, color: '#fff', letterSpacing: '-0.02em' }}
          >
            Join DrippleX
            <br />
            as a partner
          </h1>
          <p className="mt-1.5 text-[14px]" style={{ fontFamily: IT, color: MUTED }}>
            Choose how you want to grow with us
          </p>
          {statItems.length > 0 && (
            <div className="mt-4 flex gap-2.5">
              {statItems.map((s) => (
                <div
                  key={s.label}
                  className="flex flex-1 flex-col items-center rounded-2xl py-2.5"
                  style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
                >
                  <span className="text-[16px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
                    {s.value.toLocaleString()}
                  </span>
                  <span className="text-[11px]" style={{ fontFamily: IT, color: MUTED }}>
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          className="flex flex-col gap-3.5"
          style={{ animation: 'fade-up .45s ease .1s backwards' }}
        >
          {ROLES.map((r) => (
            <button
              key={r.persona}
              onClick={() => handleTap(r.persona)}
              className="relative flex w-full items-center gap-4 overflow-hidden rounded-3xl p-5 text-left transition-all duration-150"
              style={{
                background: NAVY_CARD,
                border: `1.5px solid ${pressed === r.persona ? r.accent : BORDER}`,
                boxShadow:
                  pressed === r.persona
                    ? `0 0 0 3px ${r.accent}22, 0 8px 32px rgba(0,0,0,.3)`
                    : '0 2px 12px rgba(0,0,0,.22)',
                transform: pressed === r.persona ? 'scale(0.975)' : 'scale(1)',
              }}
            >
              <div
                className="pointer-events-none absolute inset-0"
                style={{ background: r.bg, opacity: 0.9 }}
              />
              <div
                className="relative z-10 flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl text-3xl"
                style={{ background: `${r.accent}18`, border: `1px solid ${r.accent}30` }}
              >
                {r.icon}
              </div>
              <div className="relative z-10 min-w-0 flex-1">
                <p className="text-[17px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
                  {r.title}
                </p>
                <p
                  className="mt-0.5 text-[13px] leading-snug"
                  style={{ fontFamily: IT, color: 'rgba(255,255,255,.5)' }}
                >
                  {r.copy}
                </p>
              </div>
              <div
                className="relative z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl"
                style={{ background: `${r.accent}18` }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={r.accent}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </div>
            </button>
          ))}
        </div>

        <div className="pb-10" style={{ animation: 'fade-up .45s ease .2s backwards' }}>
          <p className="text-center text-[14px]" style={{ fontFamily: IT, color: MUTED }}>
            Already a partner?{' '}
            <button
              onClick={onSignIn}
              className="font-semibold underline underline-offset-2 transition-opacity active:opacity-70"
              style={{ color: G3 }}
            >
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

// Alias for newer call-sites that refer to the partner hub as PartnerHub.
export const PartnerHub = PartnerChoiceScreen;

// The payload each signup hands to App for the shared OTP → login handoff.
export type PartnerSignupResult = { email: string; password: string };
// Merchant carries the extra business fields it collected, so the post-login
// Business Details step can pre-fill them before persisting via PATCH /merchant/business.
export type MerchantSignupResult = PartnerSignupResult & {
  businessName: string;
  /** The real enum value, null if somehow unselected. Not the display label:
   *  a label cannot be stored, and storing nothing is what left every merchant
   *  registered through this flow uncategorised. */
  category: MerchantCategory | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN 2 — MERCHANT SIGN-UP (wired: POST /auth/register/merchant)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * What the merchant sells, with the real `MerchantCategory` value attached.
 *
 * These used to be bare label strings, and the label was the only thing that
 * survived: it was passed along to Business Details and written into the
 * business *description*, while `Business.category` — a column the backend has
 * accepted on create and update all along — was left null.
 *
 * The consequence was silent and total. An uncategorised business appears only
 * under "All" in the marketplace, never under its own filter; and a hotel is
 * recognised as a hotel by `category === 'HOTEL'` and nothing else, so its
 * store page rendered the empty product grid instead of its rooms. A hotel
 * could register perfectly and still be unbookable, with no error anywhere.
 *
 * Same defect, same fix as the marketplace category chips, which carried
 * labels into a name search until they were made to carry the enum.
 */
const BIZ_TYPES: { label: string; category: MerchantCategory }[] = [
  { label: 'Restaurant & Food', category: 'RESTAURANT' },
  { label: 'Supermarket / Grocery', category: 'SUPERMARKET' },
  { label: 'Pharmacy & Health', category: 'PHARMACY' },
  { label: 'Fashion & Clothing', category: 'FASHION' },
  { label: 'Electronics', category: 'ELECTRONICS' },
  { label: 'Beauty & Cosmetics', category: 'BEAUTY' },
  { label: 'Hardware & Tools', category: 'HARDWARE' },
  { label: 'Furniture & Home', category: 'FURNITURE' },
  { label: 'Hotels & Hospitality', category: 'HOTEL' },
  { label: 'Wholesale / B2B', category: 'WHOLESALE' },
  { label: 'Professional Services', category: 'SERVICES' },
  { label: 'Other', category: 'OTHER' },
];

/** The label shown in the dropdown → the value the backend stores. */
export function categoryForBusinessTypeLabel(label: string): MerchantCategory | null {
  return BIZ_TYPES.find((b) => b.label === label)?.category ?? null;
}

export function MerchantSignUpScreen({
  onBack,
  onNext,
  onSignIn,
}: {
  onBack: () => void;
  onNext: (r: MerchantSignupResult) => void;
  onSignIn: () => void;
}) {
  const [form, setForm] = useState({ name: '', email: '', password: '', biz: '', type: '' });
  const [focused, setFocused] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const ready =
    form.name.trim().length >= 2 &&
    form.email.includes('@') &&
    form.password.length >= 8 &&
    form.biz.length >= 2 &&
    form.type.length > 0;

  const handleSubmit = async () => {
    setErr('');
    setLoading(true);
    try {
      const { firstName, lastName } = splitName(form.name);
      const email = form.email.trim().toLowerCase();
      // Business name/type are captured for the merchant's records but there is
      // no registration field for them; the merchant sets them in the dashboard
      // after approval (registration auto-creates the blank merchant profile).
      await api.auth.registerMerchant({ firstName, lastName, email, password: form.password });
      onNext({
        email,
        password: form.password,
        businessName: form.biz,
        category: categoryForBusinessTypeLabel(form.type),
      });
    } catch (e) {
      setErr(messageFor(e));
      setLoading(false);
    }
  };

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{ background: BG }}
    >
      <Ambient />
      <StatusBar />
      <div className="relative z-10 px-6 pt-3">
        <BackBtn onPress={onBack} />
      </div>

      <div
        className="relative z-10 flex-1 overflow-y-auto px-7 pb-10"
        style={{ scrollbarWidth: 'none' }}
      >
        <div style={{ animation: 'fade-up .4s ease .05s backwards' }}>
          <div className="mb-1 flex items-center gap-2">
            <span className="text-2xl">🛍</span>
            <span
              className="rounded-full px-2.5 py-1 text-[12px] font-semibold"
              style={{
                background: 'rgba(249,115,22,.12)',
                color: '#FB923C',
                fontFamily: IT,
                border: '1px solid rgba(249,115,22,.22)',
              }}
            >
              Merchant
            </span>
          </div>
          <h1
            className="mt-3 text-[26px] font-bold leading-tight"
            style={{ fontFamily: PP, color: '#fff', letterSpacing: '-0.02em' }}
          >
            Create your
            <br />
            merchant account
          </h1>
          <p className="mt-1.5 text-[14px]" style={{ fontFamily: IT, color: MUTED }}>
            Start selling to thousands of DrippleX shoppers
          </p>
        </div>

        <div
          className="mt-7 flex flex-col gap-4"
          style={{ animation: 'fade-up .4s ease .12s backwards' }}
        >
          <FieldGroup
            label="Full Name"
            id="name"
            placeholder="Type your full name"
            value={form.name}
            onChange={set('name')}
            focused={focused}
            onFocus={setFocused}
            onBlur={() => setFocused(null)}
          />
          <FieldGroup
            label="Email address"
            id="email"
            type="email"
            placeholder="Type your email address"
            value={form.email}
            onChange={set('email')}
            focused={focused}
            onFocus={setFocused}
            onBlur={() => setFocused(null)}
          />
          <PasswordField
            value={form.password}
            onChange={set('password')}
            focused={focused}
            onFocus={setFocused}
            onBlur={() => setFocused(null)}
          />
          <FieldGroup
            label="Business Name"
            id="biz"
            placeholder="Type your business name"
            value={form.biz}
            onChange={set('biz')}
            focused={focused}
            onFocus={setFocused}
            onBlur={() => setFocused(null)}
          />
          <Dropdown
            id="type"
            label="Business Type"
            placeholder="Select a category"
            value={form.type}
            onChange={set('type')}
            options={BIZ_TYPES.map((b) => b.label)}
            focused={focused}
            onFocus={setFocused}
            onBlur={() => setFocused(null)}
          />
        </div>

        <div
          className="mt-8 flex flex-col gap-4"
          style={{ animation: 'fade-up .4s ease .2s backwards' }}
        >
          <ErrorNote message={err} />
          <GreenBtn
            label="Create merchant account"
            disabled={!ready}
            loading={loading}
            onClick={handleSubmit}
            icon={<ArrowIcon />}
          />
          <p className="text-center text-[14px]" style={{ fontFamily: IT, color: MUTED }}>
            Already a partner?{' '}
            <button
              onClick={onSignIn}
              className="font-semibold underline underline-offset-2 transition-opacity active:opacity-70"
              style={{ color: G3 }}
            >
              Sign in
            </button>
          </p>
          <p
            className="mt-1 text-center text-[11px]"
            style={{ fontFamily: IT, color: 'rgba(255,255,255,.22)' }}
          >
            By continuing you agree to our{' '}
            <span
              className="underline underline-offset-2"
              style={{ color: 'rgba(255,255,255,.4)' }}
            >
              Terms
            </span>
            {' & '}
            <span
              className="underline underline-offset-2"
              style={{ color: 'rgba(255,255,255,.4)' }}
            >
              Privacy Policy
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN 3 — DRIVER SIGN-UP (wired: POST /auth/register/driver)
// ─────────────────────────────────────────────────────────────────────────────
function PhonePersonaSignUp({
  persona,
  badge,
  badgeColors,
  emoji,
  title,
  subtitle,
  ctaLabel,
  agreementLabel,
  namePlaceholder,
  emailPlaceholder,
  phonePlaceholder,
  register,
  onBack,
  onNext,
  onSignIn,
}: {
  persona: PartnerPersona;
  badge: string;
  badgeColors: { bg: string; color: string; border: string };
  emoji: string;
  title: React.ReactNode;
  subtitle: string;
  ctaLabel: string;
  agreementLabel: string;
  namePlaceholder: string;
  emailPlaceholder: string;
  phonePlaceholder: string;
  register: (body: Record<string, unknown>) => Promise<unknown>;
  onBack: () => void;
  onNext: (r: PartnerSignupResult) => void;
  onSignIn: () => void;
}) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [focused, setFocused] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const ready =
    form.name.trim().length >= 2 &&
    form.email.includes('@') &&
    form.phone.replace(/\D/g, '').length >= 7 &&
    form.password.length >= 8;

  const handleSubmit = async () => {
    setErr('');
    setLoading(true);
    try {
      const { firstName, lastName } = splitName(form.name);
      const email = form.email.trim().toLowerCase();
      await register({
        firstName,
        lastName,
        email,
        phone: toE164(form.phone),
        password: form.password,
      });
      onNext({ email, password: form.password });
    } catch (e) {
      setErr(messageFor(e));
      setLoading(false);
    }
  };

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{ background: BG }}
    >
      <Ambient />
      <StatusBar />
      <div className="relative z-10 px-6 pt-3">
        <BackBtn onPress={onBack} />
      </div>

      <div
        className="relative z-10 flex-1 overflow-y-auto px-7 pb-10"
        style={{ scrollbarWidth: 'none' }}
      >
        <div style={{ animation: 'fade-up .4s ease .05s backwards' }}>
          <div className="mb-1 flex items-center gap-2">
            <span className="text-2xl">{emoji}</span>
            <span
              className="rounded-full px-2.5 py-1 text-[12px] font-semibold"
              style={{
                background: badgeColors.bg,
                color: badgeColors.color,
                fontFamily: IT,
                border: `1px solid ${badgeColors.border}`,
              }}
            >
              {badge}
            </span>
          </div>
          <h1
            className="mt-3 text-[26px] font-bold leading-tight"
            style={{ fontFamily: PP, color: '#fff', letterSpacing: '-0.02em' }}
          >
            {title}
          </h1>
          <p className="mt-1.5 text-[14px]" style={{ fontFamily: IT, color: MUTED }}>
            {subtitle}
          </p>
        </div>

        <div
          className="mt-7 flex flex-col gap-4"
          style={{ animation: 'fade-up .4s ease .12s backwards' }}
        >
          <FieldGroup
            label="Full Name"
            id="name"
            placeholder={namePlaceholder}
            value={form.name}
            onChange={set('name')}
            focused={focused}
            onFocus={setFocused}
            onBlur={() => setFocused(null)}
          />
          <FieldGroup
            label="Email address"
            id="email"
            type="email"
            placeholder={emailPlaceholder}
            value={form.email}
            onChange={set('email')}
            focused={focused}
            onFocus={setFocused}
            onBlur={() => setFocused(null)}
          />
          <div className="flex flex-col gap-2">
            <FieldLabel>Phone Number</FieldLabel>
            <div
              className="flex h-[56px] items-center gap-3 rounded-2xl px-4 transition-all duration-200"
              style={{
                background: 'rgba(255,255,255,.045)',
                border: `1.5px solid ${focused === 'phone' ? G2 : BORDER}`,
                boxShadow: focused === 'phone' ? '0 0 0 3px rgba(43,172,82,.12)' : 'none',
              }}
            >
              <div
                className="flex shrink-0 items-center gap-2 pr-3"
                style={{ borderRight: `1px solid ${BORDER}` }}
              >
                <span className="text-base">🇳🇬</span>
                <span
                  className="text-[14px]"
                  style={{ fontFamily: IT, color: 'rgba(255,255,255,.5)' }}
                >
                  +234
                </span>
              </div>
              <input
                type="tel"
                placeholder={phonePlaceholder}
                value={form.phone}
                onChange={(e) => set('phone')(e.target.value)}
                onFocus={() => setFocused('phone')}
                onBlur={() => setFocused(null)}
                className="flex-1 bg-transparent text-[15px] text-white outline-none"
                style={{ fontFamily: IT }}
              />
            </div>
          </div>
          <PasswordField
            value={form.password}
            onChange={set('password')}
            focused={focused}
            onFocus={setFocused}
            onBlur={() => setFocused(null)}
          />
        </div>

        <div
          className="mt-8 flex flex-col gap-4"
          style={{ animation: 'fade-up .4s ease .2s backwards' }}
        >
          <ErrorNote message={err} />
          <GreenBtn
            label={ctaLabel}
            disabled={!ready}
            loading={loading}
            onClick={handleSubmit}
            icon={<ArrowIcon />}
          />
          <p className="text-center text-[14px]" style={{ fontFamily: IT, color: MUTED }}>
            Already a partner?{' '}
            <button
              onClick={onSignIn}
              className="font-semibold underline underline-offset-2 transition-opacity active:opacity-70"
              style={{ color: G3 }}
            >
              Sign in
            </button>
          </p>
          <p
            className="mt-1 text-center text-[11px]"
            style={{ fontFamily: IT, color: 'rgba(255,255,255,.22)' }}
          >
            By applying you agree to our{' '}
            <span
              className="underline underline-offset-2"
              style={{ color: 'rgba(255,255,255,.4)' }}
            >
              {agreementLabel}
            </span>
            {' & '}
            <span
              className="underline underline-offset-2"
              style={{ color: 'rgba(255,255,255,.4)' }}
            >
              Privacy Policy
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

export function DriverSignUpScreen(props: {
  onBack: () => void;
  onNext: (r: PartnerSignupResult) => void;
  onSignIn: () => void;
}) {
  return (
    <PhonePersonaSignUp
      persona="driver"
      badge="Driver"
      badgeColors={{ bg: 'rgba(59,130,246,.12)', color: '#60A5FA', border: 'rgba(59,130,246,.22)' }}
      emoji="🚗"
      title={
        <>
          Apply to drive
          <br />
          with DrippleX
        </>
      }
      subtitle="Earn on your schedule — complete the form to get started"
      ctaLabel="Apply to drive"
      agreementLabel="Driver Agreement"
      namePlaceholder="Type your full name"
      emailPlaceholder="Type your email address"
      phonePlaceholder="Type your phone number"
      register={api.auth.registerDriver}
      {...props}
    />
  );
}

export function RiderSignUpScreen(props: {
  onBack: () => void;
  onNext: (r: PartnerSignupResult) => void;
  onSignIn: () => void;
}) {
  return (
    <PhonePersonaSignUp
      persona="rider"
      badge="Rider"
      badgeColors={{ bg: 'rgba(71,207,114,.12)', color: G3, border: 'rgba(71,207,114,.22)' }}
      emoji="🚴"
      title={
        <>
          Apply to deliver
          <br />
          with DrippleX
        </>
      }
      subtitle="Make deliveries on your schedule, earn every day"
      ctaLabel="Apply to deliver"
      agreementLabel="Rider Agreement"
      namePlaceholder="Type your full name"
      emailPlaceholder="Type your email address"
      phonePlaceholder="Type your phone number"
      register={api.auth.registerRider}
      {...props}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN — REGISTER A FLEET
//
// DPX-FLEET, founder decision 2026-08-30: "The two clients needing fleet
// registration will go online and register themselves then the system should
// issue a dx fleet number for them which their riders and drivers will use at
// onboarding process."
//
// Two things this screen has to get right:
//
//   The DX number is the deliverable. The owner does not leave here with a
//   "thanks, we'll be in touch" — they leave with the number they are going to
//   read out to fifteen riders. So it is shown large, on its own, after
//   submitting.
//
//   It says plainly that DrippleX still has to approve the fleet, and what
//   that does and does not stop. An owner who thinks they are live and finds
//   zero earnings a week later was misled by this screen.
//
// Built from the same FieldGroup / GreenBtn / ErrorNote pieces as every other
// signup here — no new visual language.
// ─────────────────────────────────────────────────────────────────────────────
export function FleetRegisterScreen({
  onBack,
  onDone,
}: {
  onBack: () => void;
  onDone: () => void;
}) {
  const [focused, setFocused] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [issued, setIssued] = useState<{ fleetNumber: string; name: string } | null>(null);

  const ready = Boolean(name.trim().length >= 2 && !loading);

  const handleSubmit = async () => {
    setErr('');
    setLoading(true);
    try {
      const fleet = await api.fleet.register({
        name: name.trim(),
        ...(phone.trim() === '' ? {} : { contactPhone: phone.trim() }),
      });
      setIssued({ fleetNumber: fleet.fleetNumber, name: fleet.name });
    } catch (e) {
      setErr(messageFor(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{ background: BG }}
    >
      <Ambient />
      <StatusBar />

      <div
        className="relative z-10 flex flex-1 flex-col overflow-y-auto px-7 pt-6"
        style={{ scrollbarWidth: 'none' }}
      >
        <button
          onClick={onBack}
          className="mb-5 flex h-9 w-9 items-center justify-center rounded-full transition-opacity active:opacity-70"
          style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
          aria-label="Back"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        {issued === null ? (
          <>
            <div style={{ animation: 'fade-up .45s ease backwards' }}>
              <h1
                className="text-[26px] font-bold leading-tight"
                style={{ fontFamily: PP, color: '#fff', letterSpacing: '-0.02em' }}
              >
                Register your fleet
              </h1>
              <p className="mt-1.5 text-[14px]" style={{ fontFamily: IT, color: MUTED }}>
                You will get a Fleet DX number straight away to give your riders and drivers.
              </p>
            </div>

            <div
              className="mt-7 flex flex-col gap-4"
              style={{ animation: 'fade-up .45s ease .1s backwards' }}
            >
              <FieldGroup
                label="Fleet name"
                id="fleetName"
                placeholder="Your company name"
                value={name}
                onChange={setName}
                focused={focused}
                onFocus={setFocused}
                onBlur={() => setFocused(null)}
                helper="How DrippleX and your riders will see your company"
              />
              <FieldGroup
                label="Contact phone"
                id="fleetPhone"
                placeholder="Type your phone number"
                value={phone}
                onChange={setPhone}
                focused={focused}
                onFocus={setFocused}
                onBlur={() => setFocused(null)}
                helper="Where DrippleX Operations reaches your fleet (optional)"
              />
            </div>

            <div className="mt-6">
              <ErrorNote message={err} />
              <GreenBtn
                label="Register fleet"
                disabled={!ready}
                loading={loading}
                onClick={handleSubmit}
                icon={<ArrowIcon />}
              />
            </div>

            <p
              className="mt-4 pb-10 text-center text-[12px]"
              style={{ fontFamily: IT, color: 'rgba(255,255,255,.24)' }}
            >
              DrippleX Operations reviews every fleet before it starts trading
            </p>
          </>
        ) : (
          <div style={{ animation: 'fade-up .45s ease backwards' }}>
            <h1
              className="text-[26px] font-bold leading-tight"
              style={{ fontFamily: PP, color: '#fff', letterSpacing: '-0.02em' }}
            >
              {issued.name} is registered
            </h1>
            <p className="mt-1.5 text-[14px]" style={{ fontFamily: IT, color: MUTED }}>
              This is your Fleet DX number. Give it to every rider and driver who works for you —
              they enter it when they sign up with DrippleX.
            </p>

            {/* The number is what the owner came here for, so it gets the room. */}
            <div
              className="mt-7 rounded-3xl px-6 py-8 text-center"
              style={{ background: NAVY_CARD, border: `1.5px solid rgba(71,207,114,.3)` }}
            >
              <p
                className="text-[11px] uppercase"
                style={{ fontFamily: IT, color: MUTED, letterSpacing: '0.14em' }}
              >
                Fleet DX number
              </p>
              <p
                className="mt-2 text-[30px] font-bold"
                style={{ fontFamily: PP, color: G3, letterSpacing: '0.02em' }}
              >
                {issued.fleetNumber}
              </p>
            </div>

            <div
              className="mt-6 rounded-2xl px-5 py-4"
              style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
            >
              <p className="text-[13px] leading-relaxed" style={{ fontFamily: IT, color: MUTED }}>
                DrippleX Operations is reviewing your fleet. Your riders can enter this number now
                and their requests will wait in your console for you to confirm — nothing is counted
                or charged to you until your fleet is approved.
              </p>
            </div>

            <div className="mt-6 pb-10">
              <GreenBtn label="Done" onClick={onDone} icon={<ArrowIcon />} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN 5 — DRIVER DOCUMENTS + VEHICLE DETAILS
// Backend-wired: uploads each image to storage, submits the three required KYC
// documents and registers the vehicle. (The note that used to sit here said the
// screen was visual-only pending a storage service — storage shipped and this
// was wired with it, but the note was left behind.)
//
// This is the ONLY place a driver is asked for these at sign-up. The driver app
// then shows them back as already-sent rather than asking again — see
// DriverKYCStatusScreen and DriverVehicleRegScreen.
// ─────────────────────────────────────────────────────────────────────────────
type DocStatus = 'pending' | 'verified' | 'rejected';

function StatusPill({ status }: { status: DocStatus }) {
  const map: Record<DocStatus, { label: string; bg: string; color: string }> = {
    pending: { label: 'Pending', bg: 'rgba(251,191,36,.12)', color: '#FCD34D' },
    verified: { label: 'Verified', bg: 'rgba(16,185,129,.12)', color: '#34D399' },
    rejected: { label: 'Rejected', bg: 'rgba(239,68,68,.12)', color: '#F87171' },
  };
  const s = map[status];
  return (
    <span
      className="rounded-full px-2.5 py-1 text-[11px] font-bold"
      style={{ background: s.bg, color: s.color, fontFamily: IT, border: `1px solid ${s.color}30` }}
    >
      {status === 'pending' && '● '}
      {status === 'verified' && '✓ '}
      {status === 'rejected' && '✕ '}
      {s.label}
    </span>
  );
}

function DocumentCard({
  icon,
  title,
  docKey,
  docNum,
  setDocNum,
  status,
  setStatus,
  onFile,
  focused,
  onFocus,
  onBlur,
}: {
  icon: string;
  title: string;
  docKey: string;
  docNum: string;
  setDocNum: (v: string) => void;
  status: DocStatus;
  setStatus: (s: DocStatus) => void;
  onFile: (f: File | null) => void;
  focused: string | null;
  onFocus: (id: string) => void;
  onBlur: () => void;
}) {
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const numId = `${docKey}_num`;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFileName(f?.name ?? null);
    onFile(f);
    if (f) setStatus('pending');
  };

  return (
    <div
      className="flex flex-col gap-3 rounded-3xl p-4"
      style={{
        background: NAVY_CARD,
        border: `1.5px solid ${
          status === 'verified'
            ? 'rgba(52,211,153,.25)'
            : status === 'rejected'
              ? 'rgba(248,113,113,.25)'
              : BORDER
        }`,
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-2xl text-xl"
            style={{ background: NAVY_SURFACE }}
          >
            {icon}
          </div>
          <div>
            <p className="text-[15px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
              {title}
            </p>
            {fileName && (
              <p
                className="mt-0.5 max-w-[160px] truncate text-[11px]"
                style={{ fontFamily: IT, color: 'rgba(255,255,255,.38)' }}
              >
                {fileName}
              </p>
            )}
          </div>
        </div>
        <StatusPill status={status} />
      </div>

      <div className="flex flex-col gap-1.5">
        <FieldLabel>Document number</FieldLabel>
        <TextInput
          id={numId}
          placeholder="Type the number here"
          value={docNum}
          onChange={setDocNum}
          focused={focused}
          onFocus={onFocus}
          onBlur={onBlur}
        />
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={handleFile}
      />
      <div className="flex gap-2">
        <button
          onClick={() => fileRef.current?.click()}
          className="flex h-[42px] flex-1 items-center justify-center gap-2 rounded-xl transition-all active:scale-[0.97]"
          style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}`, fontFamily: IT }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke={G3}
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="17 8 12 3 7 8" stroke={G3} />
            <line x1="12" y1="3" x2="12" y2="15" stroke={G3} />
          </svg>
          <span className="text-[12px] font-semibold" style={{ color: G3 }}>
            Upload file
          </span>
        </button>
        <button
          onClick={() => setStatus('pending')}
          className="flex h-[42px] flex-1 items-center justify-center gap-2 rounded-xl transition-all active:scale-[0.97]"
          style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}`, fontFamily: IT }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke={G2}
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="10" r="3" />
            <path d="M7 20.662V19a2 2 0 012-2h6a2 2 0 012 2v1.662" />
          </svg>
          <span className="text-[12px] font-semibold" style={{ color: G2 }}>
            Take photo
          </span>
        </button>
      </div>
    </div>
  );
}

const RIDE_CATEGORIES = ['Economy', 'Comfort', 'XL', 'Tricycle'];

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="mb-4 flex items-center gap-3 px-1">
      <div className="h-px flex-1" style={{ background: BORDER }} />
      <span
        className="text-[11px] font-semibold uppercase tracking-widest"
        style={{ fontFamily: IT, color: 'rgba(255,255,255,.3)' }}
      >
        {label}
      </span>
      <div className="h-px flex-1" style={{ background: BORDER }} />
    </div>
  );
}

export function DriverDocumentsScreen({
  onBack,
  onSubmit,
}: {
  onBack: () => void;
  onSubmit: () => void;
}) {
  const [focused, setFocused] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const [licNum, setLicNum] = useState('');
  const [licStatus, setLicStatus] = useState<DocStatus>('pending');
  const [licFile, setLicFile] = useState<File | null>(null);
  const [regNum, setRegNum] = useState('');
  const [regStatus, setRegStatus] = useState<DocStatus>('pending');
  const [regFile, setRegFile] = useState<File | null>(null);
  const [gurNum, setGurNum] = useState('');
  const [gurStatus, setGurStatus] = useState<DocStatus>('pending');
  const [gurFile, setGurFile] = useState<File | null>(null);

  const [vehicle, setVehicle] = useState({
    make: '',
    model: '',
    plate: '',
    colour: '',
    category: '',
    seats: '',
    year: '',
  });
  const setV = (k: keyof typeof vehicle) => (v: string) => setVehicle((f) => ({ ...f, [k]: v }));

  const vehicleReady =
    vehicle.make &&
    vehicle.model &&
    vehicle.plate &&
    vehicle.colour &&
    vehicle.category &&
    vehicle.seats &&
    vehicle.year;
  const ready =
    licNum && regNum && gurNum && licFile && regFile && gurFile && vehicleReady && !loading;

  // Precise, user-facing list of what still blocks submission, so a disabled
  // button never leaves the driver guessing which field is incomplete.
  const missing: string[] = [];
  if (!licNum || !licFile) missing.push("Driver's Licence (number + file)");
  if (!regNum || !regFile) missing.push('Vehicle Registration (number + file)');
  if (!gurNum || !gurFile) missing.push('Guarantor ID (number + file)');
  if (!vehicleReady) missing.push('all vehicle details');

  const CATEGORY_TO_RIDE_TYPE: Record<string, string> = {
    Economy: 'ECONOMY',
    Comfort: 'COMFORT',
    XL: 'XL',
    Tricycle: 'TRICYCLE',
  };

  // Uploads each document image to R2 (signed PUT), submits the three KYC docs
  // (DRIVER_LICENSE / VEHICLE_REGISTRATION / GUARANTOR_ID), then registers the
  // vehicle. Requires the driver to be logged in (they are, post-OTP) with
  // driver:kyc:manage + driver:vehicle:manage. Real backend — no fake gap.
  const handleSubmit = async () => {
    if (!licFile || !regFile || !gurFile) return;
    setErr('');
    setLoading(true);
    try {
      const [licUrl, regUrl, gurUrl] = await Promise.all([
        uploadFile(licFile, 'kyc-documents'),
        uploadFile(regFile, 'kyc-documents'),
        uploadFile(gurFile, 'kyc-documents'),
      ]);
      await api.driver.submitKyc({
        documentType: 'DRIVER_LICENSE',
        documentNumber: licNum.trim(),
        frontImage: licUrl,
      });
      await api.driver.submitKyc({
        documentType: 'VEHICLE_REGISTRATION',
        documentNumber: regNum.trim(),
        frontImage: regUrl,
      });
      await api.driver.submitKyc({
        documentType: 'GUARANTOR_ID',
        documentNumber: gurNum.trim(),
        frontImage: gurUrl,
      });
      await api.driver.createVehicle({
        plateNumber: vehicle.plate.trim(),
        make: vehicle.make.trim(),
        model: vehicle.model.trim(),
        color: vehicle.colour.trim(),
        year: Number(vehicle.year),
        rideCategory: (CATEGORY_TO_RIDE_TYPE[vehicle.category] ?? 'ECONOMY') as Parameters<
          typeof api.driver.createVehicle
        >[0]['rideCategory'],
        seats: Number(vehicle.seats),
      });
      setLicStatus('verified');
      setRegStatus('verified');
      setGurStatus('verified');
      onSubmit();
    } catch (e) {
      setErr(messageFor(e));
      setLoading(false);
    }
  };

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{ background: BG }}
    >
      <Ambient />
      <StatusBar />
      <div className="relative z-10 px-6 pt-3">
        <BackBtn onPress={onBack} />
      </div>

      <div
        className="relative z-10 flex-1 overflow-y-auto px-5 pb-10"
        style={{ scrollbarWidth: 'none' }}
      >
        <div className="mb-6 px-2" style={{ animation: 'fade-up .4s ease .05s backwards' }}>
          <h1
            className="text-[24px] font-bold leading-tight"
            style={{ fontFamily: PP, color: '#fff', letterSpacing: '-0.02em' }}
          >
            Upload your documents
          </h1>
          <p className="mt-1 text-[14px]" style={{ fontFamily: IT, color: MUTED }}>
            We verify these to ensure everyone's safety
          </p>
        </div>

        <SectionDivider label="Required documents" />

        <div
          className="mb-6 flex flex-col gap-3.5"
          style={{ animation: 'fade-up .4s ease .1s backwards' }}
        >
          <DocumentCard
            icon="📋"
            title="Driver's License"
            docKey="lic"
            docNum={licNum}
            setDocNum={setLicNum}
            status={licStatus}
            setStatus={setLicStatus}
            onFile={setLicFile}
            focused={focused}
            onFocus={setFocused}
            onBlur={() => setFocused(null)}
          />
          <DocumentCard
            icon="🚗"
            title="Vehicle Registration"
            docKey="reg"
            docNum={regNum}
            setDocNum={setRegNum}
            status={regStatus}
            setStatus={setRegStatus}
            onFile={setRegFile}
            focused={focused}
            onFocus={setFocused}
            onBlur={() => setFocused(null)}
          />
          <DocumentCard
            icon="🪪"
            title="Guarantor ID"
            docKey="gur"
            docNum={gurNum}
            setDocNum={setGurNum}
            status={gurStatus}
            setStatus={setGurStatus}
            onFile={setGurFile}
            focused={focused}
            onFocus={setFocused}
            onBlur={() => setFocused(null)}
          />
        </div>

        <SectionDivider label="Vehicle details" />

        <div
          className="mb-8 flex flex-col gap-4"
          style={{ animation: 'fade-up .4s ease .18s backwards' }}
        >
          <div className="flex gap-3">
            <div className="min-w-0 flex-1">
              <FieldGroup
                label="Make"
                id="make"
                placeholder="Type your car make"
                value={vehicle.make}
                onChange={setV('make')}
                focused={focused}
                onFocus={setFocused}
                onBlur={() => setFocused(null)}
              />
            </div>
            <div className="min-w-0 flex-1">
              <FieldGroup
                label="Model"
                id="model"
                placeholder="Type your car model"
                value={vehicle.model}
                onChange={setV('model')}
                focused={focused}
                onFocus={setFocused}
                onBlur={() => setFocused(null)}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <div className="min-w-0 flex-1">
              <FieldGroup
                label="Plate number"
                id="plate"
                placeholder="Type your plate number"
                value={vehicle.plate}
                onChange={setV('plate')}
                focused={focused}
                onFocus={setFocused}
                onBlur={() => setFocused(null)}
              />
            </div>
            <div className="min-w-0 flex-1">
              <FieldGroup
                label="Colour"
                id="colour"
                placeholder="Type the colour"
                value={vehicle.colour}
                onChange={setV('colour')}
                focused={focused}
                onFocus={setFocused}
                onBlur={() => setFocused(null)}
              />
            </div>
          </div>

          <Dropdown
            id="category"
            label="Ride category"
            placeholder="Select category"
            value={vehicle.category}
            onChange={setV('category')}
            options={RIDE_CATEGORIES}
            focused={focused}
            onFocus={setFocused}
            onBlur={() => setFocused(null)}
          />

          <div className="flex gap-3">
            <div className="min-w-0 flex-1">
              <FieldGroup
                label="Year"
                id="year"
                type="number"
                placeholder="Type the year"
                value={vehicle.year}
                onChange={setV('year')}
                focused={focused}
                onFocus={setFocused}
                onBlur={() => setFocused(null)}
              />
            </div>
            <div className="min-w-0 flex-1">
              <FieldGroup
                label="Seats"
                id="seats"
                type="number"
                placeholder="How many seats"
                value={vehicle.seats}
                onChange={setV('seats')}
                focused={focused}
                onFocus={setFocused}
                onBlur={() => setFocused(null)}
              />
            </div>
          </div>
        </div>

        <ErrorNote message={err} />

        {!loading && missing.length > 0 && (
          <p
            className="mb-3 text-[12px] leading-relaxed"
            style={{ fontFamily: IT, color: 'rgba(255,255,255,.5)' }}
          >
            Still needed to submit: {missing.join(' · ')}
          </p>
        )}

        <GreenBtn
          label="Submit for review"
          disabled={!ready}
          loading={loading}
          onClick={handleSubmit}
          icon={<ArrowIcon />}
        />

        <p
          className="mt-4 text-center text-[12px]"
          style={{ fontFamily: IT, color: 'rgba(255,255,255,.24)' }}
        >
          Our team typically reviews applications within 24–48 hours
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RIDER DOCUMENTS (post-login) — wired: POST /rider/kyc ×2 + PATCH /rider/profile
// The delivery rider uploads an ID and a Guarantor ID and enters the company
// they deliver for (name only — founder scope). Runs while the rider is logged
// in (post-OTP) with rider:kyc:manage. Real backend — DPX-RIDER-002.
// ─────────────────────────────────────────────────────────────────────────────
export function RiderDocumentsScreen({
  onBack,
  onSubmit,
}: {
  onBack: () => void;
  onSubmit: () => void;
}) {
  const [focused, setFocused] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const [idNum, setIdNum] = useState('');
  const [idStatus, setIdStatus] = useState<DocStatus>('pending');
  const [idFile, setIdFile] = useState<File | null>(null);
  const [gurNum, setGurNum] = useState('');
  const [gurStatus, setGurStatus] = useState<DocStatus>('pending');
  const [gurFile, setGurFile] = useState<File | null>(null);

  const [companyName, setCompanyName] = useState('');
  const [fleetNumber, setFleetNumber] = useState('');
  const [fleetNote, setFleetNote] = useState('');

  const ready = Boolean(idNum && gurNum && idFile && gurFile && !loading);

  // Uploads the two document images to R2 (signed PUT), submits the two KYC
  // docs (NATIONAL_ID / GUARANTOR_ID), then saves the company name. Requires
  // the rider to be logged in (post-OTP) with rider:kyc:manage.
  const handleSubmit = async () => {
    if (!idFile || !gurFile) return;
    setErr('');
    setLoading(true);
    try {
      const [idUrl, gurUrl] = await Promise.all([
        uploadFile(idFile, 'kyc-documents'),
        uploadFile(gurFile, 'kyc-documents'),
      ]);
      await api.rider.submitKyc({
        documentType: 'NATIONAL_ID',
        documentNumber: idNum.trim(),
        frontImage: idUrl,
      });
      await api.rider.submitKyc({
        documentType: 'GUARANTOR_ID',
        documentNumber: gurNum.trim(),
        frontImage: gurUrl,
      });
      if (companyName.trim()) {
        await api.rider.updateProfile({ companyName: companyName.trim() });
      }
      // The fleet number is optional and deliberately cannot fail the
      // submission: the rider's KYC is already in by this point, and a
      // mistyped fleet number must not cost them their onboarding. A bad
      // number is reported here and can be fixed with the fleet owner later.
      if (fleetNumber.trim()) {
        try {
          const req = await api.fleet.requestToJoin(fleetNumber.trim().toUpperCase());
          setFleetNote(`Sent to ${req.fleetName}. They will confirm you.`);
        } catch (fleetError) {
          setFleetNote(messageFor(fleetError));
        }
      }
      setIdStatus('verified');
      setGurStatus('verified');
      onSubmit();
    } catch (e) {
      setErr(messageFor(e));
      setLoading(false);
    }
  };

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{ background: BG }}
    >
      <Ambient />
      <StatusBar />
      <div className="relative z-10 px-6 pt-3">
        <BackBtn onPress={onBack} />
      </div>

      <div
        className="relative z-10 flex-1 overflow-y-auto px-5 pb-10"
        style={{ scrollbarWidth: 'none' }}
      >
        <div className="mb-6 px-2" style={{ animation: 'fade-up .4s ease .05s backwards' }}>
          <h1
            className="text-[24px] font-bold leading-tight"
            style={{ fontFamily: PP, color: '#fff', letterSpacing: '-0.02em' }}
          >
            Upload your documents
          </h1>
          <p className="mt-1 text-[14px]" style={{ fontFamily: IT, color: MUTED }}>
            We verify these to ensure everyone's safety
          </p>
        </div>

        <SectionDivider label="Required documents" />

        <div
          className="mb-6 flex flex-col gap-3.5"
          style={{ animation: 'fade-up .4s ease .1s backwards' }}
        >
          <DocumentCard
            icon="🪪"
            title="Government ID"
            docKey="id"
            docNum={idNum}
            setDocNum={setIdNum}
            status={idStatus}
            setStatus={setIdStatus}
            onFile={setIdFile}
            focused={focused}
            onFocus={setFocused}
            onBlur={() => setFocused(null)}
          />
          <DocumentCard
            icon="🧑‍⚖️"
            title="Guarantor ID"
            docKey="gur"
            docNum={gurNum}
            setDocNum={setGurNum}
            status={gurStatus}
            setStatus={setGurStatus}
            onFile={setGurFile}
            focused={focused}
            onFocus={setFocused}
            onBlur={() => setFocused(null)}
          />
        </div>

        <SectionDivider label="Company" />

        <div
          className="mb-8 flex flex-col gap-4"
          style={{ animation: 'fade-up .4s ease .18s backwards' }}
        >
          <FieldGroup
            label="Company name"
            id="companyName"
            placeholder="Type the company name"
            value={companyName}
            onChange={setCompanyName}
            focused={focused}
            onFocus={setFocused}
            onBlur={() => setFocused(null)}
            helper="The company you deliver for (optional)"
          />
          {/* DPX-FLEET, founder decision 2026-08-30: riders quote the number
              their fleet owner gave them. It is not a KYC field and does not
              gate the submission — a rider who does not have one, or types it
              wrong, still completes onboarding exactly as before. */}
          <FieldGroup
            label="Fleet DX number"
            id="fleetNumber"
            placeholder="DX-FL-0001"
            value={fleetNumber}
            onChange={setFleetNumber}
            focused={focused}
            onFocus={setFocused}
            onBlur={() => setFocused(null)}
            helper="If you ride for a fleet, enter the number they gave you (optional)"
          />
          {fleetNote !== '' && (
            <p className="text-[12px]" style={{ fontFamily: IT, color: 'rgba(255,255,255,.55)' }}>
              {fleetNote}
            </p>
          )}
        </div>

        <ErrorNote message={err} />

        <GreenBtn
          label="Submit for review"
          disabled={!ready}
          loading={loading}
          onClick={handleSubmit}
          icon={<ArrowIcon />}
        />

        <p
          className="mt-4 text-center text-[12px]"
          style={{ fontFamily: IT, color: 'rgba(255,255,255,.24)' }}
        >
          Our team typically reviews applications within 24–48 hours
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MERCHANT BUSINESS DETAILS (post-login) — wired: PATCH /merchant/business
// Registration auto-creates a blank merchant profile; this persists the business
// name, its legal structure, and the retail category chosen at signup. Uses the
// real UpdateBusinessDto — businessType is the LEGAL structure enum (how the
// business is incorporated) and `category` is what it SELLS. They are different
// columns and confusing them is what kept every merchant here uncategorised.
// ─────────────────────────────────────────────────────────────────────────────
const BUSINESS_STRUCTURES: { label: string; value: string }[] = [
  { label: 'Sole Proprietorship', value: 'SOLE_PROPRIETORSHIP' },
  { label: 'Partnership', value: 'PARTNERSHIP' },
  { label: 'Limited Liability Company', value: 'LIMITED_LIABILITY' },
  { label: 'Corporation', value: 'CORPORATION' },
  { label: 'Other', value: 'OTHER' },
];

export function BusinessDetailsScreen({
  businessName: initialName,
  category,
  onDone,
  onBack,
}: {
  businessName: string;
  category: MerchantCategory | null;
  onDone: () => void;
  onBack: () => void;
}) {
  const [name, setName] = useState(initialName ?? '');
  const [structure, setStructure] = useState('');
  // No longer seeded with the category: that was a workaround for the category
  // not being stored at all, and it left every merchant with a description
  // reading "Hotels & Hospitality" and nothing useful.
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [focused, setFocused] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const ready = name.trim().length >= 2 && structure.length > 0;

  const handleSubmit = async () => {
    setErr('');
    setLoading(true);
    try {
      const businessType = BUSINESS_STRUCTURES.find((s) => s.label === structure)?.value ?? 'OTHER';
      const body: Record<string, unknown> = {
        businessName: name.trim(),
        businessType,
        // Optional in the DTO on purpose — a guessed category is worse than a
        // blank one — so it is sent only when the merchant actually chose.
        ...(category ? { category } : {}),
      };
      if (description.trim()) body.description = description.trim();
      if (phone.replace(/\D/g, '').length >= 7) body.phone = toE164(phone);
      if (address.trim()) body.address = address.trim();

      // First-time registration CREATEs the business (POST) — it starts SUBMITTED /
      // UNDER_REVIEW and enters the Ops approval queue. If the merchant already has a
      // business (e.g. returning to edit these details), the backend replies 409 and
      // we PATCH the existing record instead. This is the real approval flow — no bypass.
      try {
        await api.merchant.createBusiness(
          body as Parameters<typeof api.merchant.createBusiness>[0],
        );
      } catch (createErr) {
        if (createErr instanceof ApiError && createErr.status === 409) {
          await api.merchant.updateBusiness(
            body as Parameters<typeof api.merchant.updateBusiness>[0],
          );
        } else {
          throw createErr;
        }
      }
      onDone();
    } catch (e) {
      setErr(messageFor(e));
      setLoading(false);
    }
  };

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{ background: BG }}
    >
      <Ambient />
      <StatusBar />
      <div className="relative z-10 px-6 pt-3">
        <BackBtn onPress={onBack} />
      </div>

      <div
        className="relative z-10 flex-1 overflow-y-auto px-7 pb-10"
        style={{ scrollbarWidth: 'none' }}
      >
        <div style={{ animation: 'fade-up .4s ease .05s backwards' }}>
          <div className="mb-1 flex items-center gap-2">
            <span className="text-2xl">🏪</span>
            <span
              className="rounded-full px-2.5 py-1 text-[12px] font-semibold"
              style={{
                background: 'rgba(249,115,22,.12)',
                color: '#FB923C',
                fontFamily: IT,
                border: '1px solid rgba(249,115,22,.22)',
              }}
            >
              Business details
            </span>
          </div>
          <h1
            className="mt-3 text-[26px] font-bold leading-tight"
            style={{ fontFamily: PP, color: '#fff', letterSpacing: '-0.02em' }}
          >
            Tell us about
            <br />
            your business
          </h1>
          <p className="mt-1.5 text-[14px]" style={{ fontFamily: IT, color: MUTED }}>
            This appears on your storefront and helps us verify you faster
          </p>
        </div>

        <div
          className="mt-7 flex flex-col gap-4"
          style={{ animation: 'fade-up .4s ease .12s backwards' }}
        >
          <FieldGroup
            label="Business Name"
            id="name"
            placeholder="Type your business name"
            value={name}
            onChange={setName}
            focused={focused}
            onFocus={setFocused}
            onBlur={() => setFocused(null)}
          />
          <Dropdown
            id="structure"
            label="Business Structure"
            placeholder="Select a structure"
            value={structure}
            onChange={setStructure}
            options={BUSINESS_STRUCTURES.map((s) => s.label)}
            focused={focused}
            onFocus={setFocused}
            onBlur={() => setFocused(null)}
          />
          <FieldGroup
            label="What you sell (optional)"
            id="description"
            placeholder="Type what you sell"
            value={description}
            onChange={setDescription}
            focused={focused}
            onFocus={setFocused}
            onBlur={() => setFocused(null)}
          />
          <div className="flex flex-col gap-2">
            <FieldLabel>Business Phone (optional)</FieldLabel>
            <div
              className="flex h-[56px] items-center gap-3 rounded-2xl px-4 transition-all duration-200"
              style={{
                background: 'rgba(255,255,255,.045)',
                border: `1.5px solid ${focused === 'bphone' ? G2 : BORDER}`,
                boxShadow: focused === 'bphone' ? '0 0 0 3px rgba(43,172,82,.12)' : 'none',
              }}
            >
              <div
                className="flex shrink-0 items-center gap-2 pr-3"
                style={{ borderRight: `1px solid ${BORDER}` }}
              >
                <span className="text-base">🇳🇬</span>
                <span
                  className="text-[14px]"
                  style={{ fontFamily: IT, color: 'rgba(255,255,255,.5)' }}
                >
                  +234
                </span>
              </div>
              <input
                type="tel"
                placeholder="Type your phone number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onFocus={() => setFocused('bphone')}
                onBlur={() => setFocused(null)}
                className="flex-1 bg-transparent text-[15px] text-white outline-none"
                style={{ fontFamily: IT }}
              />
            </div>
          </div>
          <FieldGroup
            label="Business Address (optional)"
            id="address"
            placeholder="Type your business address"
            value={address}
            onChange={setAddress}
            focused={focused}
            onFocus={setFocused}
            onBlur={() => setFocused(null)}
          />
        </div>

        <div
          className="mt-8 flex flex-col gap-4"
          style={{ animation: 'fade-up .4s ease .2s backwards' }}
        >
          <ErrorNote message={err} />
          <GreenBtn
            label="Save & submit for review"
            disabled={!ready}
            loading={loading}
            onClick={handleSubmit}
            icon={<ArrowIcon />}
          />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN 6 — PENDING REVIEW (three variants)
// ─────────────────────────────────────────────────────────────────────────────
type ReviewStep = { label: string; done: boolean; active?: boolean };

/**
 * Partner onboarding checklist.
 *
 * These used to be hardcoded as "Business details submitted ✓ / KYC verification
 * IN PROGRESS — 24–48 hours", which told every brand-new partner that documents
 * they had never uploaded were already being reviewed, with no way to act. The
 * merchant checklist is now derived from the real backend state.
 *
 * The DRIVER and RIDER stages are the real onboarding stages for those personas
 * (driver includes the vehicle inspection stages) and must NOT be trimmed — only
 * the fabricated `done: true` / `active` flags were removed, so the stages are
 * listed as outstanding instead of claiming progress the app cannot verify.
 * Wiring them to real per-persona status is a follow-up, not a reason to drop
 * stages from the list.
 */
const DRIVER_STEPS: ReviewStep[] = [
  { label: 'Identity check', done: false },
  { label: 'Document review', done: false },
  { label: 'Vehicle inspection', done: false },
  { label: 'Inspection & test', done: false },
  { label: 'Agreement signing', done: false },
  { label: 'Account standing', done: false },
];

const RIDER_STEPS: ReviewStep[] = [
  { label: 'Application submitted', done: true },
  { label: 'Under review', done: false },
];

const MERCHANT_STEPS: ReviewStep[] = [
  { label: 'Business details submitted', done: true },
  { label: 'Identity documents', done: false },
  { label: 'Account approved', done: false },
];

/**
 * A fleet's two stages. Deliberately short: unlike a rider, a fleet submits no
 * documents and sits through no KYC — DrippleX either recognises the company
 * or it does not. Listing document stages here would promise a review that
 * does not happen.
 */
const FLEET_STEPS: ReviewStep[] = [
  { label: 'Fleet registered', done: true },
  { label: 'DrippleX approval', done: false },
];

const STEP_MAP: Record<PartnerPersona, ReviewStep[]> = {
  merchant: MERCHANT_STEPS,
  driver: DRIVER_STEPS,
  rider: RIDER_STEPS,
  fleet: FLEET_STEPS,
};

const PERSONA_META: Record<PartnerPersona, { icon: string; label: string; accent: string }> = {
  merchant: { icon: '🛍', label: 'Merchant', accent: '#F97316' },
  driver: { icon: '🚗', label: 'Driver', accent: '#3B82F6' },
  rider: { icon: '🚴', label: 'Rider', accent: G2 },
  fleet: { icon: '🏢', label: 'Fleet', accent: '#A855F7' },
};

export function PendingReviewScreen({
  persona,
  onHome,
  onRefresh,
  onUploadDocuments,
}: {
  persona: PartnerPersona;
  onHome: () => void;
  onRefresh: () => void;
  /** Opens the portal page where this partner actually uploads documents. */
  onUploadDocuments?: () => void;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const [liveSteps, setLiveSteps] = useState<ReviewStep[] | null>(null);
  // null = unknown (not a merchant, or not loaded yet)
  const [kycState, setKycState] = useState<'NONE' | 'PENDING' | 'VERIFIED' | 'REJECTED' | null>(
    null,
  );
  const meta = PERSONA_META[persona];

  /**
   * Read the merchant's REAL onboarding state. Previously this screen showed a
   * fixed checklist claiming KYC was already under review, so a merchant who had
   * uploaded nothing was told to wait 24–48 hours for a review that would never
   * happen.
   */
  const loadMerchantState = React.useCallback(async () => {
    if (persona !== 'merchant' || !auth.isLoggedIn()) return;
    try {
      const [business, kyc] = await Promise.all([
        api.merchant.getBusiness().catch(() => null),
        api.merchant.getKyc().catch(() => null),
      ]);
      const latest = kyc?.latest ?? null;
      const state: 'NONE' | 'PENDING' | 'VERIFIED' | 'REJECTED' = !latest
        ? 'NONE'
        : latest.verificationStatus === 'VERIFIED'
          ? 'VERIFIED'
          : latest.verificationStatus === 'REJECTED'
            ? 'REJECTED'
            : 'PENDING';
      // The backend field is `verificationStatus`
      // (BusinessVerificationStatus: PENDING | UNDER_REVIEW | VERIFIED | REJECTED).
      // There is no `approvalStatus` and no `APPROVED` — the old comparison was
      // always false, so a verified merchant was never shown as approved.
      const approved = business?.verificationStatus === 'VERIFIED';
      setKycState(state);
      setLiveSteps([
        { label: 'Business details submitted', done: Boolean(business) },
        {
          label:
            state === 'REJECTED'
              ? 'Identity documents — rejected, re-upload'
              : state === 'NONE'
                ? 'Identity documents — not uploaded yet'
                : 'Identity documents',
          done: state === 'VERIFIED',
          active: state === 'PENDING',
        },
        { label: 'Account approved', done: approved },
      ]);
    } catch {
      // Leave the neutral default checklist rather than inventing progress.
    }
  }, [persona]);

  /**
   * Read the RIDER's real state. Riders were never loaded here, so kycState
   * stayed null and the screen kept offering "Upload documents" to a rider who
   * had already submitted both — which read as a second, duplicate upload page.
   * The driver flow is deliberately untouched: it keeps its own six-stage
   * checklist (identity, documents, vehicle inspection, test, agreement,
   * standing) and its upload route.
   */
  const loadRiderState = React.useCallback(async () => {
    if (persona !== 'rider' || !auth.isLoggedIn()) return;
    try {
      const profile = await api.rider.getProfile();
      const docs = profile.kyc;
      const state: 'NONE' | 'PENDING' | 'VERIFIED' | 'REJECTED' =
        docs.length === 0
          ? 'NONE'
          : docs.some((d) => d.verificationStatus === 'REJECTED')
            ? 'REJECTED'
            : docs.every((d) => d.verificationStatus === 'VERIFIED')
              ? 'VERIFIED'
              : 'PENDING';
      setKycState(state);
      setLiveSteps([
        { label: 'Application submitted', done: true },
        {
          label:
            state === 'REJECTED'
              ? 'Documents — rejected, re-upload'
              : state === 'NONE'
                ? 'Documents — not uploaded yet'
                : 'Identity & guarantor documents',
          done: state === 'VERIFIED',
          active: state === 'PENDING',
        },
        { label: 'Account approved', done: profile.status === 'APPROVED' },
      ]);
    } catch {
      // Leave the neutral default checklist rather than inventing progress.
    }
  }, [persona]);

  const loadPartnerState = React.useCallback(async () => {
    await Promise.all([loadMerchantState(), loadRiderState()]);
  }, [loadMerchantState, loadRiderState]);

  React.useEffect(() => {
    void loadPartnerState();
  }, [loadPartnerState]);

  const steps = liveSteps ?? STEP_MAP[persona];
  const doneCount = steps.filter((s) => s.done).length;
  // Only a document that is genuinely awaiting review is "in review".
  const awaitingReview = kycState === 'PENDING';
  // Offer the upload route unless we have POSITIVE evidence a document is
  // already pending review or verified. kycState is null when the status could
  // not be read — most importantly right after signup, before the partner has
  // logged in — and hiding the button in that case left them with no way
  // forward at all, which is the very dead end this screen was meant to fix.
  const needsUpload = kycState !== 'PENDING' && kycState !== 'VERIFIED';

  const handleRefresh = () => {
    setRefreshing(true);
    void loadPartnerState().finally(() => setRefreshing(false));
    onRefresh();
  };

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{ background: BG }}
    >
      <Ambient />
      <StatusBar />

      <div className="relative z-10 flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        <div
          className="flex flex-col items-center px-7 pb-6 pt-8"
          style={{ animation: 'success-bounce .65s cubic-bezier(.34,1.56,.64,1) both' }}
        >
          <div
            className="relative mb-6 flex items-center justify-center"
            style={{ width: 120, height: 120 }}
          >
            <div
              className="absolute inset-0 rounded-full"
              style={{
                border: `2px solid ${G2}`,
                animation: 'pulse-ring 1.4s ease-out .3s infinite',
              }}
            />
            <div
              className="absolute inset-0 rounded-full"
              style={{
                border: `2px solid ${G2}`,
                animation: 'pulse-ring 1.4s ease-out .7s infinite',
              }}
            />
            <div
              className="flex h-[100px] w-[100px] items-center justify-center rounded-full"
              style={{
                background:
                  'radial-gradient(circle,rgba(43,172,82,.22) 0%,rgba(23,107,48,.12) 100%)',
                border: '2px solid rgba(43,172,82,.3)',
              }}
            >
              <span style={{ fontSize: 48 }}>{meta.icon}</span>
            </div>
          </div>

          <div
            className="mb-4 flex items-center gap-2 rounded-full px-4 py-2"
            style={{ background: 'rgba(251,191,36,.1)', border: '1px solid rgba(251,191,36,.25)' }}
          >
            <span className="text-[12px]">⏳</span>
            <span
              className="text-[12px] font-bold"
              style={{
                fontFamily: IT,
                color: '#FCD34D',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              Under Review
            </span>
          </div>

          <h1
            className="text-center text-[24px] font-bold"
            style={{ fontFamily: PP, color: '#fff', letterSpacing: '-0.02em' }}
          >
            {needsUpload ? 'One more step' : 'Application received'}
          </h1>
          <p
            className="mt-2.5 text-center text-[14px] leading-relaxed"
            style={{ fontFamily: IT, color: MUTED, maxWidth: 290 }}
          >
            {needsUpload
              ? 'Your account is created. Upload your identity or business document to finish and go live.'
              : "Your application is with the DrippleX team — we'll notify you the moment you're approved"}
          </p>

          <div
            className="mt-5 flex items-center gap-2 rounded-2xl px-4 py-2"
            style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
          >
            <div
              className="h-1.5 w-24 rounded-full"
              style={{ background: 'rgba(255,255,255,.08)' }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${(doneCount / steps.length) * 100}%`, background: GG }}
              />
            </div>
            <span className="text-[12px] font-semibold" style={{ fontFamily: IT, color: MUTED }}>
              {doneCount}/{steps.length} steps done
            </span>
          </div>
        </div>

        <div className="mb-6 px-7" style={{ animation: 'fade-up .5s ease .25s backwards' }}>
          <p
            className="mb-4 text-[11px] font-semibold uppercase tracking-widest"
            style={{ fontFamily: IT, color: 'rgba(255,255,255,.3)' }}
          >
            Review checklist
          </p>

          <div className="flex flex-col" style={{ gap: 0 }}>
            {steps.map((step, i) => (
              <div key={step.label} className="flex items-start gap-3">
                <div className="flex flex-col items-center" style={{ width: 28, flexShrink: 0 }}>
                  <div
                    className="z-10 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full"
                    style={{
                      background: step.done
                        ? GG
                        : step.active
                          ? 'rgba(251,191,36,.15)'
                          : NAVY_SURFACE,
                      border: step.done
                        ? 'none'
                        : step.active
                          ? '1.5px solid rgba(251,191,36,.5)'
                          : `1.5px solid ${BORDER}`,
                      boxShadow: step.active ? '0 0 0 4px rgba(251,191,36,.08)' : 'none',
                    }}
                  >
                    {step.done ? (
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="white"
                        strokeWidth="3"
                        strokeLinecap="round"
                      >
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    ) : step.active ? (
                      <div
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: '#FCD34D', animation: 'avatar-pulse 1.8s infinite' }}
                      />
                    ) : (
                      <div
                        className="h-2 w-2 rounded-full"
                        style={{ background: 'rgba(255,255,255,.18)' }}
                      />
                    )}
                  </div>
                  {i < steps.length - 1 && (
                    <div
                      className="my-1 w-px flex-1"
                      style={{
                        minHeight: 24,
                        background: step.done
                          ? `linear-gradient(to bottom,${G2},rgba(43,172,82,.2))`
                          : 'rgba(255,255,255,.07)',
                      }}
                    />
                  )}
                </div>
                <div className="flex-1 pb-6 pt-1">
                  <p
                    className="text-[14px] font-semibold"
                    style={{
                      fontFamily: IT,
                      color: step.done ? '#fff' : step.active ? '#FCD34D' : 'rgba(255,255,255,.32)',
                    }}
                  >
                    {step.label}
                  </p>
                  {step.active && (
                    <p
                      className="mt-0.5 text-[12px]"
                      style={{ fontFamily: IT, color: 'rgba(251,191,36,.6)' }}
                    >
                      {awaitingReview ? 'In review — estimated 24–48 hours' : 'Waiting on you'}
                    </p>
                  )}
                  {step.done && (
                    <p
                      className="mt-0.5 text-[12px]"
                      style={{ fontFamily: IT, color: 'rgba(52,211,153,.55)' }}
                    >
                      Completed ✓
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          className="flex flex-col gap-3 px-7 pb-10"
          style={{ animation: 'fade-up .5s ease .35s backwards' }}
        >
          <div
            className="flex items-start gap-3 rounded-2xl p-4"
            style={{ background: 'rgba(59,130,246,.07)', border: '1px solid rgba(59,130,246,.15)' }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#60A5FA"
              strokeWidth="2"
              strokeLinecap="round"
              className="mt-0.5 shrink-0"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4m0 4h.01" />
            </svg>
            <p
              className="text-[12.5px] leading-relaxed"
              style={{ fontFamily: IT, color: 'rgba(255,255,255,.45)' }}
            >
              You'll receive an email and push notification as each step is completed. Make sure
              your documents are clear and unobstructed.
            </p>
          </div>

          <button
            onClick={handleRefresh}
            className="flex h-[52px] w-full items-center justify-center gap-2.5 rounded-2xl text-[15px] font-semibold transition-all active:scale-[0.97]"
            style={{
              background: NAVY_SURFACE,
              border: `1.5px solid ${BORDER}`,
              fontFamily: PP,
              color: 'rgba(255,255,255,.75)',
            }}
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke={G2}
              strokeWidth="2.2"
              strokeLinecap="round"
              style={{ animation: refreshing ? 'spin .7s linear infinite' : 'none' }}
            >
              <path d="M23 4v6h-6" />
              <path d="M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
            </svg>
            {refreshing ? 'Checking…' : 'Refresh status'}
          </button>

          {/* The screen used to offer only a (non-functional) refresh and "Back
              to Home", so a partner who still had to upload documents had no way
              to proceed. */}
          {needsUpload && onUploadDocuments && (
            <button
              onClick={onUploadDocuments}
              className="mt-3 flex h-[52px] w-full items-center justify-center rounded-2xl text-[15px] font-bold text-white transition-transform active:scale-[.97]"
              style={{ background: `linear-gradient(135deg,${G2},${G3})`, fontFamily: PP }}
            >
              Upload documents
            </button>
          )}

          <button
            onClick={onHome}
            className="py-2 text-center text-[14px] transition-opacity active:opacity-70"
            style={{ fontFamily: IT, color: MUTED }}
          >
            ← Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}
