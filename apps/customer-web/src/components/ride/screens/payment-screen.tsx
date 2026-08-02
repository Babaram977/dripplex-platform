'use client';

import * as React from 'react';

import { ActionButton, RideHeader } from '../ride-ui';

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

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#0A1628' }}
    >
      <RideHeader onBack={onBack} title="Choose Payment" />
      <div className="flex-1 overflow-y-auto px-5 pt-3">
        <div
          className="mb-4 rounded-2xl p-4"
          style={{ background: '#0D1B2E', border: '1px solid rgba(255,255,255,.08)' }}
        >
          <p
            className="text-[12px]"
            style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.38)' }}
          >
            {ride.data?.pickupAddress ?? 'Pickup'} → {ride.data?.dropoffAddress ?? 'Destination'}
          </p>
          <p
            className="my-1 text-[32px] font-extrabold"
            style={{ fontFamily: "'Poppins',sans-serif", color: '#47CF72' }}
          >
            {ride.data ? `₦${ride.data.totalFare.toLocaleString()}` : '—'}
          </p>
        </div>
        {METHODS.map((m) => {
          const selected = method === m.id;
          const isWallet = m.id === 'WALLET';
          const insufficientWallet =
            isWallet && wallet.data !== undefined && ride.data !== undefined
              ? wallet.data.availableBalance < ride.data.totalFare
              : false;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setMethod(m.id);
              }}
              disabled={insufficientWallet}
              className="mb-3 flex w-full items-center gap-3 rounded-2xl p-4 text-left disabled:opacity-40"
              style={{
                background: selected ? 'rgba(34,197,94,.08)' : '#0D1B2E',
                border: selected ? '1.5px solid #47CF72' : '1px solid rgba(255,255,255,.08)',
              }}
            >
              <span style={{ fontSize: 22 }}>{m.icon}</span>
              <div className="flex-1">
                <p
                  className="text-[14px] font-semibold"
                  style={{ fontFamily: "'Poppins',sans-serif", color: '#fff' }}
                >
                  {m.label}
                </p>
                {isWallet ? (
                  <p
                    className="text-[12px]"
                    style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.6)' }}
                  >
                    {wallet.isLoading
                      ? 'Loading balance…'
                      : wallet.data
                        ? `Balance: ₦${wallet.data.availableBalance.toLocaleString()}${insufficientWallet ? ' — insufficient' : ''}`
                        : '—'}
                  </p>
                ) : null}
              </div>
              <div
                className="flex h-5 w-5 items-center justify-center rounded-full"
                style={{
                  background: selected ? '#47CF72' : 'transparent',
                  border: selected ? 'none' : '2px solid rgba(255,255,255,.08)',
                }}
              >
                {selected ? <div className="h-2.5 w-2.5 rounded-full bg-white" /> : null}
              </div>
            </button>
          );
        })}
        {initiatePayment.isError ? (
          <p
            className="mb-3 text-[13px]"
            style={{ fontFamily: "'Inter',sans-serif", color: '#EF4444' }}
          >
            Payment couldn&apos;t be started. Try again.
          </p>
        ) : null}
      </div>
      <div className="px-5 pb-8 pt-3">
        <ActionButton
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
