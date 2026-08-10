import React from 'react';
import { G0, G2 } from '../../tokens/colors';
import { ELEVATION } from '../../tokens/elevation';
import { FAB_BOTTOM } from '../../tokens/spacing';

interface FloatingAIButtonProps {
  onPress: () => void;
  bottom?: number;
  right?: number;
  size?: number;
}

// Shared floating AI assistant button — appears on Home and Marketplace screens
export function FloatingAIButton({
  onPress,
  bottom = FAB_BOTTOM,
  right = 18,
  size = 52,
}: FloatingAIButtonProps) {
  return (
    <button
      onClick={onPress}
      className="absolute z-40 transition-all active:scale-90"
      style={{ bottom, right }}
      aria-label="AI Shopping Assistant"
    >
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: `linear-gradient(135deg,${G0},${G2})`,
          boxShadow: `${ELEVATION.fab}, 0 0 0 1.5px rgba(43,172,82,.3)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'avatar-pulse 3s ease-in-out infinite',
        }}
      >
        <span style={{ fontSize: size * 0.42 }}>✨</span>
      </div>
    </button>
  );
}
