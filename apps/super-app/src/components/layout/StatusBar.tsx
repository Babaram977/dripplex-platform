import React from 'react';
import { STATUS_BAR_H } from '../../tokens/spacing';

// Shared DrippleX status bar — time + signal/wifi/battery icons
// Used at the top of every screen. Requires STATUS_BAR_H (52px) top offset.
interface StatusBarProps {
  light?: boolean; // true = white icons (default), false = dimmed
  style?: React.CSSProperties;
}

export function StatusBar({ light = true, style }: StatusBarProps) {
  const color = light ? 'rgba(255,255,255,.35)' : 'rgba(0,0,0,.3)';
  return (
    <div
      className="flex items-center justify-between px-5"
      style={{
        paddingTop: STATUS_BAR_H,
        paddingBottom: 4,
        fontSize: 11,
        color,
        fontFamily: "'Inter',sans-serif",
        ...style,
      }}
    >
      <span>9:41</span>
      <div className="flex items-center gap-1.5">
        {/* Signal */}
        <svg width="16" height="11" viewBox="0 0 17 12" fill="currentColor">
          <rect x="0" y="6" width="3" height="6" rx=".6" opacity=".4" />
          <rect x="4.5" y="3.5" width="3" height="8.5" rx=".6" opacity=".6" />
          <rect x="9" y="1" width="3" height="11" rx=".6" opacity=".85" />
          <rect x="13.5" y="0" width="3" height="12" rx=".6" />
        </svg>
        {/* WiFi */}
        <svg width="15" height="11" viewBox="0 0 16 12" fill="currentColor">
          <path d="M8 9a1.5 1.5 0 110 3 1.5 1.5 0 010-3z" />
          <path d="M2.5 5.5a7.7 7.7 0 0111 0l-1.4 1.4a5.7 5.7 0 00-8.2 0z" opacity=".7" />
          <path d="M.2 3.3a11 11 0 0115.6 0L14.3 4.8a9 9 0 00-12.6 0z" opacity=".4" />
        </svg>
        {/* Battery */}
        <svg width="24" height="11" viewBox="0 0 26 12" fill="currentColor">
          <rect
            x=".5"
            y=".5"
            width="22"
            height="11"
            rx="3.5"
            stroke="currentColor"
            strokeOpacity=".35"
            fill="none"
          />
          <rect x="2" y="2" width="17" height="8" rx="2" opacity=".6" />
          <path d="M24 4v4a2 2 0 000-4z" opacity=".4" />
        </svg>
      </div>
    </div>
  );
}
