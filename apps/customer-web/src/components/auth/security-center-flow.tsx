'use client';

import { useAuth } from '@dripplex/hooks';
import { SuperAppAuthSecurityCenterScreen, type SuperAppSecurityCenterLinkKey } from '@dripplex/ui';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { describeSdkError, sdk } from '@/lib/sdk';

const NOT_AVAILABLE_LABEL: Record<SuperAppSecurityCenterLinkKey, string> = {
  twofa: 'Two-Factor Auth',
  devices: 'Trusted Devices',
  activity: 'Security Activity',
  sessions: 'Active Sessions',
  emergency: 'Emergency Protection',
  trust: 'Trust Center',
  loginapproval: 'Login Approvals',
};

/**
 * DPX-INTEGRATION-001 -- orchestrates `SuperAppAuthSecurityCenterScreen`.
 * None of the seven Manage Security destinations have a built screen yet
 * (see the mapping doc); tapping one shows an honest "not available yet"
 * notice instead of a broken route or a fabricated feature. "Lock My
 * Account" is wired to the real `sdk.auth.logoutAll()` -- it doesn't
 * prevent future logins (no backend concept of an account lock exists),
 * but it does immediately end every session, which is the literal promise
 * in the source screen's copy.
 */
export function SecurityCenterFlow(): React.JSX.Element {
  const router = useRouter();
  const { clearSession } = useAuth();
  const [notice, setNotice] = React.useState<string | null>(null);
  const [locking, setLocking] = React.useState(false);
  const [lockError, setLockError] = React.useState<string | null>(null);

  const handleNavigate = React.useCallback((key: SuperAppSecurityCenterLinkKey): void => {
    setNotice(`${NOT_AVAILABLE_LABEL[key]} isn't available yet.`);
  }, []);

  const handleLockAccount = React.useCallback((): void => {
    setLockError(null);
    setLocking(true);
    void (async () => {
      try {
        await sdk.auth.logoutAll();
        clearSession();
        router.push('/login');
      } catch (error) {
        setLockError(describeSdkError(error).description);
      } finally {
        setLocking(false);
      }
    })();
  }, [clearSession, router]);

  return (
    <>
      <SuperAppAuthSecurityCenterScreen
        onBack={() => {
          router.back();
        }}
        onNavigate={handleNavigate}
        onLockAccount={handleLockAccount}
      />
      {notice ? (
        <div
          role="status"
          className="fixed inset-x-6 bottom-6 z-50 rounded-2xl p-4 text-center text-[13px] text-white shadow-lg"
          style={{ background: '#0D1B2E', border: '1px solid rgba(255,255,255,.12)' }}
          onClick={() => {
            setNotice(null);
          }}
        >
          {notice}
        </div>
      ) : null}
      {locking ? (
        <div
          role="status"
          className="fixed inset-x-6 bottom-6 z-50 rounded-2xl p-4 text-center text-[13px] text-white shadow-lg"
          style={{ background: '#0D1B2E', border: '1px solid rgba(255,255,255,.12)' }}
        >
          Ending all sessions…
        </div>
      ) : null}
      {lockError ? (
        <div
          role="alert"
          className="fixed inset-x-6 bottom-6 z-50 rounded-2xl p-4 text-center text-[13px] text-white shadow-lg"
          style={{ background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.3)' }}
        >
          {lockError}
        </div>
      ) : null}
    </>
  );
}
