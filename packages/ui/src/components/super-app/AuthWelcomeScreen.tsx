'use client';

import * as React from 'react';

import { dripplexMarkSvg } from '../../brand/dripplex-mark';

import { SuperAppAuthAmbient, SuperAppAuthStatusBar } from './AuthChrome';
import { SuperAppAuthArrowIcon, SuperAppAuthGreenButton } from './AuthPrimitives';
import { useSuperAppFonts } from './fonts';

const FLOATING_ICONS = [
  { icon: '🛍️', angle: -68, anim: 'float-a', dur: '3.2s' },
  { icon: '🚖', angle: 54, anim: 'float-b', dur: '4.0s' },
  { icon: '💳', angle: 174, anim: 'float-c', dur: '3.6s' },
] as const;

/**
 * Ported from the locked Figma Make `screensA.tsx`'s `WelcomeScreen`
 * (AUTH-002) -- orbiting rings + floating service icons around the brand
 * mark, "Your Life. One App." headline, Get Started / Sign In entry.
 *
 * This is the mobile-app-style onboarding entry point (distinct from the
 * desktop marketing homepage's `HeroSection` -- same relationship as
 * `/ride` and `/wallet` to the rest of the site: a full-bleed 480px shell
 * that reproduces the Figma source directly, not a marketing page).
 */
export function SuperAppAuthWelcomeScreen({
  onGetStarted,
  onSignIn,
}: {
  onGetStarted: () => void;
  onSignIn: () => void;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  return (
    <div
      className="relative flex h-full min-h-dvh w-full flex-col overflow-hidden"
      style={{ background: 'linear-gradient(155deg,#060E1C 0%,#0A1628 55%,#0B1D2F 100%)' }}
    >
      <SuperAppAuthAmbient />
      <SuperAppAuthStatusBar />
      <div
        className="relative z-10 flex flex-1 items-center justify-center"
        style={{ animation: 'fade-in .55s ease .15s both' }}
      >
        <div
          className="relative flex items-center justify-center"
          style={{ width: 320, height: 320 }}
        >
          <div
            className="absolute inset-0 rounded-full"
            style={{
              border: '1px solid rgba(43,172,82,.11)',
              animation: 'orbit-cw 32s linear infinite',
            }}
          />
          <div
            className="absolute rounded-full"
            style={{
              inset: 18,
              borderTop: '1.5px solid #2BAC52',
              borderRight: '1.5px solid transparent',
              borderBottom: '1.5px solid transparent',
              borderLeft: '1.5px solid transparent',
              borderRadius: '50%',
              animation: 'orbit-ccw 9s linear infinite',
              boxShadow: '0 0 10px rgba(43,172,82,.2)',
            }}
          />
          <div
            className="absolute rounded-full"
            style={{
              inset: 42,
              border: '1px solid rgba(43,172,82,.06)',
              animation: 'orbit-cw 22s linear infinite',
            }}
          />
          <div
            className="relative z-10 flex items-center justify-center rounded-2xl px-5 py-4"
            style={{
              background: 'linear-gradient(145deg,#112238,#0D1B2E)',
              animation: 'glow-ring 4s ease-in-out infinite',
            }}
          >
            <span
              aria-hidden="true"
              className="block h-16 w-[19.1vw] max-w-[76px]"
              dangerouslySetInnerHTML={{ __html: dripplexMarkSvg }}
            />
          </div>
          {FLOATING_ICONS.map(({ icon, angle, anim, dur }) => {
            const rad = (angle * Math.PI) / 180;
            const r = 134;
            return (
              <div
                key={angle}
                className="absolute"
                style={{
                  transform: `translate(${(Math.cos(rad) * r).toFixed(2)}px,${(Math.sin(rad) * r).toFixed(2)}px)`,
                }}
              >
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl"
                  style={{
                    background: 'linear-gradient(145deg,#112238,#0D1B2E)',
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
      <div
        className="relative z-10 flex flex-col gap-5 px-7 pb-10"
        style={{ animation: 'fade-up .65s ease .3s both' }}
      >
        <div className="flex flex-col gap-2">
          <h1
            className={`text-[32px] font-bold leading-[1.15] text-white ${heading}`}
            style={{ letterSpacing: '-0.025em' }}
          >
            Your Life.
            <br />
            <span style={{ color: '#47CF72' }}>One App.</span>
          </h1>
          <p
            className={`text-[14px] leading-relaxed ${body}`}
            style={{ color: 'rgba(255,255,255,.38)' }}
          >
            Shop, ride, pay, and manage your day — all in one beautifully connected app.
          </p>
        </div>
        <div className="flex flex-col gap-3 pt-1">
          <SuperAppAuthGreenButton
            label="Get Started"
            onClick={onGetStarted}
            icon={<SuperAppAuthArrowIcon />}
          />
          <button
            type="button"
            onClick={onSignIn}
            className={`flex h-[52px] w-full items-center justify-center rounded-2xl text-[15px] font-medium transition-all active:scale-[0.97] ${heading}`}
            style={{
              color: 'rgba(255,255,255,.55)',
              background: 'rgba(255,255,255,.045)',
              border: '1.5px solid rgba(255,255,255,.08)',
            }}
          >
            I already have an account
          </button>
        </div>
        <p className={`text-center text-[11px] ${body}`} style={{ color: 'rgba(255,255,255,.2)' }}>
          By continuing you agree to our{' '}
          <span className="underline underline-offset-2" style={{ color: '#2BAC52' }}>
            Terms
          </span>{' '}
          &amp;{' '}
          <span className="underline underline-offset-2" style={{ color: '#2BAC52' }}>
            Privacy Policy
          </span>
        </p>
      </div>
    </div>
  );
}
