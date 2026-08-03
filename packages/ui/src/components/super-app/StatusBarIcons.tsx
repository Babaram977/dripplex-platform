/**
 * Signal / Wi-Fi / battery status-bar icon group, traced from the locked
 * Figma Make `homeScreen.tsx` Header (not `shared.tsx`'s generic
 * `StatusBar`, which uses slightly larger viewBoxes — 17x12/16x12/26x12 vs
 * this component's 17x12/16x12/26x12 scaled to 16x11/15x11/24x11 render
 * size — a sizing inconsistency in the source itself between the two
 * files; Home is the locked reference screen so its values win here).
 */
export function SuperAppStatusBarIcons(): React.JSX.Element {
  return (
    <div className="flex items-center gap-1.5">
      <svg width="16" height="11" viewBox="0 0 17 12" fill="currentColor">
        <rect x="0" y="6" width="3" height="6" rx="0.6" opacity="0.4" />
        <rect x="4.5" y="3.5" width="3" height="8.5" rx="0.6" opacity="0.6" />
        <rect x="9" y="1" width="3" height="11" rx="0.6" opacity="0.85" />
        <rect x="13.5" y="0" width="3" height="12" rx="0.6" />
      </svg>
      <svg width="15" height="11" viewBox="0 0 16 12" fill="currentColor">
        <path d="M8 9a1.5 1.5 0 110 3 1.5 1.5 0 010-3z" />
        <path d="M2.5 5.5a7.7 7.7 0 0111 0l-1.4 1.4a5.7 5.7 0 00-8.2 0z" opacity="0.7" />
        <path d="M.2 3.3a11 11 0 0115.6 0L14.3 4.8a9 9 0 00-12.6 0z" opacity="0.4" />
      </svg>
      <svg width="24" height="11" viewBox="0 0 26 12" fill="currentColor">
        <rect
          x="0.5"
          y="0.5"
          width="22"
          height="11"
          rx="3.5"
          stroke="currentColor"
          strokeOpacity="0.35"
          fill="none"
        />
        <rect x="2" y="2" width="17" height="8" rx="2" opacity="0.6" />
        <path d="M24 4v4a2 2 0 000-4z" opacity="0.4" />
      </svg>
    </div>
  );
}
