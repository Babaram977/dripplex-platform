'use client';

import {
  SuperAppAuthOtpScreen,
  SuperAppAuthRegisterScreen,
  SuperAppAuthWelcomeScreen,
  type SuperAppAuthOtpVerifyResult,
  type SuperAppAuthRegisterValues,
} from '@dripplex/ui';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { describeSdkError, DripplexApiError, sdk } from '@/lib/sdk';

type AuthFlowScreen =
  | { name: 'welcome' }
  | { name: 'register' }
  | { name: 'otp'; identifier: string; kind: 'phone' | 'email' };

/**
 * DPX-100 Auth Slice 2+3 -- orchestrates the real Figma Welcome, Register,
 * and OTP screens (see docs/AUTH-DPX-100-REALITY-AUDIT.md). Splash is
 * already handled site-wide by `SplashIntro` on the marketing homepage, so
 * this flow starts at Welcome. Follows the same flat-screen-union +
 * callback pattern as `RideFlow`/`WalletFlow` -- presentational screens
 * live in `packages/ui`, this component owns the real SDK calls and
 * navigation.
 */
export function AuthFlow(): React.JSX.Element {
  const router = useRouter();
  const [screen, setScreen] = React.useState<AuthFlowScreen>({ name: 'welcome' });
  const [loading, setLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const handleRegister = React.useCallback((values: SuperAppAuthRegisterValues): void => {
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
        if (result.email) {
          setScreen({ name: 'otp', identifier: result.email, kind: 'email' });
        } else if (values.phone) {
          setScreen({ name: 'otp', identifier: values.phone, kind: 'phone' });
        }
      } catch (error) {
        setErrorMessage(describeSdkError(error).description);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleVerifyOtp = React.useCallback(
    async (
      identifier: string,
      kind: 'phone' | 'email',
      code: string,
    ): Promise<SuperAppAuthOtpVerifyResult> => {
      try {
        if (kind === 'email') {
          await sdk.auth.verifyEmail({ email: identifier, otp: code });
        } else {
          await sdk.auth.verifyPhone({ phone: identifier, otp: code });
        }
        return { success: true };
      } catch (error) {
        if (error instanceof DripplexApiError) {
          if (error.errorCode === 'OTP_INVALID') return { success: false, error: 'invalid' };
          if (error.errorCode === 'OTP_EXPIRED') return { success: false, error: 'expired' };
          if (error.errorCode === 'OTP_ATTEMPTS_EXCEEDED' || error.errorCode === 'RATE_LIMITED') {
            return { success: false, error: 'attempts' };
          }
        }
        return { success: false, error: 'network' };
      }
    },
    [],
  );

  const handleResendOtp = React.useCallback(
    async (
      identifier: string,
      kind: 'phone' | 'email',
    ): Promise<{ expiresInSeconds?: number } | undefined> => {
      try {
        if (kind === 'email') {
          await sdk.auth.resendEmailOtp({ email: identifier });
        } else {
          await sdk.auth.resendPhoneOtp({ phone: identifier });
        }
      } catch {
        // Best-effort: the countdown UI already resets locally, and the
        // next explicit "Verify" attempt will surface a real error if the
        // resend genuinely failed server-side.
      }
      return undefined;
    },
    [],
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
    case 'otp':
      return (
        <SuperAppAuthOtpScreen
          identifierDisplay={screen.identifier}
          identifierKind={screen.kind}
          onBack={() => {
            setScreen({ name: 'register' });
          }}
          onChangeIdentifier={() => {
            setScreen({ name: 'register' });
          }}
          onVerify={(code) => handleVerifyOtp(screen.identifier, screen.kind, code)}
          onResend={() => handleResendOtp(screen.identifier, screen.kind)}
          onVerified={() => {
            router.push('/login');
          }}
        />
      );
  }
}
