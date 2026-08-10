import React, { useState } from 'react';
import { G3, BORDER } from '../../tokens/colors';
import { FONT_BODY, TYPE } from '../../tokens/typography';
import { BOTTOM_NAV_PB } from '../../tokens/spacing';

export type NavTabKey = 'home' | 'market' | 'ride' | 'wallet' | 'profile';

interface NavTabConfig {
  key: NavTabKey;
  label: string;
  icon: (active: boolean) => React.ReactNode;
}

const TABS: NavTabConfig[] = [
  {
    key: 'home',
    label: 'Home',
    icon: (a) => (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke={a ? G3 : 'rgba(255,255,255,.3)'}
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2zM9 22V12h6v10" />
      </svg>
    ),
  },
  {
    key: 'market',
    label: 'Market',
    icon: (a) => (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke={a ? G3 : 'rgba(255,255,255,.3)'}
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0" />
      </svg>
    ),
  },
  {
    key: 'ride',
    label: 'Ride',
    icon: (a) => (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke={a ? G3 : 'rgba(255,255,255,.3)'}
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v9a2 2 0 01-2 2h-2M7 17a2 2 0 100 4 2 2 0 000-4zM17 17a2 2 0 100 4 2 2 0 000-4z" />
      </svg>
    ),
  },
  {
    key: 'wallet',
    label: 'Wallet',
    icon: (a) => (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke={a ? G3 : 'rgba(255,255,255,.3)'}
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 4H3a2 2 0 00-2 2v12a2 2 0 002 2h18a2 2 0 002-2V6a2 2 0 00-2-2zM1 10h22" />
      </svg>
    ),
  },
  {
    key: 'profile',
    label: 'Profile',
    icon: (a) => (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke={a ? G3 : 'rgba(255,255,255,.3)'}
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 3a4 4 0 100 8 4 4 0 000-8z" />
      </svg>
    ),
  },
];

interface BottomNavigationProps {
  activeTab?: NavTabKey;
  onTabChange?: (tab: NavTabKey) => void;
  // Badge counts
  marketBadge?: number;
  walletBadge?: number;
  notifBadge?: number;
}

export function BottomNavigation({
  activeTab: externalActive,
  onTabChange,
  marketBadge,
}: BottomNavigationProps) {
  const [internalActive, setInternalActive] = useState<NavTabKey>('home');
  const active = externalActive ?? internalActive;

  const handlePress = (tab: NavTabKey) => {
    setInternalActive(tab);
    onTabChange?.(tab);
  };

  return (
    <div
      className="absolute bottom-0 left-0 right-0 flex items-center justify-around px-1 pt-2"
      style={{
        paddingBottom: BOTTOM_NAV_PB,
        background: 'rgba(6,14,28,.95)',
        borderTop: `1px solid ${BORDER}`,
        backdropFilter: 'blur(24px)',
      }}
    >
      {TABS.map((tab) => {
        const isActive = active === tab.key;
        const badge = tab.key === 'market' ? marketBadge : undefined;
        return (
          <button
            key={tab.key}
            onClick={() => handlePress(tab.key)}
            className="flex flex-col items-center gap-1 px-2 transition-all active:scale-90"
            style={{ minWidth: 52 }}
            aria-label={tab.label}
            aria-current={isActive ? 'page' : undefined}
          >
            <div
              className="relative flex h-10 w-10 items-center justify-center rounded-xl"
              style={{
                background: isActive ? 'rgba(43,172,82,.15)' : 'transparent',
                border: isActive ? '1px solid rgba(43,172,82,.3)' : '1px solid transparent',
                transition: 'all .22s ease',
              }}
            >
              {tab.icon(isActive)}
              {badge !== undefined && badge > 0 && (
                <div
                  className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full"
                  style={{
                    background: '#2BAC52',
                    fontSize: 8,
                    color: '#FFF',
                    fontFamily: FONT_BODY,
                    fontWeight: 700,
                  }}
                >
                  {badge > 9 ? '9+' : badge}
                </div>
              )}
            </div>
            <p
              style={{
                fontSize: TYPE['2xs'],
                fontWeight: 600,
                color: isActive ? G3 : 'rgba(255,255,255,.28)',
                fontFamily: FONT_BODY,
                transition: 'color .22s ease',
              }}
            >
              {tab.label}
            </p>
          </button>
        );
      })}
    </div>
  );
}
