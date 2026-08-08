'use client';

import * as React from 'react';

import { SuperAppAuthAmbient, SuperAppAuthBackButton, SuperAppAuthStatusBar } from './AuthChrome';
import { useSuperAppFonts } from './fonts';

/**
 * DPX-PROFILE-KYC-001 (founder decision 2026-08-07,
 * docs/DPX-PROFILE-KYC-001-DESIGN.md) -- the real editable-profile screen,
 * built once `PATCH /auth/me` and the phone/email change endpoints existed.
 * Replaces the read-only identity card `AuthAccountManagementScreen` shipped
 * with in the prior pass. Purely presentational: all async state (loading,
 * error, success, the two-step phone/email OTP flow) is owned by the
 * customer-web flow component and passed in as props, same split as every
 * other Super App screen.
 *
 * `profilePhotoUrl` is a URL field, not a file picker -- there is no
 * upload/storage backend in this repo yet (see
 * `docs/reference/DPX-FIGMA-DIFF-REGISTER.md`), same constraint `DriverKyc`
 * already lives with. No `username` field: explicit founder decision not to
 * introduce one.
 */

export interface SuperAppEditProfileValues {
  firstName: string;
  lastName: string;
  profilePhotoUrl: string;
  dateOfBirth: string;
  gender: string;
}

export type SuperAppChangeStep = 'idle' | 'code-sent';

function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
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
        type={type}
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

export function SuperAppAuthEditProfileScreen({
  onBack,
  initialValues,
  onSaveProfile,
  savingProfile,
  profileSaveError,
  profileSaved,

  currentPhone,
  phoneChangeStep,
  onRequestPhoneChange,
  onConfirmPhoneChange,
  onCancelPhoneChange,
  phoneChangeLoading,
  phoneChangeError,

  currentEmail,
  emailChangeStep,
  onRequestEmailChange,
  onConfirmEmailChange,
  onCancelEmailChange,
  emailChangeLoading,
  emailChangeError,
}: {
  onBack: () => void;
  initialValues: SuperAppEditProfileValues;
  onSaveProfile: (values: SuperAppEditProfileValues) => void;
  savingProfile: boolean;
  profileSaveError: string | null;
  profileSaved: boolean;

  currentPhone: string | null;
  phoneChangeStep: SuperAppChangeStep;
  onRequestPhoneChange: (newPhone: string) => void;
  onConfirmPhoneChange: (otp: string) => void;
  onCancelPhoneChange: () => void;
  phoneChangeLoading: boolean;
  phoneChangeError: string | null;

  currentEmail: string | null;
  emailChangeStep: SuperAppChangeStep;
  onRequestEmailChange: (newEmail: string) => void;
  onConfirmEmailChange: (otp: string) => void;
  onCancelEmailChange: () => void;
  emailChangeLoading: boolean;
  emailChangeError: string | null;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();

  const [firstName, setFirstName] = React.useState(initialValues.firstName);
  const [lastName, setLastName] = React.useState(initialValues.lastName);
  const [profilePhotoUrl, setProfilePhotoUrl] = React.useState(initialValues.profilePhotoUrl);
  const [dateOfBirth, setDateOfBirth] = React.useState(initialValues.dateOfBirth);
  const [gender, setGender] = React.useState(initialValues.gender);

  const [newPhone, setNewPhone] = React.useState('');
  const [phoneOtp, setPhoneOtp] = React.useState('');
  const [newEmail, setNewEmail] = React.useState('');
  const [emailOtp, setEmailOtp] = React.useState('');

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
          <h1 className={`text-[22px] font-bold text-white ${heading}`}>Edit Profile</h1>
          <p className={`mt-1 text-sm ${body}`} style={{ color: 'rgba(255,255,255,.38)' }}>
            Update the details on your DrippleX account
          </p>
        </div>

        {/* Basic info -- immediate save, no verification gate */}
        <div
          className="mx-6 mb-4 flex flex-col gap-3 rounded-2xl p-4"
          style={{ background: '#0D1B2E', border: '1.5px solid rgba(255,255,255,.08)' }}
        >
          <TextField label="First Name" value={firstName} onChange={setFirstName} />
          <TextField label="Last Name" value={lastName} onChange={setLastName} />
          <TextField
            label="Profile Photo URL"
            value={profilePhotoUrl}
            onChange={setProfilePhotoUrl}
            placeholder="https://…"
          />
          <TextField
            label="Date of Birth"
            type="date"
            value={dateOfBirth}
            onChange={setDateOfBirth}
          />
          <TextField
            label="Gender"
            value={gender}
            onChange={setGender}
            placeholder="Optional, free text"
          />

          {profileSaveError ? (
            <p className="text-[12px]" style={{ color: '#F87171' }}>
              {profileSaveError}
            </p>
          ) : null}
          {profileSaved ? (
            <p className="text-[12px]" style={{ color: '#47CF72' }}>
              Saved
            </p>
          ) : null}

          <button
            type="button"
            disabled={savingProfile}
            onClick={() => {
              onSaveProfile({ firstName, lastName, profilePhotoUrl, dateOfBirth, gender });
            }}
            className="mt-1 flex h-[46px] w-full items-center justify-center rounded-xl text-[14px] font-bold text-white transition-all active:scale-[0.98] disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#176B30,#2BAC52)' }}
          >
            {savingProfile ? 'Saving…' : 'Save Changes'}
          </button>
        </div>

        {/* Phone -- verification-gated two-step change */}
        <div
          className="mx-6 mb-4 flex flex-col gap-3 rounded-2xl p-4"
          style={{ background: '#0D1B2E', border: '1.5px solid rgba(255,255,255,.08)' }}
        >
          <p
            className={`text-[10px] font-semibold uppercase tracking-widest ${body}`}
            style={{ color: 'rgba(255,255,255,.38)' }}
          >
            Phone Number
          </p>
          <p className={`text-[14px] text-white ${body}`}>{currentPhone ?? 'Not set'}</p>

          {phoneChangeStep === 'idle' ? (
            <>
              <TextField
                label="New Phone Number"
                value={newPhone}
                onChange={setNewPhone}
                placeholder="+234…"
              />
              {phoneChangeError ? (
                <p className="text-[12px]" style={{ color: '#F87171' }}>
                  {phoneChangeError}
                </p>
              ) : null}
              <button
                type="button"
                disabled={phoneChangeLoading || newPhone.trim().length === 0}
                onClick={() => {
                  onRequestPhoneChange(newPhone.trim());
                }}
                className="flex h-[42px] w-full items-center justify-center rounded-xl text-[13px] font-bold text-white transition-all active:scale-[0.98] disabled:opacity-50"
                style={{
                  background: 'rgba(43,172,82,.16)',
                  border: '1.5px solid rgba(43,172,82,.3)',
                }}
              >
                {phoneChangeLoading ? 'Sending code…' : 'Send Verification Code'}
              </button>
            </>
          ) : (
            <>
              <p className={`text-[12px] ${body}`} style={{ color: 'rgba(255,255,255,.5)' }}>
                Enter the code sent to {newPhone}
              </p>
              <TextField label="Verification Code" value={phoneOtp} onChange={setPhoneOtp} />
              {phoneChangeError ? (
                <p className="text-[12px]" style={{ color: '#F87171' }}>
                  {phoneChangeError}
                </p>
              ) : null}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={phoneChangeLoading || phoneOtp.trim().length === 0}
                  onClick={() => {
                    onConfirmPhoneChange(phoneOtp.trim());
                  }}
                  className="flex h-[42px] flex-1 items-center justify-center rounded-xl text-[13px] font-bold text-white transition-all active:scale-[0.98] disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#176B30,#2BAC52)' }}
                >
                  {phoneChangeLoading ? 'Confirming…' : 'Confirm'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPhoneOtp('');
                    onCancelPhoneChange();
                  }}
                  className="flex h-[42px] items-center justify-center rounded-xl px-4 text-[13px] font-semibold transition-all active:scale-[0.98]"
                  style={{
                    color: 'rgba(255,255,255,.5)',
                    border: '1.5px solid rgba(255,255,255,.1)',
                  }}
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>

        {/* Email -- verification-gated two-step change */}
        <div
          className="mx-6 mb-6 flex flex-col gap-3 rounded-2xl p-4"
          style={{ background: '#0D1B2E', border: '1.5px solid rgba(255,255,255,.08)' }}
        >
          <p
            className={`text-[10px] font-semibold uppercase tracking-widest ${body}`}
            style={{ color: 'rgba(255,255,255,.38)' }}
          >
            Email Address
          </p>
          <p className={`text-[14px] text-white ${body}`}>{currentEmail ?? 'Not set'}</p>

          {emailChangeStep === 'idle' ? (
            <>
              <TextField
                label="New Email Address"
                value={newEmail}
                onChange={setNewEmail}
                placeholder="you@example.com"
              />
              {emailChangeError ? (
                <p className="text-[12px]" style={{ color: '#F87171' }}>
                  {emailChangeError}
                </p>
              ) : null}
              <button
                type="button"
                disabled={emailChangeLoading || newEmail.trim().length === 0}
                onClick={() => {
                  onRequestEmailChange(newEmail.trim());
                }}
                className="flex h-[42px] w-full items-center justify-center rounded-xl text-[13px] font-bold text-white transition-all active:scale-[0.98] disabled:opacity-50"
                style={{
                  background: 'rgba(43,172,82,.16)',
                  border: '1.5px solid rgba(43,172,82,.3)',
                }}
              >
                {emailChangeLoading ? 'Sending code…' : 'Send Verification Code'}
              </button>
            </>
          ) : (
            <>
              <p className={`text-[12px] ${body}`} style={{ color: 'rgba(255,255,255,.5)' }}>
                Enter the code sent to {newEmail}
              </p>
              <TextField label="Verification Code" value={emailOtp} onChange={setEmailOtp} />
              {emailChangeError ? (
                <p className="text-[12px]" style={{ color: '#F87171' }}>
                  {emailChangeError}
                </p>
              ) : null}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={emailChangeLoading || emailOtp.trim().length === 0}
                  onClick={() => {
                    onConfirmEmailChange(emailOtp.trim());
                  }}
                  className="flex h-[42px] flex-1 items-center justify-center rounded-xl text-[13px] font-bold text-white transition-all active:scale-[0.98] disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#176B30,#2BAC52)' }}
                >
                  {emailChangeLoading ? 'Confirming…' : 'Confirm'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmailOtp('');
                    onCancelEmailChange();
                  }}
                  className="flex h-[42px] items-center justify-center rounded-xl px-4 text-[13px] font-semibold transition-all active:scale-[0.98]"
                  style={{
                    color: 'rgba(255,255,255,.5)',
                    border: '1.5px solid rgba(255,255,255,.1)',
                  }}
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
