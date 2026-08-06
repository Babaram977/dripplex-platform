'use client';

import { DripplexLogo } from '@dripplex/ui';
import * as React from 'react';

// Locked Figma palette (docs/reference/figma-super-app-source/tokens/colors.ts)
const NAVY_DEEP = '#060E1C';
const NAVY_BASE = '#0A1628';
const G0 = '#176B30';
const G2 = '#2BAC52';
const G3 = '#47CF72';

// Survives client-side (SPA) navigations within a single page load, so the
// splash never replays when moving between routes.
let splashPlayedThisLoad = false;

/**
 * Boot splash — ported from the Figma Make SplashScreen (screensA.tsx):
 * pop-in logo + "life, Simplified" + bar-fill loading bar, then fades out to
 * reveal the welcome hero. Renders from the first paint (no flash of the hero
 * underneath), and plays once per browser session — refreshes within the same
 * session and in-site navigation don't replay it.
 */
export function SplashIntro(): React.JSX.Element | null {
  // Show from the first render (matches SSR) unless already played this load.
  const [show, setShow] = React.useState(() => !splashPlayedThisLoad);
  const [fading, setFading] = React.useState(false);

  React.useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem('dripplex-splash-seen') === '1';
    } catch {
      seen = false;
    }
    if (splashPlayedThisLoad || seen) {
      splashPlayedThisLoad = true;
      setShow(false);
      return;
    }
    splashPlayedThisLoad = true;
    const fadeT = setTimeout(() => { setFading(true); }, 2600);
    const doneT = setTimeout(() => {
      setShow(false);
      try {
        sessionStorage.setItem('dripplex-splash-seen', '1');
      } catch {
        /* ignore */
      }
    }, 3200);
    return () => {
      clearTimeout(fadeT);
      clearTimeout(doneT);
    };
  }, []);

  if (!show) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-between overflow-hidden transition-opacity duration-500"
      style={{
        background: `linear-gradient(155deg,${NAVY_DEEP} 0%,${NAVY_BASE} 55%,#0B1D2F 100%)`,
        opacity: fading ? 0 : 1,
        pointerEvents: fading ? 'none' : 'auto',
      }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 60% 45% at 50% 40%, rgba(43,172,82,.16), transparent 60%)`,
        }}
      />
      <div
        className="relative z-10 flex flex-1 flex-col items-center justify-center gap-6"
        style={{ animation: 'pop-in .75s cubic-bezier(.34,1.56,.64,1) .25s both' }}
      >
        <div style={{ transform: 'scale(2.2)' }}>
          <DripplexLogo href="#" />
        </div>
        <span
          className="font-display text-sm font-medium"
          style={{ letterSpacing: '0.22em', color: G2 }}
        >
          life, Simplified
        </span>
      </div>
      <div className="relative z-10 flex w-full max-w-md flex-col items-center gap-4 px-10 pb-14">
        <div
          className="h-[2px] w-full overflow-hidden rounded-full"
          style={{ background: 'rgba(255,255,255,.06)' }}
        >
          <div
            className="h-full rounded-full"
            style={{
              background: `linear-gradient(90deg,${G0},${G3})`,
              animation: 'bar-fill 2.4s cubic-bezier(.4,0,.2,1) .3s both',
            }}
          />
        </div>
        <span className="text-[11px] text-white/20">v1.0.0</span>
      </div>
    </div>
  );
}
