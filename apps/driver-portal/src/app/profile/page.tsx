'use client';

import { Badge, Card, CardContent, CardHeader, CardTitle, Skeleton } from '@dripplex/ui';
import Link from 'next/link';
import * as React from 'react';

import { AppShell } from '@/components/app-shell';
import { ChangePasswordForm } from '@/components/driver/change-password-form';
import { EditPersonalInfoForm } from '@/components/driver/edit-personal-info-form';
import { EmergencyContactForm } from '@/components/driver/emergency-contact-form';
import { InspectionHistory } from '@/components/driver/inspection-history';
import { KycDocumentForm } from '@/components/driver/kyc-document-form';
import { PerformanceSummary } from '@/components/driver/performance-summary';
import { SecurityStatus } from '@/components/driver/security-status';
import { VehicleManager } from '@/components/driver/vehicle-manager';
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
          <CardContent className="flex flex-col gap-4">
            {profile.isLoading ? <Skeleton className="h-24 w-full" /> : null}
            {profile.data ? (
              <>
                <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
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
                <p className="text-muted-foreground text-xs">
                  Email and phone changes aren&apos;t available yet — there&apos;s no
                  change-of-email/phone flow for any account type in this backend.
                </p>
                <EditPersonalInfoForm profile={profile.data} />
              </>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Emergency contact</CardTitle>
          </CardHeader>
          <CardContent>
            {profile.data ? <EmergencyContactForm profile={profile.data} /> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <PerformanceSummary />
            <p className="text-muted-foreground mt-3 text-xs">
              Want the full breakdown?{' '}
              <Link href="/earnings" className="text-primary underline-offset-4 hover:underline">
                View earnings
              </Link>
              .
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Security</CardTitle>
          </CardHeader>
          <CardContent>
            <SecurityStatus />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vehicles</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <VehicleManager />
            <div className="border-border/70 border-t pt-3 text-sm">
              <p className="text-muted-foreground text-xs">Online category (from availability)</p>
              <p>
                {availability.data?.vehicleType
                  ? (VEHICLE_TYPE_LABEL[availability.data.vehicleType] ??
                    availability.data.vehicleType)
                  : 'Set from the dashboard when you go online'}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                This is set independently each time you go online — it isn&apos;t linked to the
                vehicles listed above.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Inspection history</CardTitle>
          </CardHeader>
          <CardContent>
            <InspectionHistory />
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
