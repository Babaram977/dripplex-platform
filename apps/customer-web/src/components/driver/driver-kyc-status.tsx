'use client';

import { useAuth } from '@dripplex/hooks';
import { Button, EmptyState } from '@dripplex/ui';
import Link from 'next/link';
import * as React from 'react';

import type { DriverKycDto, DriverProfileDto, KycDocumentType } from '@dripplex/types';

import { useRequireAuth } from '@/hooks/use-require-auth';
import { describeSdkError, DripplexApiError, sdk } from '@/lib/sdk';

type ViewState =
  | { kind: 'loading' }
  | { kind: 'not-driver' }
  | { kind: 'ready'; profile: DriverProfileDto }
  | { kind: 'error'; title: string; description: string };

/** Same `KycDocumentType` label map the Upload screen uses -- kept in sync
 * manually since each screen is its own file per the founder's "preserve
 * the Figma screen boundaries" rule (no shared-state merge between them). */
const DOCUMENT_LABELS: Record<KycDocumentType, string> = {
  NATIONAL_ID: 'National ID (NIN)',
  DRIVER_LICENSE: "Driver's licence",
  VEHICLE_REGISTRATION: 'Vehicle registration paper',
  INSURANCE: 'Insurance certificate',
  PASSPORT: 'Passport',
  GUARANTOR_ID: "Guarantor's ID",
  CAC_CERTIFICATE: 'CAC certificate',
  BUSINESS_REGISTRATION: 'Business registration',
};

const STATUS_LABEL: Record<DriverKycDto['verificationStatus'], string> = {
  PENDING: 'Pending review',
  VERIFIED: 'Verified',
  REJECTED: 'Needs attention',
};

/**
 * DPX-100 Priority 1 -- KYC Status screen (Figma `DriverKYCStatusScreen`,
 * `src/app/driverScreen.tsx`). Kept as its own screen/route, separate from
 * Upload Documents, per the founder's permanent rule: preserve Figma's
 * screen boundaries even where the backend data model differs -- never
 * merge screens for convenience.
 *
 * One documented gap: Figma's progress ring is computed against a fixed
 * mock 6-document checklist with a client-side percentage. The real
 * backend (`DriverProfileDto.kyc: DriverKycDto[]`) has no such required
 * checklist or completion percentage -- it's a free-form submitted-
 * documents list. Not faked here; this screen shows the real submitted
 * documents and their real `verificationStatus` instead of an invented
 * progress ring. See docs/reference/DPX-FIGMA-DIFF-REGISTER.md.
 */
export function DriverKycStatus(): React.JSX.Element {
  const { ready } = useRequireAuth();
  const { user } = useAuth();
  const [view, setView] = React.useState<ViewState>({ kind: 'loading' });

  const loadProfile = React.useCallback(async (): Promise<void> => {
    try {
      const profile = await sdk.driverProfile.getOwnProfile();
      setView({ kind: 'ready', profile });
    } catch (error) {
      if (error instanceof DripplexApiError && error.statusCode === 403) {
        setView({ kind: 'not-driver' });
        return;
      }
      const described = describeSdkError(error);
      setView({ kind: 'error', title: described.title, description: described.description });
    }
  }, []);

  React.useEffect(() => {
    if (!ready) return;
    void loadProfile();
  }, [ready, loadProfile]);

  if (!ready || view.kind === 'loading') {
    return (
      <div className="text-muted-foreground flex min-h-[40vh] items-center justify-center text-sm">
        Loading…
      </div>
    );
  }

  if (view.kind === 'not-driver') {
    return (
      <EmptyState
        title="Become a Driver first"
        description="KYC verification is part of Driver onboarding. Go back and become a driver to continue."
      />
    );
  }

  if (view.kind === 'error') {
    return (
      <EmptyState
        title={view.title}
        description={view.description}
        action={
          <Button type="button" variant="outline" onClick={() => void loadProfile()}>
            Try again
          </Button>
        }
      />
    );
  }

  const kyc = view.profile.kyc;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight">KYC verification</h1>
        <p className="text-muted-foreground text-sm">
          {kyc.length > 0
            ? `${String(kyc.length)} document${kyc.length === 1 ? '' : 's'} submitted`
            : `Hi ${user?.firstName ?? 'there'}, no documents submitted yet.`}
        </p>
      </div>

      {kyc.length > 0 ? (
        <div className="space-y-2.5">
          {kyc.map((doc) => (
            <div
              key={doc.id}
              className="border-border/70 bg-card/60 flex items-center justify-between rounded-2xl border p-3.5 text-sm"
            >
              <span className="font-medium">{DOCUMENT_LABELS[doc.documentType]}</span>
              <span
                className={
                  doc.verificationStatus === 'VERIFIED'
                    ? 'text-brand font-medium'
                    : doc.verificationStatus === 'REJECTED'
                      ? 'font-medium text-red-500'
                      : 'text-muted-foreground font-medium'
                }
              >
                {STATUS_LABEL[doc.verificationStatus]}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <Button asChild className="w-full">
        <Link href="/driver-onboarding/documents/upload">Upload documents</Link>
      </Button>
    </div>
  );
}
