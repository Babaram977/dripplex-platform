'use client';

import * as React from 'react';
import { useState } from 'react';

import { BORDER, G2, G3, MUTED, NAVY_CARD } from '../../tokens/colors';

import { useSuperAppFonts } from './fonts';

export interface SuperAppReview {
  key: string;
  name: string;
  initials: string;
  rating: number;
  date: string;
  comment: string;
  reply?: string;
  avatarBackground: string;
}

export interface SuperAppRatingBreakdown {
  stars: 5 | 4 | 3 | 2 | 1;
  percent: number;
}

/**
 * Reviews section (rating summary bar + expandable review list), ported
 * from `ReviewsSection` in the locked Figma Make Store screen. Manages
 * its own expand/collapse state internally, matching the source.
 */
export function SuperAppReviewsSection({
  rating,
  reviewCount,
  breakdown,
  reviews,
  collapsedCount = 2,
}: {
  rating: number;
  reviewCount: number;
  breakdown: SuperAppRatingBreakdown[];
  reviews: SuperAppReview[];
  collapsedCount?: number | undefined;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? reviews : reviews.slice(0, collapsedCount);

  return (
    <div className="mb-5 px-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className={`text-[15px] font-bold ${heading}`} style={{ color: '#FFF' }}>
            Reviews
          </p>
          <p className={`mt-0.5 text-[10px] ${body}`} style={{ color: MUTED }}>
            ★ {rating} · {reviewCount.toLocaleString()} ratings
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setExpanded((e) => !e);
          }}
          className={`text-[12px] font-semibold ${body}`}
          style={{ color: G3 }}
        >
          {expanded ? 'Show less' : 'See all →'}
        </button>
      </div>

      <div
        className="mb-3 rounded-2xl p-4"
        style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
      >
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-center">
            <p
              className={`text-[36px] font-extrabold leading-none ${heading}`}
              style={{ color: '#FFF' }}
            >
              {rating}
            </p>
            <p className="mt-0.5 text-[10px]" style={{ color: '#FBBF24' }}>
              ★★★★★
            </p>
            <p className={`mt-0.5 text-[9px] ${body}`} style={{ color: MUTED }}>
              {reviewCount.toLocaleString()}
            </p>
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            {breakdown.map((b) => (
              <div key={b.stars} className="flex items-center gap-2">
                <p className={`w-2 text-[9px] ${body}`} style={{ color: MUTED }}>
                  {b.stars}
                </p>
                <div
                  className="flex-1 overflow-hidden rounded-full"
                  style={{ height: 5, background: 'rgba(255,255,255,.08)' }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${String(b.percent)}%`,
                      background: b.stars >= 4 ? G2 : b.stars === 3 ? '#F59E0B' : '#EF4444',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {visible.map((r) => (
          <div
            key={r.key}
            className="rounded-2xl p-3.5"
            style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
          >
            <div className="mb-2 flex items-start gap-3">
              <div
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl"
                style={{ background: r.avatarBackground }}
              >
                <p className={`text-[12px] font-bold ${heading}`} style={{ color: '#FFF' }}>
                  {r.initials}
                </p>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className={`text-[12px] font-semibold ${heading}`} style={{ color: '#FFF' }}>
                    {r.name}
                  </p>
                  <p className={`text-[9.5px] ${body}`} style={{ color: MUTED }}>
                    {r.date}
                  </p>
                </div>
                <p className="text-[10px]" style={{ color: '#FBBF24' }}>
                  {'★'.repeat(r.rating)}
                  {'☆'.repeat(5 - r.rating)}
                </p>
              </div>
            </div>
            <p
              className={`text-[11.5px] ${body}`}
              style={{
                color: 'rgba(255,255,255,.72)',
                lineHeight: 1.6,
                marginBottom: r.reply ? 10 : 0,
              }}
            >
              {r.comment}
            </p>
            {r.reply ? (
              <div
                className="mt-2 rounded-xl p-2.5"
                style={{
                  background: 'rgba(43,172,82,.07)',
                  border: '1px solid rgba(43,172,82,.15)',
                }}
              >
                <p className={`mb-0.5 text-[9px] font-bold ${body}`} style={{ color: G3 }}>
                  💬 Merchant Reply
                </p>
                <p
                  className={`text-[11px] ${body}`}
                  style={{ color: 'rgba(255,255,255,.6)', lineHeight: 1.55 }}
                >
                  {r.reply}
                </p>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
