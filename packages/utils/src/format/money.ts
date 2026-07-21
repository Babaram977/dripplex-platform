const nairaFormatter = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatNaira(amount: number): string {
  return nairaFormatter.format(amount);
}

export function parseNairaInput(value: string): number | null {
  const normalized = value.replace(/[^0-9.]/g, '');
  if (normalized.length === 0) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}
