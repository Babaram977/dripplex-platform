'use client';

import { Drawer, DrawerContent, DrawerTitle, toast } from '@dripplex/ui';
import { Lock, ShieldAlert } from 'lucide-react';
import * as React from 'react';

import type { DriverVerificationTrigger } from '@dripplex/types';

import { SelfieCapture } from '@/components/driver/selfie-capture';
import { useSubmitIdentityVerification } from '@/hooks/use-identity-verification';

const TRIGGER_COPY: Record<DriverVerificationTrigger, string> = {
  ONBOARDING: "Let's confirm it's really you before you start driving.",
  IDLE_TIMEOUT: "You've been offline a while — let's confirm it's still you before you go online.",
  NEW_DEVICE: "We don't recognize this device — let's confirm it's really you.",
  SUSPICIOUS_ACTIVITY: 'For your account’s safety, please re-verify before going online.',
  ACCOUNT_RECOVERY: 'Since your account was recently recovered, please re-verify it’s you.',
  MANUAL_ADMIN: 'Our team has asked you to re-verify your identity before going online.',
  CREDENTIAL_CHANGE: 'Since your password or PIN changed recently, please re-verify it’s you.',
  FAILED_LOGIN_LOCKOUT:
    'For your account’s safety after a login lockout, please re-verify it’s you.',
  FIRST_LOGIN_OF_DAY: "Let's confirm it's you for today before you go online.",
  GPS_ANOMALY: "Your location changed unexpectedly — let's confirm it's really you.",
  RANDOM_SPOT_CHECK: "Just a quick check — let's confirm it's really you.",
  PHONE_NUMBER_CHANGED: 'Since your phone number changed recently, please re-verify it’s you.',
};

interface IdentityVerificationDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: DriverVerificationTrigger | null;
  /** DPX-DS-001: a support-review lock after repeated failures — no capture
   * flow is offered, only a "contact support" message. */
  locked: boolean;
  deviceId: string | undefined;
  onVerified: () => void;
}

/**
 * Driver-001's "verification required" gate UI — shown only when the risk
 * engine blocks going online, never before every trip. See
 * docs/DRIVER-001-IDENTITY-VERIFICATION-DESIGN.md.
 */
export function IdentityVerificationDrawer({
  open,
  onOpenChange,
  trigger,
  locked,
  deviceId,
  onVerified,
}: IdentityVerificationDrawerProps): React.JSX.Element {
  const submit = useSubmitIdentityVerification();

  const onCapture = (selfieImageBase64: string): void => {
    submit.mutate(
      { selfieImageBase64, ...(deviceId !== undefined ? { deviceId } : {}) },
      {
        onSuccess: (result) => {
          if (result.status === 'PASSED') {
            toast({ title: 'Verified', description: "You're clear to go online." });
            onOpenChange(false);
            onVerified();
          } else {
            toast({
              title: "Couldn't verify you",
              description: "That didn't match. You've been kept offline — try again.",
              variant: 'destructive',
            });
          }
        },
        onError: () => {
          toast({
            title: 'Verification failed',
            description: "We couldn't complete verification. You've been kept offline — try again.",
            variant: 'destructive',
          });
        },
      },
    );
  };

  if (locked) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent side="bottom" className="flex flex-col items-center gap-4 text-center">
          <Lock className="text-destructive h-8 w-8" aria-hidden="true" />
          <DrawerTitle>Account locked for review</DrawerTitle>
          <p className="text-muted-foreground text-sm">
            After several failed verification attempts, your account needs a support review before
            you can go online again. Please contact DrippleX support.
          </p>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent side="bottom" className="flex flex-col items-center gap-4 text-center">
        <ShieldAlert className="text-primary h-8 w-8" aria-hidden="true" />
        <DrawerTitle>Identity verification required</DrawerTitle>
        <p className="text-muted-foreground text-sm">
          {trigger ? TRIGGER_COPY[trigger] : 'Please verify your identity to continue.'}
        </p>
        <SelfieCapture onCapture={onCapture} disabled={submit.isPending} />
      </DrawerContent>
    </Drawer>
  );
}
