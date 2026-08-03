import { BORDER, G0, G2, MUTED } from '../../tokens/colors';

import { useSuperAppFonts } from './fonts';

/**
 * "No nearby merchants" empty state, ported from `EmptyState` in the
 * locked Figma Make Marketplace screen. Note: the source defines this
 * component but never actually renders it in `MarketplaceScreen`'s
 * default composition (no "zero results" condition wires it up) — ported
 * for completeness per the source-of-truth rule, not wired into the
 * Marketplace preview's default render either, matching that.
 */
export function SuperAppEmptyState({
  icon = '📍',
  title = 'No nearby merchants found.',
  description = 'Try a different location or browse the full catalogue.',
  primaryLabel = 'Browse All',
  secondaryLabel = 'Change Location',
  onPrimary,
  onSecondary,
}: {
  icon?: string | undefined;
  title?: string | undefined;
  description?: string | undefined;
  primaryLabel?: string | undefined;
  secondaryLabel?: string | undefined;
  onPrimary?: (() => void) | undefined;
  onSecondary?: (() => void) | undefined;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  return (
    <div className="flex flex-col items-center px-8 py-10 text-center">
      <div
        className="mb-4 flex h-20 w-20 items-center justify-center rounded-full"
        style={{ background: 'rgba(43,172,82,.08)', border: '1.5px solid rgba(43,172,82,.2)' }}
      >
        <span style={{ fontSize: 38 }}>{icon}</span>
      </div>
      <p className={`mb-2 text-[16px] font-bold ${heading}`} style={{ color: '#FFF' }}>
        {title}
      </p>
      <p className={`mb-6 text-[12px] ${body}`} style={{ color: MUTED, lineHeight: 1.6 }}>
        {description}
      </p>
      <div className="flex w-full gap-3">
        <button
          type="button"
          onClick={onSecondary}
          className={`h-11 flex-1 rounded-2xl text-[12px] font-semibold transition-all active:scale-95 ${body}`}
          style={{
            background: 'rgba(255,255,255,.07)',
            color: 'rgba(255,255,255,.7)',
            border: `1px solid ${BORDER}`,
          }}
        >
          {secondaryLabel}
        </button>
        <button
          type="button"
          onClick={onPrimary}
          className={`h-11 flex-1 rounded-2xl text-[12px] font-semibold transition-all active:scale-95 ${body}`}
          style={{
            background: `linear-gradient(135deg,${G0},${G2})`,
            color: '#FFF',
            boxShadow: '0 4px 16px rgba(43,172,82,.28)',
          }}
        >
          {primaryLabel}
        </button>
      </div>
    </div>
  );
}
