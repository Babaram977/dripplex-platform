'use client';

import { Badge, Card, CardContent, CardHeader, CardTitle, Skeleton } from '@dripplex/ui';
import * as React from 'react';

import { AppShell } from '@/components/app-shell';
import { ChangePasswordForm } from '@/components/driver/change-password-form';
import { KycDocumentForm } from '@/components/driver/kyc-document-form';
import { useDriverAvailability } from '@/hooks/rides/use-driver-availability';
import { useDriverProfile } from '@/hooks/use-driver-profile';
import { formatDate } from '@/lib/format';

interface StatusBadgeProps {
  variant: 'success' | 'outline';
  className?: string;
}

const NEGATIVE_BADGE_CLASSNAME = 'text-destructive border-destructive/40';

const DRIVER_STATUS_BADGE: Record<string, StatusBadgeProps> = {
  APPROVED: { variant: 'success' },
  REJECTED: { variant: 'outline', className: NEGATIVE_BADGE_CLASSNAME },
  SUSPENDED: { variant: 'outline', className: NEGATIVE_BADGE_CLASSNAME },
  PENDING: { variant: 'outline' },
  UNDER_REVIEW: { variant: 'outline' },
};

const KYC_STATUS_BADGE: Record<string, StatusBadgeProps> = {
  VERIFIED: { variant: 'success' },
  REJECTED: { variant: 'outline', className: NEGATIVE_BADGE_CLASSNAME },
  PENDING: { variant: 'outline' },
};

const VEHICLE_TYPE_LABEL: Record<string, string> = {
  ECONOMY: 'Dx Ride (car)',
  COMFORT: 'Dx Comfort (car)',
  XL: 'Dx XL (car)',
  TRICYCLE: 'Tricycle (Keke)',
};

export default function ProfilePage(): React.JSX.Element {
  const profile = useDriverProfile();
  const availability = useDriverAvailability();

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Profile</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Your personal information, vehicle, documents, and account settings.
          </p>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Personal information</CardTitle>
            {profile.data ? (
              <Badge {...(DRIVER_STATUS_BADGE[profile.data.status] ?? { variant: 'outline' })}>
                {profile.data.status}
              </Badge>
            ) : null}
          </CardHeader>
          <CardContent>
            {profile.isLoading ? <Skeleton className="h-24 w-full" /> : null}
            {profile.data ? (
              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-muted-foreground text-xs">Name</p>
                  <p>
                    {profile.data.firstName} {profile.data.lastName}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Email</p>
                  <p>{profile.data.email}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Phone</p>
                  <p>{profile.data.phone ?? 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Driver since</p>
                  <p>{formatDate(profile.data.createdAt)}</p>
                </div>
              </div>
            ) : null}
            <p className="text-muted-foreground mt-3 text-xs">
              Editing personal information isn&apos;t available yet — there&apos;s no update-profile
              endpoint for drivers in the backend.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vehicle details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              <p className="text-muted-foreground text-xs">Vehicle type</p>
              <p>
                {availability.data?.vehicleType
                  ? (VEHICLE_TYPE_LABEL[availability.data.vehicleType] ??
                    availability.data.vehicleType)
                  : 'Set from the dashboard when you go online'}
              </p>
            </div>
            <p className="text-muted-foreground mt-3 text-xs">
              Make, model, plate number, and colour aren&apos;t captured anywhere in the
              backend&apos;s schema — only this broad vehicle-type category exists.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Documents & KYC</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {profile.data && profile.data.kyc.length > 0 ? (
              <div className="flex flex-col gap-2">
                {profile.data.kyc.map((doc) => (
                  <div
                    key={doc.id}
                    className="border-border/70 flex items-center justify-between rounded-md border p-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">{doc.documentType.replaceAll('_', ' ')}</p>
                      <p className="text-muted-foreground text-xs">
                        Submitted {formatDate(doc.createdAt)}
                      </p>
                    </div>
                    <Badge
                      {...(KYC_STATUS_BADGE[doc.verificationStatus] ?? { variant: 'outline' })}
                    >
                      {doc.verificationStatus}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No documents submitted yet.</p>
            )}
            <KycDocumentForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account settings</CardTitle>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
