import { G0, G2 } from '../../tokens/colors';

import { useSuperAppFonts } from './fonts';

/** User avatar chip, ported from the initial-letter badge in Home's `Header`. */
export function SuperAppAvatar({
  initial,
  size = 42,
}: {
  initial: string;
  size?: number | undefined;
}): React.JSX.Element {
  const { heading } = useSuperAppFonts();
  return (
    <div
      className="flex items-center justify-center rounded-2xl"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg,${G0},${G2})`,
        boxShadow: '0 4px 14px rgba(43,172,82,.3)',
      }}
    >
      <span className={`text-[17px] font-bold text-white ${heading}`}>{initial}</span>
    </div>
  );
}
