import { G0, G2 } from '../../tokens/colors';

import { useSuperAppFonts } from './fonts';

/** Search pill, ported from Home's `Header`. */
export function SuperAppSearchBar({
  placeholder,
  onPress,
}: {
  placeholder: string;
  onPress?: (() => void) | undefined;
}): React.JSX.Element {
  const { body } = useSuperAppFonts();
  return (
    <button
      type="button"
      onClick={onPress}
      className="flex w-full items-center gap-3 rounded-2xl px-4 text-left"
      style={{
        height: 50,
        background: 'rgba(255,255,255,.08)',
        border: '1.5px solid rgba(255,255,255,.10)',
      }}
    >
      <div
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl"
        style={{ background: `linear-gradient(135deg,${G0},${G2})` }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="white">
          <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
        </svg>
      </div>
      <span className={`flex-1 text-[12.5px] ${body}`} style={{ color: 'rgba(255,255,255,.32)' }}>
        {placeholder}
      </span>
    </button>
  );
}
