'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';

import { BORDER, G0, G2, G3 } from '../../tokens/colors';

import { useSuperAppFonts } from './fonts';

/**
 * Marketplace's "Ask Drip" search-discovery banner, ported from
 * `AIDiscovery` in the locked Figma Make Marketplace screen. Visually
 * distinct from `SuperAppAIWidget` (Home's widget) — smaller avatar, a
 * search icon inside the typewriter box, "Live" status instead of
 * "Online" — so it's its own component rather than a reskin.
 */
export function SuperAppAIDiscoveryBanner({
  title = 'Ask Drip',
  subtitle = 'Describe what you need',
  prompts,
  onAsk,
  typewriterMs = 36,
  rotateMs = 4000,
}: {
  title?: string | undefined;
  subtitle?: string | undefined;
  prompts: string[];
  onAsk: (prompt?: string) => void;
  typewriterMs?: number | undefined;
  rotateMs?: number | undefined;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  const [idx, setIdx] = useState(0);
  const [chars, setChars] = useState(0);
  const prompt = prompts[idx] ?? '';

  useEffect(() => {
    const t = setInterval(() => {
      setIdx((i) => (i + 1) % prompts.length);
      setChars(0);
    }, rotateMs);
    return () => {
      clearInterval(t);
    };
  }, [prompts.length, rotateMs]);

  useEffect(() => {
    if (chars >= prompt.length) return;
    const t = setTimeout(() => {
      setChars((c) => c + 1);
    }, typewriterMs);
    return () => {
      clearTimeout(t);
    };
  }, [chars, prompt, typewriterMs]);

  return (
    <div
      className="mx-5 mb-5 overflow-hidden rounded-3xl"
      style={{
        background: 'linear-gradient(135deg,#0A1628 0%,#0E1F38 100%)',
        border: '1.5px solid rgba(43,172,82,.2)',
        boxShadow: '0 4px 32px rgba(43,172,82,.07)',
      }}
    >
      <div className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-2xl"
              style={{
                background: `linear-gradient(135deg,${G0},${G3})`,
                boxShadow: '0 4px 16px rgba(43,172,82,.35)',
                animation: 'avatar-pulse 3s ease-in-out infinite',
              }}
            >
              <span style={{ fontSize: 18 }}>✨</span>
            </div>
            <div>
              <p className={`text-[14px] font-bold ${heading}`} style={{ color: '#FFF' }}>
                {title}
              </p>
              <p className={`text-[10px] ${body}`} style={{ color: G3 }}>
                {subtitle}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <div
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: G3, animation: 'pulse-ring 1.8s ease-out infinite' }}
            />
            <p className={`text-[9px] font-medium ${body}`} style={{ color: G3 }}>
              Live
            </p>
          </div>
        </div>

        <div
          className="mb-3 flex min-h-[40px] items-center rounded-xl px-3.5 py-2.5"
          style={{ background: 'rgba(43,172,82,.07)', border: '1px solid rgba(43,172,82,.14)' }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke={G3}
            strokeWidth="2"
            strokeLinecap="round"
            className="mr-2 flex-shrink-0 opacity-55"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <p className={`flex-1 text-[11.5px] ${body}`} style={{ color: 'rgba(255,255,255,.7)' }}>
            {prompt.slice(0, chars)}
            <span style={{ opacity: chars < prompt.length ? 1 : 0 }}>|</span>
          </p>
        </div>

        <div className="mb-3.5 flex flex-wrap gap-1.5">
          {prompts.slice(0, 4).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                onAsk(s);
              }}
              className={`rounded-full px-2.5 py-1.5 text-[10px] font-medium transition-all active:scale-95 ${body}`}
              style={{
                background: 'rgba(255,255,255,.055)',
                color: 'rgba(255,255,255,.55)',
                border: `1px solid ${BORDER}`,
              }}
            >
              {s.length > 24 ? `${s.slice(0, 22)}…` : s}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            onAsk();
          }}
          className={`active:scale-97 flex h-11 w-full items-center justify-center gap-2 rounded-2xl text-[13px] font-semibold transition-all ${heading}`}
          style={{
            background: `linear-gradient(135deg,${G0},${G2} 55%,${G3})`,
            color: '#FFF',
            boxShadow: '0 6px 22px rgba(43,172,82,.28)',
          }}
        >
          <span>✨</span>Ask AI
        </button>
      </div>
    </div>
  );
}
