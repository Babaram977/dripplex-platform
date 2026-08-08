'use client';

import { Button, toast } from '@dripplex/ui';
import * as React from 'react';

import type { DriverProfileDto } from '@dripplex/types';

import { useAcceptAgreement } from '@/hooks/use-driver-onboarding';
import { DRIVER_AGREEMENT_SECTIONS, DRIVER_AGREEMENT_VERSION } from '@/lib/driver-onboarding';

interface AgreementAcceptanceFormProps {
  profile: DriverProfileDto;
}

export function AgreementAcceptanceForm({
  profile,
}: AgreementAcceptanceFormProps): React.JSX.Element {
  const accept = useAcceptAgreement();
  const alreadyAccepted = profile.agreementAcceptedAt !== null;
  const [agreed, setAgreed] = React.useState(false);

  const onSubmit = (): void => {
    accept.mutate(
      { agreementVersion: DRIVER_AGREEMENT_VERSION },
      {
        onSuccess: () => {
          toast({ title: 'Driver Agreement accepted' });
        },
        onError: () => {
          toast({
            title: "Couldn't record agreement",
            description: 'Please try again.',
            variant: 'destructive',
          });
        },
      },
    );
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className="flex flex-col gap-4"
    >
      <div className="border-border/70 flex flex-col gap-3 rounded-md border p-4">
        <p className="font-display text-sm font-semibold">DrippleX Driver Agreement</p>
        {DRIVER_AGREEMENT_SECTIONS.map((section) => (
          <div key={section.title} className="flex flex-col gap-0.5">
            <p className="text-sm font-medium">{section.title}</p>
            <p className="text-muted-foreground text-sm">{section.body}</p>
          </div>
        ))}
        <p className="text-muted-foreground text-xs">
          Agreement version {DRIVER_AGREEMENT_VERSION}
        </p>
      </div>

      {alreadyAccepted ? (
        <p className="text-sm text-emerald-600">
          You accepted the Driver Agreement
          {profile.agreementVersion !== null ? ` (version ${profile.agreementVersion})` : ''}. You
          can re-accept if the agreement has been updated.
        </p>
      ) : null}

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4"
          checked={agreed}
          onChange={(event) => {
            setAgreed(event.target.checked);
          }}
        />
        <span>I have read and agree to the Driver Agreement and Terms of Service.</span>
      </label>

      <Button type="submit" disabled={!agreed || accept.isPending}>
        Accept agreement
      </Button>
    </form>
  );
}
