export function formatNaira(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatCountdown(seconds: number | null): string {
  if (seconds === null) {
    return 'No active campaign';
  }
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  if (days > 0) {
    return `${String(days)}d ${String(hours)}h left`;
  }
  const minutes = Math.floor((seconds % 3_600) / 60);
  if (hours > 0) {
    return `${String(hours)}h ${String(minutes)}m left`;
  }
  return `${String(minutes)}m left`;
}

export function tierLabel(tier: string): string {
  switch (tier) {
    case 'GOLD':
      return 'Gold';
    case 'SILVER':
      return 'Silver';
    default:
      return 'Not yet ranked';
  }
}
