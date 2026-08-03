'use client';

import * as React from 'react';
import { useState } from 'react';

import { BORDER, NAVY_CARD } from '../../tokens/colors';

import { useSuperAppFonts } from './fonts';

export interface SuperAppAccordionItem {
  key: string;
  icon: string;
  title: string;
  body: string;
}

/**
 * Expandable, single-open-at-a-time list card (icon + title + chevron,
 * click to reveal body text), ported from `StorePolicies` in the locked
 * Figma Make Store screen. Kept generic (not "policies"-specific) since
 * this accordion shape is a common pattern (FAQ, help, terms, ...) not
 * unique to store policies.
 */
export function SuperAppAccordionCard({
  title,
  items,
}: {
  title: string;
  items: SuperAppAccordionItem[];
}): React.JSX.Element {
  const { heading, body: bodyFont } = useSuperAppFonts();
  const [openKey, setOpenKey] = useState<string | null>(null);

  return (
    <div className="mb-5 px-4">
      <p className={`mb-3 text-[15px] font-bold ${heading}`} style={{ color: '#FFF' }}>
        {title}
      </p>
      <div
        className="overflow-hidden rounded-3xl"
        style={{ border: `1.5px solid ${BORDER}`, background: NAVY_CARD }}
      >
        {items.map((item, i) => {
          const isOpen = openKey === item.key;
          return (
            <div key={item.key}>
              <button
                type="button"
                onClick={() => {
                  setOpenKey(isOpen ? null : item.key);
                }}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-white/[.025]"
              >
                <div
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl text-[15px]"
                  style={{ background: 'rgba(255,255,255,.06)' }}
                >
                  {item.icon}
                </div>
                <p
                  className={`flex-1 text-[13px] font-semibold ${heading}`}
                  style={{ color: '#FFF' }}
                >
                  {item.title}
                </p>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="rgba(255,255,255,.35)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  style={{
                    transition: 'transform .2s ease',
                    transform: isOpen ? 'rotate(180deg)' : 'none',
                  }}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {isOpen ? (
                <div className="px-4 pb-4" style={{ animation: 'fade-in .15s ease' }}>
                  <p
                    className={`text-[12px] ${bodyFont}`}
                    style={{ color: 'rgba(255,255,255,.58)', lineHeight: 1.65, paddingLeft: 44 }}
                  >
                    {item.body}
                  </p>
                </div>
              ) : null}
              {i < items.length - 1 ? (
                <div style={{ height: 1, background: BORDER, marginLeft: 56, marginRight: 16 }} />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
