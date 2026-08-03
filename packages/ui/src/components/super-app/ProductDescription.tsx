import { MUTED } from '../../tokens/colors';

import { useSuperAppFonts } from './fonts';

/**
 * "Description" label + body copy, ported from the Product Detail screen.
 * The source also supports an expandable specs table (`product.specs`),
 * dropped here — the real `ProductDetailDto` has no spec-list field.
 */
export function SuperAppProductDescription({
  description,
}: {
  description: string;
}): React.JSX.Element {
  const { body } = useSuperAppFonts();
  return (
    <div className="mb-4 px-5">
      <p
        className={`mb-2 text-[12px] font-semibold uppercase tracking-widest ${body}`}
        style={{ color: MUTED }}
      >
        Description
      </p>
      <p
        className={`text-[14px] leading-relaxed ${body}`}
        style={{ color: 'rgba(255,255,255,.68)' }}
      >
        {description}
      </p>
    </div>
  );
}
