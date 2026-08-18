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
      className="relative z-10 flex w-full items-center justify-between px-7 pt-[52px]"
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
