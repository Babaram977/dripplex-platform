import React from 'react';
import { G0, G2, G3 } from '../../tokens/colors';
import { FONT_HEADING, FONT_BODY, TYPE } from '../../tokens/typography';

interface ProfileAvatarProps {
  name?: string;
  initials?: string;
  size?: number;
  online?: boolean;
  onPress?: () => void;
  style?: React.CSSProperties;
}

// Generates initials from a full name
function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function ProfileAvatar({
  name,
  initials,
  size = 40,
  online,
  onPress,
  style,
}: ProfileAvatarProps) {
  const letters = initials ?? (name ? getInitials(name) : 'U');
  const fontSize = size * 0.35;

  return (
    <button
      onClick={onPress}
      className="relative flex-shrink-0 transition-all active:scale-90"
      style={{ width: size, height: size, ...style }}
      aria-label={name ?? 'Profile'}
    >
      {/* Avatar circle */}
      <div
        className="flex h-full w-full items-center justify-center rounded-full"
        style={{
          background: `linear-gradient(135deg, ${G0}, ${G2})`,
          boxShadow: `0 2px 10px rgba(43,172,82,.3)`,
        }}
      >
        <p style={{ fontSize, fontWeight: 700, color: '#FFF', fontFamily: FONT_HEADING }}>
          {letters}
        </p>
      </div>

      {/* Online indicator */}
      {online !== undefined && (
        <div
          className="absolute"
          style={{
            bottom: size * 0.04,
            right: size * 0.04,
            width: size * 0.27,
            height: size * 0.27,
            borderRadius: '50%',
            background: online ? '#10B981' : 'rgba(255,255,255,.25)',
            border: `${size * 0.06}px solid #060E1C`,
          }}
        />
      )}
    </button>
  );
}
