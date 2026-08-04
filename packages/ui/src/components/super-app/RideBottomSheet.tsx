import * as React from 'react';

import { useSuperAppFonts } from './fonts';

/** Rounded bottom sheet shared by every Ride screen, either filling the rest
 * of the screen below a map/hero or fixed/anchored over one. */
export function SuperAppRideBottomSheet({
  children,
  title,
  peek,
  anchored,
}: {
  children: React.ReactNode;
  title?: string | undefined;
  peek?: boolean | undefined;
  /** Fixed to the bottom over a full-bleed map instead of filling the rest of the screen. */
  anchored?: boolean | undefined;
}): React.JSX.Element {
  const { heading } = useSuperAppFonts();
  return (
    <div
      className={
        anchored ? 'absolute inset-x-0 bottom-0 z-10' : 'relative z-10 flex flex-1 flex-col'
      }
      style={{
        background: '#0A1628',
        borderRadius: '28px 28px 0 0',
        boxShadow: '0 -24px 80px rgba(0,0,0,.7)',
      }}
    >
      {peek ? (
        <div className="flex justify-center pb-1 pt-3">
          <div className="h-1 w-10 rounded-full" style={{ background: 'rgba(255,255,255,.15)' }} />
        </div>
      ) : null}
      {title ? (
        <p className={`px-5 pb-2 pt-4 text-[17px] font-bold text-white ${heading}`}>{title}</p>
      ) : null}
      {children}
    </div>
  );
}
