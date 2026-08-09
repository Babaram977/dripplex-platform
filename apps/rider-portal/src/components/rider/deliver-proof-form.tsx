'use client';

import { Button, Input, Label, Select } from '@dripplex/ui';
import * as React from 'react';

import type { DeliverOrderDto, ProofType } from '@dripplex/types';

const PROOF_TYPES: ProofType[] = ['OTP', 'PHOTO', 'SIGNATURE', 'PHOTO_AND_OTP'];

/**
 * Builds the DeliverOrderDto for POST /rider/jobs/:id/deliver. The backend
 * validates that each proof type carries its required field:
 *  - OTP → otp
 *  - PHOTO → photoUrl
 *  - SIGNATURE → signatureUrl
 *  - PHOTO_AND_OTP → photoUrl + otp
 * PHOTO / SIGNATURE need a hosted asset URL, which depends on the file-upload
 * pipeline (sdk.uploads) — not wired into this minimum flow. OTP is the
 * upload-free default: the rider types the code and the job moves to DELIVERED.
 */
export function DeliverProofForm({
  isPending,
  onSubmit,
}: {
  isPending: boolean;
  onSubmit: (body: DeliverOrderDto) => void;
}): React.JSX.Element {
  const [proofType, setProofType] = React.useState<ProofType>('OTP');
  const [otp, setOtp] = React.useState('');
  const [photoUrl, setPhotoUrl] = React.useState('');
  const [signatureUrl, setSignatureUrl] = React.useState('');
  const [notes, setNotes] = React.useState('');

  const needsOtp = proofType === 'OTP' || proofType === 'PHOTO_AND_OTP';
  const needsPhoto = proofType === 'PHOTO' || proofType === 'PHOTO_AND_OTP';
  const needsSignature = proofType === 'SIGNATURE';

  const submit = (): void => {
    const body: DeliverOrderDto = { proofType };
    if (needsOtp && otp.trim() !== '') {
      body.otp = otp.trim();
    }
    if (needsPhoto && photoUrl.trim() !== '') {
      body.photoUrl = photoUrl.trim();
    }
    if (needsSignature && signatureUrl.trim() !== '') {
      body.signatureUrl = signatureUrl.trim();
    }
    if (notes.trim() !== '') {
      body.notes = notes.trim();
    }
    onSubmit(body);
  };

  return (
    <div className="border-border/70 mt-3 space-y-3 rounded-md border p-3">
      <div className="space-y-1">
        <Label htmlFor="proofType">Proof of delivery</Label>
        <Select
          id="proofType"
          value={proofType}
          onChange={(event) => {
            setProofType(event.target.value as ProofType);
          }}
        >
          {PROOF_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </Select>
      </div>

      {needsOtp ? (
        <div className="space-y-1">
          <Label htmlFor="otp">Delivery code (OTP)</Label>
          <Input
            id="otp"
            value={otp}
            maxLength={12}
            onChange={(event) => {
              setOtp(event.target.value);
            }}
            placeholder="Code from customer"
          />
        </div>
      ) : null}

      {needsPhoto ? (
        <div className="space-y-1">
          <Label htmlFor="photoUrl">Photo URL</Label>
          <Input
            id="photoUrl"
            value={photoUrl}
            onChange={(event) => {
              setPhotoUrl(event.target.value);
            }}
            placeholder="https://… (requires upload pipeline)"
          />
        </div>
      ) : null}

      {needsSignature ? (
        <div className="space-y-1">
          <Label htmlFor="signatureUrl">Signature URL</Label>
          <Input
            id="signatureUrl"
            value={signatureUrl}
            onChange={(event) => {
              setSignatureUrl(event.target.value);
            }}
            placeholder="https://… (requires upload pipeline)"
          />
        </div>
      ) : null}

      <div className="space-y-1">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Input
          id="notes"
          value={notes}
          maxLength={1000}
          onChange={(event) => {
            setNotes(event.target.value);
          }}
          placeholder="Left with concierge, etc."
        />
      </div>

      <Button type="button" className="w-full" disabled={isPending} onClick={submit}>
        {isPending ? 'Submitting…' : 'Mark delivered'}
      </Button>
    </div>
  );
}
