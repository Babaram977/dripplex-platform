'use client';

import { useAuth } from '@dripplex/hooks';
import { Button, LoadingSpinner } from '@dripplex/ui';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';

import { describeSdkError, sdk } from '@/lib/sdk';
import { siteConfig } from '@/lib/site';

/**
 * Lands here after the backend's /auth/google/callback redirect completes.
 * Exchanges the short-lived `?code=` for the real token pair and finishes
 * sign-in — the SDK is Bearer-token based, so the browser redirect never
 * carries a real JWT, only this single-use handoff code.
 */
export default function GoogleCallbackPage(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setSession } = useAuth();
  const [error, setError] = React.useState<string | null>(null);

  const code = searchParams.get('code');
  const redirectError = searchParams.get('error');

  React.useEffect(() => {
    if (redirectError) {
      setError('Google sign-in was cancelled or could not be completed.');
      return;
    }
    if (!code) {
      setError('Missing Google sign-in code.');
      return;
    }

    let cancelled = false;
    sdk.auth
      .exchangeGoogleCode(code)
      .then((session) => {
        if (cancelled) {
          return;
        }
        setSession({
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          expiresIn: session.expiresIn,
          user: session.user,
          portal: 'customer',
        });
        router.push(siteConfig.links.getTheApp);
      })
      .catch((exchangeError: unknown) => {
        if (!cancelled) {
          setError(describeSdkError(exchangeError).description);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [code, redirectError, router, setSession]);

  if (error) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="font-display text-xl font-semibold tracking-tight">
          We couldn&apos;t sign you in
        </h1>
        <p className="text-muted-foreground text-sm">{error}</p>
        <Button asChild className="w-full">
          <Link href="/login">Back to login</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <LoadingSpinner label="Finishing sign-in with Google…" />
    </div>
  );
}
