'use client';

import { useAuth } from '@dripplex/hooks';
import {
  SuperAppAuthEditProfileScreen,
  type SuperAppChangeStep,
  type SuperAppEditProfileValues,
} from '@dripplex/ui';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { describeSdkError, sdk } from '@/lib/sdk';

/**
 * DPX-PROFILE-KYC-001 (founder decision 2026-08-07) -- orchestrates
 * `SuperAppAuthEditProfileScreen` against the real `PATCH /auth/me` and
 * phone/email change endpoints. Owns all async state (loading/error/success,
 * the two-step OTP flow for phone/email); the screen itself is purely
 * presentational. On every successful mutation the session's cached `user`
 * is updated from the endpoint's response so the rest of the Super App
 * (Account Management's identity card, etc.) reflects the change without a
 * separate refetch.
 */
export function EditProfileFlow(): React.JSX.Element {
  const router = useRouter();
  const { user, setUser } = useAuth();

  const [savingProfile, setSavingProfile] = React.useState(false);
  const [profileSaveError, setProfileSaveError] = React.useState<string | null>(null);
  const [profileSaved, setProfileSaved] = React.useState(false);

  const [phoneChangeStep, setPhoneChangeStep] = React.useState<SuperAppChangeStep>('idle');
  const [phoneChangeLoading, setPhoneChangeLoading] = React.useState(false);
  const [phoneChangeError, setPhoneChangeError] = React.useState<string | null>(null);

  const [emailChangeStep, setEmailChangeStep] = React.useState<SuperAppChangeStep>('idle');
  const [emailChangeLoading, setEmailChangeLoading] = React.useState(false);
  const [emailChangeError, setEmailChangeError] = React.useState<string | null>(null);

  const handleSaveProfile = React.useCallback(
    (values: SuperAppEditProfileValues): void => {
      setProfileSaveError(null);
      setProfileSaved(false);
      setSavingProfile(true);
      void (async () => {
        try {
          const updated = await sdk.auth.updateProfile({
            ...(values.firstName.trim() ? { firstName: values.firstName.trim() } : {}),
            ...(values.lastName.trim() ? { lastName: values.lastName.trim() } : {}),
            ...(values.profilePhotoUrl.trim()
              ? { profilePhotoUrl: values.profilePhotoUrl.trim() }
              : {}),
            ...(values.dateOfBirth.trim() ? { dateOfBirth: values.dateOfBirth.trim() } : {}),
            ...(values.gender.trim() ? { gender: values.gender.trim() } : {}),
          });
          setUser(updated);
          setProfileSaved(true);
        } catch (error) {
          setProfileSaveError(describeSdkError(error).description);
        } finally {
          setSavingProfile(false);
        }
      })();
    },
    [setUser],
  );

  const handleRequestPhoneChange = React.useCallback((newPhone: string): void => {
    setPhoneChangeError(null);
    setPhoneChangeLoading(true);
    void (async () => {
      try {
        await sdk.auth.requestPhoneChange({ newPhone });
        setPhoneChangeStep('code-sent');
      } catch (error) {
        setPhoneChangeError(describeSdkError(error).description);
      } finally {
        setPhoneChangeLoading(false);
      }
    })();
  }, []);

  const handleConfirmPhoneChange = React.useCallback(
    (otp: string): void => {
      setPhoneChangeError(null);
      setPhoneChangeLoading(true);
      void (async () => {
        try {
          const updated = await sdk.auth.confirmPhoneChange({ otp });
          setUser(updated);
          setPhoneChangeStep('idle');
        } catch (error) {
          setPhoneChangeError(describeSdkError(error).description);
        } finally {
          setPhoneChangeLoading(false);
        }
      })();
    },
    [setUser],
  );

  const handleRequestEmailChange = React.useCallback((newEmail: string): void => {
    setEmailChangeError(null);
    setEmailChangeLoading(true);
    void (async () => {
      try {
        await sdk.auth.requestEmailChange({ newEmail });
        setEmailChangeStep('code-sent');
      } catch (error) {
        setEmailChangeError(describeSdkError(error).description);
      } finally {
        setEmailChangeLoading(false);
      }
    })();
  }, []);

  const handleConfirmEmailChange = React.useCallback(
    (otp: string): void => {
      setEmailChangeError(null);
      setEmailChangeLoading(true);
      void (async () => {
        try {
          const updated = await sdk.auth.confirmEmailChange({ otp });
          setUser(updated);
          setEmailChangeStep('idle');
        } catch (error) {
          setEmailChangeError(describeSdkError(error).description);
        } finally {
          setEmailChangeLoading(false);
        }
      })();
    },
    [setUser],
  );

  return (
    <SuperAppAuthEditProfileScreen
      onBack={() => {
        router.back();
      }}
      initialValues={{
        firstName: user?.firstName ?? '',
        lastName: user?.lastName ?? '',
        profilePhotoUrl: user?.profilePhotoUrl ?? '',
        dateOfBirth: user?.dateOfBirth ?? '',
        gender: user?.gender ?? '',
      }}
      onSaveProfile={handleSaveProfile}
      savingProfile={savingProfile}
      profileSaveError={profileSaveError}
      profileSaved={profileSaved}
      currentPhone={user?.phone ?? null}
      phoneChangeStep={phoneChangeStep}
      onRequestPhoneChange={handleRequestPhoneChange}
      onConfirmPhoneChange={handleConfirmPhoneChange}
      onCancelPhoneChange={() => {
        setPhoneChangeStep('idle');
        setPhoneChangeError(null);
      }}
      phoneChangeLoading={phoneChangeLoading}
      phoneChangeError={phoneChangeError}
      currentEmail={user?.email ?? null}
      emailChangeStep={emailChangeStep}
      onRequestEmailChange={handleRequestEmailChange}
      onConfirmEmailChange={handleConfirmEmailChange}
      onCancelEmailChange={() => {
        setEmailChangeStep('idle');
        setEmailChangeError(null);
      }}
      emailChangeLoading={emailChangeLoading}
      emailChangeError={emailChangeError}
    />
  );
}
