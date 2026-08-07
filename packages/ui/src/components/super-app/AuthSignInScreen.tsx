'use client';

import * as React from 'react';

import { dripplexMarkSvg } from '../../brand/dripplex-mark';

import { SuperAppAuthAmbient, SuperAppAuthBackButton, SuperAppAuthStatusBar } from './AuthChrome';
import {
  SUPER_APP_AUTH_COUNTRIES,
  SuperAppAuthArrowIcon,
  SuperAppAuthCheckIcon,
  SuperAppAuthDivider,
  SuperAppAuthGreenButton,
  type SuperAppAuthCountry,
} from './AuthPrimitives';
import { useSuperAppFonts } from './fonts';

export type SuperAppAuthSignInMode = 'phone' | 'email';

export interface SuperAppAuthSignInValues {
  password: string;
  /** Full phone number including country code. Present only in 'phone' mode. */
  phone?: string;
  /** Present only in 'email' mode. */
  email?: string;
}

/**
 * Ported from the locked Figma Make `screensA.tsx`'s `SignInScreen`
 * (AUTH-007). The source is phone-only and passwordless (no password
 * field at all -- Google/Apple/Face ID are the only options besides
 * phone+OTP). Our real login endpoint is password-based and already
 * accepts either identifier (`PortalLoginDto`'s `HasLoginIdentifier`), so
 * this adaptation adds the same Phone/Email toggle used on the Register
 * screen plus a password field, and drops Apple/Face ID (no infra for
 * either -- see docs/AUTH-DPX-100-REALITY-AUDIT.md Slice 4). Google is
 * kept: it's a real, working OAuth integration
 * (`sdk.auth.googleSignInUrl()`), previously only wired into the
 * email-only `LoginForm` this screen replaces -- dropping it here would
 * have silently regressed a live feature, not just skipped a decorative
 * one.
 */
export function SuperAppAuthSignInScreen({
  onSubmit,
  onForgotPassword,
  onCreateAccount,
  onGoogleSignIn,
  onBack,
  loading = false,
  errorMessage = null,
}: {
  onSubmit: (values: SuperAppAuthSignInValues) => void;
  onForgotPassword: () => void;
  onCreateAccount: () => void;
  onGoogleSignIn: () => void;
  onBack: () => void;
  loading?: boolean;
  errorMessage?: string | null;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  const [mode, setMode] = React.useState<SuperAppAuthSignInMode>('phone');
  const [country, setCountry] = React.useState<SuperAppAuthCountry>(
    SUPER_APP_AUTH_COUNTRIES[0] ?? { flag: '🇳🇬', name: 'Nigeria', code: '+234' },
  );
  const [showPicker, setShowPicker] = React.useState(false);
  const [phone, setPhone] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [focusedField, setFocusedField] = React.useState<string | null>(null);
  const [shake, setShake] = React.useState(false);

  const identifierValid =
    mode === 'phone' ? phone.replace(/\D/g, '').length >= 7 : /^\S+@\S+\.\S+$/.test(email.trim());
  const isValid = identifierValid && password.length > 0;

  const handleContinue = (): void => {
    if (!isValid) {
      setShake(true);
      setTimeout(() => {
        setShake(false);
      }, 500);
      return;
    }
    onSubmit({
      password,
      ...(mode === 'phone' ? { phone: `${country.code}${phone.replace(/\D/g, '')}` } : {}),
      ...(mode === 'email' ? { email: email.trim() } : {}),
    });
  };

  return (
    <div
      className="relative flex h-full min-h-dvh w-full flex-col overflow-hidden"
      style={{ background: 'linear-gradient(155deg,#060E1C 0%,#0A1628 55%,#0B1D2F 100%)' }}
    >
      <SuperAppAuthAmbient />
      <SuperAppAuthStatusBar />
      <div
        className="relative z-10 flex flex-1 flex-col overflow-y-auto"
        style={{ scrollbarWidth: 'none' }}
      >
        <div className="px-6 pb-1 pt-3">
          <SuperAppAuthBackButton onBack={onBack} />
        </div>
        <div
          className="flex flex-1 flex-col gap-7 px-7 pt-5"
          style={{ animation: 'fade-up .5s ease .05s both' }}
        >
          <span
            aria-hidden="true"
            className="block h-9 w-[8.9vw] max-w-[36px]"
            dangerouslySetInnerHTML={{ __html: dripplexMarkSvg }}
          />
          <div className="flex flex-col gap-1.5">
            <h2
              className={`text-[26px] font-bold text-white ${heading}`}
              style={{ letterSpacing: '-0.02em' }}
            >
              Welcome back
            </h2>
            <p className={`text-sm ${body}`} style={{ color: 'rgba(255,255,255,.38)' }}>
              Sign in using your phone number or email.
            </p>
          </div>

          <div
            className="flex rounded-xl p-1"
            style={{
              background: 'rgba(255,255,255,.04)',
              border: '1px solid rgba(255,255,255,.06)',
              animation: shake ? 'shake .45s ease' : 'none',
            }}
          >
            {(['phone', 'email'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setMode(tab);
                }}
                className={`flex-1 rounded-lg py-2 text-[13px] font-semibold capitalize transition-all ${heading}`}
                style={{
                  background: mode === tab ? 'rgba(43,172,82,.16)' : 'transparent',
                  color: mode === tab ? '#47CF72' : 'rgba(255,255,255,.4)',
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {mode === 'phone' ? (
            <div className="flex flex-col gap-2">
              <label
                className={`text-[11px] font-medium uppercase tracking-widest ${body}`}
                style={{ color: 'rgba(255,255,255,.32)' }}
              >
                Phone Number
              </label>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowPicker((v) => !v);
                  }}
                  className="flex h-[56px] items-center justify-between rounded-2xl px-4 transition-all"
                  style={{
                    background: 'rgba(255,255,255,.045)',
                    border: showPicker
                      ? '1.5px solid #2BAC52'
                      : '1.5px solid rgba(255,255,255,.08)',
                    boxShadow: showPicker ? '0 0 0 3px rgba(43,172,82,.12)' : 'none',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{country.flag}</span>
                    <span className={`text-sm ${body}`} style={{ color: 'rgba(255,255,255,.5)' }}>
                      {country.code}
                    </span>
                  </div>
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="rgba(255,255,255,.3)"
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
                {showPicker ? (
                  <div
                    className="overflow-hidden rounded-xl"
                    style={{
                      border: '1px solid rgba(255,255,255,.08)',
                      background: '#0D1B2E',
                      boxShadow: '0 16px 48px rgba(0,0,0,.5)',
                    }}
                  >
                    {SUPER_APP_AUTH_COUNTRIES.map((c, i) => (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => {
                          setCountry(c);
                          setShowPicker(false);
                        }}
                        className="flex h-[46px] w-full items-center gap-3 px-4 transition-all"
                        style={{
                          background:
                            c.code === country.code ? 'rgba(43,172,82,.12)' : 'transparent',
                          borderBottom:
                            i < SUPER_APP_AUTH_COUNTRIES.length - 1
                              ? '1px solid rgba(255,255,255,.05)'
                              : 'none',
                        }}
                      >
                        <span className="text-lg">{c.flag}</span>
                        <span className={`flex-1 text-left text-[14px] text-white ${body}`}>
                          {c.name}
                        </span>
                        <span
                          className={`text-sm ${body}`}
                          style={{ color: 'rgba(255,255,255,.38)' }}
                        >
                          {c.code}
                        </span>
                        {c.code === country.code ? <SuperAppAuthCheckIcon /> : null}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div
                  className="flex h-[56px] items-center gap-3 rounded-2xl px-4 transition-all duration-200"
                  style={{
                    background: 'rgba(255,255,255,.045)',
                    border:
                      focusedField === 'phone'
                        ? '1.5px solid #2BAC52'
                        : '1.5px solid rgba(255,255,255,.08)',
                    boxShadow: focusedField === 'phone' ? '0 0 0 3px rgba(43,172,82,.12)' : 'none',
                  }}
                >
                  <input
                    type="tel"
                    inputMode="numeric"
                    placeholder="(555) 000-0000"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                    }}
                    onFocus={() => {
                      setFocusedField('phone');
                    }}
                    onBlur={() => {
                      setFocusedField(null);
                    }}
                    className={`flex-1 bg-transparent text-base text-white outline-none placeholder:text-white/20 ${body}`}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <label
                className={`text-[11px] font-medium uppercase tracking-widest ${body}`}
                style={{ color: 'rgba(255,255,255,.32)' }}
              >
                Email Address
              </label>
              <div
                className="flex h-[56px] items-center gap-3 rounded-2xl px-4 transition-all duration-200"
                style={{
                  background: 'rgba(255,255,255,.045)',
                  border:
                    focusedField === 'email'
                      ? '1.5px solid #2BAC52'
                      : '1.5px solid rgba(255,255,255,.08)',
                  boxShadow: focusedField === 'email' ? '0 0 0 3px rgba(43,172,82,.12)' : 'none',
                  animation: shake ? 'shake .45s ease' : 'none',
                }}
              >
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                  }}
                  onFocus={() => {
                    setFocusedField('email');
                  }}
                  onBlur={() => {
                    setFocusedField(null);
                  }}
                  className={`flex-1 bg-transparent text-base text-white outline-none placeholder:text-white/20 ${body}`}
                />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <label
                className={`text-[11px] font-medium uppercase tracking-widest ${body}`}
                style={{ color: 'rgba(255,255,255,.32)' }}
              >
                Password
              </label>
              <button
                type="button"
                onClick={onForgotPassword}
                className="text-[12px] font-medium underline underline-offset-2 active:opacity-60"
                style={{ color: '#47CF72' }}
              >
                Forgot password?
              </button>
            </div>
            <div
              className="flex h-[56px] items-center gap-3 rounded-2xl px-4 transition-all duration-200"
              style={{
                background: 'rgba(255,255,255,.045)',
                border:
                  focusedField === 'password'
                    ? '1.5px solid #2BAC52'
                    : '1.5px solid rgba(255,255,255,.08)',
                boxShadow: focusedField === 'password' ? '0 0 0 3px rgba(43,172,82,.12)' : 'none',
              }}
            >
              <input
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                }}
                onFocus={() => {
                  setFocusedField('password');
                }}
                onBlur={() => {
                  setFocusedField(null);
                }}
                className={`flex-1 bg-transparent text-base text-white outline-none placeholder:text-white/20 ${body}`}
              />
            </div>
          </div>

          {errorMessage ? (
            <p className={`text-center text-[13px] ${body}`} style={{ color: '#EF4444' }}>
              {errorMessage}
            </p>
          ) : null}

          <SuperAppAuthGreenButton
            label={loading ? 'Signing in…' : 'Continue'}
            disabled={!isValid}
            loading={loading}
            onClick={handleContinue}
            icon={<SuperAppAuthArrowIcon />}
          />

          <SuperAppAuthDivider />

          <button
            type="button"
            onClick={onGoogleSignIn}
            className="flex h-[52px] w-full items-center justify-center gap-2.5 rounded-2xl text-[14px] font-semibold text-white transition-all active:scale-[0.97]"
            style={{
              background: 'rgba(255,255,255,.045)',
              border: '1.5px solid rgba(255,255,255,.08)',
            }}
          >
            <SuperAppAuthGoogleIcon />
            Continue with Google
          </button>

          <p
            className={`text-center text-[14px] ${body}`}
            style={{ color: 'rgba(255,255,255,.38)' }}
          >
            Don&rsquo;t have an account?{' '}
            <button
              type="button"
              onClick={onCreateAccount}
              className="font-semibold underline underline-offset-2 transition-opacity active:opacity-70"
              style={{ color: '#47CF72' }}
            >
              Get Started
            </button>
          </p>
        </div>
        <div className="pb-8" />
      </div>
    </div>
  );
}

/** Same Google "G" mark as `GoogleSignInButton`, inlined for the dark theme. */
function SuperAppAuthGoogleIcon(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.2-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.4 19 12 24 12c3.1 0 5.8 1.1 8 3l6-6C34.6 5.1 29.6 3 24 3c-7.5 0-14 3.9-17.7 9.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 45c5.5 0 10.4-1.9 14.2-5.1l-6.5-5.5C29.6 36 26.9 37 24 37c-5.3 0-9.7-3.1-11.3-7.6l-6.6 5.1C9.8 40.9 16.3 45 24 45z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.3 5.7l6.5 5.5C40.9 36.6 44 30.7 44 24c0-1.2-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}
