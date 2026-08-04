'use client';

import {
  SuperAppRideActionButton,
  SuperAppRideAmountChips,
  SuperAppRideDriverIdentity,
  SuperAppRideHeader,
  SuperAppRideInfoBox,
  useSuperAppFonts,
} from '@dripplex/ui';
import * as React from 'react';

import { useRideReceipt, useTipDriver } from '@/hooks/rides';

const PRESETS = [100, 200, 500, 1000];

/**
 * Real source. One real-data upgrade over the active-ride screens: once a
 * ride is COMPLETED, GET /customer/rides/:id/receipt does expose a real
 * driver name (RideReceiptDriverDto.name) — unlike DriverAssignedScreen/
 * DriverEnRouteScreen, which have no such endpoint while a ride is still
 * active. Shown here instead of the generic "Your driver" placeholder.
 */
export function TipDriverScreen({
  rideId,
  onBack,
  onSubmit,
  onSkip,
}: {
  rideId: string;
  onBack: () => void;
  onSubmit: () => void;
  onSkip: () => void;
}): React.JSX.Element {
  const receipt = useRideReceipt(rideId);
  const [selected, setSelected] = React.useState<number>(200);
  const tipDriver = useTipDriver();
  const { body } = useSuperAppFonts();

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#0A1628' }}
    >
      <SuperAppRideHeader onBack={onBack} title="Leave a Tip" />
      <div className="flex-1 overflow-y-auto px-5">
        <SuperAppRideDriverIdentity driverName={receipt.data?.driver?.name} layout="row" />
        <div className="mb-6">
          <SuperAppRideAmountChips amounts={PRESETS} selected={selected} onSelect={setSelected} />
        </div>
        <div className="mb-4">
          <SuperAppRideInfoBox tone="success">
            <p className="text-center">💚 100% goes directly to your driver</p>
          </SuperAppRideInfoBox>
        </div>
        {tipDriver.isError ? (
          <p className={`text-[13px] ${body}`} style={{ color: '#EF4444' }}>
            Couldn&apos;t send the tip. Try again.
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-2 px-5 pb-8 pt-3">
        <SuperAppRideActionButton
          label={`Send Tip (₦${selected.toLocaleString()})`}
          loading={tipDriver.isPending}
          onClick={() => {
            tipDriver.mutate({ rideId, amount: selected }, { onSuccess: onSubmit });
          }}
        />
        <button
          type="button"
          onClick={onSkip}
          className={`h-10 w-full text-sm ${body}`}
          style={{ color: 'rgba(255,255,255,.5)' }}
        >
          Skip, no tip
        </button>
      </div>
    </div>
  );
}
