'use client';

import {
  SuperAppAuthRegisterScreen,
  SuperAppAuthWelcomeScreen,
  type SuperAppAuthRegisterValues,
} from '@dripplex/ui';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { describeSdkError, sdk } from '@/lib/sdk';

type AuthFlowScreen = { name: 'welcome' } | { name: 'register' };

/**
 * DPX-100 Auth Slice 2 -- orchestrates the real Figma Welcome + Register
 * screens (see docs/AUTH-DPX-100-REALITY-AUDIT.md). Splash is already
 * handled site-wide by `SplashIntro` on the marketing homepage, so this
 * flow starts at Welcome. Follows the same flat-screen-union + callback
 * pattern as `RideFlow`/`WalletFlow` -- presentational screens live in
 * `packages/ui`, this component owns the real SDK call and navigation.
 */
export function AuthFlow(): React.JSX.Element {
  const router = useRouter();
  const [screen, setScreen] = React.useState<AuthFlowScreen>({ name: 'welcome' });
  const [loading, setLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const handleRegister = React.useCallback(
    (values: SuperAppAuthRegisterValues): void => {
      setErrorMessage(null);
      setLoading(true);
      void (async () => {
        try {
          const result = await sdk.auth.registerCustomer({
            firstName: values.firstName,
            lastName: values.lastName,
            password: values.password,
            ...(values.email ? { email: values.email } : {}),
            ...(values.phone ? { phone: values.phone } : {}),
          });
          const params = new URLSearchParams(
            result.email ? { email: result.email } : { phone: values.phone ?? '' },
          );
          router.push(`/verify-otp?${params.toString()}`);
        } catch (error) {
          setErrorMessage(describeSdkError(error).description);
        } finally {
          setLoading(false);
        }
      })();
    },
    [router],
  );

  switch (screen.name) {
    case 'welcome':
      return (
        <SuperAppAuthWelcomeScreen
          onGetStarted={() => {
            setScreen({ name: 'register' });
          }}
          onSignIn={() => {
            router.push('/login');
          }}
        />
      );
    case 'register':
      return (
        <SuperAppAuthRegisterScreen
          onSubmit={handleRegister}
          onSignIn={() => {
            router.push('/login');
          }}
          onBack={() => {
            setErrorMessage(null);
            setScreen({ name: 'welcome' });
          }}
          loading={loading}
          errorMessage={errorMessage}
        />
      );
  }
}
