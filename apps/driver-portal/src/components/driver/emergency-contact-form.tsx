'use client';

import { Button, Input, Label, toast } from '@dripplex/ui';
import * as React from 'react';

import type { DriverProfileDto } from '@dripplex/types';

import { useSubmitEmergencyContact } from '@/hooks/use-driver-onboarding';

interface EmergencyContactFormProps {
  profile: DriverProfileDto;
}

export function EmergencyContactForm({ profile }: EmergencyContactFormProps): React.JSX.Element {
  const submit = useSubmitEmergencyContact();
  const [name, setName] = React.useState(profile.emergencyContactName ?? '');
  const [phone, setPhone] = React.useState(profile.emergencyContactPhone ?? '');

  const onSubmit = (): void => {
    submit.mutate(
      { emergencyContactName: name.trim(), emergencyContactPhone: phone.trim() },
      {
        onSuccess: () => {
          toast({ title: 'Emergency contact updated' });
        },
        onError: () => {
          toast({
            title: "Couldn't update emergency contact",
            description: 'Check the details and try again.',
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
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="emergency-contact-name">Contact name</Label>
        <Input
          id="emergency-contact-name"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
          }}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="emergency-contact-phone">Contact phone</Label>
        <Input
          id="emergency-contact-phone"
          type="tel"
          value={phone}
          onChange={(event) => {
            setPhone(event.target.value);
          }}
        />
      </div>
      <Button type="submit" disabled={submit.isPending}>
        Save emergency contact
      </Button>
    </form>
  );
}
