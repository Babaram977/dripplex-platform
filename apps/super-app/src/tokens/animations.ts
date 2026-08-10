// DrippleX Animation tokens

export const DURATION = {
  instant: 100,
  fast: 200,
  normal: 300,
  slow: 500,
  carousel: 4800,
  typewriter: 36, // ms per character
} as const;

export const EASING = {
  ease: 'ease',
  easeIn: 'ease-in',
  easeOut: 'ease-out',
  easeInOut: 'ease-in-out',
  spring: 'cubic-bezier(.34,1.56,.64,1)',
  smoothOut: 'cubic-bezier(.25,.46,.45,.94)',
} as const;

// CSS transition shorthand helpers
export const TRANSITION_DEFAULT = `all ${DURATION.normal}ms ${EASING.easeOut}`;
export const TRANSITION_FAST = `all ${DURATION.fast}ms ${EASING.easeOut}`;

// Keyframe animation names (defined in GLOBAL_STYLES in shared.tsx)
export const ANIM = {
  fadeIn: 'fade-in',
  fadeUp: 'fade-up',
  scaleIn: 'scale-in',
  pulse: 'avatar-pulse',
  pulseRing: 'pulse-ring',
  shimmer: 'shimmer',
  slidePop: 'slide-pop',
  floatBob: 'float-bob',
  spinSlow: 'spin-slow',
} as const;
