import * as React from 'react';

import { useSuperAppFonts } from './fonts';

/** Receipt header (ID + status pill) plus a label/value row list, used on Trip Receipt. */
export function SuperAppRideReceiptCard({
  receiptId,
  status,
  rows,
}: {
  receiptId: string;
  status: string;
  rows: [string, string][];
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  return (
    <div
      className="mb-4 overflow-hidden rounded-2xl"
      style={{ background: '#0D1B2E', border: '1px solid rgba(255,255,255,.08)' }}
    >
      <div
        className="flex items-center justify-between border-b px-4 py-4"
        style={{ borderColor: 'rgba(255,255,255,.08)' }}
      >
        <div>
          <p
            className={`text-[11px] font-semibold ${body}`}
            style={{ color: 'rgba(255,255,255,.5)' }}
          >
            RECEIPT
          </p>
          <p className={`text-[13px] font-medium text-white ${heading}`}>{receiptId}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-[11px] font-bold ${body}`}
          style={{ background: 'rgba(43,172,82,.12)', color: '#47CF72' }}
        >
          {status}
        </span>
      </div>
      <div className="p-4">
        {rows.map(([label, value]) => (
          <div key={label} className="mb-3 flex justify-between last:mb-0">
            <p className={`text-[13px] ${body}`} style={{ color: 'rgba(255,255,255,.5)' }}>
              {label}
            </p>
            <p className={`text-[13px] font-medium text-white ${body}`}>{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
