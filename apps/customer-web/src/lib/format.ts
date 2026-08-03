export function formatPrice(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(amount);
}
