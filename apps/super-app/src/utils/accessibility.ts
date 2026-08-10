// WCAG 2.2 AA helpers

// Minimum touch target size (px) per Material Design 3 / WCAG 2.5.5
export const MIN_TOUCH_TARGET = 44;

// Returns aria-label string for icon-only buttons
export function iconLabel(action: string, subject?: string): string {
  return subject ? `${action} ${subject}` : action;
}

// Checks if a hex color meets WCAG AA contrast ratio against white/black
// Returns "pass" | "fail" — use during development only, not runtime
export function checkContrast(hexColor: string, onDark = true): 'pass' | 'fail' {
  const r = parseInt(hexColor.slice(1, 3), 16) / 255;
  const g = parseInt(hexColor.slice(3, 5), 16) / 255;
  const b = parseInt(hexColor.slice(5, 7), 16) / 255;
  const linearize = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const L = 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
  const bgL = onDark ? 0.0113 : 1; // #060E1C ≈ 0.0113
  const [lighter, darker] = L > bgL ? [L, bgL] : [bgL, L];
  const ratio = (lighter + 0.05) / (darker + 0.05);
  return ratio >= 4.5 ? 'pass' : 'fail';
}
