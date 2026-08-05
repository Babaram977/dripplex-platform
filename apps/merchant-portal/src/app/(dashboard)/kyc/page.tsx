'use client';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  LoadingSpinner,
  Select,
} from '@dripplex/ui';
import Link from 'next/link';
import * as React from 'react';

import type { KycDocumentType, KycVerificationStatus, MerchantKycDto } from '@dripplex/types';

import { describeSdkError, sdk } from '@/lib/sdk';

// KycDocumentType is a shared enum used by both Merchant and Driver KYC
// (apps/backend/prisma/schema.prisma) — the backend's SubmitKycDto accepts
// the full enum with no portal-specific restriction. VEHICLE_REGISTRATION,
// GUARANTOR_ID, and INSURANCE only have meaning for Driver KYC, so this
// page curates the dropdown to the document types that are actually
// meaningful for a merchant's identity/business verification — the same
// kind of narrowing Incoming Orders' ACTIONABLE_STATUSES did against a
// broader shared enum. This does not invent a verification step; it just
// doesn't offer irrelevant ones from a shared type.
const MERCHANT_DOCUMENT_TYPES: KycDocumentType[] = [
  'NATIONAL_ID',
  'PASSPORT',
  'DRIVER_LICENSE',
  'CAC_CERTIFICATE',
  'BUSINESS_REGISTRATION',
];

const DOCUMENT_TYPE_LABEL: Record<KycDocumentType, string> = {
  NATIONAL_ID: 'National ID',
  PASSPORT: 'International passport',
  DRIVER_LICENSE: "Driver's license",
  CAC_CERTIFICATE: 'CAC certificate',
  BUSINESS_REGISTRATION: 'Business registration document',
  VEHICLE_REGISTRATION: 'Vehicle registration',
  GUARANTOR_ID: "Guarantor's ID",
  INSURANCE: 'Insurance',
};

// The backend's KycVerificationStatus has exactly three values — PENDING,
// VERIFIED, REJECTED. There is no distinct "under review" state (no
// reviewer-assignment field, no in-progress sub-status) — PENDING covers
// both "just submitted" and "a reviewer is looking at it." Labelled
// honestly as one combined state rather than inventing a split the
// backend doesn't track.
const STATUS_LABEL: Record<KycVerificationStatus, string> = {
  PENDING: 'Submitted — awaiting review',
  VERIFIED: 'Approved',
  REJECTED: 'Rejected',
};

const STATUS_BADGE_VARIANT: Record<KycVerificationStatus, 'outline' | 'accent' | 'success'> = {
  PENDING: 'accent',
  VERIFIED: 'success',
  REJECTED: 'outline',
};

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );
}

export default function KycPage(): React.JSX.Element {
  const [hasBusiness, setHasBusiness] = React.useState<boolean | null>(null);
  const [latest, setLatest] = React.useState<MerchantKycDto | null>(null);
  const [items, setItems] = React.useState<MerchantKycDto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      await sdk.merchant.getBusiness();
      setHasBusiness(true);
    } catch (businessError) {
      if (describeSdkError(businessError).statusCode === 404) {
        setHasBusiness(false);
        return;
      }
      setError(describeSdkError(businessError).description);
      return;
    }

    try {
      const status = await sdk.merchant.getKycStatus();
      setLatest(status.latest);
      setItems(status.items);
    } catch (kycError) {
      setError(describeSdkError(kycError).description);
    }
  }, []);

  React.useEffect(() => {
    setLoading(true);
    void load().finally(() => {
      setLoading(false);
    });
  }, [load]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Verification (KYC)</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Submit an identity or business document so DrippleX can verify and approve your store.
        </p>
      </div>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      {hasBusiness === false ? (
        <Card>
          <CardHeader>
            <CardTitle>Complete your business profile first</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Verification comes after your business details — the backend requires a business
              profile to exist before a KYC document can be submitted.
            </p>
            <Button asChild className="mt-4">
              <Link href="/business">Go to Business profile</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <StatusCard latest={latest} />
          {!latest || latest.verificationStatus === 'REJECTED' ? (
            <SubmitForm
              onSubmitted={(kyc) => {
                setLatest(kyc);
                setItems((current) => [kyc, ...current]);
              }}
            />
          ) : null}
          {items.length > 1 ? <HistoryCard items={items} /> : null}
        </>
      )}
    </div>
  );
}

function StatusCard({ latest }: { latest: MerchantKycDto | null }): React.JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Status</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {latest ? (
          <>
            <div className="flex items-center gap-2">
              <Badge variant={STATUS_BADGE_VARIANT[latest.verificationStatus]}>
                {STATUS_LABEL[latest.verificationStatus]}
              </Badge>
              <span className="text-muted-foreground text-sm">
                {DOCUMENT_TYPE_LABEL[latest.documentType]}
              </span>
            </div>
            <p className="text-muted-foreground text-xs">
              Submitted {formatDate(latest.createdAt)}
              {latest.reviewedAt ? ` · Reviewed ${formatDate(latest.reviewedAt)}` : ''}
            </p>
            {latest.verificationStatus === 'REJECTED' && latest.remarks ? (
              <p className="text-destructive text-sm">Reason: {latest.remarks}</p>
            ) : null}
            {latest.verificationStatus === 'REJECTED' ? (
              <p className="text-muted-foreground text-xs">
                You can submit a new document below to try again.
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-muted-foreground text-sm">
            No document submitted yet — use the form below to get started.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function HistoryCard({ items }: { items: MerchantKycDto[] }): React.JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Submission history</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="border-border/70 flex items-center justify-between border-b pb-3 text-sm last:border-b-0 last:pb-0"
          >
            <div>
              <p className="font-medium">{DOCUMENT_TYPE_LABEL[item.documentType]}</p>
              <p className="text-muted-foreground text-xs">{formatDate(item.createdAt)}</p>
            </div>
            <Badge variant={STATUS_BADGE_VARIANT[item.verificationStatus]}>
              {STATUS_LABEL[item.verificationStatus]}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function SubmitForm({
  onSubmitted,
}: {
  onSubmitted: (kyc: MerchantKycDto) => void;
}): React.JSX.Element {
  const [documentType, setDocumentType] = React.useState<KycDocumentType>('NATIONAL_ID');
  const [documentNumber, setDocumentNumber] = React.useState('');
  const [frontImage, setFrontImage] = React.useState('');
  const [backImage, setBackImage] = React.useState('');
  const [selfieImage, setSelfieImage] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const onSubmit: React.SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    if (saving) {
      return;
    }
    void (async () => {
      setSaving(true);
      setError(null);
      try {
        const kyc = await sdk.merchant.submitKyc({
          documentType,
          documentNumber: documentNumber.trim(),
          frontImage: frontImage.trim(),
          ...(backImage.trim() ? { backImage: backImage.trim() } : {}),
          ...(selfieImage.trim() ? { selfieImage: selfieImage.trim() } : {}),
        });
        onSubmitted(kyc);
        setDocumentNumber('');
        setFrontImage('');
        setBackImage('');
        setSelfieImage('');
      } catch (submitError) {
        setError(describeSdkError(submitError).description);
      } finally {
        setSaving(false);
      }
    })();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Submit a document</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="documentType">Document type</Label>
              <Select
                id="documentType"
                value={documentType}
                onChange={(event) => {
                  setDocumentType(event.target.value as KycDocumentType);
                }}
              >
                {MERCHANT_DOCUMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {DOCUMENT_TYPE_LABEL[type]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="documentNumber">Document number</Label>
              <Input
                id="documentNumber"
                required
                minLength={3}
                maxLength={100}
                value={documentNumber}
                onChange={(event) => {
                  setDocumentNumber(event.target.value);
                }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="frontImage">Front image URL</Label>
            <Input
              id="frontImage"
              required
              placeholder="https://…"
              value={frontImage}
              onChange={(event) => {
                setFrontImage(event.target.value);
              }}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="backImage">Back image URL (optional)</Label>
              <Input
                id="backImage"
                placeholder="https://…"
                value={backImage}
                onChange={(event) => {
                  setBackImage(event.target.value);
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="selfieImage">Selfie URL (optional)</Label>
              <Input
                id="selfieImage"
                placeholder="https://…"
                value={selfieImage}
                onChange={(event) => {
                  setSelfieImage(event.target.value);
                }}
              />
            </div>
          </div>

          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? 'Submitting…' : 'Submit for review'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
