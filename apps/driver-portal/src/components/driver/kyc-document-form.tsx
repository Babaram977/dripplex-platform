'use client';

import { Button, Input, Label, Select, toast } from '@dripplex/ui';
import * as React from 'react';

import type { KycDocumentType } from '@dripplex/types';

import { useSubmitKyc } from '@/hooks/use-driver-profile';

const DOCUMENT_TYPES: { value: KycDocumentType; label: string }[] = [
  { value: 'NATIONAL_ID', label: 'National ID' },
  { value: 'PASSPORT', label: 'Passport' },
  { value: 'DRIVER_LICENSE', label: "Driver's license" },
  { value: 'VEHICLE_REGISTRATION', label: 'Vehicle registration' },
];

/** frontImage/backImage are validated as URLs on the backend
 * (SubmitDriverKycDto @IsUrl) — there is no file-upload/storage endpoint
 * anywhere in this backend, so this takes a hosted image URL rather than
 * a file picker. Adapting the UI to the real backend contract. */
export function KycDocumentForm(): React.JSX.Element {
  const submitKyc = useSubmitKyc();
  const [documentType, setDocumentType] = React.useState<KycDocumentType>('NATIONAL_ID');
  const [documentNumber, setDocumentNumber] = React.useState('');
  const [frontImage, setFrontImage] = React.useState('');
  const [backImage, setBackImage] = React.useState('');

  const onSubmit = (): void => {
    submitKyc.mutate(
      {
        documentType,
        documentNumber,
        frontImage,
        ...(backImage.trim() ? { backImage: backImage.trim() } : {}),
      },
      {
        onSuccess: () => {
          toast({ title: 'Document submitted', description: 'Awaiting verification.' });
          setDocumentNumber('');
          setFrontImage('');
          setBackImage('');
        },
        onError: () => {
          toast({
            title: "Couldn't submit document",
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
        <Label htmlFor="kyc-document-type">Document type</Label>
        <Select
          id="kyc-document-type"
          value={documentType}
          onChange={(event) => {
            setDocumentType(event.target.value as KycDocumentType);
          }}
        >
          {DOCUMENT_TYPES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="kyc-document-number">Document number</Label>
        <Input
          id="kyc-document-number"
          value={documentNumber}
          onChange={(event) => {
            setDocumentNumber(event.target.value);
          }}
          required
          minLength={3}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="kyc-front-image">Front image URL</Label>
        <Input
          id="kyc-front-image"
          type="url"
          value={frontImage}
          onChange={(event) => {
            setFrontImage(event.target.value);
          }}
          placeholder="https://…"
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="kyc-back-image">Back image URL (optional)</Label>
        <Input
          id="kyc-back-image"
          type="url"
          value={backImage}
          onChange={(event) => {
            setBackImage(event.target.value);
          }}
          placeholder="https://…"
        />
      </div>
      <Button type="submit" disabled={submitKyc.isPending}>
        Submit document
      </Button>
    </form>
  );
}
