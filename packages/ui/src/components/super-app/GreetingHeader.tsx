import { G3 } from '../../tokens/colors';

import { useSuperAppFonts } from './fonts';

/** "👋 Good Morning / Name / tagline" block, ported from Home's `Header`. */
export function SuperAppGreetingHeader({
  greeting,
  name,
  tagline,
}: {
  greeting: string;
  name: string;
  tagline?: string | undefined;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5">
        <span style={{ fontSize: 15 }}>👋</span>
        <p className={`text-[12px] ${body}`} style={{ color: 'rgba(255,255,255,.48)' }}>
          {greeting}
        </p>
      </div>
      <p className={`text-[22px] font-bold leading-tight ${heading}`} style={{ color: '#FFF' }}>
        {name}
      </p>
      {tagline ? (
        <p
          className={`mt-0.5 text-[11px] font-semibold ${body}`}
          style={{ color: G3, letterSpacing: '0.05em' }}
        >
          {tagline}
        </p>
      ) : null}
    </div>
  );
}
