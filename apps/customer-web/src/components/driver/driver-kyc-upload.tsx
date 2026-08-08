'use client';

import { Button, EmptyState, Input, Label, Select } from '@dripplex/ui';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import type { DriverProfileDto, KycDocumentType } from '@dripplex/types';

import { useRequireAuth } from '@/hooks/use-require-auth';
import { describeSdkError, DripplexApiError, sdk } from '@/lib/sdk';

type ViewState =
  | { kind: 'loading' }
  | { kind: 'not-driver' }
  | { kind: 'ready'; profile: DriverProfileDto }
  | { kind: 'error'; title: string; description: string };

/** Real `KycDocumentType` values a driver can be asked for -- matches the
 * enum `SubmitDriverKycRequest.documentType` actually accepts
 * (`packages/types/src/merchant/index.ts`), same list driver-portal's own
 * `KycDocumentForm` uses. Figma's `DriverUploadDocsScreen` mocks a fixed
 * checklist including "Road Worthiness" and "Passport Photo" -- neither has
 * a backend document type; not invented here. See
 * docs/reference/DPX-FIGMA-DIFF-REGISTER.md. */
const DOCUMENT_TYPES: { value: KycDocumentType; label: string }[] = [
  { value: 'NATIONAL_ID', label: 'National ID (NIN)' },
  { value: 'DRIVER_LICENSE', label: "Driver's licence" },
  { value: 'VEHICLE_REGISTRATION', label: 'Vehicle registration paper' },
  { value: 'INSURANCE', label: 'Insurance certificate' },
  { value: 'PASSPORT', label: 'Passport' },
  { value: 'GUARANTOR_ID', label: "Guarantor's ID" },
];

/**
 * DPX-100 Priority 1 -- Upload Documents screen (Figma `DriverUploadDocsScreen`,
 * `src/app/driverScreen.tsx`). Its own screen/route, separate from KYC
 * Status, preserving Figma's screen boundaries per the founder's permanent
 * rule -- never merged for convenience even though both read/write the same
 * `DriverProfileDto.kyc` backend model.
 *
 * frontImage/backImage are hosted-image URLs, not a file picker -- there is
 * no file-upload/storage backend anywhere in this codebase (see
 * `KycDocumentForm` in driver-portal, which documents the same constraint;
 * also logged in the diff register).
 */
export function DriverKycUpload(): React.JSX.Element {
  const { ready } = useRequireAuth();
  const router = useRouter();
  const [view, setView] = React.useState<ViewState>({ kind: 'loading' });
  const [submitting, setSubmitting] = React.useState(false);

  const [documentType, setDocumentType] = React.useState<KycDocumentType>('NATIONAL_ID');
  const [documentNumber, setDocumentNumber] = React.useState('');
  const [frontImage, setFrontImage] = React.useState('');
  const [backImage, setBackImage] = React.useState('');

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

  const onSubmit: React.SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    void (async () => {
      setSubmitting(true);
      try {
        await sdk.driverProfile.submitKyc({
          documentType,
          documentNumber: documentNumber.trim(),
          frontImage: frontImage.trim(),
          ...(backImage.trim() ? { backImage: backImage.trim() } : {}),
        });
        // Figma's onSave navigates back to the KYC Status screen (App.tsx:
        // drvuploaddocs.onSave -> go("drvkyc")).
        router.push('/driver-onboarding/documents');
      } catch (error) {
        const described = describeSdkError(error);
        setView({ kind: 'error', title: described.title, description: described.description });
      } finally {
        setSubmitting(false);
      }
    })();
  };

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
        description="Document upload is part of Driver onboarding. Go back and become a driver to continue."
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

  const submittedTypes = new Set(view.profile.kyc.map((doc) => doc.documentType));
  const remaining = DOCUMENT_TYPES.filter((doc) => !submittedTypes.has(doc.value));

  if (remaining.length === 0) {
    return (
      <EmptyState
        title="All document types submitted"
        description="There's nothing left to upload right now."
      />
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Upload documents</h1>
        <p className="text-muted-foreground text-sm">{remaining.length} pending</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="kyc-doc-type">Document type</Label>
        <Select
          id="kyc-doc-type"
          value={documentType}
          onChange={(e) => {
            setDocumentType(e.target.value as KycDocumentType);
          }}
        >
          {remaining.map((doc) => (
            <option key={doc.value} value={doc.value}>
              {doc.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="kyc-doc-number">Document number</Label>
        <Input
          id="kyc-doc-number"
          value={documentNumber}
          onChange={(e) => {
            setDocumentNumber(e.target.value);
          }}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="kyc-front-image">Front image URL</Label>
        <Input
          id="kyc-front-image"
          type="url"
          placeholder="https://…"
          value={frontImage}
          onChange={(e) => {
            setFrontImage(e.target.value);
          }}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="kyc-back-image">Back image URL (optional)</Label>
        <Input
          id="kyc-back-image"
          type="url"
          placeholder="https://…"
          value={backImage}
          onChange={(e) => {
            setBackImage(e.target.value);
          }}
        />
      </div>
      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? 'Submitting…' : 'Submit document'}
      </Button>
    </form>
  );
}
