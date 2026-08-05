import Link from 'next/link';
import * as React from 'react';

import { AnalyticsRangePicker } from '@/components/analytics-range-picker';
import { type AnalyticsRangeValue } from '@/lib/analytics-range';

/** DPX-OPS-001 Slice 4 — the header every analytics drill-down page
 * shares: a way back to the overview, the title, and the same range
 * picker every drill-down reads from. */
export function AnalyticsDrilldownHeader({
  title,
  description,
  range,
  onRangeChange,
}: {
  title: string;
  description: string;
  range: AnalyticsRangeValue;
  onRangeChange: (next: AnalyticsRangeValue) => void;
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      <Link href="/analytics" className="text-muted-foreground hover:text-foreground w-fit text-sm">
        ← Analytics
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{description}</p>
        </div>
        <AnalyticsRangePicker value={range} onChange={onRangeChange} />
      </div>
    </div>
  );
}
