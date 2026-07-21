export function formatDate(
  value: string | Date,
  locale = 'en-NG',
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  },
): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat(locale, options).format(date);
}

export function formatRelativeTime(value: string | Date, locale = 'en-NG'): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const diffMs = date.getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const minutes = Math.round(diffMs / 60_000);
  if (Math.abs(minutes) < 60) {
    return rtf.format(minutes, 'minute');
  }
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) {
    return rtf.format(hours, 'hour');
  }
  const days = Math.round(hours / 24);
  return rtf.format(days, 'day');
}
