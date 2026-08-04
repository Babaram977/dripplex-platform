'use client';

import { Button, Input, Label, toast } from '@dripplex/ui';
import * as React from 'react';

import type { DriverProfileDto } from '@dripplex/types';

import { useUpdateDriverProfile } from '@/hooks/use-driver-profile';

interface EditPersonalInfoFormProps {
  profile: DriverProfileDto;
}

/** Comma-separated free-text list input — no tag-picker component exists
 * in packages/ui, and this is a low-stakes field (languages spoken /
 * preferred areas), so a plain comma-separated string is the simplest
 * honest UI rather than introducing a new component for it. */
function parseList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function EditPersonalInfoForm({ profile }: EditPersonalInfoFormProps): React.JSX.Element {
  const updateProfile = useUpdateDriverProfile();
  const [firstName, setFirstName] = React.useState(profile.firstName);
  const [lastName, setLastName] = React.useState(profile.lastName);
  const [avatarUrl, setAvatarUrl] = React.useState(profile.avatarUrl ?? '');
  const [languagesSpoken, setLanguagesSpoken] = React.useState(profile.languagesSpoken.join(', '));
  const [preferredServiceAreas, setPreferredServiceAreas] = React.useState(
    profile.preferredServiceAreas.join(', '),
  );
  const [drivingExperienceYears, setDrivingExperienceYears] = React.useState(
    profile.drivingExperienceYears !== null ? String(profile.drivingExperienceYears) : '',
  );

  const onSubmit = (): void => {
    const experience = drivingExperienceYears.trim();
    updateProfile.mutate(
      {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        ...(avatarUrl.trim() ? { avatarUrl: avatarUrl.trim() } : {}),
        languagesSpoken: parseList(languagesSpoken),
        preferredServiceAreas: parseList(preferredServiceAreas),
        ...(experience ? { drivingExperienceYears: Number(experience) } : {}),
      },
      {
        onSuccess: () => {
          toast({ title: 'Profile updated' });
        },
        onError: () => {
          toast({
            title: "Couldn't update profile",
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="profile-first-name">First name</Label>
          <Input
            id="profile-first-name"
            value={firstName}
            onChange={(event) => {
              setFirstName(event.target.value);
            }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="profile-last-name">Last name</Label>
          <Input
            id="profile-last-name"
            value={lastName}
            onChange={(event) => {
              setLastName(event.target.value);
            }}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="profile-avatar-url">Profile photo URL</Label>
        <Input
          id="profile-avatar-url"
          type="url"
          placeholder="https://…"
          value={avatarUrl}
          onChange={(event) => {
            setAvatarUrl(event.target.value);
          }}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="profile-languages">Languages spoken</Label>
        <Input
          id="profile-languages"
          placeholder="English, Yoruba, Hausa"
          value={languagesSpoken}
          onChange={(event) => {
            setLanguagesSpoken(event.target.value);
          }}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="profile-service-areas">Preferred service areas</Label>
        <Input
          id="profile-service-areas"
          placeholder="Lekki, Ikeja, Victoria Island"
          value={preferredServiceAreas}
          onChange={(event) => {
            setPreferredServiceAreas(event.target.value);
          }}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="profile-driving-experience">Driving experience (years)</Label>
        <Input
          id="profile-driving-experience"
          type="number"
          min={0}
          max={80}
          value={drivingExperienceYears}
          onChange={(event) => {
            setDrivingExperienceYears(event.target.value);
          }}
        />
      </div>
      <Button type="submit" disabled={updateProfile.isPending}>
        Save changes
      </Button>
    </form>
  );
}
