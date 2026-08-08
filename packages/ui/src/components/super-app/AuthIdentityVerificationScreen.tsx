'use client';

import * as React from 'react';

import { SuperAppAuthAmbient, SuperAppAuthBackButton, SuperAppAuthStatusBar } from './AuthChrome';
import { useSuperAppFonts } from './fonts';

/**
 * DPX-PROFILE-KYC-002 (founder decision 2026-08-07,
 * docs/DPX-PROFILE-KYC-001-DESIGN.md) -- the real Level 2 identity
 * verification screen, reachable from `AuthAccountManagementScreen`'s
 * "Identity Verification" row. Purely presentational: all async state
 * (loading, error, the current `CustomerKycStatusDto`, submit) is owned by
 * the customer-web flow component and passed in as props, same split as
 * `SuperAppAuthEditProfileScreen`.
 *
 * Levels 0/1 are read-only here (`levelAccess`) -- they come from existing
 * phone/email verification, not this document flow. Only Level 2
 * (start/submit) is interactive. Document images are URL-string fields, not
 * a file picker -- there is no upload/storage backend in this repo yet,
 * same constraint `DriverKyc`'s screen already lives with.
 */

export type SuperAppKycStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'PENDING_REVIEW'
  | 'VERIFIED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'REQUIRES_RESUBMISSION';

export type SuperAppKycDocumentType = 'NATIONAL_ID' | 'PASSPORT' | 'DRIVER_LICENSE';

export interface SuperAppKycStatusValues {
  level: 'LEVEL_0' | 'LEVEL_1' | 'LEVEL_2';
  status: SuperAppKycStatus;
  documentType: string | null;
  remarks: string | null;
  submittedAt: string | null;
  verifiedAt: string | null;
  levelAccess: { level0: boolean; level1: boolean };
}

export interface SuperAppSubmitKycValues {
  documentType: SuperAppKycDocumentType;
  documentNumber: string;
  frontImageUrl: string;
  backImageUrl: string;
  selfieUrl: string;
}

const DOCUMENT_LABELS: Record<SuperAppKycDocumentType, string> = {
  NATIONAL_ID: 'National ID',
  PASSPORT: 'Passport',
  DRIVER_LICENSE: "Driver's Licence",
};

const STATUS_COPY: Record<SuperAppKycStatus, { label: string; color: string; sub: string }> = {
  NOT_STARTED: {
    label: 'Not Started',
    color: 'rgba(255,255,255,.5)',
    sub: 'Verify your identity to unlock full account features',
  },
  IN_PROGRESS: {
    label: 'In Progress',
    color: '#FBBF24',
    sub: 'Finish uploading your documents below',
  },
  PENDING_REVIEW: {
    label: 'Pending Review',
    color: '#FBBF24',
    sub: "We're reviewing your submission — this usually takes 1-2 business days",
  },
  VERIFIED: {
    label: 'Verified',
    color: '#47CF72',
    sub: 'Your identity has been verified',
  },
  REJECTED: {
    label: 'Rejected',
    color: '#F87171',
    sub: 'Your submission was rejected — see the note below',
  },
  REQUIRES_RESUBMISSION: {
    label: 'Resubmission Required',
    color: '#F87171',
    sub: 'Please upload new or corrected documents',
  },
  EXPIRED: {
    label: 'Expired',
    color: '#F87171',
    sub: 'Your previous verification has lapsed and needs renewal',
  },
};

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}): React.JSX.Element {
  const { body } = useSuperAppFonts();
  return (
    <label className="block">
      <span
        className={`mb-1.5 block text-[10px] font-semibold uppercase tracking-widest ${body}`}
        style={{ color: 'rgba(255,255,255,.38)' }}
      >
        {label}
      </span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className={`w-full rounded-xl px-3.5 py-3 text-[14px] text-white outline-none ${body}`}
        style={{ background: '#0A1424', border: '1.5px solid rgba(255,255,255,.1)' }}
      />
    </label>
  );
}

export function SuperAppAuthIdentityVerificationScreen({
  onBack,
  status,
  loading,
  onStart,
  onSubmit,
  submitting,
  submitError,
}: {
  onBack: () => void;
  status: SuperAppKycStatusValues | null;
  loading: boolean;
  onStart: () => void;
  onSubmit: (values: SuperAppSubmitKycValues) => void;
  submitting: boolean;
  submitError: string | null;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();

  const [documentType, setDocumentType] = React.useState<SuperAppKycDocumentType>('NATIONAL_ID');
  const [documentNumber, setDocumentNumber] = React.useState('');
  const [frontImageUrl, setFrontImageUrl] = React.useState('');
  const [backImageUrl, setBackImageUrl] = React.useState('');
  const [selfieUrl, setSelfieUrl] = React.useState('');

  const kycStatus = status?.status ?? 'NOT_STARTED';
  const copy = STATUS_COPY[kycStatus];
  const canSubmitDocuments = kycStatus === 'IN_PROGRESS' || kycStatus === 'REQUIRES_RESUBMISSION';

  return (
    <div
      className="relative flex h-full min-h-dvh w-full flex-col overflow-hidden"
      style={{ background: 'linear-gradient(155deg,#060E1C 0%,#0A1628 55%,#0B1D2F 100%)' }}
    >
      <SuperAppAuthAmbient />
      <SuperAppAuthStatusBar />
      <div
        className="relative z-10 flex flex-1 flex-col overflow-y-auto"
        style={{ scrollbarWidth: 'none' }}
      >
        <div className="flex items-center gap-3 px-6 pb-2 pt-3">
          <SuperAppAuthBackButton onBack={onBack} />
        </div>
        <div className="px-7 pb-2 pt-2">
          <h1 className={`text-[22px] font-bold text-white ${heading}`}>Identity Verification</h1>
          <p className={`mt-1 text-sm ${body}`} style={{ color: 'rgba(255,255,255,.38)' }}>
            Level 2 verification unlocks the full DrippleX experience
          </p>
        </div>

        {loading ? (
          <div
            className="mx-6 mb-4 flex flex-col gap-3 rounded-2xl p-4"
            style={{ background: '#0D1B2E' }}
          >
            <p className={`text-[13px] ${body}`} style={{ color: 'rgba(255,255,255,.5)' }}>
              Loading…
            </p>
          </div>
        ) : (
          <>
            {/* Levels 0/1 -- read-only, derived from phone/email verification */}
            <div
              className="mx-6 mb-4 flex flex-col gap-2 rounded-2xl p-4"
              style={{ background: '#0D1B2E', border: '1.5px solid rgba(255,255,255,.08)' }}
            >
              <div className="flex items-center justify-between">
                <p className={`text-[13px] font-semibold text-white ${heading}`}>Level 0 · Phone</p>
                <span
                  className="text-[11px] font-bold"
                  style={{
                    color: status?.levelAccess.level0 ? '#47CF72' : 'rgba(255,255,255,.38)',
                  }}
                >
                  {status?.levelAccess.level0 ? '✓ Verified' : 'Not verified'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <p className={`text-[13px] font-semibold text-white ${heading}`}>Level 1 · Email</p>
                <span
                  className="text-[11px] font-bold"
                  style={{
                    color: status?.levelAccess.level1 ? '#47CF72' : 'rgba(255,255,255,.38)',
                  }}
                >
                  {status?.levelAccess.level1 ? '✓ Verified' : 'Not verified'}
                </span>
              </div>
            </div>

            {/* Level 2 -- document-based, interactive */}
            <div
              className="mx-6 mb-4 flex flex-col gap-3 rounded-2xl p-4"
              style={{ background: '#0D1B2E', border: '1.5px solid rgba(255,255,255,.08)' }}
            >
              <div className="flex items-center justify-between">
                <p className={`text-[13px] font-semibold text-white ${heading}`}>
                  Level 2 · Document Verification
                </p>
                <span className="text-[11px] font-bold" style={{ color: copy.color }}>
                  {copy.label}
                </span>
              </div>
              <p className={`text-[12px] ${body}`} style={{ color: 'rgba(255,255,255,.5)' }}>
                {copy.sub}
              </p>
              {status?.remarks &&
              (kycStatus === 'REJECTED' || kycStatus === 'REQUIRES_RESUBMISSION') ? (
                <p
                  className={`rounded-lg p-2.5 text-[12px] ${body}`}
                  style={{ background: 'rgba(248,113,113,.1)', color: '#F87171' }}
                >
                  {status.remarks}
                </p>
              ) : null}

              {kycStatus === 'NOT_STARTED' ? (
                <button
                  type="button"
                  onClick={onStart}
                  className="mt-1 flex h-[46px] w-full items-center justify-center rounded-xl text-[14px] font-bold text-white transition-all active:scale-[0.98]"
                  style={{ background: 'linear-gradient(135deg,#176B30,#2BAC52)' }}
                >
                  Start Verification
                </button>
              ) : null}

              {canSubmitDocuments ? (
                <>
                  <label className="block">
                    <span
                      className={`mb-1.5 block text-[10px] font-semibold uppercase tracking-widest ${body}`}
                      style={{ color: 'rgba(255,255,255,.38)' }}
                    >
                      Document Type
                    </span>
                    <select
                      value={documentType}
                      onChange={(event) => {
                        setDocumentType(event.target.value as SuperAppKycDocumentType);
                      }}
                      className={`w-full rounded-xl px-3.5 py-3 text-[14px] text-white outline-none ${body}`}
                      style={{ background: '#0A1424', border: '1.5px solid rgba(255,255,255,.1)' }}
                    >
                      {Object.entries(DOCUMENT_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <TextField
                    label="Document Number (optional)"
                    value={documentNumber}
                    onChange={setDocumentNumber}
                  />
                  <TextField
                    label="Front Image URL"
                    value={frontImageUrl}
                    onChange={setFrontImageUrl}
                    placeholder="https://…"
                  />
                  <TextField
                    label="Back Image URL (optional)"
                    value={backImageUrl}
                    onChange={setBackImageUrl}
                    placeholder="https://…"
                  />
                  <TextField
                    label="Selfie URL (optional)"
                    value={selfieUrl}
                    onChange={setSelfieUrl}
                    placeholder="https://…"
                  />
                  {submitError ? (
                    <p className="text-[12px]" style={{ color: '#F87171' }}>
                      {submitError}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    disabled={submitting || frontImageUrl.trim().length === 0}
                    onClick={() => {
                      onSubmit({
                        documentType,
                        documentNumber: documentNumber.trim(),
                        frontImageUrl: frontImageUrl.trim(),
                        backImageUrl: backImageUrl.trim(),
                        selfieUrl: selfieUrl.trim(),
                      });
                    }}
                    className="mt-1 flex h-[46px] w-full items-center justify-center rounded-xl text-[14px] font-bold text-white transition-all active:scale-[0.98] disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg,#176B30,#2BAC52)' }}
                  >
                    {submitting ? 'Submitting…' : 'Submit for Review'}
                  </button>
                </>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
