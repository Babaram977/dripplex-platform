/** DPX-OPS-001 Slice 4 — small, pure formatting helpers shared across every
 * analytics screen. Kept local to operations-console (not `@dripplex/ui`)
 * since none of this is a visual component, just number formatting. */

export function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

export function formatCount(value: number): string {
  return value.toLocaleString('en-NG');
}

/** `null` means "no samples" — rendered as an em dash, never a fabricated
 * 0s or 0%. */
export function formatDurationSeconds(seconds: number | null): string {
  if (seconds === null) return '—';
  if (seconds < 60) return `${String(Math.round(seconds))}s`;
  if (seconds < 3600) return `${String(Math.round(seconds / 60))}m`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return minutes > 0 ? `${String(hours)}h ${String(minutes)}m` : `${String(hours)}h`;
}

export function formatRateOrDash(rate: number | null): string {
  return rate === null ? '—' : formatPercent(rate);
}
