import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';
import logoImg from '@/imports/C3C48FE4-A0D8-4DA3-8A0D-A09D3D9EA7FB.jpeg';

// ── Brand tokens — sourced from /src/tokens/colors.ts ─────────────────────
// Imported locally so components in this file can use them directly,
// and re-exported for backwards compatibility with existing screen files.
// New screens should import directly from "../../tokens" instead.
import {
  G0,
  G2,
  G3,
  NAVY_DEEP,
  NAVY_BASE,
  NAVY_CARD,
  NAVY_SURFACE,
  BORDER,
  MUTED,
} from '../tokens/colors';
export { G0, G2, G3, NAVY_DEEP, NAVY_BASE, NAVY_CARD, NAVY_SURFACE, BORDER, MUTED };

/**
 * DrippleX support WhatsApp line (founder-provided, 2026-08-17).
 *
 * Kept here rather than typed into each screen so there is one number to change
 * — a stale support number is worse than none, because a blocked user believes
 * they have reached somebody.
 */
export const DRIPPLEX_SUPPORT_WHATSAPP = '+2349061616116';

/**
 * Time-of-day greeting. One implementation so the wallet cannot say
 * "Good morning" at 9pm while the home screen says "Good Evening".
 */
export function timeGreeting(now: Date = new Date()): string {
  const h = now.getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

export const GLOBAL_STYLES = `
  @keyframes orbit-cw       { from{transform:rotate(0deg);}    to{transform:rotate(360deg);}   }
  @keyframes orbit-ccw      { from{transform:rotate(0deg);}    to{transform:rotate(-360deg);}  }
  @keyframes float-a        { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-8px);}   }
  @keyframes float-b        { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-11px);}  }
  @keyframes float-c        { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-7px);}   }
  @keyframes pop-in         { from{opacity:0;transform:scale(.82);}       to{opacity:1;transform:scale(1);}       }
  @keyframes fade-up        { from{opacity:0;transform:translateY(22px);}  to{opacity:1;transform:translateY(0);}  }
  @keyframes fade-in        { from{opacity:0;}                             to{opacity:1;}                          }
  @keyframes slide-in-right { from{opacity:0;transform:translateX(28px);}  to{opacity:1;transform:translateX(0);}  }
  @keyframes glow-ring      { 0%,100%{box-shadow:0 0 24px rgba(43,172,82,.14),0 0 0 1px rgba(43,172,82,.18);}
                              50%    {box-shadow:0 0 52px rgba(43,172,82,.30),0 0 0 1px rgba(43,172,82,.28);} }
  @keyframes bar-fill       { from{width:0;}  to{width:100%;} }
  @keyframes shake          { 0%,100%{transform:translateX(0);} 20%,60%{transform:translateX(-6px);} 40%,80%{transform:translateX(6px);} }
  @keyframes otp-pop        { from{opacity:0;transform:scale(.65);} to{opacity:1;transform:scale(1);} }
  @keyframes check-draw     { from{stroke-dashoffset:60;} to{stroke-dashoffset:0;} }
  @keyframes circle-draw    { from{stroke-dashoffset:201;} to{stroke-dashoffset:0;} }
  @keyframes success-bounce { 0%{transform:scale(.6);opacity:0;} 60%{transform:scale(1.08);} 80%{transform:scale(.96);} 100%{transform:scale(1);opacity:1;} }
  @keyframes pulse-ring     { 0%{transform:scale(1);opacity:.5;} 100%{transform:scale(1.5);opacity:0;} }
  @keyframes fade-out       { from{opacity:1;} to{opacity:0;} }
  @keyframes spin           { from{transform:rotate(0deg);} to{transform:rotate(360deg);} }
  @keyframes chip-pop       { 0%{transform:scale(1);} 40%{transform:scale(1.18);} 70%{transform:scale(.94);} 100%{transform:scale(1);} }
  @keyframes avatar-pulse   { 0%,100%{box-shadow:0 0 0 0 rgba(43,172,82,.4);} 50%{box-shadow:0 0 0 14px rgba(43,172,82,0);} }
  @keyframes welcome-rise   { from{opacity:0;transform:translateY(32px) scale(.95);} to{opacity:1;transform:translateY(0) scale(1);} }
  @keyframes orbit-once     { from{transform:rotate(0deg);} to{transform:rotate(360deg);} }

  /* ── Fitting a real phone ───────────────────────────────────────────────
     Two layout rules that are wrong to repeat per screen.

     1. A flex column whose child is 'flex-1' gives that child
        min-height:auto, so the child grows to fit its content instead of
        being bounded by the column. Anything pinned below it — a Book
        button, a Proceed to Checkout bar — is then pushed past the bottom
        of the screen and clipped. That is why the ride Fare Estimate could
        not be confirmed. min-height:0 lets the child shrink so its own
        scroll area takes the overflow and the pinned row stays on screen.
        Children that scroll already get this from their own overflow, so
        this only ever affects the containers that were broken. */
  .flex-col > .flex-1 { min-height: 0; }

  /*  1b. The mirror image of the same bug, and the reason Manage Account
        showed an empty "Account Settings" section with no way to sign out.

        A screen whose root is 'flex h-full flex-col overflow-y-auto' has a
        definite height, so its children are flex items under shrink
        pressure. A child normally resists via min-height:auto — but a card
        with overflow:hidden (every rounded, clipped card in this app) gets
        min-height:0 instead, so it is free to be squeezed to nothing. The
        three cards on that screen carrying overflow-hidden collapsed to
        hairlines; the one without it rendered fine. Nothing was missing from
        the markup, and no amount of scrolling brought it back.

        A scrolling column should scroll, not compress. */
  .flex-col.overflow-y-auto > *,
  .flex-col.overflow-auto > * { flex-shrink: 0; }

  /*  1b. The welcome hero. See HeroFit below for why the scale is measured
        rather than declared; this half is the geometry it drives.

        The slot stretches to fill the flex row it is given and reports a
        144px minimum, so the row cannot collapse the orbit to nothing. The
        orbit keeps its authored 320px box and is centred on the slot by
        absolute positioning rather than by grid alignment: a grid item that
        is LARGER than its area is start-aligned, not centred (CSS Grid 6.2
        forces start alignment on overflow to keep content reachable), so the
        old place-items:center slid the whole composition down and to the
        right by half the shrinkage — measured 51px on a 360x640 screen.
        left/top 50% + translate(-50%,-50%) centres it for every scale.

        The scale is applied on the orbit itself, above the rings and tiles,
        so the orbit-cw / orbit-ccw / float-a-b-c animations inside are
        untouched — a parent scale composes with a child's rotate rather
        than replacing it. */
  .dx-hero-slot  { position: relative; flex: 1 1 auto; align-self: stretch;
                   min-width: 0; min-height: 144px; }
  .dx-hero-orbit { position: absolute; left: 50%; top: 50%;
                   transform: translate(-50%,-50%) scale(var(--dx-hero-scale,1)); }

  /*  2a. Above 480px the app is a 390px column, and that column is for
        reading the app on a big screen — not for pretending to be an iPhone.
        The bezel, the notch and the fake 9:41 clock are desktop preview
        chrome; shipped to a tablet user they are imitation hardware wrapped
        around a real product, and they are what a Play reviewer would see.

        They also cause damage. iOS text autosizing inflates type inside a
        narrow column on a wide viewport, which is what pushed the marketplace
        search placeholder onto three lines and over the title above it. The
        text-size-adjust:100% rule in theme.css is the other half of that fix.

        The column stays; only the costume goes. */
  .dx-phone-frame { border-radius: 0 !important;
                    box-shadow: 0 0 0 1px rgba(255,255,255,.06) !important; }
  .dx-phone-notch { display: none !important; }
  .dx-status-mock > * { visibility: hidden; }

  /*  2b. The device mockup — bezel, notch, 390px width, simulated status bar
        — is a desktop preview of a phone. On an actual phone it IS the
        phone, and a fixed 390px overflows a 360px handset sideways while
        wasting space on a 430px one. Full bleed, and the mock chrome goes.

        The trigger is the DEVICE, not a width. It used to be max-width:
        480px alone, which is a guess about how wide a phone is — and it is
        wrong for a large Android, a foldable, or a tablet, all of which
        report more than 480 CSS pixels. Those devices got the 390px column
        with dead black bars either side of it, reported as the app not
        fitting the screen.

        pointer: coarse asks the question that actually matters: is this
        being touched? Any handheld gets the whole screen at any width. A
        mouse-driven desktop keeps the centred column, which is right there —
        a phone layout stretched across a 27-inch monitor is not an
        improvement. The width query stays alongside it for the rare touch
        device that misreports its pointer. */
  @media (max-width: 480px), (pointer: coarse) {
    .dx-canvas       { padding: 0 !important; align-items: stretch !important; }
    .dx-canvas > *   { width: 100%; height: 100%; }
    .dx-phone-frame  { width: 100dvw !important; height: 100dvh !important;
                       border-radius: 0 !important; box-shadow: none !important; }
    .dx-phone-notch  { display: none !important; }
    /* The 9:41 clock and fake battery are mock chrome sitting under the real
       ones. The row stays as the safe-area spacer it needs to be. */
    .dx-status-mock  { padding-top: max(env(safe-area-inset-top), 10px) !important; }
    .dx-status-mock > * { visibility: hidden; }

    /*  The ops/admin console gets the same treatment, and for the same
        reason. It renders in a 1100px window with macOS traffic lights and a
        fake URL bar — a desktop preview of a console. On a handset that is a
        1100px box inside a ~390px screen, so an operator pans sideways past
        fake window chrome to reach a real dashboard. /ops is a link people
        share, so a phone opens it routinely; reported as unusable on Android.

        The console's own layout is dense and will still want a landscape
        screen for real work — this makes it reachable and legible on a phone,
        which it was not. */
    .dx-desktop-frame  { width: 100dvw !important; height: 100dvh !important;
                         border-radius: 0 !important; box-shadow: none !important; }
    .dx-desktop-chrome { display: none !important; }
  }
`;

// ── Shared primitives ──────────────────────────────────────────────────────
export function Logo({ width = 280 }: { width?: number }) {
  return (
    <ImageWithFallback
      src={logoImg}
      alt="DrippleX"
      style={{ width, height: Math.round(width / 3.03), objectFit: 'contain', display: 'block' }}
    />
  );
}

/** Authored size of the welcome orbit — ring box, in CSS px. */
const HERO_ORBIT = 320;
/** Below this the wordmark stops being legible; matches .dx-hero-slot's min-height. */
const HERO_MIN_SCALE = 0.45;

/**
 * Fits the welcome orbit into the space the layout actually leaves it.
 *
 * This replaces a ladder of `@media (max-height: 780/720/660/600px)` rules,
 * which could not work in principle: the constraint is not the viewport, it
 * is whatever is left after the status bar, the headline, the two buttons,
 * the partner link and the terms line. On the handset this was reported from
 * — 412x817 CSS px — that leftover row is 199px tall while the viewport is
 * 817px, clear of every breakpoint in the ladder. So no rule fired, the slot
 * stayed a rigid 320px, and it overflowed the row by ~60px top and bottom:
 * the shopping-bag tile sat in the status bar and the taxi tile sat on top of
 * "Your Life.". Reproduced at that viewport and measured, not eyeballed.
 *
 * Only measuring the row can know. The authored geometry — 320px box, 134px
 * satellite radius, 192px logo — is untouched and uniformly scaled, so the
 * composition stays exactly as designed in the Figma Make source
 * (docs/reference/figma-super-app-source/screensA.tsx).
 */
export function HeroFit({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      const { width, height } = el.getBoundingClientRect();
      if (!width || !height) return;
      setScale(Math.max(HERO_MIN_SCALE, Math.min(1, width / HERO_ORBIT, height / HERO_ORBIT)));
    };
    fit();
    // Rotation, the keyboard opening, and the WebView's URL bar collapsing all
    // resize this row without a window resize event reaching it reliably.
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, []);

  return (
    <div
      ref={ref}
      className="dx-hero-slot"
      style={{ '--dx-hero-scale': scale } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

export function Ambient() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div
        className="absolute -right-28 -top-28 h-80 w-80 rounded-full"
        style={{ background: `radial-gradient(circle,${G2} 0%,transparent 70%)`, opacity: 0.14 }}
      />
      <div
        className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full"
        style={{ background: `radial-gradient(circle,${G0} 0%,transparent 70%)`, opacity: 0.1 }}
      />
      <div
        className="absolute inset-0"
        style={{
          opacity: 0.027,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
    </div>
  );
}

export function StatusBar({ light }: { light?: boolean } = {}) {
  return (
    <div
      className="dx-status-mock relative z-10 flex w-full items-center justify-between px-7 pt-[52px]"
      style={{
        fontFamily: "'Inter',sans-serif",
        fontSize: 11,
        color: light ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.28)',
      }}
    >
      <span>9:41</span>
      <div className="flex items-center gap-1.5">
        <svg width="17" height="12" viewBox="0 0 17 12" fill="currentColor">
          <rect x="0" y="6" width="3" height="6" rx=".6" opacity=".4" />
          <rect x="4.5" y="3.5" width="3" height="8.5" rx=".6" opacity=".6" />
          <rect x="9" y="1" width="3" height="11" rx=".6" opacity=".85" />
          <rect x="13.5" y="0" width="3" height="12" rx=".6" />
        </svg>
        <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor">
          <path d="M8 9a1.5 1.5 0 110 3 1.5 1.5 0 010-3z" />
          <path d="M2.5 5.5a7.7 7.7 0 0111 0l-1.4 1.4a5.7 5.7 0 00-8.2 0z" opacity=".7" />
          <path d="M.2 3.3a11 11 0 0115.6 0L14.3 4.8a9 9 0 00-12.6 0z" opacity=".4" />
        </svg>
        <svg width="26" height="12" viewBox="0 0 26 12" fill="currentColor">
          <rect
            x=".5"
            y=".5"
            width="22"
            height="11"
            rx="3.5"
            stroke="currentColor"
            strokeOpacity=".35"
            fill="none"
          />
          <rect x="2" y="2" width="17" height="8" rx="2" opacity=".65" />
          <path d="M24 4v4a2 2 0 000-4z" opacity=".4" />
        </svg>
      </div>
    </div>
  );
}

export function BackBtn({
  onPress,
  onClick,
  label = 'Back',
}: {
  onPress?: () => void;
  onClick?: () => void;
  label?: string;
}) {
  const handler = onPress ?? onClick;
  return (
    <button
      onClick={handler}
      className="flex items-center gap-2 text-sm transition-all active:scale-95"
      style={{ fontFamily: "'Inter',sans-serif", color: MUTED, minHeight: 48 }}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
      {label}
    </button>
  );
}

export function GreenBtn({
  label,
  disabled,
  onClick,
  loading,
  icon,
}: {
  label: string;
  disabled?: boolean;
  onClick?: () => void;
  loading?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="flex h-[56px] w-full items-center justify-center gap-2.5 rounded-2xl text-[15px] font-semibold transition-all duration-200"
      style={{
        fontFamily: "'Poppins',sans-serif",
        background:
          disabled || loading
            ? 'rgba(255,255,255,.06)'
            : `linear-gradient(135deg,${G0} 0%,${G2} 52%,${G3} 100%)`,
        color: disabled || loading ? 'rgba(255,255,255,.22)' : 'white',
        boxShadow:
          disabled || loading
            ? 'none'
            : `0 10px 36px rgba(43,172,82,.38),0 0 0 1px rgba(43,172,82,.26)`,
        transform: 'scale(1)',
      }}
      onMouseDown={(e) => {
        if (!disabled && !loading)
          (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)';
      }}
      onMouseUp={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
      }}
    >
      {loading ? (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          style={{ animation: 'spin 1s linear infinite' }}
        >
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" />
        </svg>
      ) : (
        <>
          {label}
          {icon}
        </>
      )}
    </button>
  );
}

export function Divider({ label = 'OR' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,.07)' }} />
      <span
        className="text-xs"
        style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.24)' }}
      >
        {label}
      </span>
      <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,.07)' }} />
    </div>
  );
}

export const ArrowIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
);

/** Google's four-colour "G", drawn rather than fetched so no asset request
 *  blocks the sign-in screen. */
export const GoogleGlyph = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
    />
    <path
      fill="#34A853"
      d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
    />
    <path
      fill="#FBBC05"
      d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"
    />
    <path
      fill="#EA4335"
      d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
    />
  </svg>
);

export const CheckIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

export const COUNTRIES = [
  { flag: '🇳🇬', name: 'Nigeria', code: '+234' },
  { flag: '🇬🇧', name: 'United Kingdom', code: '+44' },
  { flag: '🇺🇸', name: 'United States', code: '+1' },
  { flag: '🇰🇪', name: 'Kenya', code: '+254' },
  { flag: '🇿🇦', name: 'South Africa', code: '+27' },
  { flag: '🇬🇭', name: 'Ghana', code: '+233' },
  { flag: '🇦🇪', name: 'UAE', code: '+971' },
  { flag: '🇮🇳', name: 'India', code: '+91' },
];
