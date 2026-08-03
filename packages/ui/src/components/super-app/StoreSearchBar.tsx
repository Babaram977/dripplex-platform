import { BORDER } from '../../tokens/colors';

import { useSuperAppFonts } from './fonts';

/**
 * Store screen's search bar (magnifying glass + placeholder + sort
 * icon), ported from `StoreSearch` in the locked Figma Make Store
 * screen. Different sizing/icons from `SuperAppSearchBar` (Home) and
 * `SuperAppMarketplaceHeader`'s embedded bar (Marketplace) — a third,
 * genuinely distinct search-bar spec, not a forced reuse of either.
 */
export function SuperAppStoreSearchBar({
  storeName,
  onPress,
  onSortPress,
}: {
  storeName: string;
  onPress?: (() => void) | undefined;
  onSortPress?: (() => void) | undefined;
}): React.JSX.Element {
  const { body } = useSuperAppFonts();
  return (
    <div className="mb-2 mt-4 px-4">
      <div
        className="flex items-center gap-3 rounded-2xl px-4"
        style={{ height: 48, background: 'rgba(255,255,255,.07)', border: `1.5px solid ${BORDER}` }}
      >
        <button
          type="button"
          onClick={onPress}
          className="flex flex-1 items-center gap-3 text-left"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(255,255,255,.35)"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <span
            className={`flex-1 text-[12.5px] ${body}`}
            style={{ color: 'rgba(255,255,255,.28)' }}
          >
            Search {storeName}…
          </span>
        </button>
        <button
          type="button"
          onClick={onSortPress}
          aria-label="Sort"
          className="flex h-7 w-7 items-center justify-center rounded-xl"
          style={{ background: 'rgba(255,255,255,.06)' }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(255,255,255,.45)"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="8" y1="12" x2="20" y2="12" />
            <line x1="12" y1="18" x2="20" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
