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

export type SuperAppAuthRegisterMode = 'phone' | 'email';

export interface SuperAppAuthRegisterValues {
  firstName: string;
  lastName: string;
  password: string;
  /** Full phone number including country code, e.g. "+2348012345678". Present only in 'phone' mode. */
  phone?: string;
  /** Present only in 'email' mode. */
  email?: string;
}

interface FieldShellProps {
  label: string;
  focused: boolean;
  children: React.ReactNode;
}

function FieldShell({ label, focused, children }: FieldShellProps): React.JSX.Element {
  const { body } = useSuperAppFonts();
  return (
    <div className="flex flex-col gap-2">
      <label
        className={`text-[11px] font-medium uppercase tracking-widest ${body}`}
        style={{ color: 'rgba(255,255,255,.3)' }}
      >
        {label}
      </label>
      <div
        className="flex h-[54px] items-center gap-3 rounded-xl px-4 transition-all duration-200"
        style={{
          background: 'rgba(255,255,255,.05)',
          border: focused ? '1.5px solid #2BAC52' : '1.5px solid rgba(255,255,255,.08)',
          boxShadow: focused ? '0 0 0 3px rgba(43,172,82,.11)' : 'none',
        }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Ported from the locked Figma Make `screensA.tsx`'s `RegisterScreen`
 * (AUTH-003). The source is phone-only (no email field at all -- OTP-first,
 * profile filled in afterward). The founder's explicit requirement is that
 * registration accept EITHER identifier, so this adaptation adds a
 * Phone/Email toggle and the name/password fields the backend's
 * single-step registration endpoint needs (see
 * docs/AUTH-DPX-100-REALITY-AUDIT.md, "founder's requirement" section, for
 * why this deviates from the source's literal content while keeping its
 * visual language). Purely presentational -- the parent wires `onSubmit` to
 * the real `sdk.auth.registerCustomer` call.
 */
export function SuperAppAuthRegisterScreen({
  onSubmit,
  onSignIn,
  onBack,
  loading = false,
  errorMessage = null,
}: {
  onSubmit: (values: SuperAppAuthRegisterValues) => void;
  onSignIn: () => void;
  onBack: () => void;
  loading?: boolean;
  errorMessage?: string | null;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  const [mode, setMode] = React.useState<SuperAppAuthRegisterMode>('phone');
  const [country, setCountry] = React.useState<SuperAppAuthCountry>(
    SUPER_APP_AUTH_COUNTRIES[0] ?? { flag: '🇳🇬', name: 'Nigeria', code: '+234' },
  );
  const [showPicker, setShowPicker] = React.useState(false);
  const [phone, setPhone] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [focusedField, setFocusedField] = React.useState<string | null>(null);
  const [shake, setShake] = React.useState(false);

  const identifierValid =
    mode === 'phone' ? phone.replace(/\D/g, '').length >= 7 : /^\S+@\S+\.\S+$/.test(email.trim());
  const isValid =
    identifierValid &&
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    password.length >= 8;

  const handleContinue = (): void => {
    if (!isValid) {
      setShake(true);
      setTimeout(() => {
        setShake(false);
      }, 500);
      return;
    }
    onSubmit({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
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
        <div className="px-7 pb-2 pt-3">
          <span
            aria-hidden="true"
            className="block h-9 w-[8.9vw] max-w-[36px]"
            dangerouslySetInnerHTML={{ __html: dripplexMarkSvg }}
          />
        </div>
        <div
          className="flex flex-col gap-2 px-7 pb-5 pt-5"
          style={{ animation: 'slide-in-right .42s cubic-bezier(.25,.46,.45,.94) .05s both' }}
        >
          <h1
            className={`text-[28px] font-bold leading-tight text-white ${heading}`}
            style={{ letterSpacing: '-0.022em' }}
          >
            Welcome to DrippleX
          </h1>
          <p
            className={`text-[14px] leading-relaxed ${body}`}
            style={{ color: 'rgba(255,255,255,.38)' }}
          >
            Create your account using your phone number or email.
          </p>
        </div>

        <div
          className="mx-5 flex flex-col gap-5 rounded-3xl px-5 py-5"
          style={{
            background: 'linear-gradient(145deg,#112238,#0D1B2E)',
            border: '1px solid rgba(255,255,255,.08)',
            boxShadow: '0 20px 60px rgba(0,0,0,.4)',
            animation: shake
              ? 'shake .45s ease'
              : 'slide-in-right .42s cubic-bezier(.25,.46,.45,.94) .12s both',
          }}
        >
          <div
            className="flex rounded-xl p-1"
            style={{
              background: 'rgba(255,255,255,.04)',
              border: '1px solid rgba(255,255,255,.06)',
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
            <>
              <div className="flex flex-col gap-2">
                <label
                  className={`text-[11px] font-medium uppercase tracking-widest ${body}`}
                  style={{ color: 'rgba(255,255,255,.3)' }}
                >
                  Country
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowPicker((v) => !v);
                  }}
                  className="flex h-[54px] items-center justify-between rounded-xl px-4 transition-all"
                  style={{
                    background: 'rgba(255,255,255,.05)',
                    border: showPicker
                      ? '1.5px solid #2BAC52'
                      : '1.5px solid rgba(255,255,255,.08)',
                    boxShadow: showPicker ? '0 0 0 3px rgba(43,172,82,.11)' : 'none',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{country.flag}</span>
                    <span className={`text-[15px] font-medium text-white ${body}`}>
                      {country.name}
                    </span>
                    <span className={`text-sm ${body}`} style={{ color: 'rgba(255,255,255,.38)' }}>
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
              </div>
              <FieldShell label="Phone Number" focused={focusedField === 'phone'}>
                <span
                  className={`shrink-0 border-r pr-3 text-[14px] font-medium ${body}`}
                  style={{ color: '#47CF72', borderColor: 'rgba(255,255,255,.1)' }}
                >
                  {country.code}
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder="801 234 5678"
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
                  className={`placeholder:text-white/22 flex-1 bg-transparent text-[15px] text-white outline-none ${body}`}
                />
              </FieldShell>
            </>
          ) : (
            <FieldShell label="Email Address" focused={focusedField === 'email'}>
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
                className={`placeholder:text-white/22 flex-1 bg-transparent text-[15px] text-white outline-none ${body}`}
              />
            </FieldShell>
          )}

          <div className="grid grid-cols-2 gap-3">
            <FieldShell label="First Name" focused={focusedField === 'firstName'}>
              <input
                type="text"
                autoComplete="given-name"
                placeholder="Ada"
                value={firstName}
                onChange={(e) => {
                  setFirstName(e.target.value);
                }}
                onFocus={() => {
                  setFocusedField('firstName');
                }}
                onBlur={() => {
                  setFocusedField(null);
                }}
                className={`placeholder:text-white/22 w-full bg-transparent text-[15px] text-white outline-none ${body}`}
              />
            </FieldShell>
            <FieldShell label="Last Name" focused={focusedField === 'lastName'}>
              <input
                type="text"
                autoComplete="family-name"
                placeholder="Lovelace"
                value={lastName}
                onChange={(e) => {
                  setLastName(e.target.value);
                }}
                onFocus={() => {
                  setFocusedField('lastName');
                }}
                onBlur={() => {
                  setFocusedField(null);
                }}
                className={`placeholder:text-white/22 w-full bg-transparent text-[15px] text-white outline-none ${body}`}
              />
            </FieldShell>
          </div>

          <FieldShell label="Password" focused={focusedField === 'password'}>
            <input
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
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
              className={`placeholder:text-white/22 flex-1 bg-transparent text-[15px] text-white outline-none ${body}`}
            />
          </FieldShell>

          <div className="flex items-start gap-2.5 px-1">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#2BAC52"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mt-0.5 shrink-0"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <p
              className={`text-[12px] leading-relaxed ${body}`}
              style={{ color: 'rgba(255,255,255,.34)' }}
            >
              {mode === 'phone'
                ? 'Your phone number is securely verified using a one-time password (OTP).'
                : 'Your email address is securely verified using a one-time password (OTP).'}
            </p>
          </div>
        </div>

        {errorMessage ? (
          <p className={`px-7 pt-4 text-center text-[13px] ${body}`} style={{ color: '#EF4444' }}>
            {errorMessage}
          </p>
        ) : null}

        <div
          className="flex flex-col gap-4 px-7 pt-5"
          style={{ animation: 'slide-in-right .42s cubic-bezier(.25,.46,.45,.94) .2s both' }}
        >
          <SuperAppAuthGreenButton
            label={loading ? 'Creating account…' : 'Continue'}
            disabled={!isValid}
            loading={loading}
            onClick={handleContinue}
            icon={<SuperAppAuthArrowIcon />}
          />
          <p
            className={`text-center text-[14px] ${body}`}
            style={{ color: 'rgba(255,255,255,.38)' }}
          >
            Already have an account?{' '}
            <button
              type="button"
              onClick={onSignIn}
              className="font-semibold underline underline-offset-2 transition-opacity active:opacity-70"
              style={{ color: '#47CF72' }}
            >
              Sign In
            </button>
          </p>
          <SuperAppAuthDivider />
        </div>
        <div className="flex items-center justify-center gap-4 px-7 pb-10 pt-5">
          {(['Terms of Service', 'Privacy Policy'] as const).map((t, i) => (
            <span key={t} className="flex items-center gap-4">
              <button
                type="button"
                className={`text-[12px] underline underline-offset-2 ${body}`}
                style={{ color: 'rgba(255,255,255,.26)' }}
              >
                {t}
              </button>
              {i === 0 ? <span style={{ color: 'rgba(255,255,255,.14)' }}>·</span> : null}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
