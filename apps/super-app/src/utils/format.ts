// DrippleX formatting utilities

// Currency — formats a raw number to a Naira string: 1500 → "₦1,500"
export function formatNaira(amount: number, decimals = 0): string {
  return `₦${amount.toLocaleString('en-NG', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

// Shortens large numbers: 1200 → "1.2k", 1_500_000 → "1.5M"
export function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

// Distance: 0.4 → "0.4 km", 1200 (metres) → "1.2 km"
export function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

// ETA display: 8 → "8 min", 65 → "1h 5m"
export function formatEta(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// Rating: 4.678 → "4.7"
export function formatRating(rating: number): string {
  return rating.toFixed(1);
}

// Time greeting based on current hour
export function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

// Initials from full name: "Saeed Ali" → "SA"
// Splitting on a single space turned "  " into ['', '', ''] and mapped each to
// undefined, so a padded or empty name produced garbage rather than nothing.
// Callers treat '' as "no initials" and fall back to a placeholder.
export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

// Truncate long strings: "Hello world" → "Hello wor…"
export function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? str.slice(0, maxLen - 1) + '…' : str;
}
