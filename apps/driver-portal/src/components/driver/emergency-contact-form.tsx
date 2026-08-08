'use client';

import { Button, Input, Label, Select, toast } from '@dripplex/ui';
import * as React from 'react';

import type { DriverProfileDto } from '@dripplex/types';

import { useSubmitEmergencyContact } from '@/hooks/use-driver-onboarding';
import { EMERGENCY_CONTACT_RELATIONSHIPS } from '@/lib/driver-onboarding';

interface EmergencyContactFormProps {
  profile: DriverProfileDto;
}

export function EmergencyContactForm({ profile }: EmergencyContactFormProps): React.JSX.Element {
  const submit = useSubmitEmergencyContact();
  const [name, setName] = React.useState(profile.emergencyContactName ?? '');
  const [phone, setPhone] = React.useState(profile.emergencyContactPhone ?? '');
  const [relationship, setRelationship] = React.useState(
    profile.emergencyContactRelationship ?? '',
  );
  const [email, setEmail] = React.useState(profile.emergencyContactEmail ?? '');
  const [error, setError] = React.useState<string | null>(null);

  const onSubmit = (): void => {
    if (name.trim().length === 0 || phone.trim().length === 0 || relationship.length === 0) {
      setError('Name, phone, and relationship are required.');
      return;
    }
    setError(null);
    const trimmedEmail = email.trim();
    submit.mutate(
      {
        emergencyContactName: name.trim(),
        emergencyContactPhone: phone.trim(),
        emergencyContactRelationship: relationship,
        ...(trimmedEmail.length > 0 ? { emergencyContactEmail: trimmedEmail } : {}),
      },
      {
        onSuccess: () => {
          toast({ title: 'Emergency contact saved' });
        },
        onError: () => {
          toast({
            title: "Couldn't save emergency contact",
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
        <Label htmlFor="emergency-contact-name">Full name</Label>
        <Input
          id="emergency-contact-name"
          value={name}
          placeholder="e.g. Fatima Okafor"
          onChange={(event) => {
            setName(event.target.value);
          }}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="emergency-contact-relationship">Relationship</Label>
        <Select
          id="emergency-contact-relationship"
          value={relationship}
          onChange={(event) => {
            setRelationship(event.target.value);
          }}
        >
          <option value="" disabled>
            Select a relationship
          </option>
          {EMERGENCY_CONTACT_RELATIONSHIPS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="emergency-contact-phone">Phone number</Label>
        <Input
          id="emergency-contact-phone"
          type="tel"
          value={phone}
          placeholder="e.g. +234 801 234 5678"
          onChange={(event) => {
            setPhone(event.target.value);
          }}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="emergency-contact-email">Email address (optional)</Label>
        <Input
          id="emergency-contact-email"
          type="email"
          value={email}
          placeholder="e.g. contact@example.com"
          onChange={(event) => {
            setEmail(event.target.value);
          }}
        />
      </div>
      {error !== null ? <p className="text-destructive text-sm">{error}</p> : null}
      <Button type="submit" disabled={submit.isPending}>
        Save emergency contact
      </Button>
    </form>
  );
}
