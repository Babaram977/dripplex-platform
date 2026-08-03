import { BORDER, G3 } from '../../tokens/colors';

import { useSuperAppFonts } from './fonts';

export type SuperAppNavTab = 'home' | 'marketplace' | 'ride' | 'wallet' | 'profile';

const TABS: { key: SuperAppNavTab; label: string; d: string }[] = [
  { key: 'home', label: 'Home', d: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2zM9 22V12h6v10' },
  {
    key: 'marketplace',
    label: 'Marketplace',
    d: 'M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0',
  },
  {
    key: 'ride',
    label: 'Ride',
    d: 'M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v9a2 2 0 01-2 2h-2M7 17a2 2 0 100 4 2 2 0 000-4zM17 17a2 2 0 100 4 2 2 0 000-4z',
  },
  {
    key: 'wallet',
    label: 'Wallet',
    d: 'M21 4H3a2 2 0 00-2 2v12a2 2 0 002 2h18a2 2 0 002-2V6a2 2 0 00-2-2zM1 10h22',
  },
  {
    key: 'profile',
    label: 'Profile',
    d: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 3a4 4 0 100 8 4 4 0 000-8z',
  },
];

/**
 * The app-wide 5-tab bottom navigation bar, ported from `BottomNav` in the
 * locked Figma Make export. The source hardcodes "Home" as the only active
 * tab (each screen file duplicates this component); here `active` is a
 * prop so every screen in the app can reuse one implementation.
 */
export function SuperAppBottomNav({
  active,
  onNavigate,
}: {
  active: SuperAppNavTab;
  onNavigate?: ((tab: SuperAppNavTab) => void) | undefined;
}): React.JSX.Element {
  const { body } = useSuperAppFonts();
  return (
    <div
      className="absolute bottom-0 left-0 right-0 flex items-center justify-around px-1 pb-6 pt-2"
      style={{
        background: 'rgba(6,14,28,.95)',
        borderTop: `1px solid ${BORDER}`,
        backdropFilter: 'blur(24px)',
      }}
    >
      {TABS.map((t) => {
        const on = t.key === active;
        return (
          <button
            key={t.key}
            type="button"
            onClick={
              onNavigate
                ? () => {
                    onNavigate(t.key);
                  }
                : undefined
            }
            className="flex flex-col items-center gap-1 px-2"
            style={{ minWidth: 52 }}
          >
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{
                background: on ? 'rgba(43,172,82,.15)' : 'transparent',
                border: on ? '1px solid rgba(43,172,82,.3)' : '1px solid transparent',
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke={on ? G3 : 'rgba(255,255,255,.32)'}
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d={t.d} />
              </svg>
            </div>
            <p
              className={`text-[9px] font-semibold ${body}`}
              style={{ color: on ? G3 : 'rgba(255,255,255,.28)' }}
            >
              {t.label}
            </p>
          </button>
        );
      })}
    </div>
  );
}
