import { DripplexLogo } from '@dripplex/ui';
import Link from 'next/link';
import * as React from 'react';

import { siteConfig } from '@/lib/site';

// Locked Figma palette (docs/reference/figma-super-app-source/tokens/colors.ts)
const NAVY_DEEP = '#060E1C';
const NAVY_BASE = '#0A1628';
const NAVY_CARD = '#0D1B2E';
const NAVY_SURFACE = '#112238';
const G2 = '#2BAC52';
const G3 = '#47CF72';
const BORDER = 'rgba(255,255,255,.08)';
const MUTED = 'rgba(255,255,255,.55)';

/**
 * Orbiting icons placed on a circle, matching the Figma Make WelcomeScreen
 * (docs/reference/figma-super-app-source/screensA.tsx). Angles/radius and the
 * per-icon float animation are ported verbatim.
 */
const ORBIT_ICONS = [
  { icon: '🛍️', angle: -68, anim: 'float-a', dur: '3.2s' },
  { icon: '🚖', angle: 54, anim: 'float-b', dur: '4.0s' },
  { icon: '💳', angle: 174, anim: 'float-c', dur: '3.6s' },
] as const;

const ORBIT_RADIUS = 134;

export function HeroSection(): React.JSX.Element {
  return (
    <section
      className="relative isolate flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-6 py-20"
      style={{
        background: `linear-gradient(155deg,${NAVY_DEEP} 0%,${NAVY_BASE} 55%,#0B1D2F 100%)`,
      }}
    >
      {/* Ambient brand glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: `radial-gradient(ellipse 60% 45% at 50% 22%, rgba(43,172,82,.18), transparent 60%)`,
        }}
      />

      {/* ── Revolving circle: concentric orbit rings + glowing logo + floating icons ── */}
      <div
        className="relative flex items-center justify-center"
        style={{ animation: 'fade-in .55s ease .15s both' }}
      >
        <div
          className="relative flex items-center justify-center"
          style={{ width: 320, height: 320 }}
        >
          {/* outer ring — slow clockwise */}
          <div
            aria-hidden="true"
            className="absolute inset-0 rounded-full"
            style={{
              border: '1px solid rgba(43,172,82,.11)',
              animation: 'orbit-cw 32s linear infinite',
            }}
          />
          {/* mid ring — green arc, counter-clockwise (the visible revolving arc) */}
          <div
            aria-hidden="true"
            className="absolute rounded-full"
            style={{
              inset: 18,
              borderTop: `1.5px solid ${G2}`,
              borderRight: '1.5px solid transparent',
              borderBottom: '1.5px solid transparent',
              borderLeft: '1.5px solid transparent',
              animation: 'orbit-ccw 9s linear infinite',
              boxShadow: '0 0 10px rgba(43,172,82,.2)',
            }}
          />
          {/* inner ring — slow clockwise */}
          <div
            aria-hidden="true"
            className="absolute rounded-full"
            style={{
              inset: 42,
              border: '1px solid rgba(43,172,82,.06)',
              animation: 'orbit-cw 22s linear infinite',
            }}
          />
          {/* center logo — pulsing glow ring */}
          <div
            className="relative z-10 flex items-center justify-center rounded-2xl px-5 py-4"
            style={{
              background: `linear-gradient(145deg,${NAVY_SURFACE},${NAVY_CARD})`,
              animation: 'glow-ring 4s ease-in-out infinite',
            }}
          >
            {/* This panel is hard-coded navy, so the wordmark cannot inherit
                `text-foreground` — in light theme that resolves to near-black
                and the word "Dripplex" all but disappears into the card. The
                mark beside it is an inline SVG and stays sharp either way,
                which is why this reads as a blurry logo rather than an
                invisible one. Same fix the auth layout already uses. */}
            <DripplexLogo invertWordmark className="text-primary-foreground" />
          </div>
          {/* orbiting floating icons */}
          {ORBIT_ICONS.map(({ icon, angle, anim, dur }) => {
            const rad = (angle * Math.PI) / 180;
            return (
              <div
                key={angle}
                aria-hidden="true"
                className="absolute"
                style={{
                  transform: `translate(${(Math.cos(rad) * ORBIT_RADIUS).toFixed(2)}px,${(Math.sin(rad) * ORBIT_RADIUS).toFixed(2)}px)`,
                }}
              >
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl"
                  style={{
                    background: `linear-gradient(145deg,${NAVY_SURFACE},${NAVY_CARD})`,
                    boxShadow: '0 0 0 1px rgba(43,172,82,.16),0 10px 28px rgba(0,0,0,.45)',
                    animation: `${anim} ${dur} ease-in-out infinite`,
                  }}
                >
                  {icon}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Copy + CTAs ── */}
      <div
        className="relative z-10 mt-10 flex w-full max-w-md flex-col gap-5 text-center"
        style={{ animation: 'fade-up .65s ease .3s both' }}
      >
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-[34px] font-bold leading-[1.15] tracking-tight text-white sm:text-5xl">
            Your Life.
            <br />
            <span style={{ color: G3 }}>One App.</span>
          </h1>
          <p className="text-sm leading-relaxed sm:text-base" style={{ color: MUTED }}>
            Shop, ride, pay, and manage your day — all in one beautifully connected app.
          </p>
        </div>

        <div className="flex flex-col gap-3 pt-1">
          <Link
            href={siteConfig.links.register}
            className="flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold text-white transition-transform active:scale-[0.97]"
            style={{
              fontFamily: 'var(--font-display)',
              background: `linear-gradient(135deg,${G2},${G3})`,
              boxShadow: '0 10px 40px rgba(43,172,82,.38)',
            }}
          >
            Get Started
            <span aria-hidden="true">→</span>
          </Link>
          <Link
            href={siteConfig.links.login}
            className="flex h-[52px] w-full items-center justify-center rounded-2xl text-[15px] font-medium transition-transform active:scale-[0.97]"
            style={{
              color: 'rgba(255,255,255,.55)',
              background: 'rgba(255,255,255,.045)',
              border: `1.5px solid ${BORDER}`,
            }}
          >
            I already have an account
          </Link>
        </div>
      </div>
    </section>
  );
}
