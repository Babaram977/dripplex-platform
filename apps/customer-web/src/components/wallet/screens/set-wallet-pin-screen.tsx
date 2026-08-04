'use client';

import {
  SuperAppWalletButton,
  SuperAppWalletScreenHeader,
  SuperAppWalletSectionLabel,
  SuperAppWalletStatusBar,
  useSuperAppFonts,
} from '@dripplex/ui';
import * as React from 'react';

import { useSetWalletPin } from '@/hooks/wallet';

const PIN_INPUT_STYLE: React.CSSProperties = {
  background: '#112238',
  border: '1px solid rgba(255,255,255,.08)',
  letterSpacing: '0.5em',
};

/**
 * DPX-100 Wallet Slice 4. No PIN infrastructure existed anywhere in the
 * platform before this (see docs/WALLET-004-WITHDRAW-DESIGN.md) — a real
 * 4-digit PIN, bcrypt-hashed server-side, gating withdrawal requests.
 * Per DPX-UX-001, setting a PIN for the first time is the one step in the
 * withdrawal flow that gets its own short screen rather than folding into
 * the confirm step, since a PIN is being created, not just checked.
 */
export function SetWalletPinScreen({
  onBack,
  onSet,
}: {
  onBack: () => void;
  onSet: () => void;
}): React.JSX.Element {
  const [pin, setPin] = React.useState('');
  const [confirmPin, setConfirmPin] = React.useState('');
  const setWalletPin = useSetWalletPin();
  const { body } = useSuperAppFonts();

  const validPin = /^[0-9]{4}$/.test(pin);
  const pinsMatch = pin === confirmPin;
  const canSubmit = validPin && pinsMatch;

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#0A1628' }}
    >
      <SuperAppWalletStatusBar />
      <SuperAppWalletScreenHeader title="Set Withdrawal PIN" onBack={onBack} />

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <p className={`mb-6 text-[13px] ${body}`} style={{ color: 'rgba(255,255,255,.5)' }}>
          Create a 4-digit PIN. You&apos;ll enter it to confirm every withdrawal from your wallet.
        </p>

        <div className="pb-4">
          <SuperAppWalletSectionLabel>4-digit PIN</SuperAppWalletSectionLabel>
          <input
            value={pin}
            onChange={(event) => {
              setPin(event.target.value.replace(/[^0-9]/g, '').slice(0, 4));
            }}
            type="password"
            inputMode="numeric"
            maxLength={4}
            className={`mt-2.5 h-[56px] w-full rounded-xl px-4 text-center text-[24px] font-bold text-white outline-none ${body}`}
            style={PIN_INPUT_STYLE}
          />
        </div>

        <div className="pb-4">
          <SuperAppWalletSectionLabel>Confirm PIN</SuperAppWalletSectionLabel>
          <input
            value={confirmPin}
            onChange={(event) => {
              setConfirmPin(event.target.value.replace(/[^0-9]/g, '').slice(0, 4));
            }}
            type="password"
            inputMode="numeric"
            maxLength={4}
            className={`mt-2.5 h-[56px] w-full rounded-xl px-4 text-center text-[24px] font-bold text-white outline-none ${body}`}
            style={PIN_INPUT_STYLE}
          />
          {confirmPin.length === 4 && !pinsMatch ? (
            <p className={`mt-2 text-[13px] ${body}`} style={{ color: '#EF4444' }}>
              PINs don&apos;t match.
            </p>
          ) : null}
        </div>

        {setWalletPin.isError ? (
          <p className={`text-[13px] ${body}`} style={{ color: '#EF4444' }}>
            Couldn&apos;t set your PIN. Try again.
          </p>
        ) : null}
      </div>

      <div className="px-4 pb-8 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,.08)' }}>
        <SuperAppWalletButton
          disabled={!canSubmit}
          loading={setWalletPin.isPending}
          onClick={() => {
            setWalletPin.mutate(pin, { onSuccess: onSet });
          }}
        >
          Set PIN
        </SuperAppWalletButton>
      </div>
    </div>
  );
}
