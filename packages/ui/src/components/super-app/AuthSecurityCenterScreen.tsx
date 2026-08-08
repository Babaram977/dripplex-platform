'use client';

import * as React from 'react';

import { SuperAppAuthAmbient, SuperAppAuthBackButton, SuperAppAuthStatusBar } from './AuthChrome';
import { useSuperAppFonts } from './fonts';

/**
 * The seven destinations `SecurityCenterScreen`'s Manage Security list links
 * to in the locked Figma Make source (`screensB.tsx`). None of them have a
 * built screen in the Super App yet, and per the Missing Backend Register
 * (`docs/reference/dpx-100-figma-screen-mapping.md` §2) most have no backend
 * either -- 2FA, Trusted Devices, Security Activity, Emergency Protection,
 * Trust Center, and Login Approvals are all `❌ Missing`. Sessions is
 * `🟡 Partial` (backend exists, SDK exposure to the customer barrel
 * unconfirmed). This screen does not invent any of the seven -- every link
 * calls `onNavigate` and lets the owning flow decide what to show (today,
 * that's an honest "not available yet" notice for all seven, not a broken
 * route).
 */
export type SuperAppSecurityCenterLinkKey =
  'twofa' | 'devices' | 'activity' | 'sessions' | 'emergency' | 'trust' | 'loginapproval';

const LINKS: {
  key: SuperAppSecurityCenterLinkKey;
  icon: string;
  label: string;
  sub: string;
}[] = [
  { key: 'twofa', icon: '🔐', label: 'Two-Factor Auth', sub: 'Manage 2FA methods' },
  {
    key: 'devices',
    icon: '📱',
    label: 'Trusted Devices',
    sub: 'Devices authorized on your account',
  },
  { key: 'activity', icon: '📋', label: 'Security Activity', sub: 'View login history' },
  { key: 'sessions', icon: '🖥️', label: 'Active Sessions', sub: 'Manage signed-in devices' },
  { key: 'emergency', icon: '🚨', label: 'Emergency Protection', sub: 'Lock account, reset auth' },
  { key: 'trust', icon: '🏆', label: 'Trust Center', sub: 'Security overview' },
  { key: 'loginapproval', icon: '🔔', label: 'Login Approvals', sub: 'Review new device requests' },
];

/**
 * Ported from the locked Figma Make `screensB.tsx`'s `SecurityCenterScreen`
 * (AUTH-013, part of `MODULE_GROUPS["Auth"]`'s "Security" entry). The
 * source's score ring shows a hardcoded 92% not derived from any real
 * signal -- we have no backend security-score computation (no 2FA, no
 * trusted-devices tracking, etc. exist yet), so presenting a specific
 * invented percentage here would misrepresent real account state. The ring
 * and score are dropped; the header copy and the seven-item list are kept
 * pixel-faithful otherwise. This is the one deliberate departure from the
 * corrected Figma source in this pass, made because showing a fabricated
 * number is worse than showing none -- not a redesign of the working parts.
 */
export function SuperAppAuthSecurityCenterScreen({
  onBack,
  onNavigate,
  onLockAccount,
}: {
  onBack: () => void;
  onNavigate: (key: SuperAppSecurityCenterLinkKey) => void;
  onLockAccount: () => void;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();

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
          <h1 className={`text-[22px] font-bold text-white ${heading}`}>Security Center</h1>
          <p className={`mt-1 text-sm ${body}`} style={{ color: 'rgba(255,255,255,.38)' }}>
            Your account protection overview
          </p>
        </div>

        <div
          className="mx-6 my-3 flex items-center gap-4 rounded-3xl p-5"
          style={{
            background: 'linear-gradient(135deg,#0D1B2E 0%,rgba(43,172,82,.08) 100%)',
            border: '1.5px solid rgba(43,172,82,.2)',
          }}
        >
          <div
            className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full text-2xl"
            style={{ background: 'rgba(43,172,82,.12)' }}
          >
            🛡️
          </div>
          <div>
            <p className={`text-[15px] font-bold text-white ${heading}`}>Account Protection</p>
            <p className={`text-[12px] ${body}`} style={{ color: 'rgba(255,255,255,.5)' }}>
              Manage how your DrippleX account is secured below.
            </p>
          </div>
        </div>

        <p
          className={`px-6 pb-2 text-[11px] font-semibold uppercase tracking-widest ${body}`}
          style={{ color: 'rgba(255,255,255,.38)' }}
        >
          Manage Security
        </p>
        <div className="flex flex-col gap-3 px-6">
          {LINKS.map((link) => (
            <button
              key={link.key}
              type="button"
              onClick={() => {
                onNavigate(link.key);
              }}
              className="flex w-full items-center gap-3 rounded-2xl p-4 text-left transition-all active:scale-[0.98]"
              style={{ background: '#0D1B2E', border: '1.5px solid rgba(255,255,255,.08)' }}
            >
              <div
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-xl"
                style={{ background: 'rgba(43,172,82,.1)' }}
              >
                {link.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-[13px] font-semibold text-white ${heading}`}>{link.label}</p>
                <p className={`text-[11px] ${body}`} style={{ color: 'rgba(255,255,255,.38)' }}>
                  {link.sub}
                </p>
              </div>
              <span style={{ color: 'rgba(255,255,255,.38)', fontSize: 20 }}>›</span>
            </button>
          ))}
        </div>

        <div className="mx-6 mb-4 mt-4">
          <button
            type="button"
            onClick={onLockAccount}
            className="flex h-[50px] w-full items-center justify-center gap-2 rounded-2xl text-[14px] font-bold transition-all active:scale-[0.97]"
            style={{
              background: 'rgba(248,113,113,.08)',
              border: '1.5px solid rgba(248,113,113,.25)',
              color: '#F87171',
            }}
          >
            🚨 Lock My Account
          </button>
          <p
            className={`mt-2 text-center text-[10px] ${body}`}
            style={{ color: 'rgba(255,255,255,.25)' }}
          >
            Emergency use only. Immediately ends all sessions.
          </p>
        </div>
        <div className="pb-8" />
      </div>
    </div>
  );
}
