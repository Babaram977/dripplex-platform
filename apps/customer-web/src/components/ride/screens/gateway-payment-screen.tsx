'use client';

import { SuperAppRideHeader, SuperAppRideStatusBanner, useSuperAppFonts } from '@dripplex/ui';
import * as React from 'react';

import { useVerifyRidePayment } from '@/hooks/rides';

/**
 * Generated — the received `OPayPaymentScreen` was a single-provider mock
 * ("Does /payments/opay/initiate return a session_token...?" was an open
 * gap question). The real backend treats Paystack/Flutterwave/OPay
 * identically (`GATEWAY_METHODS`, one `initiatePayment`/`verifyPayment`
 * contract) — a real redirect to `authorizationUrl`, not an embedded SDK
 * session. One generated screen covers all three rather than three
 * near-duplicate ones, documented in docs/RIDE-003-GENERATED-SCREENS.md.
 * Same visual language (RideHeader, StatusBanner) as every other screen.
 */
export function GatewayPaymentScreen({
  rideId,
  authorizationUrl,
  verifying,
  onBack,
  onVerified,
}: {
  rideId: string;
  authorizationUrl: string;
  /** True once we've returned from the gateway's redirect and need to confirm the outcome. */
  verifying: boolean;
  onBack: () => void;
  onVerified: () => void;
}): React.JSX.Element {
  const verifyPayment = useVerifyRidePayment();
  const attempted = React.useRef(false);
  const { body } = useSuperAppFonts();

  React.useEffect(() => {
    if (verifying) return;
    const timer = setTimeout(() => {
      window.location.assign(authorizationUrl);
    }, 800);
    return () => {
      clearTimeout(timer);
    };
  }, [verifying, authorizationUrl]);

  React.useEffect(() => {
    if (!verifying || attempted.current) return;
    attempted.current = true;
    verifyPayment.mutate(
      { rideId },
      {
        onSuccess: (ride) => {
          if (ride.paymentStatus === 'PAID') {
            onVerified();
          }
        },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once when we land back from the gateway
  }, [verifying]);

  if (verifying) {
    return (
      <div
        className="absolute inset-0 flex flex-col overflow-hidden"
        style={{ background: '#0A1628' }}
      >
        <SuperAppRideHeader onBack={onBack} title="Confirming Payment" />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-5">
          {verifyPayment.isError ? (
            <SuperAppRideStatusBanner
              tone="error"
              title="Couldn't confirm payment"
              subtitle="The gateway didn't confirm this payment. You can go back and try again."
            />
          ) : (
            <SuperAppRideStatusBanner
              title="Confirming your payment…"
              subtitle="This only takes a moment."
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#0A1628' }}
    >
      <SuperAppRideHeader onBack={onBack} title="Redirecting" />
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-5">
        <SuperAppRideStatusBanner
          title="Taking you to the payment page…"
          subtitle="You'll come back here automatically once it's done."
        />
        <a
          href={authorizationUrl}
          className={`text-[13px] underline ${body}`}
          style={{ color: '#47CF72' }}
        >
          Continue to payment
        </a>
      </div>
    </div>
  );
}
