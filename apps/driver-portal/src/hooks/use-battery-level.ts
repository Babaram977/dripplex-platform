'use client';

import * as React from 'react';

interface BatteryManagerLike {
  level: number;
  addEventListener: (type: 'levelchange', listener: () => void) => void;
  removeEventListener: (type: 'levelchange', listener: () => void) => void;
}

interface NavigatorWithBattery extends Navigator {
  getBattery?: () => Promise<BatteryManagerLike>;
}

/** Driver Slice 2 item 5 — SOS/Emergency: the Battery Status API is
 * deprecated/unsupported in most browsers today (notably desktop and iOS
 * Safari) — this honestly returns `null` when it isn't available rather
 * than fabricating a value. When present, returns 0-100. */
export function useBatteryLevel(): number | null {
  const [level, setLevel] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (typeof navigator === 'undefined') {
      return;
    }
    const nav = navigator as NavigatorWithBattery;
    if (typeof nav.getBattery !== 'function') {
      return;
    }

    let battery: BatteryManagerLike | undefined;
    const onLevelChange = (): void => {
      if (battery) {
        setLevel(Math.round(battery.level * 100));
      }
    };

    void nav.getBattery().then((manager) => {
      battery = manager;
      setLevel(Math.round(manager.level * 100));
      manager.addEventListener('levelchange', onLevelChange);
    });

    return () => {
      battery?.removeEventListener('levelchange', onLevelChange);
    };
  }, []);

  return level;
}
