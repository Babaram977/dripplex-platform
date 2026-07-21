export type AnalyticsPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface PeriodBucket {
  key: string;
  from: Date;
  to: Date;
}

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function endOfUtcDay(date: Date): Date {
  const start = startOfUtcDay(date);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
}

export function bucketDate(date: Date, period: AnalyticsPeriod): string {
  const day = startOfUtcDay(date);
  if (period === 'daily') {
    return day.toISOString().slice(0, 10);
  }
  if (period === 'monthly') {
    return `${String(day.getUTCFullYear())}-${String(day.getUTCMonth() + 1).padStart(2, '0')}`;
  }
  if (period === 'yearly') {
    return String(day.getUTCFullYear());
  }

  const weekStart = startOfUtcWeek(day);
  return weekStart.toISOString().slice(0, 10);
}

export function listPeriodBuckets(from: Date, to: Date, period: AnalyticsPeriod): PeriodBucket[] {
  const buckets: PeriodBucket[] = [];
  let cursor = periodStart(from, period);
  const end = periodStart(to, period);

  while (cursor.getTime() <= end.getTime()) {
    const next = addPeriod(cursor, period);
    buckets.push({
      key: bucketDate(cursor, period),
      from: cursor,
      to: new Date(next.getTime() - 1),
    });
    cursor = next;
  }

  return buckets;
}

function periodStart(date: Date, period: AnalyticsPeriod): Date {
  const day = startOfUtcDay(date);
  if (period === 'weekly') {
    return startOfUtcWeek(day);
  }
  if (period === 'monthly') {
    return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1));
  }
  if (period === 'yearly') {
    return new Date(Date.UTC(day.getUTCFullYear(), 0, 1));
  }
  return day;
}

function addPeriod(date: Date, period: AnalyticsPeriod): Date {
  if (period === 'weekly') {
    return new Date(date.getTime() + 7 * 24 * 60 * 60 * 1000);
  }
  if (period === 'monthly') {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  }
  if (period === 'yearly') {
    return new Date(Date.UTC(date.getUTCFullYear() + 1, 0, 1));
  }
  return new Date(date.getTime() + 24 * 60 * 60 * 1000);
}

function startOfUtcWeek(date: Date): Date {
  const day = startOfUtcDay(date);
  const weekday = day.getUTCDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  return new Date(day.getTime() + mondayOffset * 24 * 60 * 60 * 1000);
}
