'use client';

import { useAuth } from '@dripplex/hooks';
import { SuperAppAuthSignInScreen, type SuperAppAuthSignInValues } from '@dripplex/ui';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { describeSdkError, sdk } from '@/lib/sdk';
import { siteConfig } from '@/lib/site';

/**
 * DPX-100 Auth Slice 5 -- orchestrates the real Figma-ported SignIn screen
 * (see docs/AUTH-DPX-100-REALITY-AUDIT.md). Replaces the legacy
 * `LoginForm`, which was hardcoded to email-only via `loginSchema` despite
 * the backend already accepting phone OR email login via
 * `PortalLoginDto`/`portalLoginSchema` -- this flow is the fix for that,
 * not just a reskin. Follows the same presentational-screen + owning-flow
 * pattern as `AuthFlow`/`RideFlow`/`WalletFlow`.
 */
export function SignInFlow(): React.JSX.Element {
  const router = useRouter();
  const { setSession } = useAuth();
  const [loading, setLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const handleSubmit = React.useCallback(
    (values: SuperAppAuthSignInValues): void => {
      setErrorMessage(null);
      setLoading(true);
      void (async () => {
        try {
          const session = await sdk.auth.loginCustomer({
            password: values.password,
            ...(values.email ? { email: values.email } : {}),
            ...(values.phone ? { phone: values.phone } : {}),
          });
          setSession({
            accessToken: session.accessToken,
            refreshToken: session.refreshToken,
            expiresIn: session.expiresIn,
            user: session.user,
            portal: 'customer',
          });
          // The website does not run the product. Whoever just signed in —
          // customer, driver, or merchant — is handed to the app from here.
          router.push(siteConfig.links.getTheApp);
        } catch (error) {
          setErrorMessage(describeSdkError(error).description);
        } finally {
          setLoading(false);
        }
      })();
    },
    [router, setSession],
  );

  const handleGoogleSignIn = React.useCallback(() => {
    window.location.href = sdk.auth.googleSignInUrl();
  }, []);

  return (
    <SuperAppAuthSignInScreen
      onSubmit={handleSubmit}
      onForgotPassword={() => {
        router.push('/forgot-password');
      }}
      onCreateAccount={() => {
        router.push('/get-started');
      }}
      onGoogleSignIn={handleGoogleSignIn}
      onBack={() => {
        router.push('/');
      }}
      loading={loading}
      errorMessage={errorMessage}
    />
  );
}
