'use client';

import * as React from 'react';

import { SuperAppAuthAmbient, SuperAppAuthBackButton, SuperAppAuthStatusBar } from './AuthChrome';
import { SuperAppAuthCheckIcon, SuperAppAuthGreenButton } from './AuthPrimitives';
import { useSuperAppFonts } from './fonts';

export type SuperAppAuthOtpErrorCode = 'invalid' | 'expired' | 'attempts' | 'network';

export interface SuperAppAuthOtpVerifyResult {
  success: boolean;
  error?: SuperAppAuthOtpErrorCode;
}

const ERROR_CONFIG: Record<
  SuperAppAuthOtpErrorCode,
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
    message: "You've reached the maximum attempts. Wait a while before retrying.",
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

/**
 * Ported from the locked Figma Make `screensA.tsx`'s `OTPScreen` (AUTH-004)
 * -- 6-digit code entry with paste support, error states, resend countdown,
 * and a success animation. The source is phone-only and simulates
 * verification with a local setTimeout; this adaptation is identifier-
 * agnostic (`identifierKind` swaps the copy between "phone number" and
 * "email address" -- the founder's requirement is registration/verification
 * work for either, never phone-only) and `onVerify`/`onResend` call the
 * real backend through the parent flow instead of a fake timer.
 */
export function SuperAppAuthOtpScreen({
  identifierDisplay,
  identifierKind,
  onBack,
  onChangeIdentifier,
  onVerify,
  onResend,
  onVerified,
  initialResendSeconds = 45,
}: {
  identifierDisplay: string;
  identifierKind: 'phone' | 'email';
  onBack: () => void;
  onChangeIdentifier: () => void;
  onVerify: (code: string) => Promise<SuperAppAuthOtpVerifyResult>;
  onResend: () => Promise<{ expiresInSeconds?: number } | undefined>;
  onVerified: () => void;
  initialResendSeconds?: number;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  const [otp, setOtp] = React.useState<string[]>(['', '', '', '', '', '']);
  const [focused, setFocused] = React.useState<number>(-1);
  const [resend, setResend] = React.useState(initialResendSeconds);
  const [error, setError] = React.useState<SuperAppAuthOtpErrorCode | null>(null);
  const [status, setStatus] = React.useState<'idle' | 'verifying' | 'success'>('idle');
  const [shake, setShake] = React.useState(false);
  const [showHelp, setShowHelp] = React.useState(false);
  const inputs = React.useRef<(HTMLInputElement | null)[]>([]);

  const filled = otp.every((d) => d !== '');
  const noun = identifierKind === 'phone' ? 'Phone Number' : 'Email Address';

  React.useEffect(() => {
    if (resend <= 0) return undefined;
    const timer = setInterval(() => {
      setResend((s) => s - 1);
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, [resend]);

  const triggerShake = (): void => {
    setShake(true);
    setTimeout(() => {
      setShake(false);
    }, 500);
  };

  const handleChange = React.useCallback(
    (i: number, val: string) => {
      if (!/^\d?$/.test(val)) return;
      const next = [...otp];
      next[i] = val;
      setOtp(next);
      setError(null);
      if (val && i < 5) {
        setTimeout(() => {
          inputs.current[i + 1]?.focus();
        }, 0);
      }
    },
    [otp],
  );

  const handleKeyDown = React.useCallback(
    (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Backspace') {
        if (otp[i]) {
          const next = [...otp];
          next[i] = '';
          setOtp(next);
        } else if (i > 0) {
          inputs.current[i - 1]?.focus();
        }
      }
      if (e.key === 'ArrowLeft' && i > 0) inputs.current[i - 1]?.focus();
      if (e.key === 'ArrowRight' && i < 5) inputs.current[i + 1]?.focus();
    },
    [otp],
  );

  const handlePaste = React.useCallback(
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
      setTimeout(() => {
        inputs.current[focusIdx]?.focus();
      }, 0);
    },
    [otp],
  );

  const handleVerify = (): void => {
    if (!filled) {
      triggerShake();
      return;
    }
    setStatus('verifying');
    void (async () => {
      const result = await onVerify(otp.join(''));
      if (result.success) {
        setStatus('success');
        setTimeout(onVerified, 1600);
        return;
      }
      setStatus('idle');
      setError(result.error ?? 'invalid');
      if (result.error === 'invalid' || !result.error) triggerShake();
    })();
  };

  const handleResend = (): void => {
    void (async () => {
      const result = await onResend();
      setResend(result?.expiresInSeconds ?? initialResendSeconds);
      setOtp(['', '', '', '', '', '']);
      setError(null);
      inputs.current[0]?.focus();
    })();
  };

  const handleErrorAction = (err: SuperAppAuthOtpErrorCode): void => {
    if (err === 'expired' || err === 'network') {
      handleResend();
    } else {
      setError(null);
      setOtp(['', '', '', '', '', '']);
    }
  };

  if (status === 'success') {
    return (
      <div
        className="relative flex h-full min-h-dvh w-full flex-col items-center justify-center overflow-hidden"
        style={{ background: 'linear-gradient(155deg,#060E1C 0%,#0A1628 55%,#0B1D2F 100%)' }}
      >
        <SuperAppAuthAmbient />
        <div
          className="relative z-10 flex flex-col items-center gap-6"
          style={{ animation: 'success-bounce .6s cubic-bezier(.34,1.56,.64,1) both' }}
        >
          <div
            className="relative flex items-center justify-center"
            style={{ width: 120, height: 120 }}
          >
            <div
              className="absolute inset-0 rounded-full"
              style={{
                border: '2px solid #2BAC52',
                animation: 'pulse-ring 1.2s ease-out .3s infinite',
              }}
            />
            <div
              className="absolute inset-0 rounded-full"
              style={{
                border: '2px solid #2BAC52',
                animation: 'pulse-ring 1.2s ease-out .6s infinite',
              }}
            />
            <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
              <circle
                cx="60"
                cy="60"
                r="54"
                stroke="url(#dpx-auth-otp-success-gradient)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray="339"
                strokeDashoffset="0"
                style={{ animation: 'circle-draw .6s ease both' }}
              />
              <defs>
                <linearGradient
                  id="dpx-auth-otp-success-gradient"
                  x1="0"
                  y1="0"
                  x2="120"
                  y2="120"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="#176B30" />
                  <stop offset="1" stopColor="#47CF72" />
                </linearGradient>
              </defs>
            </svg>
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
              className={`text-[26px] font-bold text-white ${heading}`}
              style={{ letterSpacing: '-0.02em' }}
            >
              {noun} Verified
            </h2>
            <p className={`text-[15px] ${body}`} style={{ color: '#47CF72' }}>
              Welcome to DrippleX
            </p>
            <p className={`mt-1 text-[13px] ${body}`} style={{ color: 'rgba(255,255,255,.38)' }}>
              Setting up your account…
            </p>
          </div>
          <div className="flex items-center gap-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-2 w-2 rounded-full"
                style={{
                  background: '#2BAC52',
                  animation: `otp-pop .6s ease ${(i * 0.15).toFixed(2)}s infinite alternate`,
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
          className="flex flex-col gap-2 px-7 pb-2 pt-5"
          style={{ animation: 'slide-in-right .42s cubic-bezier(.25,.46,.45,.94) .05s both' }}
        >
          <h1
            className={`text-[26px] font-bold leading-tight text-white ${heading}`}
            style={{ letterSpacing: '-0.022em' }}
          >
            Verify Your {noun}
          </h1>
          <div>
            <p
              className={`text-[14px] leading-relaxed ${body}`}
              style={{ color: 'rgba(255,255,255,.38)' }}
            >
              We&rsquo;ve sent a 6-digit verification code to
            </p>
            <div className="mt-1 flex items-center gap-2">
              <span className={`text-[15px] font-semibold text-white ${body}`}>
                {identifierDisplay}
              </span>
              <button
                type="button"
                onClick={onChangeIdentifier}
                className="text-[13px] font-medium underline underline-offset-2 active:opacity-60"
                style={{ color: '#47CF72' }}
              >
                Change
              </button>
            </div>
          </div>
        </div>

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
                  aria-label={`Digit ${String(i + 1)} of 6`}
                  onChange={(e) => {
                    handleChange(i, e.target.value);
                  }}
                  onKeyDown={(e) => {
                    handleKeyDown(i, e);
                  }}
                  onPaste={handlePaste}
                  onFocus={() => {
                    setFocused(i);
                  }}
                  onBlur={() => {
                    setFocused(-1);
                  }}
                  className={`flex-1 rounded-2xl text-center font-bold text-white outline-none transition-all duration-150 ${heading}`}
                  style={{
                    height: 62,
                    fontSize: 24,
                    background: hasDigit
                      ? 'rgba(43,172,82,.14)'
                      : isFocused
                        ? 'rgba(255,255,255,.07)'
                        : 'rgba(255,255,255,.05)',
                    border: isError
                      ? '1.5px solid #E53935'
                      : isFocused
                        ? '2px solid #2BAC52'
                        : hasDigit
                          ? '1.5px solid #2BAC52'
                          : '1.5px solid rgba(255,255,255,.08)',
                    boxShadow: isFocused
                      ? '0 0 0 3px rgba(43,172,82,.15), 0 0 20px rgba(43,172,82,.1)'
                      : hasDigit && !isError
                        ? '0 0 12px rgba(43,172,82,.12)'
                        : 'none',
                    transform: isFocused ? 'scale(1.06)' : 'scale(1)',
                    minWidth: 0,
                  }}
                />
              );
            })}
          </div>
        </div>

        {error ? (
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
                className={`text-[13px] font-semibold ${heading}`}
                style={{ color: ERROR_CONFIG[error].color }}
              >
                {ERROR_CONFIG[error].title}
              </p>
              <p
                className={`mt-0.5 text-[12px] leading-relaxed ${body}`}
                style={{ color: 'rgba(255,255,255,.38)' }}
              >
                {ERROR_CONFIG[error].message}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                handleErrorAction(error);
              }}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-[12px] font-semibold active:opacity-70 ${body}`}
              style={{
                color: ERROR_CONFIG[error].color,
                background: `${ERROR_CONFIG[error].color}22`,
                border: `1px solid ${ERROR_CONFIG[error].color}40`,
              }}
            >
              {ERROR_CONFIG[error].action}
            </button>
          </div>
        ) : null}

        <div
          className="flex items-center justify-between px-7 pb-1 pt-4"
          style={{ animation: 'slide-in-right .42s cubic-bezier(.25,.46,.45,.94) .15s both' }}
        >
          <span className={`text-[13px] ${body}`} style={{ color: 'rgba(255,255,255,.38)' }}>
            {resend > 0 ? (
              <>
                Resend code in{' '}
                <span style={{ color: '#47CF72', fontVariantNumeric: 'tabular-nums' }}>
                  00:{resend.toString().padStart(2, '0')}
                </span>
              </>
            ) : (
              "Didn't receive the code?"
            )}
          </span>
          {resend <= 0 ? (
            <button
              type="button"
              onClick={handleResend}
              className="text-[13px] font-semibold underline underline-offset-2 active:opacity-60"
              style={{ color: '#47CF72' }}
            >
              Resend Code
            </button>
          ) : null}
        </div>

        <div
          className="px-7 pt-3"
          style={{ animation: 'slide-in-right .42s cubic-bezier(.25,.46,.45,.94) .2s both' }}
        >
          <SuperAppAuthGreenButton
            label="Verify"
            disabled={!filled}
            loading={status === 'verifying'}
            onClick={handleVerify}
            icon={filled && status !== 'verifying' ? <SuperAppAuthCheckIcon /> : undefined}
          />
        </div>

        <div
          className="mx-5 mt-4 flex items-start gap-3 rounded-2xl px-4 py-4"
          style={{
            background: 'linear-gradient(145deg,#112238,#0D1B2E)',
            border: '1px solid rgba(43,172,82,.12)',
            animation: 'slide-in-right .42s cubic-bezier(.25,.46,.45,.94) .25s both',
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#2BAC52"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mt-0.5 shrink-0"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <p
            className={`text-[12px] leading-relaxed ${body}`}
            style={{ color: 'rgba(255,255,255,.4)' }}
          >
            <span className="font-semibold text-white/60">Your security is important.</span> We use
            one-time passwords to securely verify your{' '}
            {identifierKind === 'phone' ? 'phone number' : 'email address'}. Never share your
            verification code with anyone.
          </p>
        </div>

        <div
          className="px-7 pb-1 pt-4"
          style={{ animation: 'slide-in-right .42s cubic-bezier(.25,.46,.45,.94) .3s both' }}
        >
          <button
            type="button"
            onClick={() => {
              setShowHelp((v) => !v);
            }}
            className={`flex items-center gap-2 text-[13px] transition-opacity active:opacity-70 ${body}`}
            style={{ color: 'rgba(255,255,255,.38)' }}
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

          {showHelp ? (
            <div
              className="mt-3 flex flex-col gap-2.5 rounded-xl px-4 py-4"
              style={{
                background: 'rgba(255,255,255,.04)',
                border: '1px solid rgba(255,255,255,.08)',
                animation: 'fade-in .2s ease both',
              }}
            >
              {[
                'Check your network connection.',
                identifierKind === 'phone'
                  ? 'Confirm your phone number is correct.'
                  : 'Confirm your email address is correct, and check spam.',
                'Request a new code after the timer expires.',
              ].map((tip) => (
                <div key={tip} className="flex items-start gap-2.5">
                  <span
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${heading}`}
                    style={{ background: 'rgba(43,172,82,.2)', color: '#47CF72' }}
                  >
                    •
                  </span>
                  <p
                    className={`text-[12px] leading-relaxed ${body}`}
                    style={{ color: 'rgba(255,255,255,.4)' }}
                  >
                    {tip}
                  </p>
                </div>
              ))}
              <button
                type="button"
                className="mt-1 self-start text-[12px] font-semibold underline underline-offset-2 active:opacity-60"
                style={{ color: '#47CF72' }}
              >
                Contact Support
              </button>
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-center gap-4 px-7 pb-10 pt-4">
          {(['Terms of Service', 'Privacy Policy'] as const).map((t, i) => (
            <span key={t} className="flex items-center gap-4">
              <button
                type="button"
                className={`text-[12px] underline underline-offset-2 ${body}`}
                style={{ color: 'rgba(255,255,255,.25)' }}
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
