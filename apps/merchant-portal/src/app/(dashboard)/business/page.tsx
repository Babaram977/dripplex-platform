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
  Textarea,
} from '@dripplex/ui';
import * as React from 'react';

import type {
  BusinessDto,
  BusinessStatus,
  BusinessType,
  BusinessVerificationStatus,
} from '@dripplex/types';

import { describeSdkError, sdk } from '@/lib/sdk';

const BUSINESS_TYPE_LABEL: Record<BusinessType, string> = {
  SOLE_PROPRIETORSHIP: 'Sole proprietorship',
  PARTNERSHIP: 'Partnership',
  LIMITED_LIABILITY: 'Limited liability company',
  CORPORATION: 'Corporation',
  OTHER: 'Other',
};

const STATUS_LABEL: Record<BusinessStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  ACTIVE: 'Active',
  PAUSED: 'Paused',
  SUSPENDED: 'Suspended',
};

const STATUS_BADGE_VARIANT: Record<BusinessStatus, 'outline' | 'accent' | 'success' | 'secondary'> =
  {
    DRAFT: 'outline',
    SUBMITTED: 'accent',
    ACTIVE: 'success',
    PAUSED: 'secondary',
    SUSPENDED: 'secondary',
  };

const VERIFICATION_LABEL: Record<BusinessVerificationStatus, string> = {
  PENDING: 'Pending review',
  UNDER_REVIEW: 'Under review',
  VERIFIED: 'Verified',
  REJECTED: 'Rejected',
};

const VERIFICATION_BADGE_VARIANT: Record<
  BusinessVerificationStatus,
  'outline' | 'accent' | 'success'
> = {
  PENDING: 'outline',
  UNDER_REVIEW: 'accent',
  VERIFIED: 'success',
  REJECTED: 'outline',
};

interface BusinessFormState {
  businessName: string;
  businessType: BusinessType;
  registrationNumber: string;
  taxNumber: string;
  description: string;
  email: string;
  phone: string;
  country: string;
  state: string;
  city: string;
  address: string;
  latitude: string;
  longitude: string;
  logoUrl: string;
  coverPhotoUrl: string;
}

function toFormState(business: BusinessDto | null): BusinessFormState {
  return {
    businessName: business?.businessName ?? '',
    businessType: business?.businessType ?? 'SOLE_PROPRIETORSHIP',
    registrationNumber: business?.registrationNumber ?? '',
    taxNumber: business?.taxNumber ?? '',
    description: business?.description ?? '',
    email: business?.email ?? '',
    phone: business?.phone ?? '',
    country: business?.country ?? '',
    state: business?.state ?? '',
    city: business?.city ?? '',
    address: business?.address ?? '',
    latitude: business ? String(business.latitude) : '',
    longitude: business ? String(business.longitude) : '',
    logoUrl: business?.logoUrl ?? '',
    coverPhotoUrl: business?.coverPhotoUrl ?? '',
  };
}

export default function BusinessProfilePage(): React.JSX.Element {
  const [business, setBusiness] = React.useState<BusinessDto | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      const data = await sdk.merchant.getBusiness();
      setBusiness(data);
    } catch (loadError) {
      const described = describeSdkError(loadError);
      if (described.statusCode === 404) {
        // No business profile created yet — this is the real first step of
        // the readiness sequence (Business details → Verification →
        // Approval → Add products → Start selling), not an error state.
        setBusiness(null);
      } else {
        setError(described.description);
      }
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
        <h1 className="font-display text-3xl font-semibold tracking-tight">Business profile</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Your registered business details. This is where DrippleX verifies who you are before
          approving your store.
        </p>
      </div>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <ReadinessCard business={business} />

      <BusinessForm business={business} onSaved={setBusiness} />
    </div>
  );
}

function ReadinessCard({ business }: { business: BusinessDto | null }): React.JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Getting your store live</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ol className="flex flex-col gap-2 text-sm">
          <ReadinessStep
            label="Business details"
            done={business !== null}
            current={business === null}
          />
          <ReadinessStep
            label="Verification"
            done={business?.verificationStatus === 'VERIFIED'}
            current={business !== null && business.verificationStatus !== 'VERIFIED'}
          />
          <ReadinessStep
            label="Approval"
            done={business?.status === 'ACTIVE' || business?.status === 'PAUSED'}
            current={
              business?.verificationStatus === 'VERIFIED' &&
              business.status !== 'ACTIVE' &&
              business.status !== 'PAUSED'
            }
          />
          <ReadinessStep
            label="Add products"
            done={false}
            current={business?.status === 'ACTIVE'}
            hint={business?.status === 'ACTIVE' ? 'Go to Products to add your catalog.' : undefined}
          />
          <ReadinessStep label="Start selling" done={false} current={false} />
        </ol>
        {business ? (
          <div className="flex items-center gap-2 pt-1">
            <Badge variant={STATUS_BADGE_VARIANT[business.status]}>
              Store: {STATUS_LABEL[business.status]}
            </Badge>
            <Badge variant={VERIFICATION_BADGE_VARIANT[business.verificationStatus]}>
              Verification: {VERIFICATION_LABEL[business.verificationStatus]}
            </Badge>
          </div>
        ) : null}
        {business?.rejectedReason ? (
          <p className="text-destructive text-sm">Rejected: {business.rejectedReason}</p>
        ) : null}
        {/* Bank setup is financial setup, not an activation requirement — the
            backend never checks for a bank account before approval. Framed
            here honestly rather than implied as a blocking step. */}
        <p className="text-muted-foreground text-xs">
          Bank details for receiving payouts can be added separately under Wallet & Bank — they are
          not required to get approved or start selling.
        </p>
      </CardContent>
    </Card>
  );
}

function ReadinessStep({
  label,
  done,
  current,
  hint,
}: {
  label: string;
  done: boolean;
  current: boolean;
  hint?: string;
}): React.JSX.Element {
  return (
    <li className="flex items-center gap-2">
      <span
        className={
          done
            ? 'bg-success flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white'
            : current
              ? 'border-accent text-accent flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold'
              : 'border-border text-muted-foreground flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px]'
        }
        aria-hidden="true"
      >
        {done ? '✓' : ''}
      </span>
      <span className={done || current ? 'font-medium' : 'text-muted-foreground'}>{label}</span>
      {hint ? <span className="text-muted-foreground text-xs">· {hint}</span> : null}
    </li>
  );
}

function BusinessForm({
  business,
  onSaved,
}: {
  business: BusinessDto | null;
  onSaved: (business: BusinessDto) => void;
}): React.JSX.Element {
  const [form, setForm] = React.useState<BusinessFormState>(() => toFormState(business));
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setForm(toFormState(business));
  }, [business]);

  const set =
    <K extends keyof BusinessFormState>(key: K) =>
    (value: BusinessFormState[K]): void => {
      setForm((current) => ({ ...current, [key]: value }));
    };

  const isSuspended = business?.status === 'SUSPENDED';

  const onSubmit: React.SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    if (saving || isSuspended) {
      return;
    }
    void (async () => {
      setSaving(true);
      setError(null);
      try {
        const payload = {
          businessName: form.businessName.trim(),
          businessType: form.businessType,
          registrationNumber: form.registrationNumber.trim(),
          ...(form.taxNumber.trim() ? { taxNumber: form.taxNumber.trim() } : {}),
          ...(form.description.trim() ? { description: form.description.trim() } : {}),
          email: form.email.trim(),
          phone: form.phone.trim(),
          country: form.country.trim(),
          state: form.state.trim(),
          city: form.city.trim(),
          address: form.address.trim(),
          latitude: Number(form.latitude),
          longitude: Number(form.longitude),
          ...(form.logoUrl.trim() ? { logoUrl: form.logoUrl.trim() } : {}),
          ...(form.coverPhotoUrl.trim() ? { coverPhotoUrl: form.coverPhotoUrl.trim() } : {}),
        };
        const saved = business
          ? await sdk.merchant.updateBusiness(payload)
          : await sdk.merchant.createBusiness(payload);
        onSaved(saved);
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
        <CardTitle>{business ? 'Edit details' : 'Create your business profile'}</CardTitle>
      </CardHeader>
      <CardContent>
        {isSuspended ? (
          <p className="text-destructive mb-4 text-sm">
            This business is suspended. Contact DrippleX support to resolve this before making
            changes.
          </p>
        ) : null}
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="businessName">Business name</Label>
              <Input
                id="businessName"
                required
                minLength={3}
                maxLength={150}
                disabled={isSuspended}
                value={form.businessName}
                onChange={(event) => {
                  set('businessName')(event.target.value);
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="businessType">Business type</Label>
              <Select
                id="businessType"
                disabled={isSuspended}
                value={form.businessType}
                onChange={(event) => {
                  set('businessType')(event.target.value as BusinessType);
                }}
              >
                {(Object.keys(BUSINESS_TYPE_LABEL) as BusinessType[]).map((type) => (
                  <option key={type} value={type}>
                    {BUSINESS_TYPE_LABEL[type]}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="registrationNumber">CAC / registration number</Label>
              <Input
                id="registrationNumber"
                required
                minLength={3}
                maxLength={100}
                disabled={isSuspended}
                value={form.registrationNumber}
                onChange={(event) => {
                  set('registrationNumber')(event.target.value);
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="taxNumber">Tax number (optional)</Label>
              <Input
                id="taxNumber"
                maxLength={100}
                disabled={isSuspended}
                value={form.taxNumber}
                onChange={(event) => {
                  set('taxNumber')(event.target.value);
                }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              rows={3}
              maxLength={2000}
              disabled={isSuspended}
              value={form.description}
              onChange={(event) => {
                set('description')(event.target.value);
              }}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Business email</Label>
              <Input
                id="email"
                type="email"
                required
                disabled={isSuspended}
                value={form.email}
                onChange={(event) => {
                  set('email')(event.target.value);
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">Business phone</Label>
              <Input
                id="phone"
                required
                minLength={7}
                maxLength={32}
                disabled={isSuspended}
                value={form.phone}
                onChange={(event) => {
                  set('phone')(event.target.value);
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                required
                disabled={isSuspended}
                value={form.country}
                onChange={(event) => {
                  set('country')(event.target.value);
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                required
                disabled={isSuspended}
                value={form.state}
                onChange={(event) => {
                  set('state')(event.target.value);
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                required
                disabled={isSuspended}
                value={form.city}
                onChange={(event) => {
                  set('city')(event.target.value);
                }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="address">Street address</Label>
            <Input
              id="address"
              required
              minLength={5}
              maxLength={500}
              disabled={isSuspended}
              value={form.address}
              onChange={(event) => {
                set('address')(event.target.value);
              }}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="latitude">Latitude</Label>
              <Input
                id="latitude"
                type="number"
                step="0.0000001"
                min="-90"
                max="90"
                required
                disabled={isSuspended}
                value={form.latitude}
                onChange={(event) => {
                  set('latitude')(event.target.value);
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="longitude">Longitude</Label>
              <Input
                id="longitude"
                type="number"
                step="0.0000001"
                min="-180"
                max="180"
                required
                disabled={isSuspended}
                value={form.longitude}
                onChange={(event) => {
                  set('longitude')(event.target.value);
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="logoUrl">Logo URL (optional)</Label>
              <Input
                id="logoUrl"
                placeholder="https://…"
                disabled={isSuspended}
                value={form.logoUrl}
                onChange={(event) => {
                  set('logoUrl')(event.target.value);
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="coverPhotoUrl">Cover photo URL (optional)</Label>
              <Input
                id="coverPhotoUrl"
                placeholder="https://…"
                disabled={isSuspended}
                value={form.coverPhotoUrl}
                onChange={(event) => {
                  set('coverPhotoUrl')(event.target.value);
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
            <Button type="submit" disabled={saving || isSuspended}>
              {saving ? 'Saving…' : business ? 'Save changes' : 'Create business profile'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
