'use client';

import { Card, CardContent, CardHeader, CardTitle, Skeleton } from '@dripplex/ui';
import * as React from 'react';

import { AppShell } from '@/components/app-shell';
import { AgreementAcceptanceForm } from '@/components/driver/agreement-acceptance-form';
import { EmergencyContactForm } from '@/components/driver/emergency-contact-form';
import { KycDocumentForm } from '@/components/driver/kyc-document-form';
import { SubmitRegistrationCard } from '@/components/driver/submit-registration-card';
import { VehicleManager } from '@/components/driver/vehicle-manager';
import { useDriverProfile } from '@/hooks/use-driver-profile';

interface StepProps {
  index: number;
  title: string;
  description: string;
  children: React.ReactNode;
}

function Step({ index, title, description, children }: StepProps): React.JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="bg-primary/10 text-primary flex h-6 w-6 items-center justify-center rounded-full text-sm font-semibold">
            {index}
          </span>
          {title}
        </CardTitle>
        <p className="text-muted-foreground text-sm">{description}</p>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/**
 * DPX-DRIVER-007 — Driver Registration Completion flow.
 * Sequences the Figma registration steps (Vehicle → Emergency Contact →
 * Agreement → KYC/Upload Docs → Submit for Review → SUBMITTED) in the
 * driver-portal web idiom, reusing existing step components. The Submit step
 * wires the Figma "Submit for Review" CTA to POST /driver/onboarding/submit.
 */
export default function OnboardingPage(): React.JSX.Element {
  const profile = useDriverProfile();

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Complete your registration
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Finish these steps to submit your driver registration for review.
          </p>
        </div>

        <Step
          index={1}
          title="Vehicle"
          description="Register the vehicle you'll drive with. It must be approved before activation."
        >
          <VehicleManager />
        </Step>

        <Step
          index={2}
          title="Emergency contact"
          description="Someone we can reach in an emergency."
        >
          {profile.isLoading ? <Skeleton className="h-24 w-full" /> : null}
          {profile.data ? <EmergencyContactForm profile={profile.data} /> : null}
        </Step>

        <Step
          index={3}
          title="Driver Agreement"
          description="Review and accept to complete registration."
        >
          {profile.isLoading ? <Skeleton className="h-24 w-full" /> : null}
          {profile.data ? <AgreementAcceptanceForm profile={profile.data} /> : null}
        </Step>

        <Step
          index={4}
          title="KYC documents"
          description="Upload at least one identity/registration document (hosted image URL)."
        >
          <KycDocumentForm />
        </Step>

        <Step
          index={5}
          title="Submit for review"
          description="Submit your registration once the steps above are complete."
        >
          <SubmitRegistrationCard />
        </Step>
      </div>
    </AppShell>
  );
}
