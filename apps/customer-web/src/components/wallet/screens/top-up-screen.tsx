'use client';

import {
  SuperAppWalletAmountCard,
  SuperAppWalletButton,
  SuperAppWalletPresetChips,
  SuperAppWalletScreenHeader,
  SuperAppWalletSectionLabel,
  SuperAppWalletSelectableRow,
  SuperAppWalletStatusBar,
  useSuperAppFonts,
} from '@dripplex/ui';
import * as React from 'react';

import type { WalletFundingProvider } from '@dripplex/types';

import { useFundWallet } from '@/hooks/wallet';

const AMOUNT_PRESETS = ['500', '1,000', '2,000', '5,000', '10,000', '20,000'];

// OPay is intentionally excluded until a real OpayProvider adapter exists
// (DPX-DRIVER-018 safe-disable). The backend rejects OPAY wallet funding at
// initiation, so it must not be offered here. Re-add once the adapter ships.
const PROVIDERS: { id: WalletFundingProvider; icon: string; label: string }[] = [
  { id: 'PAYSTACK', icon: '🟦', label: 'Paystack' },
  { id: 'FLUTTERWAVE', icon: '🟧', label: 'Flutterwave' },
];

function parseAmount(value: string): number {
  return Number(value.replace(/,/g, ''));
}

/**
 * DPX-100 Wallet Slice 2. The Figma source's Top Up offers Card/Bank
 * Transfer/USSD methods with saved cards — the real backend only supports
 * initiating a gateway checkout session (Paystack/Flutterwave/OPay, the
 * platform's three real gateway partners — Moniepoint is not integrated),
 * so the provider list is adapted to the three real gateways and no
 * saved-card UI is shown (no card tokenization exists anywhere in the
 * platform, same gap already documented for Ride payments).
 */
export function TopUpScreen({
  onBack,
  onGatewayRedirect,
  onManagePaymentMethods,
}: {
  onBack: () => void;
  onGatewayRedirect: (authorizationUrl: string) => void;
  onManagePaymentMethods: () => void;
}): React.JSX.Element {
  const [amount, setAmount] = React.useState('5,000');
  const [provider, setProvider] = React.useState<WalletFundingProvider>('PAYSTACK');
  const fundWallet = useFundWallet();
  const { body } = useSuperAppFonts();
  const numericAmount = parseAmount(amount);
  const validAmount = numericAmount >= 100 && numericAmount <= 1_000_000;

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#0A1628' }}
    >
      <SuperAppWalletStatusBar />
      <SuperAppWalletScreenHeader title="Top Up Wallet" onBack={onBack} />

      <div className="flex-1 overflow-y-auto pb-4">
        <div className="px-4 pb-4">
          <SuperAppWalletAmountCard value={amount} onChange={setAmount} />
        </div>

        <div className="px-4 pb-5">
          <SuperAppWalletSectionLabel>Quick amounts</SuperAppWalletSectionLabel>
          <div className="mt-2.5">
            <SuperAppWalletPresetChips
              presets={AMOUNT_PRESETS}
              value={amount}
              onSelect={setAmount}
            />
          </div>
        </div>

        <div className="px-4 pb-5">
          <div className="mb-2.5 flex items-center justify-between">
            <SuperAppWalletSectionLabel>Payment provider</SuperAppWalletSectionLabel>
            <button
              type="button"
              onClick={onManagePaymentMethods}
              className={`text-[12px] font-medium ${body}`}
              style={{ color: '#47CF72' }}
            >
              Manage
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {PROVIDERS.map((option) => (
              <SuperAppWalletSelectableRow
                key={option.id}
                icon={option.icon}
                label={option.label}
                selected={provider === option.id}
                onClick={() => {
                  setProvider(option.id);
                }}
              />
            ))}
          </div>
        </div>

        {!validAmount ? (
          <p className={`px-4 pb-2 text-[13px] ${body}`} style={{ color: '#EF4444' }}>
            Enter an amount between ₦100 and ₦1,000,000.
          </p>
        ) : null}
        {fundWallet.isError ? (
          <p className={`px-4 pb-2 text-[13px] ${body}`} style={{ color: '#EF4444' }}>
            Couldn&apos;t start the top-up. Try again.
          </p>
        ) : null}
      </div>

      <div className="px-4 pb-8 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,.08)' }}>
        <SuperAppWalletButton
          disabled={!validAmount}
          loading={fundWallet.isPending}
          onClick={() => {
            fundWallet.mutate(
              {
                amount: numericAmount,
                provider,
                callbackUrl: `${window.location.origin}/wallet?topupVerify=1`,
              },
              {
                onSuccess: (result) => {
                  onGatewayRedirect(result.authorizationUrl);
                },
              },
            );
          }}
        >
          Top Up ₦{amount}
        </SuperAppWalletButton>
      </div>
    </div>
  );
}
