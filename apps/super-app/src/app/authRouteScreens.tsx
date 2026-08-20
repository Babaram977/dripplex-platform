// ─── Backend-addressed auth landing routes ───────────────────────────────────
//
// The backend redirects a browser to two paths under CUSTOMER_APP_URL that no
// screen in this app used to answer:
//
//   /auth/google/callback?code=<handoff>   GoogleAuthController.googleCallback
//   /verify-email?token=<token>            ProductionNotificationService
//                                            .sendEmailVerification
//
// Until the super-app owned them, CUSTOMER_APP_URL had to keep pointing at
// customer-web or both flows would land on the splash screen with the code and
// the token silently discarded. These two screens are what lets that variable
// move — see docs/store/DPX-MOBILE-001-STORE-READINESS.md.
//
// They render outside AppShell, like SharedTripScreen: no bottom nav, no
// splash, nothing that assumes a signed-in session already exists.

import React, { useEffect, useRef, useState } from 'react';

import { api } from '../lib/api';
import { useDxAuth } from '../lib/ApiProvider';

import { BORDER, G2, MUTED, NAVY_CARD, NAVY_DEEP } from './shared';
import { GreenBtn } from './shared';

const PP = "'Poppins',sans-serif";
const IT = "'Inter',sans-serif";

export type AuthRoute = 'google-callback' | 'verify-email';

/**
 * Which backend-addressed auth path this load is answering, if any.
 *
 * Matched on the path alone. The query string carries the payload but is not
 * part of the match: a `/verify-email` with no token is still this screen's
 * job — it is the screen that explains what went wrong, rather than the
 * splash screen silently swallowing it.
 */
export function authRouteFromLocation(): AuthRoute | null {
  if (typeof window === 'undefined') return null;
  const path = window.location.pathname.replace(/\/+$/, '').toLowerCase();
  if (path === '/auth/google/callback') return 'google-callback';
  if (path === '/verify-email') return 'verify-email';
  return null;
}

/** Shell shared by both screens so they sit in the phone frame the same way. */
function AuthRouteShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="absolute inset-0 flex flex-col justify-center overflow-y-auto px-6"
      style={{ background: NAVY_DEEP, fontFamily: IT }}
    >
      {children}
    </div>
  );
}

function Heading({ title, body }: { title: string; body: string }) {
  return (
    <>
      <p style={{ fontFamily: PP, fontSize: 22, fontWeight: 700, color: '#fff' }}>{title}</p>
      <p style={{ fontSize: 14, fontFamily: IT, color: MUTED, marginTop: 8, lineHeight: 1.55 }}>
        {body}
      </p>
    </>
  );
}

function ErrorNote({ message }: { message: string }) {
  return (
    <div
      className="mt-5 rounded-2xl p-4"
      style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)' }}
    >
      <p style={{ fontSize: 13, fontFamily: IT, color: '#F87171' }}>{message}</p>
    </div>
  );
}

/**
 * `/auth/google/callback` — the browser arrives here from the backend once
 * Google consent is done.
 *
 * The handoff code in the URL is single-use, so the exchange is fired exactly
 * once per mount: the ref guard matters because `loginWithResponse` is rebuilt
 * on every ApiProvider render, and an effect keyed on it would spend the code
 * a second time and report a failure on top of a sign-in that had in fact
 * already succeeded.
 */
export function GoogleCallbackScreen({ onDone }: { onDone: () => void }) {
  const { loginWithResponse } = useDxAuth();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (params.get('error')) {
      setError('Google sign-in was cancelled or could not be completed.');
      return;
    }
    if (!code) {
      setError(
        'This sign-in link is missing its code. Please start again from the sign-in screen.',
      );
      return;
    }

    let cancelled = false;
    api.auth
      .exchangeGoogleCode(code)
      .then((session) => {
        if (cancelled) return;
        loginWithResponse(session);
        onDone();
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'We could not complete your Google sign-in.');
      });

    return () => {
      cancelled = true;
    };
    // Runs once per mount by design — see the ref guard above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <AuthRouteShell>
        <Heading title="We couldn't sign you in" body="Your DrippleX account was not changed." />
        <ErrorNote message={error} />
        <div className="mt-6">
          <GreenBtn label="Back to sign in" onClick={onDone} />
        </div>
      </AuthRouteShell>
    );
  }

  return (
    <AuthRouteShell>
      <Heading title="Finishing sign-in" body="Completing your Google sign-in with DrippleX…" />
    </AuthRouteShell>
  );
}

/**
 * `/verify-email` — the "Verify email" button in the account-verification
 * email lands here.
 *
 * The emailed link carries only `?token=`, never the address it was sent to,
 * and the backend requires both (`VerifyEmailTokenDto`) so that a leaked token
 * on its own is not enough to verify an account. So this asks the customer to
 * confirm their email rather than trusting the URL — the same bargain
 * customer-web's VerifyEmailForm makes.
 */
export function VerifyEmailScreen({ onDone }: { onDone: () => void }) {
  const token = new URLSearchParams(window.location.search).get('token') ?? '';
  const [email, setEmail] = useState('');
  const [focused, setFocused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);

  const submit = () => {
    if (busy || email.trim() === '') return;
    setBusy(true);
    setError(null);
    api.auth
      .verifyEmail({ email: email.trim(), token })
      .then(() => setVerified(true))
      .catch((e: unknown) => {
        setError(
          e instanceof Error
            ? e.message
            : 'We could not verify this email. The link may have expired.',
        );
      })
      .finally(() => setBusy(false));
  };

  if (!token) {
    return (
      <AuthRouteShell>
        <Heading
          title="This link is incomplete"
          body="Open the “Verify email” button straight from the email we sent you, or request a new link from the app."
        />
        <div className="mt-6">
          <GreenBtn label="Continue to DrippleX" onClick={onDone} />
        </div>
      </AuthRouteShell>
    );
  }

  if (verified) {
    return (
      <AuthRouteShell>
        <Heading
          title="Email verified"
          body="Your email address is confirmed. You can sign in to DrippleX now."
        />
        <div className="mt-6">
          <GreenBtn label="Continue to sign in" onClick={onDone} />
        </div>
      </AuthRouteShell>
    );
  }

  return (
    <AuthRouteShell>
      <Heading
        title="Verify your email"
        body="Confirm the address this link was sent to and we'll finish verifying your account."
      />

      <div
        className="mt-6 flex h-[56px] items-center gap-3 rounded-2xl px-4 transition-all duration-200"
        style={{
          background: 'rgba(255,255,255,.045)',
          border: focused ? `1.5px solid ${G2}` : `1.5px solid ${BORDER}`,
          boxShadow: focused ? `0 0 0 3px rgba(43,172,82,.12)` : 'none',
        }}
      >
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
          className="flex-1 bg-transparent text-base text-white outline-none placeholder:text-white/20"
          style={{ fontFamily: IT }}
        />
      </div>

      {error && <ErrorNote message={error} />}

      <div className="mt-5">
        <GreenBtn
          label={busy ? 'Verifying…' : 'Verify email'}
          disabled={email.trim() === ''}
          loading={busy}
          onClick={submit}
        />
      </div>

      <button
        onClick={onDone}
        className="mt-4 text-center"
        style={{ fontSize: 13, fontFamily: IT, color: MUTED, background: 'none', border: 'none' }}
      >
        Skip for now
      </button>

      <div
        className="mt-6 rounded-2xl p-4"
        style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
      >
        <p style={{ fontSize: 12, fontFamily: IT, color: MUTED, lineHeight: 1.55 }}>
          We ask for your address because the link alone is not proof of who you are.
        </p>
      </div>
    </AuthRouteShell>
  );
}
