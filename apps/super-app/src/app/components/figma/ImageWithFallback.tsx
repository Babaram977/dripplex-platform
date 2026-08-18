import React, { useEffect, useState } from 'react';

/**
 * Image that degrades gracefully. When the src is missing OR fails to load, it
 * renders a clean centered emoji on a subtle surface instead of a broken-image
 * icon — which is what used to happen (a light-gray box with a picture-frame
 * glyph that clashed with the dark UI and read as "broken"). The fallback emoji
 * defaults to a shopping bag but can be overridden per surface (e.g. a food
 * category can pass 🍛). didError resets whenever src changes, so a product that
 * gets a working photo (re-upload) recovers without a remount.
 */
export function ImageWithFallback(
  props: React.ImgHTMLAttributes<HTMLImageElement> & { fallbackEmoji?: string },
) {
  const [didError, setDidError] = useState(false);
  const { src, alt, style, className, fallbackEmoji = '🛍️', ...rest } = props;

  useEffect(() => {
    setDidError(false);
  }, [src]);

  const hasSrc =
    typeof src === 'string' && src.trim() !== '' && src !== 'undefined' && src !== 'null';

  if (didError || !hasSrc) {
    return (
      // dx-img-fallback scales the emoji to the box it lands in. It used to be
      // a flat 2.25rem everywhere, which overflowed a 40px avatar slot and
      // floated undersized in an 82px banner — the same glyph looking wrong at
      // both ends. See styles/fonts.css for the container rule.
      <div
        className={['dx-img-fallback', className].filter(Boolean).join(' ')}
        style={{
          ...style,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(148, 163, 184, 0.12)',
        }}
        role="img"
        aria-label={typeof alt === 'string' && alt ? alt : 'No image available'}
      >
        <span style={{ lineHeight: 1, opacity: 0.9 }} aria-hidden="true">
          {fallbackEmoji}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      // Decode off the main thread so a large merchant logo cannot stall the
      // frame it appears in. Callers can still override via props.
      decoding="async"
      {...rest}
      onError={() => setDidError(true)}
    />
  );
}
