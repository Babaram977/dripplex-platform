'use client';

import { Select } from '@dripplex/ui';
import * as React from 'react';

import {
  customRange,
  RANGE_PRESET_LABELS,
  rangeForPreset,
  type AnalyticsRangePreset,
  type AnalyticsRangeValue,
} from '@/lib/analytics-range';

const PRESET_OPTIONS: AnalyticsRangePreset[] = ['TODAY', 'LAST_7_DAYS', 'LAST_30_DAYS', 'CUSTOM'];

function toDateInputValue(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * DPX-OPS-001 Slice 4 — the range control every analytics screen shares.
 * Per the founder's instruction, time-range filtering is fundamental, not
 * an afterthought: this sits at the top of every analytics page, and every
 * KPI/drill-down on that page reads from the same selected range.
 */
export function AnalyticsRangePicker({
  value,
  onChange,
}: {
  value: AnalyticsRangeValue;
  onChange: (next: AnalyticsRangeValue) => void;
}): React.JSX.Element {
  const [customFrom, setCustomFrom] = React.useState(() => toDateInputValue(value.from));
  const [customTo, setCustomTo] = React.useState(() => toDateInputValue(value.to));

  const onPresetChange = (preset: AnalyticsRangePreset): void => {
    if (preset === 'CUSTOM') {
      onChange(customRange(customFrom, customTo));
      return;
    }
    onChange(rangeForPreset(preset));
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        aria-label="Analytics time range"
        value={value.preset}
        onChange={(event) => {
          onPresetChange(event.target.value as AnalyticsRangePreset);
        }}
        className="w-auto"
      >
        {PRESET_OPTIONS.map((preset) => (
          <option key={preset} value={preset}>
            {RANGE_PRESET_LABELS[preset]}
          </option>
        ))}
      </Select>
      {value.preset === 'CUSTOM' ? (
        <div className="flex items-center gap-2 text-sm">
          <input
            type="date"
            aria-label="Custom range start"
            value={customFrom}
            onChange={(event) => {
              setCustomFrom(event.target.value);
              onChange(customRange(event.target.value, customTo));
            }}
            className="border-input bg-background/80 h-11 rounded-md border px-3 text-sm shadow-sm"
          />
          <span className="text-muted-foreground">to</span>
          <input
            type="date"
            aria-label="Custom range end"
            value={customTo}
            onChange={(event) => {
              setCustomTo(event.target.value);
              onChange(customRange(customFrom, event.target.value));
            }}
            className="border-input bg-background/80 h-11 rounded-md border px-3 text-sm shadow-sm"
          />
        </div>
      ) : null}
    </div>
  );
}
