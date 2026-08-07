'use client';

import * as React from 'react';

import { SuperAppAuthAmbient, SuperAppAuthBackButton, SuperAppAuthStatusBar } from './AuthChrome';
import { useSuperAppFonts } from './fonts';

/**
 * The eighteen destinations `AccountManagementScreen`'s settings list links
 * to in the locked Figma Make source (`screensB.tsx`). As of the
 * 2026-08-07 repo verification (`docs/reference/dpx-100-figma-screen-mapping.md`
 * §1-2), none of these eighteen have a built screen in the Super App, and
 * most have no backend either. Every row calls `onNavigate` and lets the
 * owning flow decide what to show -- an honest "not available yet" notice
 * today, not a broken route or an invented feature.
 */
export type SuperAppAccountManagementLinkKey =
  | 'security'
  | 'privacy'
  | 'sessions'
  | 'linked'
  | 'verifstatus'
  | 'activity'
  | 'services'
  | 'trust'
  | 'kyc'
  | 'download'
  | 'pinsetup'
  | 'emailverify'
  | 'changephone'
  | 'username'
  | 'recoverycodes'
  | 'securityqs'
  | 'acctransfer'
  | 'authsummary'
  | 'delete';

const SETTINGS: {
  key: SuperAppAccountManagementLinkKey;
  icon: string;
  label: string;
  sub: string;
}[] = [
  {
    key: 'security',
    icon: '🔑',
    label: 'Security Settings',
    sub: 'Biometrics, 2FA, trusted devices',
  },
  { key: 'privacy', icon: '🛡', label: 'Privacy Controls', sub: 'Visibility, location, marketing' },
  { key: 'sessions', icon: '🖥️', label: 'Active Sessions', sub: 'Manage signed-in devices' },
  { key: 'linked', icon: '🔗', label: 'Linked Accounts', sub: 'Phone, email, Apple, Google' },
  { key: 'verifstatus', icon: '✅', label: 'Verification Status', sub: 'Track your KYC progress' },
  { key: 'activity', icon: '📊', label: 'Account Activity', sub: 'Monitor usage across services' },
  {
    key: 'services',
    icon: '📡',
    label: 'Connected Services',
    sub: 'Marketplace, Ride, Wallet & more',
  },
  { key: 'trust', icon: '🏆', label: 'Trust Center', sub: 'Security overview' },
  {
    key: 'kyc',
    icon: '🪪',
    label: 'Identity Verification',
    sub: 'KYC status · Complete to unlock features',
  },
  {
    key: 'download',
    icon: '📥',
    label: 'Download My Data',
    sub: 'Request an export of your account data',
  },
  { key: 'pinsetup', icon: '🔢', label: 'PIN Setup', sub: 'Create or update your 6-digit PIN' },
  {
    key: 'emailverify',
    icon: '📧',
    label: 'Email Verification',
    sub: 'Link and verify your email address',
  },
  {
    key: 'changephone',
    icon: '📱',
    label: 'Change Phone Number',
    sub: 'Update your primary phone number',
  },
  { key: 'username', icon: '@', label: 'Username', sub: 'Manage your public DrippleX identity' },
  {
    key: 'recoverycodes',
    icon: '🔑',
    label: 'Recovery Codes',
    sub: 'One-time emergency access codes',
  },
  { key: 'securityqs', icon: '❓', label: 'Security Questions', sub: 'Additional recovery option' },
  {
    key: 'acctransfer',
    icon: '💼',
    label: 'Account Transfer',
    sub: 'Business, estate & corporate transfer',
  },
  { key: 'authsummary', icon: '📋', label: 'Auth Summary', sub: 'Full security dashboard' },
];

/**
 * Ported from the locked Figma Make `screensB.tsx`'s `AccountManagementScreen`
 * (AUTH-017, `MODULE_GROUPS["Auth"]`'s "Account" entry). One deliberate
 * departure from source, since resolved: the source has editable Full
 * Name/Username/Email inputs with a "Save Changes" button. As of 2026-08-07
 * this backend has a real `PATCH /auth/me` + verification-gated phone/email
 * change endpoints (DPX-PROFILE-KYC-001, founder decision), so the identity
 * card is now a tappable entry point into `SuperAppAuthEditProfileScreen`
 * instead of a static read-only block. "Username" still has no field in the
 * schema at all -- the founder's explicit decision was not to introduce one,
 * so it stays out of the edit form (and its settings-list row below still
 * routes to an honest "not available" notice, same as the other
 * not-yet-built rows). The settings list is kept pixel-faithful; none of its
 * eighteen targets besides identity editing are built yet (see
 * `SuperAppAccountManagementLinkKey`), so every row routes through
 * `onNavigate` rather than a fabricated destination.
 */
export function SuperAppAuthAccountManagementScreen({
  onBack,
  onNavigate,
  onEditProfile,
  fullName,
  email,
  phone,
}: {
  onBack: () => void;
  onNavigate: (key: SuperAppAccountManagementLinkKey) => void;
  onEditProfile: () => void;
  fullName: string;
  email: string | null;
  phone: string | null;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  const initials =
    fullName
      .trim()
      .split(/\s+/)
      .map((part) => part.charAt(0))
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?';

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
          <h1 className={`text-[22px] font-bold text-white ${heading}`}>Manage Account</h1>
          <p className={`mt-1 text-sm ${body}`} style={{ color: 'rgba(255,255,255,.38)' }}>
            Control your DrippleX account
          </p>
        </div>

        <div className="flex flex-col items-center py-5">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-full text-[24px] font-bold text-white"
            style={{
              background: 'linear-gradient(135deg,#176B30,#47CF72)',
              boxShadow: '0 0 0 3px #0A1628, 0 0 0 5px rgba(43,172,82,.33)',
            }}
          >
            {initials}
          </div>
          <p className={`mt-2.5 text-[15px] font-semibold text-white ${heading}`}>
            {fullName || 'Your name'}
          </p>
          {email ? (
            <p className={`text-[11px] ${body}`} style={{ color: 'rgba(255,255,255,.38)' }}>
              {email}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={onEditProfile}
          className="mx-6 mb-4 rounded-2xl p-4 text-left transition-all active:scale-[0.98]"
          style={{ background: '#0D1B2E', border: '1.5px solid rgba(255,255,255,.08)' }}
        >
          <p
            className={`mb-1.5 text-[10px] font-semibold uppercase tracking-widest ${body}`}
            style={{ color: 'rgba(255,255,255,.38)' }}
          >
            Full Name
          </p>
          <p className={`mb-3 text-[14px] text-white ${body}`}>{fullName || '—'}</p>
          {phone ? (
            <>
              <p
                className={`mb-1.5 border-t pt-3 text-[10px] font-semibold uppercase tracking-widest ${body}`}
                style={{ color: 'rgba(255,255,255,.38)', borderColor: 'rgba(255,255,255,.08)' }}
              >
                Phone Number
              </p>
              <p className={`text-[14px] ${body}`} style={{ color: 'rgba(255,255,255,.65)' }}>
                {phone}
              </p>
            </>
          ) : null}
          <p
            className={`mt-3 text-[11px] font-semibold leading-relaxed ${body}`}
            style={{ color: '#47CF72' }}
          >
            Tap to edit your profile →
          </p>
        </button>

        <p
          className={`px-6 pb-2 text-[11px] font-semibold uppercase tracking-widest ${body}`}
          style={{ color: 'rgba(255,255,255,.38)' }}
        >
          Account Settings
        </p>
        <div
          className="mx-6 mb-4 overflow-hidden rounded-2xl"
          style={{ background: '#0D1B2E', border: '1.5px solid rgba(255,255,255,.08)' }}
        >
          {SETTINGS.map((item, i) => (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                onNavigate(item.key);
              }}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-all active:scale-[0.98]"
              style={{
                borderBottom: i < SETTINGS.length - 1 ? '1px solid rgba(255,255,255,.08)' : 'none',
              }}
            >
              <div
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-lg"
                style={{ background: 'rgba(43,172,82,.08)' }}
              >
                {item.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-[13px] font-semibold text-white ${heading}`}>{item.label}</p>
                <p className={`text-[11px] ${body}`} style={{ color: 'rgba(255,255,255,.38)' }}>
                  {item.sub}
                </p>
              </div>
              <span style={{ color: 'rgba(255,255,255,.38)', fontSize: 18 }}>›</span>
            </button>
          ))}
        </div>

        <div
          className="mx-6 mb-6 overflow-hidden rounded-2xl"
          style={{ background: '#0D1B2E', border: '1.5px solid rgba(248,113,113,.2)' }}
        >
          <button
            type="button"
            onClick={() => {
              onNavigate('delete');
            }}
            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-all active:scale-[0.98]"
          >
            <div
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-lg"
              style={{ background: 'rgba(248,113,113,.1)' }}
            >
              🗑
            </div>
            <div className="min-w-0 flex-1">
              <p className={`text-[13px] font-semibold ${heading}`} style={{ color: '#F87171' }}>
                Delete Account
              </p>
              <p className={`text-[11px] ${body}`} style={{ color: 'rgba(255,255,255,.38)' }}>
                Permanently remove your account and data
              </p>
            </div>
            <span style={{ color: 'rgba(255,255,255,.38)', fontSize: 18 }}>›</span>
          </button>
        </div>
        <div className="pb-8" />
      </div>
    </div>
  );
}
