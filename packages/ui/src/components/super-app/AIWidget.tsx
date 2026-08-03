'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';

import { BORDER, G0, G2, G3 } from '../../tokens/colors';

import { useSuperAppFonts } from './fonts';

/**
 * "Ask Drip" typewriter widget, ported from Home's `AICard`. `onAsk` is
 * called with the tapped suggestion chip's text (or `undefined` when the
 * main "Ask AI" button is pressed) so the caller decides what happens
 * next (open the sheet, prefill a prompt, etc.).
 */
export function SuperAppAIWidget({
  title = 'Ask Drip',
  subtitle = 'AI · Your personal assistant',
  prompts,
  onAsk,
  typewriterMs = 34,
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
        border: '1.5px solid rgba(43,172,82,.22)',
        boxShadow: '0 4px 32px rgba(43,172,82,.08)',
      }}
    >
      <div className="p-4">
        <div className="mb-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl"
              style={{
                background: `linear-gradient(135deg,${G0},${G3})`,
                boxShadow: '0 6px 20px rgba(43,172,82,.38)',
                animation: 'avatar-pulse 3s ease-in-out infinite',
              }}
            >
              <span style={{ fontSize: 20 }}>✨</span>
            </div>
            <div>
              <p
                className={`text-[15px] font-bold leading-tight ${heading}`}
                style={{ color: '#FFF' }}
              >
                {title}
              </p>
              <p className={`text-[10px] ${body}`} style={{ color: G3 }}>
                {subtitle}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: G3, animation: 'pulse-ring 1.8s ease-out infinite' }}
            />
            <p className={`text-[9px] font-medium ${body}`} style={{ color: G3 }}>
              Online
            </p>
          </div>
        </div>
        <div
          className="mb-3.5 flex min-h-[46px] items-center rounded-2xl px-4 py-3"
          style={{ background: 'rgba(43,172,82,.07)', border: '1px solid rgba(43,172,82,.14)' }}
        >
          <p className={`flex-1 text-[12px] ${body}`} style={{ color: 'rgba(255,255,255,.72)' }}>
            {prompt.slice(0, chars)}
            <span
              style={{
                opacity: chars < prompt.length ? 1 : 0,
                animation: chars < prompt.length ? 'fade-in .4s ease infinite alternate' : 'none',
              }}
            >
              |
            </span>
          </p>
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          {prompts.slice(0, 4).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                onAsk(s);
              }}
              className={`rounded-full px-3 py-1.5 text-[10px] font-medium transition-transform active:scale-95 ${body}`}
              style={{
                background: 'rgba(255,255,255,.055)',
                color: 'rgba(255,255,255,.58)',
                border: `1px solid ${BORDER}`,
              }}
            >
              {s.length > 22 ? `${s.slice(0, 20)}…` : s}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            onAsk();
          }}
          className={`active:scale-97 flex h-[46px] w-full items-center justify-center gap-2 rounded-2xl text-[14px] font-semibold transition-transform ${heading}`}
          style={{
            background: `linear-gradient(135deg,${G0} 0%,${G2} 55%,${G3} 100%)`,
            color: '#FFF',
            boxShadow: '0 8px 24px rgba(43,172,82,.3)',
          }}
        >
          <span>✨</span>Ask AI
        </button>
      </div>
    </div>
  );
}
