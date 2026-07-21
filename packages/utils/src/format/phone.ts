export function normalizeNigerianPhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.startsWith('234')) {
    return `+${digits}`;
  }
  if (digits.startsWith('0')) {
    return `+234${digits.slice(1)}`;
  }
  if (digits.length === 10) {
    return `+234${digits}`;
  }
  return input.startsWith('+') ? input : `+${digits}`;
}

export function maskPhoneNumber(phone: string): string {
  const normalized = normalizeNigerianPhone(phone);
  if (normalized.length < 8) {
    return phone;
  }
  return `${normalized.slice(0, 4)}****${normalized.slice(-3)}`;
}
