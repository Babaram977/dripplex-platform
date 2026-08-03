'use client';

import * as React from 'react';
import { useRef, useState } from 'react';

import { NAVY_BASE } from '../../tokens/colors';

export interface SuperAppGalleryImage {
  /** Real product photo URL. `null` renders the same emoji placeholder used elsewhere when no photo exists. */
  url: string | null;
}

/**
 * Swipeable product image gallery with back/share/favorite buttons, a
 * discount badge overlay, and dot indicators, ported from `Gallery` in
 * the locked Figma Make Product Detail screen. The source renders each
 * slide as an emoji on a gradient background (`{emoji, background}`);
 * real `ProductImageDto`s are photos, so this renders an `<img>` instead
 * and falls back to a placeholder emoji only when a product has no images
 * at all.
 */
export function SuperAppProductGallery({
  images,
  badge,
  badgeColor,
  favorited = false,
  onBack,
  onShare,
  onToggleFavorite,
}: {
  images: SuperAppGalleryImage[];
  badge?: string | undefined;
  badgeColor?: string | undefined;
  favorited?: boolean | undefined;
  onBack?: (() => void) | undefined;
  onShare?: (() => void) | undefined;
  onToggleFavorite?: (() => void) | undefined;
}): React.JSX.Element {
  const [idx, setIdx] = useState(0);
  const startX = useRef(0);

  const onTouchStart = (e: React.TouchEvent): void => {
    startX.current = e.touches[0]?.clientX ?? 0;
  };
  const onTouchEnd = (e: React.TouchEvent): void => {
    const dx = (e.changedTouches[0]?.clientX ?? 0) - startX.current;
    if (Math.abs(dx) > 40) {
      setIdx((i) => (dx < 0 ? Math.min(i + 1, images.length - 1) : Math.max(i - 1, 0)));
    }
  };

  return (
    <div
      className="relative w-full"
      style={{ height: 280 }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {images.map((img, i) => (
        <div
          key={i}
          className="absolute inset-0 flex items-center justify-center overflow-hidden transition-opacity duration-300"
          style={{
            background: 'linear-gradient(145deg,#1e2d44,#243347)',
            opacity: idx === i ? 1 : 0,
          }}
        >
          {img.url ? (
            <img src={img.url} alt="" className="h-full w-full object-cover" />
          ) : (
            <span
              style={{
                fontSize: 96,
                opacity: 0.3,
                filter: 'drop-shadow(0 16px 32px rgba(0,0,0,.35))',
              }}
            >
              📦
            </span>
          )}
        </div>
      ))}

      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-24"
        style={{ background: 'linear-gradient(to bottom,rgba(0,0,0,.45),transparent)' }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-20"
        style={{ background: `linear-gradient(to top,${NAVY_BASE},transparent)` }}
      />

      <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between px-5 pt-14">
        <button
          type="button"
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-full transition-all active:scale-90"
          style={{ background: 'rgba(0,0,0,.38)', backdropFilter: 'blur(8px)' }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onShare}
            aria-label="Share"
            className="flex h-10 w-10 items-center justify-center rounded-full transition-all active:scale-90"
            style={{ background: 'rgba(0,0,0,.38)', backdropFilter: 'blur(8px)' }}
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onToggleFavorite}
            aria-label="Toggle favorite"
            className="flex h-10 w-10 items-center justify-center rounded-full transition-all active:scale-90"
            style={{
              background: favorited ? 'rgba(239,68,68,.75)' : 'rgba(0,0,0,.38)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill={favorited ? 'white' : 'none'}
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>
        </div>
      </div>

      {badge ? (
        <div
          className="absolute left-5 top-16 z-10 rounded-full px-3 py-1 text-[11px] font-bold text-white"
          style={{ background: badgeColor }}
        >
          {badge}
        </div>
      ) : null}

      <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5">
        {images.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => {
              setIdx(i);
            }}
            className="rounded-full transition-all duration-200"
            style={{
              width: idx === i ? 16 : 6,
              height: 6,
              background: idx === i ? '#FFF' : 'rgba(255,255,255,.38)',
            }}
          />
        ))}
      </div>
    </div>
  );
}
