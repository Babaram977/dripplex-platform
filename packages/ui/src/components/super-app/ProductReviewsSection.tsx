'use client';

import * as React from 'react';
import { useState } from 'react';

import { BORDER, G2, G3, MUTED, NAVY_CARD } from '../../tokens/colors';

import { useSuperAppFonts } from './fonts';

export interface SuperAppProductReview {
  id: string;
  /**
   * The backend's public review list (`GET /reviews`) doesn't currently
   * join author display info onto `ReviewDto` (only `authorId`) — pass a
   * resolved name/initials when the caller has one, otherwise this falls
   * back to an anonymized label.
   * TODO: once the reviews API exposes author name/avatar, wire it here.
   */
  authorName?: string | undefined;
  authorInitials?: string | undefined;
  avatarBackground?: string | undefined;
  rating: number;
  date: string;
  comment: string;
  merchantReply?: string | undefined;
}

export type SuperAppReviewSort = 'recent' | 'highest' | 'lowest';

function Stars({ n, size = 12 }: { n: number; size?: number }): React.JSX.Element {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill={i <= n ? '#F59E0B' : 'rgba(255,255,255,.15)'}
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  );
}

/**
 * Reviews section with rating-breakdown bars, sort control, and
 * per-review expand/collapse for long comments, ported from
 * `ReviewsSection` in the locked Figma Make Product Detail screen. Data
 * shape matches the real backend's `ReviewAggregateDto`
 * (rating1..rating5 counts) rather than the source's mock
 * `ratingBreakdown` array.
 */
export function SuperAppProductReviewsSection({
  title = 'Customer Reviews',
  averageRating,
  reviewCount,
  breakdown,
  reviews,
  sort,
  onSortChange,
}: {
  title?: string | undefined;
  averageRating: number;
  reviewCount: number;
  breakdown: [count5: number, count4: number, count3: number, count2: number, count1: number];
  reviews: SuperAppProductReview[];
  sort: SuperAppReviewSort;
  onSortChange?: ((sort: SuperAppReviewSort) => void) | undefined;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  const [expanded, setExpanded] = useState<string | null>(null);
  const total = breakdown.reduce((a, b) => a + b, 0);

  return (
    <div className="mb-6 flex flex-col gap-4 px-5">
      <p className={`text-[14px] font-semibold text-white ${heading}`}>{title}</p>
      <div
        className="flex items-start gap-5 rounded-2xl p-4"
        style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
      >
        <div className="flex flex-col items-center gap-1">
          <span className={`text-[40px] font-bold leading-none text-white ${heading}`}>
            {averageRating.toFixed(1)}
          </span>
          <Stars n={Math.round(averageRating)} size={14} />
          <span className={`text-[11px] ${body}`} style={{ color: MUTED }}>
            {reviewCount.toLocaleString()} reviews
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          {([5, 4, 3, 2, 1] as const).map((star, i) => {
            const count = breakdown[i] ?? 0;
            const pct = total > 0 ? (count / total) * 100 : 0;
            return (
              <div key={star} className="flex items-center gap-2">
                <span className={`w-2 text-right text-[11px] ${body}`} style={{ color: MUTED }}>
                  {star}
                </span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="#F59E0B">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                <div
                  className="h-1.5 flex-1 overflow-hidden rounded-full"
                  style={{ background: 'rgba(255,255,255,.08)' }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${String(pct)}%`,
                      background: star >= 4 ? G2 : star === 3 ? '#F59E0B' : '#EF4444',
                    }}
                  />
                </div>
                <span className={`w-6 text-right text-[10px] ${body}`} style={{ color: MUTED }}>
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex gap-2">
        {(
          [
            ['recent', 'Most Recent'],
            ['highest', 'Highest'],
            ['lowest', 'Lowest'],
          ] as [SuperAppReviewSort, string][]
        ).map(([key, sortLabel]) => (
          <button
            key={key}
            type="button"
            onClick={
              onSortChange
                ? () => {
                    onSortChange(key);
                  }
                : undefined
            }
            className={`h-[28px] rounded-full px-3 text-[11px] font-semibold transition-all ${body}`}
            style={{
              background: sort === key ? G2 : 'rgba(255,255,255,.06)',
              border: `1px solid ${sort === key ? G2 : BORDER}`,
              color: sort === key ? '#FFF' : MUTED,
            }}
          >
            {sortLabel}
          </button>
        ))}
      </div>

      {reviews.map((rv) => {
        const isExp = expanded === rv.id;
        return (
          <div
            key={rv.id}
            className="flex flex-col gap-3 rounded-2xl p-4"
            style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
          >
            <div className="flex items-start gap-3">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white ${heading}`}
                style={{ background: rv.avatarBackground ?? 'rgba(255,255,255,.08)' }}
              >
                {rv.authorInitials ?? '★'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[13px] font-semibold text-white ${heading}`}>
                    {rv.authorName ?? 'Verified Customer'}
                  </span>
                  <span className={`text-[11px] ${body}`} style={{ color: MUTED }}>
                    {rv.date}
                  </span>
                </div>
                <Stars n={rv.rating} />
              </div>
            </div>
            <p
              className={`text-[13px] leading-relaxed ${body}`}
              style={{ color: 'rgba(255,255,255,.7)' }}
            >
              {isExp || rv.comment.length <= 100 ? rv.comment : `${rv.comment.slice(0, 100)}…`}
              {rv.comment.length > 100 ? (
                <button
                  type="button"
                  onClick={() => {
                    setExpanded(isExp ? null : rv.id);
                  }}
                  className="ml-1 font-semibold"
                  style={{ color: G3 }}
                >
                  {isExp ? 'less' : 'more'}
                </button>
              ) : null}
            </p>
            {rv.merchantReply ? (
              <div
                className="flex items-start gap-2 rounded-xl px-3 py-2.5"
                style={{
                  background: 'rgba(43,172,82,.07)',
                  border: '1px solid rgba(43,172,82,.15)',
                }}
              >
                <div
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-white"
                  style={{ background: `linear-gradient(135deg,${G2},${G3})` }}
                >
                  💬
                </div>
                <div>
                  <p className={`mb-0.5 text-[10px] font-bold ${body}`} style={{ color: G3 }}>
                    Merchant replied
                  </p>
                  <p
                    className={`text-[12px] leading-relaxed ${body}`}
                    style={{ color: 'rgba(255,255,255,.55)' }}
                  >
                    {rv.merchantReply}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
