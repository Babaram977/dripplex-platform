'use client';

import {
  SuperAppWalletScreenHeader,
  SuperAppWalletSectionLabel,
  SuperAppWalletStatusBar,
  useSuperAppFonts,
} from '@dripplex/ui';
import * as React from 'react';

const FUNDING_METHODS = [
  { icon: '🟦', label: 'Paystack', sub: 'Card, bank transfer, USSD' },
  { icon: '🟧', label: 'Flutterwave', sub: 'Card, bank transfer, USSD' },
  { icon: '🟣', label: 'Moniepoint', sub: 'Card, bank transfer, USSD' },
];

/**
 * DPX-100 Wallet Slice 3. The Figma source shows saved cards ("swipe to
 * delete") and linked bank accounts — neither exists in the real backend
 * (no card tokenization anywhere in the platform; `BankAccount` is a
 * merchant-payout model, not linkable by customers). Adapted to what's
 * real: the three gateway providers Top Up already uses, shown as
 * reference info rather than a fake "add card" flow. Bank-account linking
 * becomes real in Slice 4 as part of Withdraw.
 */
export function PaymentMethodsScreen({ onBack }: { onBack: () => void }): React.JSX.Element {
  const { body } = useSuperAppFonts();
  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#0A1628' }}
    >
      <SuperAppWalletStatusBar />
      <SuperAppWalletScreenHeader title="Payment Methods" onBack={onBack} />

      <div className="flex-1 overflow-y-auto pb-6">
        <div className="px-4 pb-6">
          <SuperAppWalletSectionLabel>Funding methods</SuperAppWalletSectionLabel>
          <p
            className={`mb-2.5 mt-1 text-[12px] ${body}`}
            style={{ color: 'rgba(255,255,255,.5)' }}
          >
            Used to top up your wallet — no card details are stored by DrippleX.
          </p>
          <div className="flex flex-col gap-2">
            {FUNDING_METHODS.map((method) => (
              <div
                key={method.label}
                className="flex items-center gap-3 rounded-2xl px-4 py-3.5"
                style={{ background: '#0D1B2E', border: '1px solid rgba(255,255,255,.08)' }}
              >
                <span className="text-[22px]">{method.icon}</span>
                <div>
                  <p className={`text-[14px] font-semibold text-white ${body}`}>{method.label}</p>
                  <p className={`text-[12px] ${body}`} style={{ color: 'rgba(255,255,255,.5)' }}>
                    {method.sub}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="px-4">
          <SuperAppWalletSectionLabel>Linked bank accounts</SuperAppWalletSectionLabel>
          <div
            className="mt-2.5 rounded-2xl px-4 py-5 text-center"
            style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
          >
            <p className={`text-[13px] ${body}`} style={{ color: 'rgba(255,255,255,.5)' }}>
              No linked bank accounts yet. You&apos;ll be able to add one when withdrawing from your
              wallet.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
