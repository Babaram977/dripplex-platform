import { BORDER, G3, MUTED } from '../../tokens/colors';

import { useSuperAppFonts } from './fonts';

/**
 * +/- quantity counter, ported from the qty controls in the locked Figma
 * Make Product Detail screen. Used twice there with two distinct specs —
 * inline ("default": pill-background buttons, greys out at min) and in
 * the sticky action bar ("compact": bare icon buttons, decrement always
 * muted regardless of min) — the reason this is a standalone component
 * with a `size` prop rather than two copies.
 */
export function SuperAppQuantityStepper({
  quantity,
  onDecrement,
  onIncrement,
  size = 'default',
}: {
  quantity: number;
  onDecrement?: (() => void) | undefined;
  onIncrement?: (() => void) | undefined;
  size?: 'default' | 'compact' | undefined;
}): React.JSX.Element {
  const { heading } = useSuperAppFonts();
  const atMin = quantity <= 1;
  const iconSize = size === 'compact' ? 16 : 14;

  return (
    <div className={`flex items-center ${size === 'compact' ? 'gap-3' : 'gap-4'}`}>
      <button
        type="button"
        onClick={onDecrement}
        aria-label="Decrease quantity"
        className={
          size === 'default'
            ? 'flex h-9 w-9 items-center justify-center rounded-xl transition-all active:scale-90'
            : 'transition-all active:scale-90'
        }
        style={
          size === 'default'
            ? {
                background: atMin ? 'rgba(255,255,255,.04)' : 'rgba(43,172,82,.14)',
                border: `1.5px solid ${atMin ? BORDER : 'rgba(43,172,82,.3)'}`,
              }
            : undefined
        }
      >
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 24 24"
          fill="none"
          stroke={size === 'default' ? (atMin ? MUTED : G3) : MUTED}
          strokeWidth="2.5"
          strokeLinecap="round"
        >
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
      <span
        className={`text-center font-bold text-white ${heading}`}
        style={{ width: size === 'compact' ? 20 : 24, fontSize: size === 'compact' ? 16 : 18 }}
      >
        {quantity}
      </span>
      <button
        type="button"
        onClick={onIncrement}
        aria-label="Increase quantity"
        className={
          size === 'default'
            ? 'flex h-9 w-9 items-center justify-center rounded-xl transition-all active:scale-90'
            : 'transition-all active:scale-90'
        }
        style={
          size === 'default'
            ? { background: 'rgba(43,172,82,.14)', border: '1.5px solid rgba(43,172,82,.3)' }
            : undefined
        }
      >
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 24 24"
          fill="none"
          stroke={G3}
          strokeWidth="2.5"
          strokeLinecap="round"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  );
}
