'use client';

import {
  SuperAppRideStatusBanner,
  SuperAppWalletScreenHeader,
  SuperAppWalletStatusBar,
  useSuperAppFonts,
} from '@dripplex/ui';
import * as React from 'react';

import { useVerifyWalletFunding } from '@/hooks/wallet';

/**
 * Wallet's own redirect/verify screen for the real gateway top-up flow —
 * same real contract as Ride's `GatewayPaymentScreen` (a genuine redirect
 * to `authorizationUrl`, not an embedded SDK session), reusing the same
 * generic `SuperAppRideStatusBanner` primitive since it carries no
 * Ride-specific visuals. Kept as its own component (rather than importing
 * Ride's screen directly) because it wires to `useVerifyWalletFunding`,
 * not ride payment verification.
 */
export function WalletGatewayPaymentScreen({
  authorizationUrl,
  verifying,
  onBack,
  onVerified,
}: {
  authorizationUrl: string;
  /** True once we've returned from the gateway's redirect and need to confirm the outcome. */
  verifying: boolean;
  onBack: () => void;
  onVerified: () => void;
}): React.JSX.Element {
  const verifyFunding = useVerifyWalletFunding();
  const attempted = React.useRef(false);
  const { body } = useSuperAppFonts();

  React.useEffect(() => {
    if (verifying || !authorizationUrl) return;
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
    verifyFunding.mutate(undefined, {
      onSuccess: () => {
        onVerified();
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once when we land back from the gateway
  }, [verifying]);

  if (verifying) {
    return (
      <div
        className="absolute inset-0 flex flex-col overflow-hidden"
        style={{ background: '#0A1628' }}
      >
        <SuperAppWalletStatusBar />
        <SuperAppWalletScreenHeader title="Confirming Payment" onBack={onBack} />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-5">
          {verifyFunding.isError ? (
            <SuperAppRideStatusBanner
              tone="error"
              title="Couldn't confirm payment"
              subtitle="The gateway didn't confirm this top-up. You can go back and try again."
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
      <SuperAppWalletStatusBar />
      <SuperAppWalletScreenHeader title="Redirecting" onBack={onBack} />
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
