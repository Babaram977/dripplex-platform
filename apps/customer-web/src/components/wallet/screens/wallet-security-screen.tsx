'use client';

import {
  SuperAppWalletScreenHeader,
  SuperAppWalletSectionLabel,
  SuperAppWalletStatusBar,
  SuperAppWalletToggle,
  useSuperAppFonts,
} from '@dripplex/ui';
import * as React from 'react';

import { useRevokeSession, useSessions } from '@/hooks/use-sessions';
import { useChangeWalletPin, useWalletPinStatus } from '@/hooks/wallet';

function formatLastActive(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 5 * 60 * 1000) return 'Active now';
  return new Date(iso).toLocaleString('en-NG', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * DPX-100 Wallet Slice 5. PIN status/change, trusted devices, and last
 * login are all real: `WalletPin` already exists (Slice 4), and "trusted
 * devices" is exactly the platform's existing `AuthSession` list/revoke
 * (`/auth/sessions`, built for every portal, not wallet-specific — this
 * screen is its first wallet-facing use). "Last successful login" reads
 * the current session's real `createdAt`.
 *
 * Biometric (Face ID) and Two-Factor Auth are shown as real, honest gaps
 * rather than toggles that silently do nothing: Face ID needs a native
 * platform (WebAuthn) integration this web app doesn't have, and wallet
 * 2FA (SMS-gated large transfers) needs OTP enforcement wired into the
 * Transfer/Withdraw flows specifically — a distinct follow-up, not
 * something to fake here. See docs/WALLET-005-STATEMENT-SECURITY-SETTINGS-DESIGN.md.
 */
export function WalletSecurityScreen({ onBack }: { onBack: () => void }): React.JSX.Element {
  const pinStatus = useWalletPinStatus();
  const changePin = useChangeWalletPin();
  const sessions = useSessions();
  const revokeSession = useRevokeSession();
  const { body, heading } = useSuperAppFonts();

  const [changingPin, setChangingPin] = React.useState(false);
  const [currentPin, setCurrentPin] = React.useState('');
  const [newPin, setNewPin] = React.useState('');
  const [confirmPin, setConfirmPin] = React.useState('');

  const items = sessions.data?.items ?? [];
  const current = items.find((s) => s.current);
  const others = items.filter((s) => !s.current);

  const pinsMatch = newPin.length === 4 && newPin === confirmPin;
  const canSubmit = /^[0-9]{4}$/.test(currentPin) && pinsMatch;

  const resetPinForm = (): void => {
    setChangingPin(false);
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    changePin.reset();
  };

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#0A1628' }}
    >
      <SuperAppWalletStatusBar />
      <SuperAppWalletScreenHeader title="Security" onBack={onBack} />

      <div className="flex-1 overflow-y-auto pb-6">
        <div className="px-4 pb-4">
          <SuperAppWalletSectionLabel>Wallet PIN</SuperAppWalletSectionLabel>
          <div
            className="mt-2.5 overflow-hidden rounded-2xl"
            style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
          >
            <div className="flex items-center justify-between px-4 py-3.5">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ background: 'rgba(16,185,129,.12)' }}
                >
                  🔒
                </div>
                <div>
                  <div className={`text-[14px] font-semibold text-white ${body}`}>PIN Status</div>
                  <div className={`mt-0.5 text-[12px] ${body}`} style={{ color: '#47CF72' }}>
                    {pinStatus.isLoading
                      ? 'Checking…'
                      : pinStatus.data?.hasPin
                        ? '✓ PIN is set and active'
                        : 'No PIN set yet'}
                  </div>
                </div>
              </div>
            </div>
            {pinStatus.data?.hasPin ? (
              <>
                <div style={{ height: 1, background: 'rgba(255,255,255,.08)' }} />
                <button
                  type="button"
                  onClick={() => {
                    setChangingPin((v) => !v);
                  }}
                  className="flex w-full items-center justify-between px-4 py-3.5"
                >
                  <span className={`text-[14px] font-semibold text-white ${body}`}>Change PIN</span>
                  <span style={{ color: 'rgba(255,255,255,.5)' }}>{changingPin ? '︿' : '﹀'}</span>
                </button>
                {changingPin ? (
                  <div className="px-4 pb-4">
                    <div className="flex flex-col gap-2.5">
                      <input
                        value={currentPin}
                        onChange={(e) => {
                          setCurrentPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 4));
                        }}
                        type="password"
                        inputMode="numeric"
                        maxLength={4}
                        placeholder="Current PIN"
                        className={`h-11 rounded-xl px-4 text-center text-[15px] font-bold tracking-[0.3em] text-white outline-none ${body}`}
                        style={{ background: '#0A1628', border: '1px solid rgba(255,255,255,.08)' }}
                      />
                      <input
                        value={newPin}
                        onChange={(e) => {
                          setNewPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 4));
                        }}
                        type="password"
                        inputMode="numeric"
                        maxLength={4}
                        placeholder="New PIN"
                        className={`h-11 rounded-xl px-4 text-center text-[15px] font-bold tracking-[0.3em] text-white outline-none ${body}`}
                        style={{ background: '#0A1628', border: '1px solid rgba(255,255,255,.08)' }}
                      />
                      <input
                        value={confirmPin}
                        onChange={(e) => {
                          setConfirmPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 4));
                        }}
                        type="password"
                        inputMode="numeric"
                        maxLength={4}
                        placeholder="Confirm new PIN"
                        className={`h-11 rounded-xl px-4 text-center text-[15px] font-bold tracking-[0.3em] text-white outline-none ${body}`}
                        style={{ background: '#0A1628', border: '1px solid rgba(255,255,255,.08)' }}
                      />
                      {changePin.isError ? (
                        <p
                          className={`text-center text-[12px] ${body}`}
                          style={{ color: '#EF4444' }}
                        >
                          Couldn&apos;t change your PIN. Check your current PIN and try again.
                        </p>
                      ) : null}
                      {newPin.length === 4 && confirmPin.length === 4 && !pinsMatch ? (
                        <p
                          className={`text-center text-[12px] ${body}`}
                          style={{ color: '#EF4444' }}
                        >
                          New PIN and confirmation don&apos;t match.
                        </p>
                      ) : null}
                      <button
                        type="button"
                        disabled={!canSubmit || changePin.isPending}
                        onClick={() => {
                          changePin.mutate({ currentPin, newPin }, { onSuccess: resetPinForm });
                        }}
                        className={`h-11 rounded-xl text-[14px] font-semibold ${heading}`}
                        style={{
                          background:
                            canSubmit && !changePin.isPending
                              ? 'linear-gradient(135deg,#176B30,#2BAC52)'
                              : 'rgba(255,255,255,.06)',
                          color:
                            canSubmit && !changePin.isPending ? '#fff' : 'rgba(255,255,255,.3)',
                        }}
                      >
                        {changePin.isPending ? 'Saving…' : 'Save new PIN'}
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </div>

        <div className="px-4 pb-4">
          <SuperAppWalletSectionLabel>Authentication</SuperAppWalletSectionLabel>
          <div
            className="mt-2.5 overflow-hidden rounded-2xl"
            style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
          >
            {[
              {
                icon: '👤',
                label: 'Face ID',
                sub: 'Requires the DrippleX mobile app — not available on web yet',
              },
              {
                icon: '🔑',
                label: 'Two-Factor Auth (2FA)',
                sub: 'SMS verification for large transfers — coming soon',
              },
            ].map((row, i) => (
              <div key={row.label}>
                {i > 0 ? <div style={{ height: 1, background: 'rgba(255,255,255,.08)' }} /> : null}
                <div className="flex items-center justify-between px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl text-[20px]"
                      style={{ background: '#0A1628' }}
                    >
                      {row.icon}
                    </div>
                    <div>
                      <div className={`text-[14px] font-semibold text-white ${body}`}>
                        {row.label}
                      </div>
                      <div
                        className={`mt-0.5 text-[11px] ${body}`}
                        style={{ color: 'rgba(255,255,255,.5)' }}
                      >
                        {row.sub}
                      </div>
                    </div>
                  </div>
                  <SuperAppWalletToggle on={false} onToggle={() => undefined} disabled />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="px-4 pb-4">
          <SuperAppWalletSectionLabel>
            Trusted devices {items.length > 0 ? `(${String(items.length)})` : ''}
          </SuperAppWalletSectionLabel>
          <div className="mt-2.5 flex flex-col gap-2">
            {sessions.isLoading ? (
              <p className={`text-[13px] ${body}`} style={{ color: 'rgba(255,255,255,.5)' }}>
                Loading devices…
              </p>
            ) : null}
            {sessions.isError ? (
              <p className={`text-[13px] ${body}`} style={{ color: '#EF4444' }}>
                Couldn&apos;t load your devices.
              </p>
            ) : null}
            {items.map((session) => (
              <div
                key={session.sessionId}
                className="rounded-2xl px-4 py-3.5"
                style={{
                  background: '#112238',
                  border: `1px solid ${session.current ? '#2BAC52' : 'rgba(255,255,255,.08)'}`,
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl text-[20px]"
                      style={{ background: '#0A1628' }}
                    >
                      📱
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[14px] font-semibold text-white ${body}`}>
                          {session.device} · {session.browser}
                        </span>
                        {session.current ? (
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${body}`}
                            style={{ background: 'rgba(43,172,82,.15)', color: '#47CF72' }}
                          >
                            This device
                          </span>
                        ) : null}
                      </div>
                      <div
                        className={`mt-0.5 text-[11px] ${body}`}
                        style={{ color: 'rgba(255,255,255,.5)' }}
                      >
                        {formatLastActive(session.lastActiveAt)}
                        {session.location ? ` · ${session.location}` : ''}
                      </div>
                    </div>
                  </div>
                  {!session.current ? (
                    <button
                      type="button"
                      disabled={revokeSession.isPending}
                      onClick={() => {
                        revokeSession.mutate(session.sessionId);
                      }}
                      className={`rounded-lg px-2.5 py-1 text-[12px] font-semibold ${body}`}
                      style={{ background: 'rgba(239,68,68,.1)', color: '#EF4444' }}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
            {!sessions.isLoading && others.length === 0 && items.length > 0 ? (
              <p className={`text-[12px] ${body}`} style={{ color: 'rgba(255,255,255,.5)' }}>
                No other devices are signed in.
              </p>
            ) : null}
          </div>
        </div>

        {current ? (
          <div className="px-4">
            <div
              className="rounded-2xl px-4 py-3.5"
              style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
            >
              <div className={`mb-1 text-[12px] ${body}`} style={{ color: 'rgba(255,255,255,.5)' }}>
                Last successful login
              </div>
              <div className={`text-[14px] font-semibold text-white ${body}`}>
                {new Date(current.createdAt).toLocaleString('en-NG', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </div>
              <div
                className={`mt-0.5 text-[12px] ${body}`}
                style={{ color: 'rgba(255,255,255,.5)' }}
              >
                {current.device} · {current.browser}
                {current.location ? ` · ${current.location}` : ''}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
