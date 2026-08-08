'use client';

import {
  SuperAppAuthIdentityVerificationScreen,
  type SuperAppKycStatusValues,
  type SuperAppSubmitKycValues,
} from '@dripplex/ui';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { describeSdkError, sdk } from '@/lib/sdk';

/**
 * DPX-PROFILE-KYC-002 -- orchestrates `SuperAppAuthIdentityVerificationScreen`
 * against the real `kyc/me` endpoints. Owns all async state (loading the
 * current status, start, submit); the screen itself is purely
 * presentational, same split as `EditProfileFlow`.
 */
export function IdentityVerificationFlow(): React.JSX.Element {
  const router = useRouter();

  const [status, setStatus] = React.useState<SuperAppKycStatusValues | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const loadStatus = React.useCallback((): void => {
    setLoading(true);
    void (async () => {
      try {
        const data = await sdk.kyc.getStatus();
        setStatus(data);
      } catch (error) {
        setSubmitError(describeSdkError(error).description);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  React.useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleStart = React.useCallback((): void => {
    setSubmitError(null);
    void (async () => {
      try {
        const data = await sdk.kyc.start();
        setStatus(data);
      } catch (error) {
        setSubmitError(describeSdkError(error).description);
      }
    })();
  }, []);

  const handleSubmit = React.useCallback((values: SuperAppSubmitKycValues): void => {
    setSubmitError(null);
    setSubmitting(true);
    void (async () => {
      try {
        const data = await sdk.kyc.submit({
          documentType: values.documentType,
          ...(values.documentNumber ? { documentNumber: values.documentNumber } : {}),
          frontImageUrl: values.frontImageUrl,
          ...(values.backImageUrl ? { backImageUrl: values.backImageUrl } : {}),
          ...(values.selfieUrl ? { selfieUrl: values.selfieUrl } : {}),
        });
        setStatus(data);
      } catch (error) {
        setSubmitError(describeSdkError(error).description);
      } finally {
        setSubmitting(false);
      }
    })();
  }, []);

  return (
    <SuperAppAuthIdentityVerificationScreen
      onBack={() => {
        router.back();
      }}
      status={status}
      loading={loading}
      onStart={handleStart}
      onSubmit={handleSubmit}
      submitting={submitting}
      submitError={submitError}
    />
  );
}
