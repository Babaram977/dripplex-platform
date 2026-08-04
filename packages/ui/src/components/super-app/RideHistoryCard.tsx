import * as React from 'react';

import { useSuperAppFonts } from './fonts';

/** Ride-history row: icon, type/date, fare, pickup/dropoff dots, optional cancellation note. */
export function SuperAppRideHistoryCard({
  icon,
  tone,
  title,
  dateLabel,
  fare,
  pickupAddress,
  dropoffAddress,
  note,
  onClick,
}: {
  icon: string;
  tone: 'success' | 'error';
  title: string;
  dateLabel: string;
  fare: string;
  pickupAddress: string;
  dropoffAddress: string;
  note?: string | undefined;
  onClick?: (() => void) | undefined;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  const content = (
    <>
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-xl text-base"
            style={{
              background: tone === 'success' ? 'rgba(43,172,82,.12)' : 'rgba(239,68,68,.1)',
            }}
          >
            {icon}
          </div>
          <div>
            <p className={`text-[13px] font-semibold capitalize text-white ${heading}`}>{title}</p>
            <p className={`text-[11px] ${body}`} style={{ color: 'rgba(255,255,255,.5)' }}>
              {dateLabel}
            </p>
          </div>
        </div>
        <p className={`text-[15px] font-bold text-white ${heading}`}>{fare}</p>
      </div>
      <div className="mb-1 flex items-center gap-2">
        <div className="h-1.5 w-1.5 rounded-full" style={{ background: '#2BAC52' }} />
        <p className={`text-[12px] ${body}`} style={{ color: 'rgba(255,255,255,.6)' }}>
          {pickupAddress}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-1.5 rounded-full" style={{ background: '#EF4444' }} />
        <p className={`text-[12px] ${body}`} style={{ color: 'rgba(255,255,255,.6)' }}>
          {dropoffAddress}
        </p>
      </div>
      {note ? (
        <p className={`mt-2 text-[11px] ${body}`} style={{ color: '#EF4444' }}>
          {note}
        </p>
      ) : null}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="w-full rounded-2xl p-4 text-left"
        style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
      >
        {content}
      </button>
    );
  }
  return (
    <div
      className="w-full rounded-2xl p-4"
      style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
    >
      {content}
    </div>
  );
}
