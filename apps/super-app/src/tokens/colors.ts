// DrippleX Brand Colors — locked. Do not modify without design approval.

// ─── Brand Greens ────────────────────────────────────────────────────────────
export const BRAND_GREEN_DARK = '#176B30'; // dark anchor (gradients)
export const BRAND_GREEN_MID = '#2BAC52'; // primary brand green
export const BRAND_GREEN_LIGHT = '#47CF72'; // highlight / text on dark

// Gradient helpers
export const GREEN_GRADIENT = `linear-gradient(135deg, ${BRAND_GREEN_DARK}, ${BRAND_GREEN_MID} 55%, ${BRAND_GREEN_LIGHT})`;
export const GREEN_GRADIENT_SOFT = `linear-gradient(135deg, ${BRAND_GREEN_DARK}, ${BRAND_GREEN_MID})`;

// ─── Navy Backgrounds (darkest → lightest) ───────────────────────────────────
export const NAVY_DEEP = '#060E1C'; // page / screen background
export const NAVY_BASE = '#0A1628'; // screen base layer
export const NAVY_CARD = '#0D1B2E'; // card surface
export const NAVY_SURFACE = '#112238'; // elevated surface / input bg

// ─── Borders & Overlays ──────────────────────────────────────────────────────
export const BORDER = 'rgba(255,255,255,.08)';
export const BORDER_BRAND = 'rgba(43,172,82,.2)';
export const OVERLAY_DARK = 'rgba(0,0,0,.72)';
export const OVERLAY_SOFT = 'rgba(0,0,0,.45)';

// ─── Text ────────────────────────────────────────────────────────────────────
export const TEXT_PRIMARY = '#FFFFFF';
export const TEXT_SECONDARY = 'rgba(255,255,255,.65)';
export const MUTED = 'rgba(255,255,255,.38)'; // alias kept for backwards compat
export const TEXT_MUTED = 'rgba(255,255,255,.38)';
export const TEXT_DISABLED = 'rgba(255,255,255,.22)';
export const TEXT_BRAND = BRAND_GREEN_LIGHT;

// ─── Semantic Status ─────────────────────────────────────────────────────────
export const COLOR_SUCCESS = '#10B981';
export const COLOR_WARNING = '#F59E0B';
export const COLOR_ERROR = '#EF4444';
export const COLOR_INFO = '#3B82F6';
export const COLOR_STAR = '#FBBF24';

// ─── Category Accent Palette ─────────────────────────────────────────────────
export const ACCENT_RED = '#EF4444';
export const ACCENT_ORANGE = '#F97316';
export const ACCENT_CYAN = '#06B6D4';
export const ACCENT_VIOLET = '#8B5CF6';
export const ACCENT_PINK = '#EC4899';
export const ACCENT_BLUE = '#3B82F6';

// ─── Backwards-compatible aliases (used in shared.tsx / existing screens) ────
export const G0 = BRAND_GREEN_DARK;
export const G2 = BRAND_GREEN_MID;
export const G3 = BRAND_GREEN_LIGHT;
