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
import { auth } from '../lib/auth';

// ═══════════════════════════════════════════════════════════════════════════
// SPLASH
// ═══════════════════════════════════════════════════════════════════════════
export function SplashScreen({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2900);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div
      className="relative flex h-full w-full flex-col items-center justify-between overflow-hidden"
      style={{
        background: `linear-gradient(155deg,${NAVY_DEEP} 0%,${NAVY_BASE} 55%,#0B1D2F 100%)`,
      }}
    >
      <Ambient />
      <StatusBar />
      <div
        className="relative z-10 flex flex-1 flex-col items-center justify-center gap-6"
        style={{ animation: 'pop-in .75s cubic-bezier(.34,1.56,.64,1) .25s both' }}
      >
        <Logo width={300} />
        <span
          className="text-sm font-medium tracking-[0.22em]"
          style={{ fontFamily: "'Poppins',sans-serif", color: G2 }}
        >
          life,Simplified
        </span>
      </div>
      <div className="relative z-10 flex w-full flex-col items-center gap-4 px-10 pb-14">
        <div
          className="h-[2px] w-full overflow-hidden rounded-full"
          style={{ background: 'rgba(255,255,255,.06)' }}
        >
          <div
            className="h-full rounded-full"
            style={{
              background: `linear-gradient(90deg,${G0},${G3})`,
              animation: 'bar-fill 2.4s cubic-bezier(.4,0,.2,1) .3s both',
            }}
          />
        </div>
        <span className="text-[11px] text-white/20" style={{ fontFamily: "'Inter',sans-serif" }}>
          v1.0.0
        </span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// WELCOME
// ═══════════════════════════════════════════════════════════════════════════
export function WelcomeScreen({
  onGetStarted,
  onSignIn,
  onPartner,
}: {
  onGetStarted: () => void;
  onSignIn: () => void;
  onPartner?: () => void;
}) {
  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{
        background: `linear-gradient(155deg,${NAVY_DEEP} 0%,${NAVY_BASE} 55%,#0B1D2F 100%)`,
      }}
    >
      <Ambient />
      <StatusBar />
      <div
        className="relative z-10 flex flex-1 items-center justify-center"
        style={{ animation: 'fade-in .55s ease .15s both' }}
      >
        <div
          className="relative flex items-center justify-center"
          style={{ width: 320, height: 320 }}
        >
          <div
            className="absolute inset-0 rounded-full"
            style={{
              border: '1px solid rgba(43,172,82,.11)',
              animation: 'orbit-cw 32s linear infinite',
            }}
          />
          <div
            className="absolute rounded-full"
            style={{
              inset: 18,
              borderTop: `1.5px solid ${G2}`,
              borderRight: '1.5px solid transparent',
              borderBottom: '1.5px solid transparent',
              borderLeft: '1.5px solid transparent',
              borderRadius: '50%',
              animation: 'orbit-ccw 9s linear infinite',
              boxShadow: `0 0 10px rgba(43,172,82,.2)`,
            }}
          />
          <div
            className="absolute rounded-full"
            style={{
              inset: 42,
              border: '1px solid rgba(43,172,82,.06)',
              animation: 'orbit-cw 22s linear infinite',
            }}
          />
          <div
            className="relative z-10 flex items-center justify-center rounded-2xl px-5 py-4"
            style={{
              background: `linear-gradient(145deg,${NAVY_SURFACE},${NAVY_CARD})`,
              animation: 'glow-ring 4s ease-in-out infinite',
            }}
          >
            <Logo width={192} />
          </div>
          {(
            [
              { icon: '🛍️', angle: -68, anim: 'float-a', dur: '3.2s' },
              { icon: '🚖', angle: 54, anim: 'float-b', dur: '4.0s' },
              { icon: '💳', angle: 174, anim: 'float-c', dur: '3.6s' },
            ] as const
          ).map(({ icon, angle, anim, dur }) => {
            const rad = (angle * Math.PI) / 180,
              r = 134;
            return (
              <div
                key={angle}
                className="absolute"
                style={{ transform: `translate(${Math.cos(rad) * r}px,${Math.sin(rad) * r}px)` }}
              >
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl"
                  style={{
                    background: `linear-gradient(145deg,${NAVY_SURFACE},${NAVY_CARD})`,
                    boxShadow: `0 0 0 1px rgba(43,172,82,.16),0 10px 28px rgba(0,0,0,.45)`,
                    animation: `${anim} ${dur} ease-in-out infinite`,
                  }}
                >
                  {icon}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div
        className="relative z-10 flex flex-col gap-5 px-7 pb-10"
        style={{ animation: 'fade-up .65s ease .3s both' }}
      >
        <div className="flex flex-col gap-2">
          <h1
            className="text-[32px] font-bold leading-[1.15] text-white"
            style={{ fontFamily: "'Poppins',sans-serif", letterSpacing: '-0.025em' }}
          >
            Your Life.
            <br />
            <span style={{ color: G3 }}>One App.</span>
          </h1>
          <p
            className="text-[14px] leading-relaxed"
            style={{ fontFamily: "'Inter',sans-serif", color: MUTED }}
          >
            Shop, ride, pay, and manage your day — all in one beautifully connected app.
          </p>
        </div>
        <div className="flex flex-col gap-3 pt-1">
          <GreenBtn label="Get Started" onClick={onGetStarted} icon={<ArrowIcon />} />
          <button
            onClick={onSignIn}
            className="flex h-[52px] w-full items-center justify-center rounded-2xl text-[15px] font-medium transition-all active:scale-[0.97]"
            style={{
              fontFamily: "'Poppins',sans-serif",
              color: 'rgba(255,255,255,.55)',
              background: 'rgba(255,255,255,.045)',
              border: `1.5px solid ${BORDER}`,
            }}
          >
            I already have an account
          </button>
          {onPartner && (
            <button
              onClick={onPartner}
              className="py-1 text-center text-[13px] font-medium transition-opacity active:opacity-70"
              style={{ fontFamily: "'Inter',sans-serif", color: G3 }}
            >
              Become a partner — sell, drive or deliver →
            </button>
          )}
        </div>
        <p
          className="text-center text-[11px]"
          style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.2)' }}
        >
          By continuing you agree to our{' '}
          <span className="underline underline-offset-2" style={{ color: G2 }}>
            Terms
          </span>{' '}
          &amp;{' '}
          <span className="underline underline-offset-2" style={{ color: G2 }}>
            Privacy Policy
          </span>
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTH-003 — PHONE REGISTRATION
// ═══════════════════════════════════════════════════════════════════════════
export function RegisterScreen({
  onContinue,
  onSignIn,
  onBack,
}: {
  // Passes the verified inputs forward; `password` is held in memory only for
  // the immediately-following OTP → login step and never persisted here.
  // `verifyChannel` tells the OTP screen which identifier to confirm/log in
  // with. Email is the identifier that works TODAY (SMS via Termii is pending
  // sender-ID approval); phone stays supported for when it's live.
  onContinue: (args: {
    email: string;
    phone: string;
    country: (typeof COUNTRIES)[0];
    password: string;
    verifyChannel: 'email' | 'phone';
  }) => void;
  onSignIn: () => void;
  onBack: () => void;
}) {
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [showPicker, setShowPicker] = useState(false);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [focused, setFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [shake, setShake] = useState(false);
  // Backend `POST /auth/register/customer` requires name + password up front
  // (the OTP is only dispatched after a successful register). The Figma
  // onboarding screen collects neither, so these fields are an intentional,
  // backend-mandated deviation — logged in the Figma diff register and flagged
  // for founder review. Registration needs an email OR a phone; the customer
  // portal does not require phone verification, so an email-only signup fully
  // activates the account (verify the email code → ACTIVE → order).
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [nameFocused, setNameFocused] = useState(false);
  const [pwFocused, setPwFocused] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const phoneDigits = phone.replace(/\D/g, '');
  const phoneValid = phoneDigits.length >= 7;
  const nameValid = name.trim().length >= 2;
  // Mirror the backend password policy exactly (min 8, at least one lowercase,
  // one uppercase, one digit) so the user gets immediate feedback instead of a
  // server-side rejection after submit.
  const pwValid =
    password.length >= 8 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password);
  // Email is a required, persistent identifier on every DrippleX registration
  // (founder decision) and the customer backend enforces it — so require a valid
  // email here rather than accepting phone-only, which the API would reject.
  // Phone stays optional.
  const isValid = nameValid && pwValid && emailValid;

  const handleContinue = async () => {
    if (!isValid) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }
    setErr(null);
    setSubmitting(true);
    // Split the collected name into first/last (backend requires both,
    // non-empty). A single-token name reuses it for the last name.
    const parts = name.trim().split(/\s+/);
    const firstName = parts[0];
    const lastName = parts.length > 1 ? parts.slice(1).join(' ') : parts[0];
    const trimmedEmail = email.trim().toLowerCase();
    const e164 = `${country.code}${phoneDigits}`;
    // Email is required and is the activation channel (email-first while SMS is
    // pending); phone is recorded when provided.
    const verifyChannel: 'email' | 'phone' = 'email';
    try {
      await api.auth.registerCustomer({
        firstName,
        lastName,
        password,
        email: trimmedEmail,
        ...(phoneValid ? { phone: e164 } : {}),
      });
      onContinue({ email: trimmedEmail, phone, country, password, verifyChannel });
    } catch (e) {
      const ae = e as { status?: number; message?: string };
      if (ae?.status === 409) {
        setErr('This email or number is already registered. Please sign in instead.');
      } else {
        setErr(ae?.message || 'Could not create your account. Please try again.');
      }
      setSubmitting(false);
    }
  };

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{
        background: `linear-gradient(155deg,${NAVY_DEEP} 0%,${NAVY_BASE} 55%,#0B1D2F 100%)`,
      }}
    >
      <Ambient />
      <StatusBar />
      <div
        className="relative z-10 flex flex-1 flex-col overflow-y-auto"
        style={{ scrollbarWidth: 'none' }}
      >
        <div className="px-6 pb-1 pt-3">
          <BackBtn onPress={onBack} />
        </div>
        <div className="px-7 pb-2 pt-3">
          <Logo width={148} />
        </div>
        <div
          className="flex flex-col gap-2 px-7 pb-5 pt-5"
          style={{ animation: 'slide-in-right .42s cubic-bezier(.25,.46,.45,.94) .05s both' }}
        >
          <h1
            className="text-[28px] font-bold leading-tight text-white"
            style={{ fontFamily: "'Poppins',sans-serif", letterSpacing: '-0.022em' }}
          >
            Welcome to DrippleX
          </h1>
          <p
            className="text-[14px] leading-relaxed"
            style={{ fontFamily: "'Inter',sans-serif", color: MUTED }}
          >
            Create your account with your email or phone number.
          </p>
        </div>
        <div
          className="mx-5 flex flex-col gap-5 rounded-3xl px-5 py-5"
          style={{
            background: `linear-gradient(145deg,${NAVY_SURFACE},${NAVY_CARD})`,
            border: `1px solid ${BORDER}`,
            boxShadow: '0 20px 60px rgba(0,0,0,.4)',
            animation: 'slide-in-right .42s cubic-bezier(.25,.46,.45,.94) .12s both',
          }}
        >
          <div className="flex flex-col gap-2">
            <label
              className="text-[11px] font-medium uppercase tracking-widest"
              style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.3)' }}
            >
              Full Name
            </label>
            <div
              className="flex h-[54px] items-center gap-3 rounded-xl px-4 transition-all duration-200"
              style={{
                background: 'rgba(255,255,255,.05)',
                border: nameFocused ? `1.5px solid ${G2}` : `1.5px solid ${BORDER}`,
                boxShadow: nameFocused ? `0 0 0 3px rgba(43,172,82,.11)` : 'none',
              }}
            >
              <input
                type="text"
                autoComplete="name"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
                className="placeholder:text-white/22 flex-1 bg-transparent text-[15px] text-white outline-none"
                style={{ fontFamily: "'Inter',sans-serif" }}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label
              className="text-[11px] font-medium uppercase tracking-widest"
              style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.3)' }}
            >
              Email
            </label>
            <div
              className="flex h-[54px] items-center gap-3 rounded-xl px-4 transition-all duration-200"
              style={{
                background: 'rgba(255,255,255,.05)',
                border: emailFocused ? `1.5px solid ${G2}` : `1.5px solid ${BORDER}`,
                boxShadow: emailFocused ? `0 0 0 3px rgba(43,172,82,.11)` : 'none',
              }}
            >
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                className="placeholder:text-white/22 flex-1 bg-transparent text-[15px] text-white outline-none"
                style={{ fontFamily: "'Inter',sans-serif" }}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label
              className="text-[11px] font-medium uppercase tracking-widest"
              style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.3)' }}
            >
              Country
            </label>
            <button
              onClick={() => setShowPicker((v) => !v)}
              className="flex h-[54px] items-center justify-between rounded-xl px-4 transition-all"
              style={{
                background: 'rgba(255,255,255,.05)',
                border: showPicker ? `1.5px solid ${G2}` : `1.5px solid ${BORDER}`,
                boxShadow: showPicker ? `0 0 0 3px rgba(43,172,82,.11)` : 'none',
              }}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{country.flag}</span>
                <span
                  className="text-[15px] font-medium text-white"
                  style={{ fontFamily: "'Inter',sans-serif" }}
                >
                  {country.name}
                </span>
                <span
                  className="text-sm"
                  style={{ fontFamily: "'Inter',sans-serif", color: MUTED }}
                >
                  {country.code}
                </span>
              </div>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="rgba(255,255,255,.35)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  transform: showPicker ? 'rotate(180deg)' : 'none',
                  transition: 'transform .2s',
                }}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {showPicker && (
              <div
                className="overflow-hidden rounded-xl"
                style={{
                  border: `1px solid ${BORDER}`,
                  background: NAVY_CARD,
                  boxShadow: '0 16px 48px rgba(0,0,0,.5)',
                }}
              >
                {COUNTRIES.map((c, i) => (
                  <button
                    key={c.code}
                    onClick={() => {
                      setCountry(c);
                      setShowPicker(false);
                    }}
                    className="flex h-[46px] w-full items-center gap-3 px-4 transition-all"
                    style={{
                      background: c.code === country.code ? 'rgba(43,172,82,.12)' : 'transparent',
                      borderBottom:
                        i < COUNTRIES.length - 1 ? '1px solid rgba(255,255,255,.05)' : 'none',
                    }}
                  >
                    <span className="text-lg">{c.flag}</span>
                    <span
                      className="flex-1 text-left text-[14px] text-white"
                      style={{ fontFamily: "'Inter',sans-serif" }}
                    >
                      {c.name}
                    </span>
                    <span
                      className="text-sm"
                      style={{ fontFamily: "'Inter',sans-serif", color: MUTED }}
                    >
                      {c.code}
                    </span>
                    {c.code === country.code && <CheckIcon />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <label
              className="text-[11px] font-medium uppercase tracking-widest"
              style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.3)' }}
            >
              Phone Number (optional)
            </label>
            <div
              className="flex h-[54px] items-center gap-3 rounded-xl px-4 transition-all duration-200"
              style={{
                background: 'rgba(255,255,255,.05)',
                border: focused ? `1.5px solid ${G2}` : `1.5px solid ${BORDER}`,
                boxShadow: focused ? `0 0 0 3px rgba(43,172,82,.11)` : 'none',
                animation: shake ? 'shake .45s ease' : 'none',
              }}
            >
              <span
                className="shrink-0 border-r pr-3 text-[14px] font-medium"
                style={{
                  fontFamily: "'Inter',sans-serif",
                  color: G3,
                  borderColor: 'rgba(255,255,255,.1)',
                }}
              >
                {country.code}
              </span>
              <input
                type="tel"
                inputMode="numeric"
                placeholder="801 234 5678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                className="placeholder:text-white/22 flex-1 bg-transparent text-[15px] text-white outline-none"
                style={{ fontFamily: "'Inter',sans-serif" }}
              />
              {phone.length > 0 && (
                <button
                  onClick={() => setPhone('')}
                  className="shrink-0 opacity-40 transition-opacity hover:opacity-80"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label
              className="text-[11px] font-medium uppercase tracking-widest"
              style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.3)' }}
            >
              Password
            </label>
            <div
              className="flex h-[54px] items-center gap-3 rounded-xl px-4 transition-all duration-200"
              style={{
                background: 'rgba(255,255,255,.05)',
                border: pwFocused ? `1.5px solid ${G2}` : `1.5px solid ${BORDER}`,
                boxShadow: pwFocused ? `0 0 0 3px rgba(43,172,82,.11)` : 'none',
              }}
            >
              <input
                type={showPw ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="8+ chars, with a capital & number"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setPwFocused(true)}
                onBlur={() => setPwFocused(false)}
                className="placeholder:text-white/22 flex-1 bg-transparent text-[15px] text-white outline-none"
                style={{ fontFamily: "'Inter',sans-serif" }}
              />
              {password.length > 0 && (
                <button
                  onClick={() => setShowPw((v) => !v)}
                  className="shrink-0 text-[12px] font-medium opacity-50 transition-opacity hover:opacity-90"
                  style={{ fontFamily: "'Inter',sans-serif", color: G3 }}
                >
                  {showPw ? 'Hide' : 'Show'}
                </button>
              )}
            </div>
            {password.length > 0 && !pwValid && (
              <p
                className="pl-1 text-[11px]"
                style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.4)' }}
              >
                Use at least 8 characters with an uppercase letter and a number.
              </p>
            )}
          </div>
          {err && (
            <p
              className="text-[13px] leading-relaxed"
              style={{ fontFamily: "'Inter',sans-serif", color: '#E53935' }}
            >
              {err}
            </p>
          )}
          <div className="flex items-start gap-2.5 px-1">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke={G2}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mt-0.5 shrink-0"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <p
              className="text-[12px] leading-relaxed"
              style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.34)' }}
            >
              We'll send a one-time code to verify your email (or phone) — no password needed to
              receive it.
            </p>
          </div>
        </div>
        <div
          className="flex flex-col gap-4 px-7 pt-5"
          style={{ animation: 'slide-in-right .42s cubic-bezier(.25,.46,.45,.94) .2s both' }}
        >
          <GreenBtn
            label={submitting ? 'Creating account…' : 'Continue'}
            disabled={!isValid || submitting}
            onClick={handleContinue}
            icon={<ArrowIcon />}
          />
          <p
            className="text-center text-[14px]"
            style={{ fontFamily: "'Inter',sans-serif", color: MUTED }}
          >
            Already have an account?{' '}
            <button
              onClick={onSignIn}
              className="font-semibold underline underline-offset-2 transition-opacity active:opacity-70"
              style={{ color: G3 }}
            >
              Sign In
            </button>
          </p>
          <Divider />
          <button
            className="flex h-[54px] w-full items-center justify-center gap-3 rounded-2xl text-[15px] font-medium transition-all active:scale-[0.97]"
            style={{
              fontFamily: "'Poppins',sans-serif",
              color: 'rgba(255,255,255,.7)',
              background: 'rgba(255,255,255,.04)',
              border: `1.5px solid ${BORDER}`,
            }}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke={G2}
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" />
              <path d="M14 13.12c0 2.38 0 6.38-1 8.88" />
              <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02" />
              <path d="M2 12a10 10 0 0 1 18-6" />
              <path d="M2 16h.01" />
              <path d="M21.8 16c.2-2 .131-5.354 0-6" />
              <path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2" />
              <path d="M8.65 22c.21-.66.45-1.32.57-2" />
              <path d="M9 6.8a6 6 0 0 1 9 5.2v2" />
            </svg>
            Use Biometric Authentication
          </button>
          <p
            className="-mt-2 text-center text-[11px]"
            style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.22)' }}
          >
            Fingerprint · Face ID
          </p>
        </div>
        <div className="flex items-center justify-center gap-4 px-7 pb-10 pt-5">
          {['Terms of Service', 'Privacy Policy'].map((t, i) => (
            <span key={t} className="flex items-center gap-4">
              <button
                className="text-[12px] underline underline-offset-2"
                style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.26)' }}
              >
                {t}
              </button>
              {i === 0 && <span style={{ color: 'rgba(255,255,255,.14)' }}>·</span>}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTH-004 — OTP VERIFICATION (enhanced)
// ═══════════════════════════════════════════════════════════════════════════
export type OTPError = 'invalid' | 'expired' | 'attempts' | 'network' | null;
export type OTPStatus = 'idle' | 'verifying' | 'success';

export const ERROR_CONFIG: Record<
  NonNullable<OTPError>,
  { icon: string; color: string; title: string; message: string; action: string }
> = {
  invalid: {
    icon: '✕',
    color: '#E53935',
    title: 'Incorrect Code',
    message: "The code you entered doesn't match. Please try again.",
    action: 'Try Again',
  },
  expired: {
    icon: '⏱',
    color: '#F59E0B',
    title: 'Code Expired',
    message: 'Your verification code has expired. Please request a new one.',
    action: 'Resend Code',
  },
  attempts: {
    icon: '⚠',
    color: '#EF4444',
    title: 'Too Many Attempts',
    message: "You've reached the maximum attempts. Wait 30 minutes before retrying.",
    action: 'Contact Support',
  },
  network: {
    icon: '⚡',
    color: '#6366F1',
    title: 'Connection Error',
    message: "We couldn't verify your code. Please check your connection and try again.",
    action: 'Retry',
  },
};

export function OTPScreen({
  phone,
  country,
  email,
  verifyChannel = 'phone',
  password,
  persona = 'customer',
  onBack,
  onChangeNumber,
  onVerified,
}: {
  phone: string;
  country: (typeof COUNTRIES)[0];
  // The email identifier, when the account is being verified by email code.
  email?: string;
  // Which identifier this code confirms. 'email' is the path that works today
  // (SMS via Termii is pending sender-ID approval); 'phone' once SMS is live.
  verifyChannel?: 'email' | 'phone';
  // Present during registration: after the identifier is verified the account
  // is ACTIVE, so we immediately log in with it and persist the session before
  // moving on. Absent (undefined) for any non-registration use of this screen.
  password?: string;
  // Which portal to log in through after verification. Customer for consumer
  // signup; merchant/driver/rider for partner onboarding (they activate on the
  // email code while PORTAL_EMAIL_ACTIVATION is on, then land in pending review).
  persona?: 'customer' | 'merchant' | 'driver' | 'rider';
  onBack: () => void;
  onChangeNumber: () => void;
  onVerified: () => void;
}) {
  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']);
  const [focused, setFocused] = useState<number>(-1);
  const [resend, setResend] = useState(45);
  const [error, setError] = useState<OTPError>(null);
  const [status, setStatus] = useState<OTPStatus>('idle');
  const [shake, setShake] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const filled = otp.every((d) => d !== '');
  // What we show as the destination the code was sent to.
  const displayPhone = verifyChannel === 'email' && email ? email : `${country.code} ${phone}`;

  // Countdown
  useEffect(() => {
    if (resend <= 0) return;
    const t = setInterval(() => setResend((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [resend]);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleChange = useCallback(
    (i: number, val: string) => {
      if (!/^\d?$/.test(val)) return;
      const next = [...otp];
      next[i] = val;
      setOtp(next);
      setError(null);
      if (val && i < 5) setTimeout(() => inputs.current[i + 1]?.focus(), 0);
    },
    [otp],
  );

  const handleKeyDown = useCallback(
    (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Backspace') {
        if (otp[i]) {
          const n = [...otp];
          n[i] = '';
          setOtp(n);
        } else if (i > 0) inputs.current[i - 1]?.focus();
      }
      if (e.key === 'ArrowLeft' && i > 0) inputs.current[i - 1]?.focus();
      if (e.key === 'ArrowRight' && i < 5) inputs.current[i + 1]?.focus();
    },
    [otp],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
      if (!pasted) return;
      const next = [...otp];
      pasted.split('').forEach((d, i) => {
        if (i < 6) next[i] = d;
      });
      setOtp(next);
      setError(null);
      const nextEmpty = next.findIndex((d) => d === '');
      const focusIdx = nextEmpty === -1 ? 5 : nextEmpty;
      setTimeout(() => inputs.current[focusIdx]?.focus(), 0);
    },
    [otp],
  );

  const e164 = `${country.code}${phone.replace(/\D/g, '')}`;
  const emailId = (email ?? '').trim().toLowerCase();
  const useEmail = verifyChannel === 'email' && emailId.length > 0;

  const handleVerify = async () => {
    if (!filled) {
      triggerShake();
      return;
    }
    setStatus('verifying');
    try {
      // Confirm the OTP → activates the account (PENDING_VERIFICATION → ACTIVE).
      // Email code: POST /auth/verify/email { email, otp }.
      // Phone code: POST /auth/phone/verify { phone, otp }.
      if (useEmail) {
        await api.auth.verifyEmailOtp({ email: emailId, otp: otp.join('') });
      } else {
        await api.auth.verifyPhoneOtp({ phone: e164, otp: otp.join('') });
      }
      // Registration path: the account is now ACTIVE, so log in and persist the
      // session so the user lands authenticated (Home works, orders can be
      // placed). Login uses the same identifier + password from registration.
      if (password) {
        const creds = useEmail ? { email: emailId, password } : { phone: e164, password };
        const loginFn =
          persona === 'merchant'
            ? api.auth.loginMerchant
            : persona === 'driver'
              ? api.auth.loginDriver
              : persona === 'rider'
                ? api.auth.loginRider
                : api.auth.loginCustomer;
        const res = await loginFn(creds);
        if (res.accessToken && res.refreshToken) {
          auth.setTokens(res.accessToken, res.refreshToken);
        }
        if (res.user) auth.setUser(res.user as Parameters<typeof auth.setUser>[0]);
      }
      setStatus('success');
      setTimeout(onVerified, 1600);
    } catch {
      setStatus('idle');
      setError('invalid');
      triggerShake();
    }
  };

  const handleResend = () => {
    setResend(45);
    setOtp(['', '', '', '', '', '']);
    setError(null);
    inputs.current[0]?.focus();
    // Best-effort re-dispatch of the code; UI countdown resets regardless.
    const resendReq = useEmail
      ? api.auth.resendEmailOtp({ email: emailId })
      : api.auth.resendPhoneOtp({ phone: e164 });
    void resendReq.catch(() => {});
  };
  const handleErrorAction = (err: NonNullable<OTPError>) => {
    if (err === 'expired' || err === 'network') handleResend();
    else {
      setError(null);
      setOtp(['', '', '', '', '', '']);
    }
  };

  // ── Success state ──────────────────────────────────────────────────────
  if (status === 'success') {
    return (
      <div
        className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden"
        style={{
          background: `linear-gradient(155deg,${NAVY_DEEP} 0%,${NAVY_BASE} 55%,#0B1D2F 100%)`,
        }}
      >
        <Ambient />
        <div
          className="relative z-10 flex flex-col items-center gap-6"
          style={{ animation: 'success-bounce .6s cubic-bezier(.34,1.56,.64,1) both' }}
        >
          {/* Animated success ring + checkmark */}
          <div
            className="relative flex items-center justify-center"
            style={{ width: 120, height: 120 }}
          >
            {/* Pulse rings */}
            <div
              className="absolute inset-0 rounded-full"
              style={{
                border: `2px solid ${G2}`,
                animation: 'pulse-ring 1.2s ease-out .3s infinite',
              }}
            />
            <div
              className="absolute inset-0 rounded-full"
              style={{
                border: `2px solid ${G2}`,
                animation: 'pulse-ring 1.2s ease-out .6s infinite',
              }}
            />
            {/* Circle */}
            <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
              <circle
                cx="60"
                cy="60"
                r="54"
                stroke={`url(#sg)`}
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray="339"
                strokeDashoffset="0"
                style={{ animation: 'circle-draw .6s ease both' }}
              />
              <defs>
                <linearGradient
                  id="sg"
                  x1="0"
                  y1="0"
                  x2="120"
                  y2="120"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor={G0} />
                  <stop offset="1" stopColor={G3} />
                </linearGradient>
              </defs>
            </svg>
            {/* Checkmark */}
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="absolute">
              <path
                d="M10 24l12 12 18-18"
                stroke="white"
                strokeWidth="4.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="60"
                strokeDashoffset="0"
                style={{ animation: 'check-draw .4s ease .5s both' }}
              />
            </svg>
          </div>

          <div className="flex flex-col items-center gap-2 px-8 text-center">
            <h2
              className="text-[26px] font-bold text-white"
              style={{ fontFamily: "'Poppins',sans-serif", letterSpacing: '-0.02em' }}
            >
              Phone Number Verified
            </h2>
            <p className="text-[15px]" style={{ fontFamily: "'Inter',sans-serif", color: G3 }}>
              Welcome to DrippleX
            </p>
            <p
              className="mt-1 text-[13px]"
              style={{ fontFamily: "'Inter',sans-serif", color: MUTED }}
            >
              Setting up your account…
            </p>
          </div>

          {/* Loading dots */}
          <div className="flex items-center gap-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-2 w-2 rounded-full"
                style={{
                  background: G2,
                  animation: `otp-pop .6s ease ${i * 0.15}s infinite alternate`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Main OTP UI ────────────────────────────────────────────────────────
  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{
        background: `linear-gradient(155deg,${NAVY_DEEP} 0%,${NAVY_BASE} 55%,#0B1D2F 100%)`,
      }}
    >
      <Ambient />
      <StatusBar />

      <div
        className="relative z-10 flex flex-1 flex-col overflow-y-auto"
        style={{ scrollbarWidth: 'none' }}
      >
        {/* Nav */}
        <div className="px-6 pb-1 pt-3">
          <BackBtn onPress={onBack} />
        </div>
        <div className="px-7 pb-1 pt-2">
          <Logo width={138} />
        </div>

        {/* Heading */}
        <div
          className="flex flex-col gap-2 px-7 pb-2 pt-5"
          style={{ animation: 'slide-in-right .42s cubic-bezier(.25,.46,.45,.94) .05s both' }}
        >
          <h1
            className="text-[26px] font-bold leading-tight text-white"
            style={{ fontFamily: "'Poppins',sans-serif", letterSpacing: '-0.022em' }}
          >
            Verify Your Phone Number
          </h1>
          <div>
            <p
              className="text-[14px] leading-relaxed"
              style={{ fontFamily: "'Inter',sans-serif", color: MUTED }}
            >
              We've sent a 6-digit verification code to
            </p>
            <div className="mt-1 flex items-center gap-2">
              <span
                className="text-[15px] font-semibold text-white"
                style={{ fontFamily: "'Inter',sans-serif" }}
              >
                {displayPhone}
              </span>
              <button
                onClick={onChangeNumber}
                className="text-[13px] font-medium underline underline-offset-2 active:opacity-60"
                style={{ fontFamily: "'Inter',sans-serif", color: G3 }}
              >
                Change
              </button>
            </div>
          </div>
        </div>

        {/* OTP boxes */}
        <div
          className="px-7 pb-1 pt-4"
          style={{ animation: 'slide-in-right .42s cubic-bezier(.25,.46,.45,.94) .1s both' }}
        >
          <div className="flex gap-2.5" style={{ animation: shake ? 'shake .45s ease' : 'none' }}>
            {otp.map((digit, i) => {
              const isFocused = focused === i;
              const hasDigit = digit !== '';
              const isError = error === 'invalid' || error === 'expired';
              return (
                <input
                  key={i}
                  ref={(el) => {
                    inputs.current[i] = el;
                  }}
                  type="tel"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  autoComplete="one-time-code"
                  aria-label={`Digit ${i + 1} of 6`}
                  onChange={(e) => handleChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  onPaste={handlePaste}
                  onFocus={() => setFocused(i)}
                  onBlur={() => setFocused(-1)}
                  className="flex-1 rounded-2xl text-center font-bold text-white outline-none transition-all duration-150"
                  style={{
                    height: 62,
                    fontSize: 24,
                    fontFamily: "'Poppins',sans-serif",
                    background: hasDigit
                      ? 'rgba(43,172,82,.14)'
                      : isFocused
                        ? 'rgba(255,255,255,.07)'
                        : 'rgba(255,255,255,.05)',
                    border: isError
                      ? '1.5px solid #E53935'
                      : isFocused
                        ? `2px solid ${G2}`
                        : hasDigit
                          ? `1.5px solid ${G2}`
                          : `1.5px solid ${BORDER}`,
                    boxShadow: isFocused
                      ? `0 0 0 3px rgba(43,172,82,.15), 0 0 20px rgba(43,172,82,.1)`
                      : hasDigit && !isError
                        ? `0 0 12px rgba(43,172,82,.12)`
                        : 'none',
                    transform: isFocused ? 'scale(1.06)' : 'scale(1)',
                    minWidth: 0,
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div
            className="mx-7 mt-3 flex items-start gap-3 rounded-2xl px-4 py-3"
            style={{
              background: `${ERROR_CONFIG[error].color}18`,
              border: `1px solid ${ERROR_CONFIG[error].color}40`,
              animation: 'slide-in-right .3s ease both',
            }}
          >
            <span className="mt-0.5 text-lg">{ERROR_CONFIG[error].icon}</span>
            <div className="min-w-0 flex-1">
              <p
                className="text-[13px] font-semibold"
                style={{ fontFamily: "'Poppins',sans-serif", color: ERROR_CONFIG[error].color }}
              >
                {ERROR_CONFIG[error].title}
              </p>
              <p
                className="mt-0.5 text-[12px] leading-relaxed"
                style={{ fontFamily: "'Inter',sans-serif", color: MUTED }}
              >
                {ERROR_CONFIG[error].message}
              </p>
            </div>
            <button
              onClick={() => handleErrorAction(error)}
              className="shrink-0 rounded-lg px-3 py-1.5 text-[12px] font-semibold active:opacity-70"
              style={{
                fontFamily: "'Inter',sans-serif",
                color: ERROR_CONFIG[error].color,
                background: `${ERROR_CONFIG[error].color}22`,
                border: `1px solid ${ERROR_CONFIG[error].color}40`,
              }}
            >
              {ERROR_CONFIG[error].action}
            </button>
          </div>
        )}

        {/* Timer + resend */}
        <div
          className="flex items-center justify-between px-7 pb-1 pt-4"
          style={{ animation: 'slide-in-right .42s cubic-bezier(.25,.46,.45,.94) .15s both' }}
        >
          <span className="text-[13px]" style={{ fontFamily: "'Inter',sans-serif", color: MUTED }}>
            {resend > 0 ? (
              <>
                Resend code in{' '}
                <span style={{ color: G3, fontVariantNumeric: 'tabular-nums' }}>
                  00:{resend.toString().padStart(2, '0')}
                </span>
              </>
            ) : (
              "Didn't receive the code?"
            )}
          </span>
          {resend <= 0 && (
            <button
              onClick={handleResend}
              className="text-[13px] font-semibold underline underline-offset-2 active:opacity-60"
              style={{ fontFamily: "'Inter',sans-serif", color: G3 }}
            >
              Resend Code
            </button>
          )}
        </div>

        {/* Verify button */}
        <div
          className="px-7 pt-3"
          style={{ animation: 'slide-in-right .42s cubic-bezier(.25,.46,.45,.94) .2s both' }}
        >
          <GreenBtn
            label="Verify"
            disabled={!filled}
            loading={status === 'verifying'}
            onClick={handleVerify}
            icon={filled && status !== 'verifying' ? <CheckIcon /> : undefined}
          />
        </div>

        {/* Security card */}
        <div
          className="mx-5 mt-4 flex items-start gap-3 rounded-2xl px-4 py-4"
          style={{
            background: `linear-gradient(145deg,${NAVY_SURFACE},${NAVY_CARD})`,
            border: `1px solid rgba(43,172,82,.12)`,
            animation: 'slide-in-right .42s cubic-bezier(.25,.46,.45,.94) .25s both',
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke={G2}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mt-0.5 shrink-0"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <p
            className="text-[12px] leading-relaxed"
            style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.4)' }}
          >
            <span className="font-semibold text-white/60">Your security is important.</span> We use
            one-time passwords to securely verify your phone number. Never share your verification
            code with anyone.
          </p>
        </div>

        {/* Help section */}
        <div
          className="px-7 pb-1 pt-4"
          style={{ animation: 'slide-in-right .42s cubic-bezier(.25,.46,.45,.94) .3s both' }}
        >
          <button
            onClick={() => setShowHelp((v) => !v)}
            className="flex items-center gap-2 text-[13px] transition-opacity active:opacity-70"
            style={{ fontFamily: "'Inter',sans-serif", color: MUTED }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <path d="M12 17h.01" />
            </svg>
            Need help receiving the code?
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                transform: showHelp ? 'rotate(180deg)' : 'none',
                transition: 'transform .2s',
              }}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {showHelp && (
            <div
              className="mt-3 flex flex-col gap-2.5 rounded-xl px-4 py-4"
              style={{
                background: 'rgba(255,255,255,.04)',
                border: `1px solid ${BORDER}`,
                animation: 'fade-in .2s ease both',
              }}
            >
              {[
                'Check your network connection.',
                'Confirm your phone number is correct.',
                'Request a new code after the timer expires.',
              ].map((tip, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span
                    className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                    style={{
                      background: 'rgba(43,172,82,.2)',
                      color: G3,
                      fontFamily: "'Poppins',sans-serif",
                    }}
                  >
                    {i + 1}
                  </span>
                  <p
                    className="text-[12px] leading-relaxed"
                    style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.4)' }}
                  >
                    {tip}
                  </p>
                </div>
              ))}
              <button
                className="mt-1 self-start text-[12px] font-semibold underline underline-offset-2 active:opacity-60"
                style={{ fontFamily: "'Inter',sans-serif", color: G3 }}
              >
                Contact Support
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-4 px-7 pb-10 pt-4">
          {['Terms of Service', 'Privacy Policy'].map((t, i) => (
            <span key={t} className="flex items-center gap-4">
              <button
                className="text-[12px] underline underline-offset-2"
                style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.25)' }}
              >
                {t}
              </button>
              {i === 0 && <span style={{ color: 'rgba(255,255,255,.14)' }}>·</span>}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTH-005 — PROFILE SETUP
// ═══════════════════════════════════════════════════════════════════════════
export const INTERESTS = [
  { id: 'shopping', emoji: '🛍', label: 'Shopping' },
  { id: 'ride', emoji: '🚖', label: 'Ride' },
  { id: 'food', emoji: '🍽', label: 'Food' },
  { id: 'pharmacy', emoji: '💊', label: 'Pharmacy' },
  { id: 'business', emoji: '💼', label: 'Business' },
  { id: 'entertainment', emoji: '🎉', label: 'Entertainment' },
];

export const GENDERS = ['Male', 'Female', 'Prefer not to say'] as const;

export function ProfileSetupScreen({
  onContinue,
  onSkip,
  onBack,
}: {
  onContinue: () => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  const [hasPhoto, setHasPhoto] = useState(false);
  const [showPhotoMenu, setShowPhotoMenu] = useState(false);
  // Pre-fill with the name captured at registration so this screen edits the
  // real account name rather than starting blank.
  const [fullName, setFullName] = useState(() => {
    const u = auth.getUser() as { firstName?: string; lastName?: string } | null;
    return [u?.firstName, u?.lastName].filter(Boolean).join(' ');
  });
  const [gender, setGender] = useState<(typeof GENDERS)[number] | ''>('');
  const [dob, setDob] = useState({ day: '', month: '', year: '' });
  const [interests, setInterests] = useState<Set<string>>(new Set());
  const [nameFocused, setNameFocused] = useState(false);
  const [chipAnimating, setChipAnimating] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Persist the edited name to the real account, then continue. Enrichment is
  // best-effort — the account already has a name from registration, so a
  // failed PATCH must not trap the user on onboarding.
  const handleContinue = async () => {
    if (!canContinue) return;
    setSaving(true);
    const parts = fullName.trim().split(/\s+/);
    const firstName = parts[0];
    const lastName = parts.length > 1 ? parts.slice(1).join(' ') : parts[0];
    try {
      await api.auth.updateMe({ firstName, lastName });
      const u = auth.getUser();
      if (u) auth.setUser({ ...u, firstName, lastName });
    } catch {
      /* non-fatal — proceed regardless */
    }
    setSaving(false);
    onContinue();
  };

  const toggleInterest = (id: string) => {
    setChipAnimating(id);
    setTimeout(() => setChipAnimating(null), 400);
    setInterests((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const canContinue = fullName.trim().length > 0;

  const MONTHS = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{
        background: `linear-gradient(155deg,${NAVY_DEEP} 0%,${NAVY_BASE} 55%,#0B1D2F 100%)`,
      }}
    >
      <Ambient />
      <StatusBar />

      <div
        className="relative z-10 flex flex-1 flex-col overflow-y-auto"
        style={{ scrollbarWidth: 'none' }}
      >
        {/* Nav + progress */}
        <div className="flex items-center justify-between px-6 pt-3">
          <BackBtn onPress={onBack} />
          <div className="flex items-center gap-2">
            <span
              className="text-[11px]"
              style={{ fontFamily: "'Inter',sans-serif", color: MUTED }}
            >
              Step 3 of 5
            </span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <div
                  key={s}
                  className="h-1 rounded-full transition-all duration-300"
                  style={{
                    width: s === 3 ? 20 : 6,
                    background: s <= 3 ? G2 : 'rgba(255,255,255,.15)',
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Heading */}
        <div
          className="px-7 pb-2 pt-4"
          style={{ animation: 'slide-in-right .42s cubic-bezier(.25,.46,.45,.94) .04s both' }}
        >
          <h1
            className="text-[26px] font-bold leading-tight text-white"
            style={{ fontFamily: "'Poppins',sans-serif", letterSpacing: '-0.022em' }}
          >
            Complete Your Profile
          </h1>
          <p
            className="mt-1 text-[14px]"
            style={{ fontFamily: "'Inter',sans-serif", color: MUTED }}
          >
            Let's personalize your DrippleX experience.
          </p>
        </div>

        {/* Avatar */}
        <div
          className="flex flex-col items-center pb-4 pt-3"
          style={{ animation: 'slide-in-right .42s cubic-bezier(.25,.46,.45,.94) .08s both' }}
        >
          <div className="relative">
            <button
              onClick={() => setShowPhotoMenu((v) => !v)}
              className="relative flex items-center justify-center overflow-hidden rounded-full transition-all active:scale-95"
              style={{
                width: 96,
                height: 96,
                background: hasPhoto
                  ? `linear-gradient(135deg,${G0},${G2})`
                  : `linear-gradient(145deg,${NAVY_SURFACE},${NAVY_CARD})`,
                border: `2px solid ${hasPhoto ? G2 : BORDER}`,
                boxShadow: hasPhoto
                  ? `0 0 0 3px rgba(43,172,82,.22), 0 12px 32px rgba(43,172,82,.2)`
                  : 'none',
                animation: hasPhoto ? 'avatar-pulse 2.5s ease-in-out infinite' : 'none',
              }}
            >
              {hasPhoto ? (
                <span className="text-4xl">👤</span>
              ) : (
                <svg
                  width="36"
                  height="36"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="rgba(255,255,255,.3)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              )}
            </button>
            <div
              className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full"
              style={{
                background: `linear-gradient(135deg,${G0},${G2})`,
                border: `2px solid ${NAVY_BASE}`,
              }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </div>
          </div>
          {showPhotoMenu && (
            <div
              className="mt-3 overflow-hidden rounded-2xl"
              style={{
                background: NAVY_CARD,
                border: `1px solid ${BORDER}`,
                boxShadow: '0 12px 36px rgba(0,0,0,.5)',
                minWidth: 200,
                animation: 'fade-in .18s ease both',
              }}
            >
              {[
                { label: 'Take Photo', icon: '📷' },
                { label: 'Choose from Gallery', icon: '🖼' },
              ].map((opt, i) => (
                <button
                  key={opt.label}
                  onClick={() => {
                    setHasPhoto(true);
                    setShowPhotoMenu(false);
                  }}
                  className="flex h-[48px] w-full items-center gap-3 px-5 transition-all active:bg-white/5"
                  style={{ borderBottom: i === 0 ? `1px solid rgba(255,255,255,.06)` : 'none' }}
                >
                  <span>{opt.icon}</span>
                  <span
                    className="text-[14px] text-white"
                    style={{ fontFamily: "'Inter',sans-serif" }}
                  >
                    {opt.label}
                  </span>
                </button>
              ))}
            </div>
          )}
          {!hasPhoto && (
            <button
              onClick={() => {}}
              className="mt-3 text-[12px] transition-opacity active:opacity-60"
              style={{ fontFamily: "'Inter',sans-serif", color: MUTED }}
            >
              Skip for Now
            </button>
          )}
          {!showPhotoMenu && (
            <p
              className="mt-2 text-[12px]"
              style={{ fontFamily: "'Inter',sans-serif", color: MUTED }}
            >
              {hasPhoto ? 'Tap to change photo' : 'Add Photo (Optional)'}
            </p>
          )}
        </div>

        {/* Form card */}
        <div
          className="mx-5 flex flex-col gap-4 rounded-3xl px-5 py-5"
          style={{
            background: `linear-gradient(145deg,${NAVY_SURFACE},${NAVY_CARD})`,
            border: `1px solid ${BORDER}`,
            boxShadow: '0 20px 60px rgba(0,0,0,.35)',
            animation: 'slide-in-right .42s cubic-bezier(.25,.46,.45,.94) .12s both',
          }}
        >
          {/* Full Name */}
          <div className="flex flex-col gap-1.5">
            <label
              className="text-[11px] font-medium uppercase tracking-widest"
              style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.3)' }}
            >
              Full Name
            </label>
            <div
              className="flex h-[52px] items-center gap-3 rounded-xl px-4 transition-all duration-200"
              style={{
                background: 'rgba(255,255,255,.05)',
                border: nameFocused ? `1.5px solid ${G2}` : `1.5px solid ${BORDER}`,
                boxShadow: nameFocused ? `0 0 0 3px rgba(43,172,82,.11)` : 'none',
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="rgba(255,255,255,.3)"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <input
                type="text"
                placeholder="Enter your full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
                className="flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-white/20"
                style={{ fontFamily: "'Inter',sans-serif" }}
              />
            </div>
          </div>

          {/* Username field removed — DrippleX uses phone (primary) + optional
              email + name as stable identity. "No username" is a locked founder
              decision; the prior mock username field contradicted it. */}

          {/* Gender */}
          <div className="flex flex-col gap-2">
            <label
              className="text-[11px] font-medium uppercase tracking-widest"
              style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.3)' }}
            >
              Gender (Optional)
            </label>
            <div className="flex gap-2">
              {GENDERS.map((g) => (
                <button
                  key={g}
                  onClick={() => setGender(g === gender ? '' : g)}
                  className="h-[40px] flex-1 rounded-xl text-[12px] font-medium transition-all active:scale-95"
                  style={{
                    fontFamily: "'Inter',sans-serif",
                    background: gender === g ? `rgba(43,172,82,.18)` : 'rgba(255,255,255,.04)',
                    border: gender === g ? `1.5px solid ${G2}` : `1.5px solid ${BORDER}`,
                    color: gender === g ? G3 : 'rgba(255,255,255,.5)',
                    boxShadow: gender === g ? `0 0 0 2px rgba(43,172,82,.1)` : 'none',
                  }}
                >
                  {g === 'Prefer not to say' ? '— Prefer not' : g}
                </button>
              ))}
            </div>
          </div>

          {/* Date of Birth */}
          <div className="flex flex-col gap-2">
            <label
              className="text-[11px] font-medium uppercase tracking-widest"
              style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.3)' }}
            >
              Date of Birth (Optional)
            </label>
            <div className="flex gap-2">
              {/* Day */}
              <div
                className="flex h-[48px] flex-1 items-center rounded-xl px-3"
                style={{ background: 'rgba(255,255,255,.05)', border: `1.5px solid ${BORDER}` }}
              >
                <input
                  type="number"
                  placeholder="DD"
                  min="1"
                  max="31"
                  value={dob.day}
                  onChange={(e) => setDob((p) => ({ ...p, day: e.target.value }))}
                  className="w-full bg-transparent text-center text-[14px] text-white outline-none placeholder:text-white/20"
                  style={{ fontFamily: "'Inter',sans-serif", MozAppearance: 'textfield' }}
                />
              </div>
              {/* Month */}
              <div
                className="flex h-[48px] flex-[1.6] items-center rounded-xl px-3"
                style={{ background: 'rgba(255,255,255,.05)', border: `1.5px solid ${BORDER}` }}
              >
                <select
                  value={dob.month}
                  onChange={(e) => setDob((p) => ({ ...p, month: e.target.value }))}
                  className="w-full cursor-pointer bg-transparent text-[14px] text-white outline-none"
                  style={{
                    fontFamily: "'Inter',sans-serif",
                    color: dob.month ? 'white' : 'rgba(255,255,255,.25)',
                    background: NAVY_CARD,
                  }}
                >
                  <option value="" style={{ background: NAVY_CARD }}>
                    Month
                  </option>
                  {MONTHS.map((m, i) => (
                    <option key={m} value={i + 1} style={{ background: NAVY_CARD }}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              {/* Year */}
              <div
                className="flex h-[48px] flex-[1.2] items-center rounded-xl px-3"
                style={{ background: 'rgba(255,255,255,.05)', border: `1.5px solid ${BORDER}` }}
              >
                <input
                  type="number"
                  placeholder="YYYY"
                  min="1920"
                  max="2010"
                  value={dob.year}
                  onChange={(e) => setDob((p) => ({ ...p, year: e.target.value }))}
                  className="w-full bg-transparent text-center text-[14px] text-white outline-none placeholder:text-white/20"
                  style={{ fontFamily: "'Inter',sans-serif", MozAppearance: 'textfield' }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* AI Personalization */}
        <div
          className="mx-5 mt-4 rounded-3xl px-5 py-5"
          style={{
            background: `linear-gradient(145deg,${NAVY_SURFACE},${NAVY_CARD})`,
            border: `1px solid rgba(43,172,82,.14)`,
            boxShadow: '0 0 0 1px transparent',
            animation: 'slide-in-right .42s cubic-bezier(.25,.46,.45,.94) .18s both',
          }}
        >
          <div className="mb-1 flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
              style={{ background: `linear-gradient(135deg,${G0},${G2})` }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2a10 10 0 0 1 10 10 10 10 0 0 1-10 10A10 10 0 0 1 2 12 10 10 0 0 1 12 2" />
                <path d="M12 8v4l3 3" />
              </svg>
            </div>
            <div>
              <p
                className="text-[14px] font-semibold text-white"
                style={{ fontFamily: "'Poppins',sans-serif" }}
              >
                Personalize your experience
              </p>
              <p className="text-[11px]" style={{ fontFamily: "'Inter',sans-serif", color: MUTED }}>
                Select your interests — choose all that apply
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {INTERESTS.map(({ id, emoji, label }) => {
              const selected = interests.has(id);
              return (
                <button
                  key={id}
                  onClick={() => toggleInterest(id)}
                  className="flex h-[38px] items-center gap-2 rounded-full px-4 transition-all active:scale-95"
                  style={{
                    fontFamily: "'Inter',sans-serif",
                    fontSize: 13,
                    background: selected ? `rgba(43,172,82,.2)` : 'rgba(255,255,255,.05)',
                    border: selected ? `1.5px solid ${G2}` : `1.5px solid ${BORDER}`,
                    color: selected ? G3 : 'rgba(255,255,255,.55)',
                    boxShadow: selected ? `0 0 12px rgba(43,172,82,.18)` : 'none',
                    animation:
                      chipAnimating === id
                        ? 'chip-pop .38s cubic-bezier(.34,1.56,.64,1) both'
                        : 'none',
                  }}
                >
                  <span>{emoji}</span>
                  <span>{label}</span>
                  {selected && (
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={G3}
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div
          className="flex flex-col gap-3 px-7 pt-5"
          style={{ animation: 'slide-in-right .42s cubic-bezier(.25,.46,.45,.94) .24s both' }}
        >
          <GreenBtn
            label={saving ? 'Saving…' : 'Continue'}
            disabled={!canContinue || saving}
            onClick={handleContinue}
            icon={<ArrowIcon />}
          />
          <button
            onClick={onSkip}
            className="flex h-[50px] w-full items-center justify-center rounded-2xl text-[14px] font-medium transition-all active:scale-[0.97]"
            style={{
              fontFamily: "'Poppins',sans-serif",
              color: MUTED,
              background: 'rgba(255,255,255,.03)',
              border: `1.5px solid ${BORDER}`,
            }}
          >
            Skip
          </button>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-4 px-7 pb-10 pt-4">
          {['Terms of Service', 'Privacy Policy'].map((t, i) => (
            <span key={t} className="flex items-center gap-4">
              <button
                className="text-[12px] underline underline-offset-2"
                style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.25)' }}
              >
                {t}
              </button>
              {i === 0 && <span style={{ color: 'rgba(255,255,255,.14)' }}>·</span>}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTH-006 — PERMISSIONS & SMART FEATURES
// ═══════════════════════════════════════════════════════════════════════════
export type PermKey = 'location' | 'notifications' | 'camera' | 'photos' | 'microphone';

export const PERMS: Array<{ key: PermKey; icon: string; title: string; desc: string }> = [
  {
    key: 'location',
    icon: '📍',
    title: 'Location',
    desc: 'Used for Ride, nearby merchants, order delivery, and location-based recommendations.',
  },
  {
    key: 'notifications',
    icon: '🔔',
    title: 'Notifications',
    desc: 'Receive ride updates, order tracking, payment alerts, and important account notifications.',
  },
  {
    key: 'camera',
    icon: '📷',
    title: 'Camera',
    desc: 'Upload profile photos, scan QR codes, and verify your identity when required.',
  },
  {
    key: 'photos',
    icon: '🖼',
    title: 'Photos & Media',
    desc: 'Choose profile pictures and upload documents securely.',
  },
  {
    key: 'microphone',
    icon: '🎤',
    title: 'Microphone',
    desc: 'Use voice search and interact with the DrippleX AI Assistant.',
  },
];

export const AI_FEATURES = [
  'Find products and services',
  'Book rides',
  'Track deliveries',
  'Manage your wallet',
  'Answer questions',
  'Discover nearby businesses',
];

export function PermissionsScreen({
  onContinue,
  onSkip,
  onBack,
}: {
  onContinue: () => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  const [granted, setGranted] = useState<Set<PermKey>>(new Set());
  const [exiting, setExiting] = useState(false);

  const allow = (key: PermKey) => {
    setGranted((prev) => {
      const n = new Set(prev);
      n.add(key);
      return n;
    });
  };

  const handleContinue = () => {
    setExiting(true);
    setTimeout(onContinue, 300);
  };

  const handleSkip = () => {
    setExiting(true);
    setTimeout(onSkip, 300);
  };

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{
        background: `linear-gradient(155deg,${NAVY_DEEP} 0%,${NAVY_BASE} 55%,#0B1D2F 100%)`,
        opacity: exiting ? 0 : 1,
        transition: 'opacity .3s ease',
      }}
    >
      <Ambient />
      <StatusBar />

      <div
        className="relative z-10 flex flex-1 flex-col overflow-y-auto"
        style={{ scrollbarWidth: 'none' }}
      >
        {/* Nav + progress */}
        <div className="flex items-center justify-between px-6 pt-3">
          <BackBtn onPress={onBack} />
          <div className="flex items-center gap-2">
            <span
              className="text-[11px]"
              style={{ fontFamily: "'Inter',sans-serif", color: MUTED }}
            >
              Step 4 of 5
            </span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <div
                  key={s}
                  className="h-1 rounded-full transition-all duration-300"
                  style={{
                    width: s === 4 ? 20 : 6,
                    background: s <= 4 ? G2 : 'rgba(255,255,255,.15)',
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Heading */}
        <div
          className="px-7 pb-3 pt-4"
          style={{ animation: 'slide-in-right .42s cubic-bezier(.25,.46,.45,.94) .04s both' }}
        >
          <h1
            className="text-[26px] font-bold leading-tight text-white"
            style={{ fontFamily: "'Poppins',sans-serif", letterSpacing: '-0.022em' }}
          >
            Enable Smart Features
          </h1>
          <p
            className="mt-1 text-[14px]"
            style={{ fontFamily: "'Inter',sans-serif", color: MUTED }}
          >
            Allow a few permissions to unlock the full DrippleX experience.
          </p>
        </div>

        {/* Permission cards */}
        <div
          className="mx-5 flex flex-col gap-3"
          style={{ animation: 'slide-in-right .42s cubic-bezier(.25,.46,.45,.94) .1s both' }}
        >
          {PERMS.map(({ key, icon, title, desc }) => {
            const isGranted = granted.has(key);
            return (
              <div
                key={key}
                className="flex items-start gap-3.5 rounded-2xl px-4 py-4 transition-all duration-300"
                style={{
                  background: isGranted
                    ? `linear-gradient(145deg,rgba(43,172,82,.12),rgba(43,172,82,.06))`
                    : `linear-gradient(145deg,${NAVY_SURFACE},${NAVY_CARD})`,
                  border: isGranted ? `1px solid rgba(43,172,82,.3)` : `1px solid ${BORDER}`,
                  boxShadow: isGranted
                    ? `0 0 0 1px rgba(43,172,82,.06), 0 4px 20px rgba(43,172,82,.08)`
                    : 'none',
                }}
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl transition-all duration-300"
                  style={{
                    background: isGranted ? `rgba(43,172,82,.22)` : 'rgba(255,255,255,.06)',
                  }}
                >
                  {icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className="text-[14px] font-semibold text-white"
                    style={{ fontFamily: "'Poppins',sans-serif" }}
                  >
                    {title}
                  </p>
                  <p
                    className="mt-0.5 text-[12px] leading-relaxed"
                    style={{ fontFamily: "'Inter',sans-serif", color: MUTED }}
                  >
                    {desc}
                  </p>
                </div>
                <button
                  onClick={() => !isGranted && allow(key)}
                  className="flex h-[34px] shrink-0 items-center gap-1.5 rounded-full px-4 text-[12px] font-semibold transition-all duration-200 active:scale-95"
                  style={{
                    fontFamily: "'Inter',sans-serif",
                    background: isGranted
                      ? `rgba(43,172,82,.2)`
                      : `linear-gradient(135deg,${G0},${G2})`,
                    color: isGranted ? G3 : 'white',
                    boxShadow: isGranted ? 'none' : `0 4px 14px rgba(43,172,82,.32)`,
                    minWidth: 70,
                  }}
                >
                  {isGranted ? (
                    <>
                      <svg
                        width="11"
                        height="11"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={G3}
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                      Allowed
                    </>
                  ) : (
                    'Allow'
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* AI Assistant card */}
        <div
          className="mx-5 mt-4 rounded-3xl px-5 py-5"
          style={{
            background: `linear-gradient(135deg,${NAVY_SURFACE} 0%,#0D1F38 100%)`,
            border: `1px solid rgba(43,172,82,.18)`,
            boxShadow: `0 0 40px rgba(43,172,82,.05)`,
            animation: 'slide-in-right .42s cubic-bezier(.25,.46,.45,.94) .18s both',
          }}
        >
          <div className="flex items-start gap-4">
            {/* AI illustration */}
            <div
              className="relative flex h-[52px] w-[52px] shrink-0 items-center justify-center overflow-hidden rounded-2xl"
              style={{
                background: `linear-gradient(135deg,${G0} 0%,${G2} 55%,${G3} 100%)`,
                boxShadow: `0 8px 28px rgba(43,172,82,.32), 0 0 0 1px rgba(43,172,82,.2)`,
              }}
            >
              {/* Stylised AI face */}
              <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
                <rect
                  x="5"
                  y="8"
                  width="20"
                  height="16"
                  rx="5"
                  stroke="white"
                  strokeWidth="1.6"
                  fill="none"
                  opacity=".9"
                />
                <circle cx="11" cy="15" r="2" fill="white" opacity=".9" />
                <circle cx="19" cy="15" r="2" fill="white" opacity=".9" />
                <path
                  d="M11 20h8"
                  stroke="white"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  opacity=".7"
                />
                <path
                  d="M15 8V5M12 5h6"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  opacity=".6"
                />
              </svg>
              {/* live dot */}
              <div
                className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full"
                style={{
                  background: G3,
                  boxShadow: `0 0 6px ${G3}`,
                  animation: 'avatar-pulse 2s ease-in-out infinite',
                }}
              />
            </div>
            <div className="flex-1">
              <p
                className="text-[14px] font-semibold text-white"
                style={{ fontFamily: "'Poppins',sans-serif" }}
              >
                Meet Your AI Assistant
              </p>
              <p
                className="mb-3 mt-0.5 text-[11px]"
                style={{ fontFamily: "'Inter',sans-serif", color: MUTED }}
              >
                Your personal AI helper — always ready
              </p>
              <div className="flex flex-col gap-1.5">
                {AI_FEATURES.map((f) => (
                  <div key={f} className="flex items-center gap-2">
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={G3}
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    <span
                      className="text-[12px]"
                      style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.52)' }}
                    >
                      {f}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div
          className="flex flex-col gap-3 px-7 pt-5"
          style={{ animation: 'slide-in-right .42s cubic-bezier(.25,.46,.45,.94) .24s both' }}
        >
          <GreenBtn label="Continue" onClick={handleContinue} icon={<ArrowIcon />} />
          <button
            onClick={handleSkip}
            className="flex h-[50px] w-full items-center justify-center rounded-2xl text-[14px] font-medium transition-all active:scale-[0.97]"
            style={{
              fontFamily: "'Poppins',sans-serif",
              color: MUTED,
              background: 'rgba(255,255,255,.03)',
              border: `1.5px solid ${BORDER}`,
            }}
          >
            Skip for Now
          </button>
          <p
            className="-mt-1 text-center text-[11px]"
            style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.22)' }}
          >
            Optional permissions can be enabled later from Settings
          </p>
        </div>

        <div className="pb-10" />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTH-007 — BIOMETRIC SECURITY SETUP
// ═══════════════════════════════════════════════════════════════════════════
export type BiometricStatus = 'idle' | 'prompting' | 'success';

export function BiometricScreen({
  onDone,
  onSkip,
  onBack,
}: {
  onDone: () => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  const [status, setStatus] = useState<BiometricStatus>('idle');

  const handleEnable = () => {
    setStatus('prompting');
    // Simulate native biometric prompt result
    setTimeout(() => setStatus('success'), 1400);
  };

  // Auto-advance from success state
  useEffect(() => {
    if (status !== 'success') return;
    const t = setTimeout(onDone, 2400);
    return () => clearTimeout(t);
  }, [status, onDone]);

  // ── Success / welcome state ────────────────────────────────────────────
  if (status === 'success') {
    return (
      <div
        className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden"
        style={{
          background: `linear-gradient(155deg,${NAVY_DEEP} 0%,${NAVY_BASE} 55%,#0B1D2F 100%)`,
        }}
      >
        <Ambient />

        {/* Shield + logo composition */}
        <div
          className="relative mb-8 flex items-center justify-center"
          style={{ width: 200, height: 200 }}
        >
          {/* Outer pulse rings */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              border: `2px solid ${G2}`,
              animation: 'pulse-ring 1.6s ease-out .2s infinite',
            }}
          />
          <div
            className="absolute inset-0 rounded-full"
            style={{
              border: `2px solid ${G2}`,
              animation: 'pulse-ring 1.6s ease-out .6s infinite',
            }}
          />

          {/* Green shield */}
          <div
            className="relative flex h-32 w-32 items-center justify-center"
            style={{ animation: 'success-bounce .65s cubic-bezier(.34,1.56,.64,1) .1s both' }}
          >
            <svg width="128" height="128" viewBox="0 0 128 128" fill="none">
              <defs>
                <linearGradient
                  id="shieldG"
                  x1="0"
                  y1="0"
                  x2="128"
                  y2="128"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor={G0} />
                  <stop offset="1" stopColor={G3} />
                </linearGradient>
              </defs>
              <path
                d="M64 8L20 26v34c0 28.7 18.7 55.5 44 62 25.3-6.5 44-33.3 44-62V26L64 8z"
                fill={`url(#shieldG)`}
                opacity=".18"
              />
              <path
                d="M64 8L20 26v34c0 28.7 18.7 55.5 44 62 25.3-6.5 44-33.3 44-62V26L64 8z"
                stroke={`url(#shieldG)`}
                strokeWidth="3"
                fill="none"
              />
            </svg>
            {/* Checkmark inside shield */}
            <svg width="52" height="52" viewBox="0 0 52 52" fill="none" className="absolute">
              <path
                d="M12 26l12 12 18-18"
                stroke="white"
                strokeWidth="4.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="60"
                strokeDashoffset="0"
                style={{ animation: 'check-draw .4s ease .4s both' }}
              />
            </svg>
          </div>

          {/* Logo badge */}
          <div
            className="absolute -bottom-4 left-1/2 -translate-x-1/2 rounded-xl px-4 py-2"
            style={{
              background: `linear-gradient(145deg,${NAVY_SURFACE},${NAVY_CARD})`,
              border: `1px solid rgba(43,172,82,.2)`,
              animation: 'fade-up .5s ease .6s both',
              boxShadow: `0 0 24px rgba(43,172,82,.15)`,
            }}
          >
            <Logo width={90} />
          </div>
        </div>

        {/* Text */}
        <div
          className="mt-6 flex flex-col items-center gap-2 px-8 text-center"
          style={{ animation: 'fade-up .6s ease .55s both' }}
        >
          <h1
            className="text-[28px] font-bold text-white"
            style={{ fontFamily: "'Poppins',sans-serif", letterSpacing: '-0.025em' }}
          >
            You're All Set!
          </h1>
          <p className="text-[14px]" style={{ fontFamily: "'Inter',sans-serif", color: MUTED }}>
            Welcome to DrippleX.
          </p>
          <p
            className="mt-0.5 text-[14px] font-semibold tracking-[0.2em]"
            style={{ fontFamily: "'Poppins',sans-serif", color: G2 }}
          >
            life,Simplified
          </p>
          <p
            className="mt-3 text-[12px]"
            style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.28)' }}
          >
            Loading your dashboard…
          </p>
        </div>

        {/* Loading dots */}
        <div
          className="mt-5 flex items-center gap-2"
          style={{ animation: 'fade-in .4s ease 1s both' }}
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-2 w-2 rounded-full"
              style={{
                background: G2,
                animation: `otp-pop .6s ease ${i * 0.15}s infinite alternate`,
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  // ── Main biometric UI ────────────────────────────────────────────────────
  const isPending = status === 'prompting';

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{
        background: `linear-gradient(155deg,${NAVY_DEEP} 0%,${NAVY_BASE} 55%,#0B1D2F 100%)`,
      }}
    >
      <Ambient />
      <StatusBar />

      <div
        className="relative z-10 flex flex-1 flex-col overflow-y-auto"
        style={{ scrollbarWidth: 'none' }}
      >
        {/* Nav + progress */}
        <div className="flex items-center justify-between px-6 pt-3">
          <BackBtn onPress={onBack} />
          <div className="flex items-center gap-2">
            <span
              className="text-[11px]"
              style={{ fontFamily: "'Inter',sans-serif", color: MUTED }}
            >
              Step 5 of 5
            </span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <div
                  key={s}
                  className="h-1 rounded-full transition-all duration-300"
                  style={{
                    width: s === 5 ? 20 : 6,
                    background: s <= 5 ? G2 : 'rgba(255,255,255,.15)',
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Heading */}
        <div
          className="px-7 pb-2 pt-4"
          style={{ animation: 'slide-in-right .42s cubic-bezier(.25,.46,.45,.94) .04s both' }}
        >
          <h1
            className="text-[26px] font-bold leading-tight text-white"
            style={{ fontFamily: "'Poppins',sans-serif", letterSpacing: '-0.022em' }}
          >
            Secure Your Account
          </h1>
          <p
            className="mt-1 text-[14px]"
            style={{ fontFamily: "'Inter',sans-serif", color: MUTED }}
          >
            Enable biometric authentication for faster and more secure access.
          </p>
        </div>

        {/* Hero fingerprint illustration */}
        <div
          className="flex items-center justify-center py-6"
          style={{ animation: 'fade-in .6s ease .08s both' }}
        >
          <div
            className="relative flex items-center justify-center"
            style={{ width: 160, height: 160 }}
          >
            {/* Soft glow ring */}
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: `radial-gradient(circle,rgba(43,172,82,.18) 0%,transparent 68%)`,
                animation: 'glow-ring 3s ease-in-out infinite',
              }}
            />
            {/* Outer border ring */}
            <div
              className="absolute inset-4 rounded-full"
              style={{
                border: `1px solid rgba(43,172,82,.2)`,
                animation: 'orbit-cw 18s linear infinite',
              }}
            />
            {/* Inner card */}
            <div
              className="relative z-10 flex h-24 w-24 items-center justify-center rounded-[28px]"
              style={{
                background: `linear-gradient(145deg,${NAVY_SURFACE},${NAVY_CARD})`,
                border: `1.5px solid rgba(43,172,82,.22)`,
                boxShadow: `0 0 0 1px rgba(43,172,82,.1), 0 20px 48px rgba(0,0,0,.5), 0 0 60px rgba(43,172,82,.1)`,
              }}
            >
              {/* Fingerprint SVG */}
              <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
                <defs>
                  <linearGradient
                    id="fpG"
                    x1="0"
                    y1="0"
                    x2="52"
                    y2="52"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop stopColor={G0} />
                    <stop offset="1" stopColor={G3} />
                  </linearGradient>
                </defs>
                {/* Stylised fingerprint arcs */}
                <path
                  d="M26 10c-8.8 0-16 7.2-16 16"
                  stroke={`url(#fpG)`}
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  opacity=".5"
                />
                <path
                  d="M26 15c-6.1 0-11 4.9-11 11 0 4.5 2.7 8.4 6.6 10.2"
                  stroke={`url(#fpG)`}
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  opacity=".65"
                />
                <path
                  d="M26 20c-3.3 0-6 2.7-6 6 0 2.4 1.4 4.4 3.4 5.5"
                  stroke={`url(#fpG)`}
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  opacity=".8"
                />
                <path
                  d="M26 20c3.3 0 6 2.7 6 6s-2.7 6-6 6"
                  stroke={`url(#fpG)`}
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  opacity=".8"
                />
                <path
                  d="M26 15c6.1 0 11 4.9 11 11 0 6.1-4.9 11-11 11"
                  stroke={`url(#fpG)`}
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  opacity=".65"
                />
                <path
                  d="M26 10c8.8 0 16 7.2 16 16 0 8.8-7.2 16-16 16"
                  stroke={`url(#fpG)`}
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  opacity=".5"
                />
                <circle
                  cx="26"
                  cy="26"
                  r="2.5"
                  fill={G3}
                  style={{ animation: 'avatar-pulse 2s ease-in-out infinite' }}
                />
              </svg>
            </div>
            {/* Floating method badges */}
            {[
              { label: '👆', desc: 'Touch ID', angle: -100 },
              { label: '😊', desc: 'Face ID', angle: 20 },
            ].map(({ label, desc, angle }) => {
              const rad = (angle * Math.PI) / 180,
                r = 72;
              return (
                <div
                  key={desc}
                  className="absolute"
                  style={{ transform: `translate(${Math.cos(rad) * r}px,${Math.sin(rad) * r}px)` }}
                >
                  <div
                    className="flex flex-col items-center gap-0.5 rounded-xl px-2.5 py-2"
                    style={{
                      background: `linear-gradient(145deg,${NAVY_SURFACE},${NAVY_CARD})`,
                      border: `1px solid rgba(43,172,82,.16)`,
                      boxShadow: '0 8px 20px rgba(0,0,0,.4)',
                      animation: `float-a 3.4s ease-in-out infinite`,
                    }}
                  >
                    <span className="text-lg">{label}</span>
                    <span
                      className="text-[9px]"
                      style={{ fontFamily: "'Inter',sans-serif", color: G3, whiteSpace: 'nowrap' }}
                    >
                      {desc}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Benefits card */}
        <div
          className="mx-5 rounded-3xl px-5 py-5"
          style={{
            background: `linear-gradient(145deg,${NAVY_SURFACE},${NAVY_CARD})`,
            border: `1px solid ${BORDER}`,
            boxShadow: '0 20px 60px rgba(0,0,0,.35)',
            animation: 'slide-in-right .42s cubic-bezier(.25,.46,.45,.94) .12s both',
          }}
        >
          <div className="mb-4 flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
              style={{ background: `linear-gradient(135deg,${G0},${G2})` }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <p
              className="text-[14px] font-semibold text-white"
              style={{ fontFamily: "'Poppins',sans-serif" }}
            >
              Why Enable Biometrics?
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {[
              { icon: '⚡', label: 'Faster login', desc: 'Access DrippleX instantly' },
              { icon: '🔒', label: 'Secure authentication', desc: 'Military-grade protection' },
              { icon: '💳', label: 'Protect wallet transactions', desc: 'Approve payments safely' },
              { icon: '✅', label: 'Quick payment approvals', desc: 'One touch to confirm' },
              { icon: '🧠', label: 'No passwords to remember', desc: 'Your biometric is your key' },
            ].map(({ icon, label, desc }) => (
              <div key={label} className="flex items-center gap-3">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-base"
                  style={{ background: 'rgba(43,172,82,.1)' }}
                >
                  {icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className="text-[13px] font-medium text-white"
                    style={{ fontFamily: "'Inter',sans-serif" }}
                  >
                    {label}
                  </p>
                  <p
                    className="text-[11px]"
                    style={{ fontFamily: "'Inter',sans-serif", color: MUTED }}
                  >
                    {desc}
                  </p>
                </div>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={G2}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
            ))}
          </div>
        </div>

        {/* Security notice */}
        <div
          className="mx-5 mt-3 flex items-start gap-3 rounded-2xl px-4 py-3.5"
          style={{
            background: 'rgba(43,172,82,.06)',
            border: `1px solid rgba(43,172,82,.14)`,
            animation: 'slide-in-right .42s cubic-bezier(.25,.46,.45,.94) .18s both',
          }}
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
            className="mt-0.5 shrink-0"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <p
            className="text-[12px] leading-relaxed"
            style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.42)' }}
          >
            <span className="font-semibold" style={{ color: 'rgba(255,255,255,.65)' }}>
              Your biometric data stays on your device.
            </span>{' '}
            DrippleX never stores your fingerprint or facial data on our servers.
          </p>
        </div>

        {/* Actions */}
        <div
          className="flex flex-col gap-3 px-7 pt-5"
          style={{ animation: 'slide-in-right .42s cubic-bezier(.25,.46,.45,.94) .24s both' }}
        >
          <GreenBtn
            label="Enable Biometric Login"
            onClick={handleEnable}
            loading={isPending}
            icon={
              !isPending ? (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              ) : undefined
            }
          />
          <button
            onClick={onSkip}
            className="flex h-[50px] w-full items-center justify-center rounded-2xl text-[14px] font-medium transition-all active:scale-[0.97]"
            style={{
              fontFamily: "'Poppins',sans-serif",
              color: MUTED,
              background: 'rgba(255,255,255,.03)',
              border: `1.5px solid ${BORDER}`,
            }}
          >
            Maybe Later
          </button>
          <p
            className="-mt-1 text-center text-[11px]"
            style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.22)' }}
          >
            You can enable biometrics later in Profile → Security
          </p>
        </div>

        <div className="pb-10" />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SIGN IN
// ═══════════════════════════════════════════════════════════════════════════
export function SignInScreen({
  onBack,
  onSuccess,
  onMerchant,
  onDriver,
  onBecomePartner,
  onForgot,
}: {
  onBack: () => void;
  onSuccess?: () => void;
  onMerchant?: () => void;
  onDriver?: () => void;
  onBecomePartner?: () => void;
  onForgot?: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [focused, setFocused] = useState<string | null>(null);
  const [logging, setLogging] = useState(false);
  const [loginErr, setLoginErr] = useState('');
  // Customers register with email (the required, persistent identifier), so a
  // returning customer signs back in with email — not phone.
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const ready = emailValid && password.length >= 6;

  const handleLogin = async () => {
    setLogging(true);
    setLoginErr('');
    try {
      const res = await api.auth.loginCustomer({
        email: email.trim().toLowerCase(),
        password,
      });
      const r = res as {
        accessToken?: string;
        refreshToken?: string;
        user?: Record<string, unknown>;
      };
      if (r.accessToken && r.refreshToken) auth.setTokens(r.accessToken, r.refreshToken);
      if (r.user) auth.setUser(r.user as Parameters<typeof auth.setUser>[0]);
      (onSuccess ?? onBack)();
    } catch (e: unknown) {
      setLoginErr((e as { message?: string }).message ?? 'Login failed. Check your credentials.');
    } finally {
      setLogging(false);
    }
  };
  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{
        background: `linear-gradient(155deg,${NAVY_DEEP} 0%,${NAVY_BASE} 55%,#0B1D2F 100%)`,
      }}
    >
      <Ambient />
      <StatusBar />
      <div className="relative z-10 px-6 pt-3">
        <BackBtn onPress={onBack} />
      </div>
      <div
        className="relative z-10 flex flex-1 flex-col gap-7 px-7 pt-5"
        style={{ animation: 'fade-up .5s ease .05s both' }}
      >
        <Logo width={160} />
        <div className="flex flex-col gap-1.5">
          <h2
            className="text-[26px] font-bold text-white"
            style={{ fontFamily: "'Poppins',sans-serif", letterSpacing: '-0.02em' }}
          >
            Welcome back
          </h2>
          <p className="text-sm" style={{ fontFamily: "'Inter',sans-serif", color: MUTED }}>
            Enter your email to continue
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <label
            className="text-[11px] font-medium uppercase tracking-widest"
            style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.32)' }}
          >
            Email
          </label>
          <div
            className="flex h-[56px] items-center gap-3 rounded-2xl px-4 transition-all duration-200"
            style={{
              background: 'rgba(255,255,255,.045)',
              border: focused === 'email' ? `1.5px solid ${G2}` : `1.5px solid ${BORDER}`,
              boxShadow: focused === 'email' ? `0 0 0 3px rgba(43,172,82,.12)` : 'none',
            }}
          >
            <input
              type="email"
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => setFocused('email')}
              onBlur={() => setFocused(null)}
              className="flex-1 bg-transparent text-base text-white outline-none placeholder:text-white/20"
              style={{ fontFamily: "'Inter',sans-serif" }}
            />
          </div>
          <div
            className="mt-3 flex h-[56px] items-center gap-3 rounded-2xl px-4 transition-all duration-200"
            style={{
              background: 'rgba(255,255,255,.045)',
              border: focused === 'pass' ? `1.5px solid ${G2}` : `1.5px solid ${BORDER}`,
              boxShadow: focused === 'pass' ? `0 0 0 3px rgba(43,172,82,.12)` : 'none',
            }}
          >
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setFocused('pass')}
              onBlur={() => setFocused(null)}
              className="flex-1 bg-transparent text-base text-white outline-none placeholder:text-white/20"
              style={{ fontFamily: "'Inter',sans-serif" }}
            />
          </div>
        </div>
        {onForgot && (
          <button
            onClick={onForgot}
            className="-mt-2 self-end text-[13px] font-medium transition-opacity active:opacity-70"
            style={{ fontFamily: "'Inter',sans-serif", color: G3 }}
          >
            Forgot password?
          </button>
        )}
        {loginErr && (
          <p style={{ color: '#F87171', fontSize: 13, textAlign: 'center' }}>{loginErr}</p>
        )}
        <GreenBtn
          label={logging ? 'Signing in…' : 'Sign In'}
          disabled={!ready || logging}
          icon={<ArrowIcon />}
          onClick={handleLogin}
        />
        {/* Social/biometric sign-in (Google/Apple/Face ID) is intentionally not
            shown yet: Apple has no backend, Face ID is native-only, and Google
            OAuth is not wired into this screen. Hidden rather than left as dead
            buttons (DPX §3: document gaps, don't fake). */}
        {(onMerchant || onDriver) && (
          <>
            <Divider label="partner sign-in" />
            <div className="flex gap-3">
              {onMerchant && (
                <button
                  onClick={onMerchant}
                  className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-xl transition-all active:scale-95"
                  style={{ background: 'rgba(255,255,255,.04)', border: `1.5px solid ${BORDER}` }}
                >
                  <span className="text-base">🏪</span>
                  <span
                    className="text-sm font-semibold text-white"
                    style={{ fontFamily: "'Inter',sans-serif" }}
                  >
                    Merchant
                  </span>
                </button>
              )}
              {onDriver && (
                <button
                  onClick={onDriver}
                  className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-xl transition-all active:scale-95"
                  style={{ background: 'rgba(255,255,255,.04)', border: `1.5px solid ${BORDER}` }}
                >
                  <span className="text-base">🚗</span>
                  <span
                    className="text-sm font-semibold text-white"
                    style={{ fontFamily: "'Inter',sans-serif" }}
                  >
                    Driver
                  </span>
                </button>
              )}
            </div>
          </>
        )}
        {onBecomePartner && (
          <p
            className="mt-5 text-center text-[13px]"
            style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.5)' }}
          >
            New to DrippleX?{' '}
            <button
              onClick={onBecomePartner}
              className="font-semibold underline underline-offset-2 transition-opacity active:opacity-70"
              style={{ color: G3 }}
            >
              Become a partner →
            </button>
          </p>
        )}
      </div>
      <div className="pb-8" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTH-008 — RETURNING USER LOGIN
// ═══════════════════════════════════════════════════════════════════════════
export type LoginError =
  'biometric_failed' | 'not_supported' | 'otp_required' | 'locked' | 'network' | null;
export type LoginStatus = 'idle' | 'unlocking' | 'success';

export const LOGIN_ERRORS: Record<
  NonNullable<LoginError>,
  { color: string; icon: string; title: string; message: string; action: string }
> = {
  biometric_failed: {
    color: '#E53935',
    icon: '👆',
    title: 'Biometric Failed',
    message: "We couldn't verify your identity. Please try again or use OTP.",
    action: 'Try Again',
  },
  not_supported: {
    color: '#F59E0B',
    icon: '📵',
    title: 'Device Not Supported',
    message: "Your device doesn't support biometrics. Use OTP to sign in.",
    action: 'Use OTP',
  },
  otp_required: {
    color: '#6366F1',
    icon: '📱',
    title: 'OTP Required',
    message: 'Too many biometric attempts. Please verify with a one-time code.',
    action: 'Send OTP',
  },
  locked: {
    color: '#EF4444',
    icon: '🔒',
    title: 'Account Locked',
    message: 'Your account has been temporarily locked. Contact support to unlock.',
    action: 'Recover Account',
  },
  network: {
    color: '#6366F1',
    icon: '⚡',
    title: 'Connection Error',
    message: "We couldn't connect. Please check your internet and try again.",
    action: 'Retry',
  },
};

export function ReturningLoginScreen({
  onUnlocked,
  onOTP,
  onRecover,
  onBack,
  onSecurity,
  onAccount,
}: {
  onUnlocked: () => void;
  onOTP: () => void;
  onRecover: () => void;
  onBack: () => void;
  onSecurity: () => void;
  onAccount: () => void;
}) {
  const [status, setStatus] = useState<LoginStatus>('idle');
  const [error, setError] = useState<LoginError>(null);
  const [bioPulse, setBioPulse] = useState(true);
  const returningName = auth.displayName(auth.getUser()) || 'Welcome back';

  useEffect(() => {
    if (status !== 'success') return;
    const t = setTimeout(onUnlocked, 2000);
    return () => clearTimeout(t);
  }, [status, onUnlocked]);

  const handleBiometric = () => {
    setError(null);
    setStatus('unlocking');
    setTimeout(() => setStatus('success'), 1500);
  };

  const handleErrorAction = (err: NonNullable<LoginError>) => {
    if (err === 'not_supported' || err === 'otp_required' || err === 'network') {
      setError(null);
      onOTP();
    } else if (err === 'locked') {
      setError(null);
      onRecover();
    } else {
      setError(null);
      handleBiometric();
    }
  };

  // ── Success unlock ──────────────────────────────────────────────────────
  if (status === 'success') {
    return (
      <div
        className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden"
        style={{
          background: `linear-gradient(155deg,${NAVY_DEEP} 0%,${NAVY_BASE} 55%,#0B1D2F 100%)`,
        }}
      >
        <Ambient />
        <div
          className="flex flex-col items-center gap-5"
          style={{ animation: 'success-bounce .55s cubic-bezier(.34,1.56,.64,1) both' }}
        >
          {/* Unlock icon */}
          <div className="relative flex h-28 w-28 items-center justify-center">
            <div
              className="absolute inset-0 rounded-full"
              style={{
                border: `2px solid ${G2}`,
                animation: 'pulse-ring 1.2s ease-out .2s infinite',
              }}
            />
            <div
              className="absolute inset-0 rounded-full"
              style={{
                border: `2px solid ${G2}`,
                animation: 'pulse-ring 1.2s ease-out .55s infinite',
              }}
            />
            <div
              className="flex h-20 w-20 items-center justify-center rounded-full"
              style={{
                background: `linear-gradient(135deg,${G0},${G2})`,
                boxShadow: `0 12px 40px rgba(43,172,82,.45), 0 0 0 1px rgba(43,172,82,.3)`,
              }}
            >
              <svg
                width="36"
                height="36"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 9.9-1" />
              </svg>
            </div>
          </div>
          <div className="flex flex-col items-center gap-2 px-8 text-center">
            <h2
              className="text-[26px] font-bold text-white"
              style={{ fontFamily: "'Poppins',sans-serif", letterSpacing: '-0.02em' }}
            >
              Welcome Back!
            </h2>
            <p className="text-[14px]" style={{ fontFamily: "'Inter',sans-serif", color: G3 }}>
              {returningName}
            </p>
            <p
              className="mt-1 text-[13px]"
              style={{ fontFamily: "'Inter',sans-serif", color: MUTED }}
            >
              Loading your dashboard…
            </p>
          </div>
          <div className="flex items-center gap-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-2 w-2 rounded-full"
                style={{
                  background: G2,
                  animation: `otp-pop .6s ease ${i * 0.15}s infinite alternate`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{
        background: `linear-gradient(155deg,${NAVY_DEEP} 0%,${NAVY_BASE} 55%,#0B1D2F 100%)`,
      }}
    >
      <Ambient />
      <StatusBar />

      <div
        className="relative z-10 flex flex-1 flex-col overflow-y-auto"
        style={{ scrollbarWidth: 'none' }}
      >
        {/* Nav */}
        <div className="px-6 pt-3">
          <BackBtn onPress={onBack} />
        </div>
        <div className="px-7 pb-1 pt-3">
          <Logo width={138} />
        </div>

        {/* Heading */}
        <div
          className="px-7 pb-3 pt-5"
          style={{ animation: 'slide-in-right .42s cubic-bezier(.25,.46,.45,.94) .04s both' }}
        >
          <h1
            className="text-[28px] font-bold leading-tight text-white"
            style={{ fontFamily: "'Poppins',sans-serif", letterSpacing: '-0.022em' }}
          >
            Welcome Back
          </h1>
          <p
            className="mt-1 text-[14px]"
            style={{ fontFamily: "'Inter',sans-serif", color: MUTED }}
          >
            Sign in to continue your DrippleX experience.
          </p>
        </div>

        {/* User card */}
        <div
          className="mx-5 flex items-center gap-4 rounded-3xl px-5 py-4"
          style={{
            background: `linear-gradient(145deg,${NAVY_SURFACE},${NAVY_CARD})`,
            border: `1.5px solid rgba(43,172,82,.2)`,
            boxShadow: `0 0 0 1px rgba(43,172,82,.06), 0 16px 48px rgba(0,0,0,.4)`,
            animation: 'slide-in-right .42s cubic-bezier(.25,.46,.45,.94) .08s both',
          }}
        >
          {/* Avatar */}
          <div className="relative shrink-0">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full text-2xl"
              style={{
                background: `linear-gradient(135deg,${G0},${G2})`,
                boxShadow: `0 0 0 2px rgba(43,172,82,.35), 0 0 0 4px rgba(43,172,82,.1)`,
              }}
            >
              👤
            </div>
            <div
              className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full"
              style={{
                background: G3,
                border: `2px solid ${NAVY_CARD}`,
                boxShadow: `0 0 8px ${G3}`,
              }}
            />
          </div>
          {/* Info */}
          <div className="min-w-0 flex-1">
            <p
              className="truncate text-[15px] font-semibold text-white"
              style={{ fontFamily: "'Poppins',sans-serif" }}
            >
              {returningName}
            </p>
            <p
              className="mt-0.5 truncate text-[13px]"
              style={{ fontFamily: "'Inter',sans-serif", color: MUTED }}
            >
              +234 801 234 5678
            </p>
          </div>
          {/* Verified badge */}
          <div
            className="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1"
            style={{ background: 'rgba(43,172,82,.12)', border: `1px solid rgba(43,172,82,.25)` }}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke={G3}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
            <span
              className="text-[11px] font-medium"
              style={{ fontFamily: "'Inter',sans-serif", color: G3 }}
            >
              Verified
            </span>
          </div>
        </div>
        {/* Switch account */}
        <div className="px-5 pb-1 pt-2">
          <button
            className="text-[12px] transition-opacity active:opacity-60"
            style={{ fontFamily: "'Inter',sans-serif", color: MUTED }}
          >
            Switch Account
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="ml-1 inline"
            >
              <path d="M7 17L17 7M7 7h10v10" />
            </svg>
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div
            className="mx-5 mt-2 flex items-start gap-3 rounded-2xl px-4 py-3"
            style={{
              background: `${LOGIN_ERRORS[error].color}18`,
              border: `1px solid ${LOGIN_ERRORS[error].color}40`,
              animation: 'slide-in-right .3s ease both',
            }}
          >
            <span className="mt-0.5 text-lg">{LOGIN_ERRORS[error].icon}</span>
            <div className="min-w-0 flex-1">
              <p
                className="text-[13px] font-semibold"
                style={{ fontFamily: "'Poppins',sans-serif", color: LOGIN_ERRORS[error].color }}
              >
                {LOGIN_ERRORS[error].title}
              </p>
              <p
                className="mt-0.5 text-[12px] leading-relaxed"
                style={{ fontFamily: "'Inter',sans-serif", color: MUTED }}
              >
                {LOGIN_ERRORS[error].message}
              </p>
            </div>
            <button
              onClick={() => handleErrorAction(error)}
              className="shrink-0 rounded-lg px-3 py-1.5 text-[12px] font-semibold active:opacity-70"
              style={{
                fontFamily: "'Inter',sans-serif",
                color: LOGIN_ERRORS[error].color,
                background: `${LOGIN_ERRORS[error].color}22`,
                border: `1px solid ${LOGIN_ERRORS[error].color}40`,
              }}
            >
              {LOGIN_ERRORS[error].action}
            </button>
          </div>
        )}

        {/* Biometric card — primary */}
        <div
          className="mx-5 mt-3 rounded-3xl px-5 py-5"
          style={{
            background: `linear-gradient(145deg,#0A1E34,${NAVY_CARD})`,
            border: `1.5px solid rgba(43,172,82,.22)`,
            boxShadow: `0 0 40px rgba(43,172,82,.08)`,
            animation: 'slide-in-right .42s cubic-bezier(.25,.46,.45,.94) .12s both',
          }}
        >
          <div className="flex items-center gap-4">
            {/* Fingerprint hero */}
            <div
              className="relative flex shrink-0 items-center justify-center"
              style={{ width: 72, height: 72 }}
            >
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: `radial-gradient(circle,rgba(43,172,82,.22) 0%,transparent 70%)`,
                  animation: bioPulse ? 'glow-ring 2.5s ease-in-out infinite' : 'none',
                }}
              />
              <div
                className="flex h-14 w-14 items-center justify-center rounded-2xl"
                style={{
                  background: `linear-gradient(145deg,${NAVY_SURFACE},#0A1E34)`,
                  border: `1.5px solid rgba(43,172,82,.25)`,
                  boxShadow: `0 0 20px rgba(43,172,82,.12)`,
                }}
              >
                <svg width="32" height="32" viewBox="0 0 52 52" fill="none">
                  <defs>
                    <linearGradient
                      id="fpG2"
                      x1="0"
                      y1="0"
                      x2="52"
                      y2="52"
                      gradientUnits="userSpaceOnUse"
                    >
                      <stop stopColor={G0} />
                      <stop offset="1" stopColor={G3} />
                    </linearGradient>
                  </defs>
                  <path
                    d="M26 10c-8.8 0-16 7.2-16 16"
                    stroke={`url(#fpG2)`}
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    opacity=".5"
                  />
                  <path
                    d="M26 15c-6.1 0-11 4.9-11 11 0 4.5 2.7 8.4 6.6 10.2"
                    stroke={`url(#fpG2)`}
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    opacity=".65"
                  />
                  <path
                    d="M26 20c-3.3 0-6 2.7-6 6 0 2.4 1.4 4.4 3.4 5.5"
                    stroke={`url(#fpG2)`}
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    opacity=".8"
                  />
                  <path
                    d="M26 20c3.3 0 6 2.7 6 6s-2.7 6-6 6"
                    stroke={`url(#fpG2)`}
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    opacity=".8"
                  />
                  <path
                    d="M26 15c6.1 0 11 4.9 11 11 0 6.1-4.9 11-11 11"
                    stroke={`url(#fpG2)`}
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    opacity=".65"
                  />
                  <path
                    d="M26 10c8.8 0 16 7.2 16 16 0 8.8-7.2 16-16 16"
                    stroke={`url(#fpG2)`}
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    opacity=".5"
                  />
                  <circle
                    cx="26"
                    cy="26"
                    r="2.5"
                    fill={G3}
                    style={{ animation: 'avatar-pulse 2s ease-in-out infinite' }}
                  />
                </svg>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2">
                <p
                  className="text-[15px] font-semibold text-white"
                  style={{ fontFamily: "'Poppins',sans-serif" }}
                >
                  Biometric Login
                </p>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  style={{
                    background: 'rgba(43,172,82,.18)',
                    color: G3,
                    fontFamily: "'Inter',sans-serif",
                  }}
                >
                  RECOMMENDED
                </span>
              </div>
              <p
                className="text-[12px] leading-relaxed"
                style={{ fontFamily: "'Inter',sans-serif", color: MUTED }}
              >
                Unlock instantly using your device security.
              </p>
              <div className="mt-2 flex items-center gap-3">
                {['👆 Touch ID', '😊 Face ID'].map((m) => (
                  <span
                    key={m}
                    className="text-[11px]"
                    style={{ fontFamily: "'Inter',sans-serif", color: G3 }}
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* OTP card — secondary */}
        <div
          className="mx-5 mt-3 flex items-center gap-4 rounded-3xl px-5 py-4"
          style={{
            background: `linear-gradient(145deg,${NAVY_SURFACE},${NAVY_CARD})`,
            border: `1px solid ${BORDER}`,
            animation: 'slide-in-right .42s cubic-bezier(.25,.46,.45,.94) .16s both',
          }}
        >
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl"
            style={{ background: 'rgba(255,255,255,.06)' }}
          >
            📱
          </div>
          <div className="min-w-0 flex-1">
            <p
              className="text-[14px] font-semibold text-white"
              style={{ fontFamily: "'Poppins',sans-serif" }}
            >
              OTP Login
            </p>
            <p
              className="mt-0.5 text-[12px] leading-relaxed"
              style={{ fontFamily: "'Inter',sans-serif", color: MUTED }}
            >
              Receive a one-time verification code by SMS.
            </p>
          </div>
          <button
            onClick={onOTP}
            className="h-[34px] shrink-0 rounded-full px-4 text-[12px] font-semibold transition-all active:scale-95"
            style={{
              fontFamily: "'Inter',sans-serif",
              color: 'rgba(255,255,255,.7)',
              background: 'rgba(255,255,255,.07)',
              border: `1px solid ${BORDER}`,
              whiteSpace: 'nowrap',
            }}
          >
            Use OTP
          </button>
        </div>

        {/* Primary CTA */}
        <div
          className="px-7 pt-5"
          style={{ animation: 'slide-in-right .42s cubic-bezier(.25,.46,.45,.94) .2s both' }}
        >
          <GreenBtn
            label={status === 'unlocking' ? 'Verifying…' : 'Unlock with Biometrics'}
            loading={status === 'unlocking'}
            onClick={handleBiometric}
            icon={
              status !== 'unlocking' ? (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                </svg>
              ) : undefined
            }
          />
        </div>

        {/* Footer help */}
        <div
          className="px-7 pb-10 pt-5"
          style={{ animation: 'slide-in-right .42s cubic-bezier(.25,.46,.45,.94) .24s both' }}
        >
          <div
            className="flex flex-col gap-3 rounded-2xl px-5 py-4"
            style={{ background: 'rgba(255,255,255,.03)', border: `1px solid ${BORDER}` }}
          >
            <p
              className="text-center text-[12px]"
              style={{ fontFamily: "'Inter',sans-serif", color: MUTED }}
            >
              Need help signing in?
            </p>
            <div className="flex items-center justify-center gap-6">
              <button
                onClick={onRecover}
                className="flex items-center gap-1.5 text-[13px] font-medium transition-opacity active:opacity-60"
                style={{ fontFamily: "'Inter',sans-serif", color: G3 }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                Recover Account
              </button>
              <div className="h-4 w-px" style={{ background: BORDER }} />
              <button
                className="flex items-center gap-1.5 text-[13px] font-medium transition-opacity active:opacity-60"
                style={{ fontFamily: "'Inter',sans-serif", color: MUTED }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                Contact Support
              </button>
            </div>
            <div className="h-px w-full" style={{ background: BORDER }} />
            <div className="flex items-center justify-center gap-5">
              <button
                onClick={onSecurity}
                className="flex items-center gap-1.5 text-[12px] font-medium transition-opacity active:opacity-60"
                style={{ fontFamily: "'Inter',sans-serif", color: G3 }}
              >
                🛡 Security Center
              </button>
              <div className="h-4 w-px flex-shrink-0" style={{ background: BORDER }} />
              <button
                onClick={onAccount}
                className="flex items-center gap-1.5 text-[12px] font-medium transition-opacity active:opacity-60"
                style={{ fontFamily: "'Inter',sans-serif", color: MUTED }}
              >
                ⚙️ Manage Account
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTH-009 — ACCOUNT RECOVERY & DEVICE VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════
export type RecoveryStep = 'options' | 'phone' | 'verify_device' | 'success';

export function RecoveryScreen({
  onRecovered,
  onBack,
}: {
  onRecovered: () => void;
  onBack: () => void;
}) {
  const [step, setStep] = useState<'email' | 'reset' | 'success'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const otpValid = /^\d{4,8}$/.test(otp.trim());
  const pwValid =
    password.length >= 8 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password);

  useEffect(() => {
    if (step !== 'success') return;
    const t = setTimeout(onRecovered, 2200);
    return () => clearTimeout(t);
  }, [step, onRecovered]);

  const sendCode = async () => {
    if (!emailValid || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await api.auth.forgotPassword({ email: email.trim().toLowerCase() });
      // Backend never reveals whether the email exists; if it does, a code is
      // emailed. Move on to code entry regardless.
      setStep('reset');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not send the code. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const doReset = async () => {
    if (!otpValid || !pwValid || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await api.auth.resetPassword({
        email: email.trim().toLowerCase(),
        otp: otp.trim(),
        password,
      });
      setStep('success');
    } catch (e) {
      setErr(
        e instanceof Error
          ? e.message
          : 'Could not reset your password. Check the code and try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  const fieldStyle = (key: string): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    height: 56,
    borderRadius: 16,
    padding: '0 16px',
    background: 'rgba(255,255,255,.045)',
    border: focused === key ? `1.5px solid ${G2}` : `1.5px solid ${BORDER}`,
    boxShadow: focused === key ? `0 0 0 3px rgba(43,172,82,.12)` : 'none',
    transition: 'all .2s',
  });
  const inputStyle: React.CSSProperties = {
    flex: 1,
    background: 'transparent',
    color: '#fff',
    fontFamily: "'Inter',sans-serif",
    fontSize: 15,
    outline: 'none',
    border: 'none',
  };
  const labelStyle: React.CSSProperties = {
    fontFamily: "'Inter',sans-serif",
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: '.12em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,.32)',
    marginBottom: 8,
    display: 'block',
  };

  if (step === 'success') {
    return (
      <div
        className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden"
        style={{
          background: `linear-gradient(155deg,${NAVY_DEEP} 0%,${NAVY_BASE} 55%,#0B1D2F 100%)`,
        }}
      >
        <Ambient />
        <div className="relative z-10 flex flex-col items-center gap-4 px-8 text-center">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-full"
            style={{ background: `${G2}22`, border: `2px solid ${G2}`, fontSize: 34 }}
          >
            ✓
          </div>
          <p
            className="text-[20px] font-bold text-white"
            style={{ fontFamily: "'Poppins',sans-serif" }}
          >
            Password updated
          </p>
          <p className="text-sm" style={{ fontFamily: "'Inter',sans-serif", color: MUTED }}>
            You can now sign in with your new password.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{
        background: `linear-gradient(155deg,${NAVY_DEEP} 0%,${NAVY_BASE} 55%,#0B1D2F 100%)`,
      }}
    >
      <Ambient />
      <StatusBar />
      <div className="relative z-10 px-6 pt-3">
        <BackBtn onPress={step === 'reset' ? () => setStep('email') : onBack} />
      </div>
      <div
        className="relative z-10 flex flex-1 flex-col gap-6 px-7 pt-5"
        style={{ animation: 'fade-up .5s ease .05s both' }}
      >
        <Logo width={150} />
        <div className="flex flex-col gap-1.5">
          <h2
            className="text-[24px] font-bold text-white"
            style={{ fontFamily: "'Poppins',sans-serif", letterSpacing: '-0.02em' }}
          >
            Reset password
          </h2>
          <p className="text-sm" style={{ fontFamily: "'Inter',sans-serif", color: MUTED }}>
            {step === 'email'
              ? 'Enter your email and we’ll send you a reset code.'
              : `Enter the code sent to ${email} and choose a new password.`}
          </p>
        </div>

        {step === 'email' ? (
          <div className="flex flex-col gap-2">
            <label style={labelStyle}>Email</label>
            <div style={fieldStyle('email')}>
              <input
                type="email"
                autoCapitalize="none"
                autoCorrect="off"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused(null)}
                style={inputStyle}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label style={labelStyle}>Reset code</label>
              <div style={fieldStyle('otp')}>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="6-digit code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  onFocus={() => setFocused('otp')}
                  onBlur={() => setFocused(null)}
                  style={{ ...inputStyle, letterSpacing: '.3em' }}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label style={labelStyle}>New password</label>
              <div style={fieldStyle('pass')}>
                <input
                  type="password"
                  placeholder="8+ chars, with a capital & number"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocused('pass')}
                  onBlur={() => setFocused(null)}
                  style={inputStyle}
                />
              </div>
            </div>
          </div>
        )}

        {err && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 12,
              background: 'rgba(239,68,68,.08)',
              border: '1px solid rgba(239,68,68,.25)',
              fontFamily: "'Inter',sans-serif",
              fontSize: 13,
              color: '#EF4444',
            }}
          >
            {err}
          </div>
        )}

        {step === 'email' ? (
          <GreenBtn
            label="Send reset code"
            onClick={sendCode}
            disabled={!emailValid}
            loading={busy}
          />
        ) : (
          <div className="flex flex-col gap-3">
            <GreenBtn
              label="Reset password"
              onClick={doReset}
              disabled={!otpValid || !pwValid}
              loading={busy}
            />
            <button
              onClick={busy ? undefined : sendCode}
              className="text-center text-[13px] font-medium active:opacity-70"
              style={{ fontFamily: "'Inter',sans-serif", color: G3 }}
            >
              Resend code
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
