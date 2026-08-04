'use client';

import {
  SuperAppRideActionButton,
  SuperAppRideHeader,
  SuperAppRidePaymentMethodRow,
  SuperAppRidePaymentSummary,
  useSuperAppFonts,
} from '@dripplex/ui';
import * as React from 'react';

import type { RidePaymentMethod } from '@dripplex/types';

import { useCustomerWallet, useInitiateRidePayment, useRide } from '@/hooks/rides';

const METHODS: { id: RidePaymentMethod; icon: string; label: string }[] = [
  { id: 'WALLET', icon: '💳', label: 'DrippleX Wallet' },
  { id: 'CASH', icon: '💵', label: 'Cash' },
  { id: 'PAYSTACK', icon: '🟦', label: 'Paystack' },
  { id: 'FLUTTERWAVE', icon: '🟧', label: 'Flutterwave' },
  { id: 'OPAY', icon: '🟢', label: 'OPay' },
];

/**
 * Real source's method list was Wallet/"Visa Card •••• 4821"/Cash/OPay — no
 * stored-card concept exists in the real backend (payments route through
 * Paystack/Flutterwave/OPay gateways, not a saved card token). Adapted to
 * the real RidePaymentMethod set instead of inventing a card-token system.
 */
export function PaymentScreen({
  rideId,
  onBack,
  onPaid,
  onCashPending,
  onGatewayRedirect,
}: {
  rideId: string;
  onBack: () => void;
  onPaid: () => void;
  onCashPending: () => void;
  onGatewayRedirect: (authorizationUrl: string) => void;
}): React.JSX.Element {
  const ride = useRide(rideId);
  const wallet = useCustomerWallet();
  const [method, setMethod] = React.useState<RidePaymentMethod>('WALLET');
  const initiatePayment = useInitiateRidePayment();
  const { body } = useSuperAppFonts();

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#0A1628' }}
    >
      <SuperAppRideHeader onBack={onBack} title="Choose Payment" />
      <div className="flex-1 overflow-y-auto px-5 pt-3">
        <SuperAppRidePaymentSummary
          routeLabel={`${ride.data?.pickupAddress ?? 'Pickup'} → ${ride.data?.dropoffAddress ?? 'Destination'}`}
          amount={ride.data ? `₦${ride.data.totalFare.toLocaleString()}` : '—'}
        />
        {METHODS.map((m) => {
          const selected = method === m.id;
          const isWallet = m.id === 'WALLET';
          const insufficientWallet =
            isWallet && wallet.data !== undefined && ride.data !== undefined
              ? wallet.data.availableBalance < ride.data.totalFare
              : false;
          return (
            <SuperAppRidePaymentMethodRow
              key={m.id}
              icon={m.icon}
              label={m.label}
              selected={selected}
              disabled={insufficientWallet}
              onClick={() => {
                setMethod(m.id);
              }}
              subtitle={
                isWallet
                  ? wallet.isLoading
                    ? 'Loading balance…'
                    : wallet.data
                      ? `Balance: ₦${wallet.data.availableBalance.toLocaleString()}${insufficientWallet ? ' — insufficient' : ''}`
                      : '—'
                  : undefined
              }
            />
          );
        })}
        {initiatePayment.isError ? (
          <p className={`mb-3 text-[13px] ${body}`} style={{ color: '#EF4444' }}>
            Payment couldn&apos;t be started. Try again.
          </p>
        ) : null}
      </div>
      <div className="px-5 pb-8 pt-3">
        <SuperAppRideActionButton
          label="Confirm Payment"
          loading={initiatePayment.isPending}
          onClick={() => {
            initiatePayment.mutate(
              {
                rideId,
                body: {
                  method,
                  callbackUrl: `${window.location.origin}/ride?rideId=${rideId}&payVerify=1`,
                },
              },
              {
                onSuccess: (result) => {
                  if (result.authorizationUrl) {
                    onGatewayRedirect(result.authorizationUrl);
                    return;
                  }
                  if (result.ride.paymentStatus === 'PAID') {
                    onPaid();
                    return;
                  }
                  onCashPending();
                },
              },
            );
          }}
        />
      </div>
    </div>
  );
}
