'use client';

import { Button, EmptyState, Input, Label, Select } from '@dripplex/ui';
import * as React from 'react';

import type { DriverKycDto, DriverProfileDto, KycDocumentType } from '@dripplex/types';

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
 * `KycDocumentForm` uses. Figma's `DriverKYCStatusScreen`/
 * `DriverUploadDocsScreen` mock a fixed 6-item checklist (NIN, Driver's
 * Licence, Vehicle Paper, Insurance Cert, Road Worthiness, Passport Photo)
 * against a `verificationStatus` model the backend doesn't have -- the real
 * backend is a free-form submitted-documents list, not a required checklist.
 * "Road Worthiness" and "Passport Photo" have no backend document type at
 * all; not invented here -- see the Missing Backend Register in
 * docs/reference/dpx-100-figma-screen-mapping.md. */
const DOCUMENT_TYPES: { value: KycDocumentType; label: string }[] = [
  { value: 'NATIONAL_ID', label: 'National ID (NIN)' },
  { value: 'DRIVER_LICENSE', label: "Driver's licence" },
  { value: 'VEHICLE_REGISTRATION', label: 'Vehicle registration paper' },
  { value: 'INSURANCE', label: 'Insurance certificate' },
  { value: 'PASSPORT', label: 'Passport' },
  { value: 'GUARANTOR_ID', label: "Guarantor's ID" },
];

const STATUS_LABEL: Record<DriverKycDto['verificationStatus'], string> = {
  PENDING: 'Pending review',
  VERIFIED: 'Verified',
  REJECTED: 'Needs attention',
};

/**
 * DPX-100 Priority 1 -- KYC Documents step of the in-app Driver Registration
 * flow. Merges what Figma splits into two screens (`DriverKYCStatusScreen` +
 * `DriverUploadDocsScreen`) into one, because the real backend model
 * (`DriverProfileDto.kyc: DriverKycDto[]`) is a submitted-documents list with
 * per-document `verificationStatus`, not a fixed progress-ring checklist --
 * showing status and offering the next upload are the same screen here.
 *
 * frontImage/backImage are hosted-image URLs, not a file picker -- there is
 * no file-upload/storage backend anywhere in this codebase (see
 * `KycDocumentForm` in driver-portal, which documents the same constraint).
 */
export function DriverKycDocuments(): React.JSX.Element {
  const { ready } = useRequireAuth();
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
        setDocumentNumber('');
        setFrontImage('');
        setBackImage('');
        await loadProfile();
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
        description="Document verification is part of Driver onboarding. Go back and become a driver to continue."
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

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight">KYC documents</h1>
        <p className="text-muted-foreground text-sm">
          {view.profile.kyc.length} of {DOCUMENT_TYPES.length} document types submitted
        </p>
      </div>

      {view.profile.kyc.length > 0 ? (
        <div className="space-y-2.5">
          {view.profile.kyc.map((doc) => (
            <div
              key={doc.id}
              className="border-border/70 bg-card/60 flex items-center justify-between rounded-2xl border p-3.5 text-sm"
            >
              <span className="font-medium">
                {DOCUMENT_TYPES.find((d) => d.value === doc.documentType)?.label ??
                  doc.documentType}
              </span>
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

      {remaining.length > 0 ? (
        <form onSubmit={onSubmit} className="space-y-4">
          <p className="text-muted-foreground pb-1 text-xs font-medium uppercase tracking-wide">
            Submit a document
          </p>
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
      ) : (
        <p className="text-muted-foreground text-sm">All document types submitted.</p>
      )}
    </div>
  );
}
