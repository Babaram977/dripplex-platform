import { BORDER, MUTED, NAVY_CARD } from '../../tokens/colors';

import { useSuperAppFonts } from './fonts';

export interface SuperAppInfoRow {
  key: string;
  icon: string;
  label: string;
  value: string;
}

/**
 * Static label/value row list in a bordered card, ported from `StoreInfo`
 * in the locked Figma Make Store screen. Not an accordion (unlike
 * `SuperAppAccordionCard`) — every row is always visible.
 */
export function SuperAppInfoList({
  title,
  rows,
}: {
  title: string;
  rows: SuperAppInfoRow[];
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  return (
    <div className="mb-5 px-4">
      <p className={`mb-3 text-[15px] font-bold ${heading}`} style={{ color: '#FFF' }}>
        {title}
      </p>
      <div
        className="overflow-hidden rounded-3xl"
        style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
      >
        {rows.map((row, i) => (
          <div key={row.key}>
            <div className="flex items-start gap-3 px-4 py-3.5">
              <div
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl text-[15px]"
                style={{ background: 'rgba(255,255,255,.06)' }}
              >
                {row.icon}
              </div>
              <div className="flex-1">
                <p className={`mb-0.5 text-[10px] ${body}`} style={{ color: MUTED }}>
                  {row.label}
                </p>
                <p className={`text-[12.5px] ${body}`} style={{ color: 'rgba(255,255,255,.78)' }}>
                  {row.value}
                </p>
              </div>
            </div>
            {i < rows.length - 1 ? (
              <div style={{ height: 1, background: BORDER, marginLeft: 56, marginRight: 16 }} />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
