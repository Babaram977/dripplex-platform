/**
 * DPX-OPS-001 Slice 4 — time-range presets for Operations Analytics. Per
 * the founder's explicit instruction, time-range filtering is fundamental:
 * every analytics query requires a concrete `from`/`to`, computed here
 * client-side before the SDK call is ever made — the backend never
 * defaults a range on its own.
 */
export type AnalyticsRangePreset = 'TODAY' | 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'CUSTOM';

export interface AnalyticsRangeValue {
  preset: AnalyticsRangePreset;
  from: string;
  to: string;
}

export const RANGE_PRESET_LABELS: Record<AnalyticsRangePreset, string> = {
  TODAY: 'Today',
  LAST_7_DAYS: 'Last 7 days',
  LAST_30_DAYS: 'Last 30 days',
  CUSTOM: 'Custom',
};

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Computes a preset's concrete `from`/`to` as of now — `TODAY` is
 * midnight UTC through now, `LAST_7_DAYS`/`LAST_30_DAYS` are rolling
 * windows ending now (not calendar-aligned), matching how an operator
 * reading "last 7 days" would expect it to behave. */
export function rangeForPreset(
  preset: Exclude<AnalyticsRangePreset, 'CUSTOM'>,
): AnalyticsRangeValue {
  const now = new Date();
  const to = now.toISOString();
  const from =
    preset === 'TODAY'
      ? startOfUtcDay(now).toISOString()
      : new Date(
          now.getTime() - (preset === 'LAST_7_DAYS' ? 7 : 30) * 24 * 60 * 60 * 1000,
        ).toISOString();
  return { preset, from, to };
}

/** A custom range from two `<input type="date">` values — `to` is pushed
 * to the end of that day so a same-day custom range isn't accidentally
 * empty. */
export function customRange(fromDate: string, toDate: string): AnalyticsRangeValue {
  const to = new Date(`${toDate}T23:59:59.999Z`);
  return {
    preset: 'CUSTOM',
    from: new Date(`${fromDate}T00:00:00.000Z`).toISOString(),
    to: to.toISOString(),
  };
}

export const DEFAULT_ANALYTICS_RANGE: AnalyticsRangeValue = rangeForPreset('TODAY');
