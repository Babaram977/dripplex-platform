'use client';

import { useAuth } from '@dripplex/hooks';
import {
  SuperAppAuthAccountManagementScreen,
  type SuperAppAccountManagementLinkKey,
} from '@dripplex/ui';
import { useRouter } from 'next/navigation';
import * as React from 'react';

const NOT_AVAILABLE_LABEL: Record<SuperAppAccountManagementLinkKey, string> = {
  security: 'Security Settings',
  privacy: 'Privacy Controls',
  sessions: 'Active Sessions',
  linked: 'Linked Accounts',
  verifstatus: 'Verification Status',
  activity: 'Account Activity',
  services: 'Connected Services',
  trust: 'Trust Center',
  kyc: 'Identity Verification',
  download: 'Download My Data',
  pinsetup: 'PIN Setup',
  emailverify: 'Email Verification',
  changephone: 'Change Phone Number',
  username: 'Username',
  recoverycodes: 'Recovery Codes',
  securityqs: 'Security Questions',
  acctransfer: 'Account Transfer',
  authsummary: 'Auth Summary',
  delete: 'Delete Account',
};

/**
 * DPX-INTEGRATION-001 -- orchestrates `SuperAppAuthAccountManagementScreen`.
 * Identity fields (name/email/phone) come from the real session (`useAuth`'s
 * `user`, populated from `GET /auth/me` at login/hydration) -- no extra
 * fetch needed. `security` routes to the real Security Center; the other
 * seventeen destinations, including Delete Account, have neither a built
 * screen nor (for most) a backend endpoint yet, so they show an honest
 * "not available yet" notice rather than a fabricated flow.
 */
export function AccountManagementFlow(): React.JSX.Element {
  const router = useRouter();
  const { user } = useAuth();
  const [notice, setNotice] = React.useState<string | null>(null);

  const fullName = React.useMemo(() => {
    const parts = [user?.firstName, user?.lastName].filter((part): part is string =>
      Boolean(part?.trim()),
    );
    return parts.join(' ');
  }, [user?.firstName, user?.lastName]);

  const handleNavigate = React.useCallback(
    (key: SuperAppAccountManagementLinkKey): void => {
      if (key === 'security') {
        router.push('/account/security');
        return;
      }
      setNotice(`${NOT_AVAILABLE_LABEL[key]} isn't available yet.`);
    },
    [router],
  );

  return (
    <>
      <SuperAppAuthAccountManagementScreen
        onBack={() => {
          router.back();
        }}
        onNavigate={handleNavigate}
        fullName={fullName}
        email={user?.email ?? null}
        phone={user?.phone ?? null}
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
    </>
  );
}
