'use client';

import * as React from 'react';

import { ActionButton, RideHeader } from '../ride-ui';

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

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#0A1628' }}
    >
      <RideHeader onBack={onBack} title="Leave a Tip" />
      <div className="flex-1 overflow-y-auto px-5">
        <div
          className="mb-6 flex items-center gap-3 rounded-2xl p-4"
          style={{ background: '#0D1B2E', border: '1px solid rgba(255,255,255,.08)' }}
        >
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full text-[16px] font-bold"
            style={{
              background: 'linear-gradient(135deg,#176B30,#2BAC52)',
              color: '#fff',
              fontFamily: "'Poppins',sans-serif",
            }}
          >
            {receipt.data?.driver ? receipt.data.driver.name.slice(0, 1).toUpperCase() : '🚗'}
          </div>
          <p
            className="text-[15px] font-semibold"
            style={{ fontFamily: "'Poppins',sans-serif", color: '#fff' }}
          >
            {receipt.data?.driver?.name ?? 'Your driver'}
          </p>
        </div>
        <div className="mb-6 flex flex-wrap gap-2">
          {PRESETS.map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => {
                setSelected(amount);
              }}
              className="rounded-full px-5 py-2.5 text-sm font-semibold"
              style={{
                background: selected === amount ? '#47CF72' : '#0D1B2E',
                color: selected === amount ? '#0A1628' : 'rgba(255,255,255,.6)',
                border: selected === amount ? 'none' : '1px solid rgba(255,255,255,.08)',
                fontFamily: "'Poppins',sans-serif",
              }}
            >
              ₦{amount.toLocaleString()}
            </button>
          ))}
        </div>
        <div
          className="mb-4 rounded-xl p-4"
          style={{ background: 'rgba(34,197,94,.06)', border: '1px solid rgba(34,197,94,.15)' }}
        >
          <p
            className="text-center text-[13px]"
            style={{ fontFamily: "'Inter',sans-serif", color: '#47CF72' }}
          >
            💚 100% goes directly to your driver
          </p>
        </div>
        {tipDriver.isError ? (
          <p className="text-[13px]" style={{ fontFamily: "'Inter',sans-serif", color: '#EF4444' }}>
            Couldn&apos;t send the tip. Try again.
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-2 px-5 pb-8 pt-3">
        <ActionButton
          label={`Send Tip (₦${selected.toLocaleString()})`}
          loading={tipDriver.isPending}
          onClick={() => {
            tipDriver.mutate({ rideId, amount: selected }, { onSuccess: onSubmit });
          }}
        />
        <button
          type="button"
          onClick={onSkip}
          className="h-10 w-full text-sm"
          style={{ color: 'rgba(255,255,255,.38)', fontFamily: "'Inter',sans-serif" }}
        >
          Skip, no tip
        </button>
      </div>
    </div>
  );
}
