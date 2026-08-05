import * as React from 'react';

export interface AnalyticsStat {
  label: string;
  value: string;
}

/** DPX-OPS-001 Slice 4 — a compact label/value grid for drill-down pages,
 * smaller and denser than the overview's `AnalyticsKpiTile` (these aren't
 * doorways to another page — they're already the drill-down). */
export function AnalyticsStatGrid({ stats }: { stats: AnalyticsStat[] }): React.JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {stats.map((stat) => (
        <div key={stat.label} className="flex flex-col gap-0.5">
          <span className="text-muted-foreground text-xs">{stat.label}</span>
          <span className="text-lg font-semibold tabular-nums">{stat.value}</span>
        </div>
      ))}
    </div>
  );
}
