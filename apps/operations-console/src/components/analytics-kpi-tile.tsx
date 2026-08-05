import Link from 'next/link';
import * as React from 'react';

/**
 * DPX-OPS-001 Slice 4 — one KPI. Per the founder's UX direction, the
 * overview stays a small, fixed set of these (six, one per framing
 * question) rather than growing into a pile of cards — each tile is a
 * doorway into its own drill-down page via `href`, not the full detail
 * itself.
 */
export function AnalyticsKpiTile({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  href?: string;
}): React.JSX.Element {
  const content = (
    <div className="border-border/70 hover:border-border flex flex-col gap-1 rounded-lg border p-4 transition-colors">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
      {hint ? <span className="text-muted-foreground text-xs">{hint}</span> : null}
    </div>
  );

  if (!href) return content;

  return (
    <Link href={href} className="block">
      {content}
    </Link>
  );
}
