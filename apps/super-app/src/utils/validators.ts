// DrippleX input validation utilities

// Nigerian phone number: must be 11 digits starting with 0, or 10 digits (no leading 0)
export function isValidNigerianPhone(phone: string): boolean {
  const cleaned = phone.replace(/\s+/g, '').replace(/^(\+234|234)/, '0');
  return /^0[789][01]\d{8}$/.test(cleaned);
}

// Basic email check
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// 6-digit OTP
export function isValidOtp(otp: string): boolean {
  return /^\d{6}$/.test(otp.trim());
}

// PIN: 4–6 digits, no ascending/descending sequence, no all-same
export function isValidPin(pin: string): boolean {
  if (!/^\d{4,6}$/.test(pin)) return false;
  const digits = pin.split('').map(Number);
  const allSame = digits.every((d) => d === digits[0]);
  const ascending = digits.every((d, i) => i === 0 || d === digits[i - 1] + 1);
  const descending = digits.every((d, i) => i === 0 || d === digits[i - 1] - 1);
  return !allSame && !ascending && !descending;
}

// Password: min 8 chars, at least one uppercase, one digit, one special char
export function isStrongPassword(pw: string): boolean {
  return (
    pw.length >= 8 &&
    /[A-Z]/.test(pw) &&
    /\d/.test(pw) &&
    /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pw)
  );
}

// Full name: at least two words, letters only (allows accents)
export function isValidFullName(name: string): boolean {
  return /^[\p{L}]+([\s'][\p{L}]+)+$/u.test(name.trim());
}
