import { BORDER, G0, G2, G3 } from '../../tokens/colors';

import { useSuperAppFonts } from './fonts';

/**
 * Empty-cart state, ported verbatim from `EmptyCart` in the locked Figma
 * Make Cart screen.
 */
export function SuperAppCartEmptyState({
  onBrowse,
}: {
  onBrowse?: (() => void) | undefined;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-8 py-16">
      <div className="relative">
        <div
          className="flex h-28 w-28 items-center justify-center rounded-full"
          style={{ background: 'rgba(255,255,255,.04)', border: `1.5px solid ${BORDER}` }}
        >
          <svg
            width="52"
            height="52"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(255,255,255,.18)"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="9" cy="21" r="1" />
            <circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
          </svg>
        </div>
        <div className="absolute -bottom-1 -right-1 text-3xl">😔</div>
      </div>
      <div className="flex flex-col gap-2 text-center">
        <p className={`text-[20px] font-bold text-white ${heading}`}>Your cart is empty</p>
        <p
          className={`text-[13px] leading-relaxed ${body}`}
          style={{ color: 'rgba(255,255,255,.38)' }}
        >
          Looks like you haven&apos;t added anything yet. Explore the marketplace and find something
          you love!
        </p>
      </div>
      <button
        type="button"
        onClick={onBrowse}
        className={`flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold text-white transition-all active:scale-[.97] ${heading}`}
        style={{
          background: `linear-gradient(135deg,${G0},${G2} 55%,${G3})`,
          boxShadow: '0 10px 32px rgba(43,172,82,.36)',
        }}
      >
        Browse Marketplace
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        >
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}
