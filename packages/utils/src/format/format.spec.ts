import { describe, expect, it } from 'vitest';

import { formatNaira, parseNairaInput } from './money.js';
import { maskPhoneNumber, normalizeNigerianPhone } from './phone.js';

describe('money utils', () => {
  it('formats naira values', () => {
    expect(formatNaira(1500)).toContain('1,500');
  });

  it('parses naira input', () => {
    expect(parseNairaInput('₦2,500.50')).toBe(2500.5);
  });
});

describe('phone utils', () => {
  it('normalizes local numbers to E.164', () => {
    expect(normalizeNigerianPhone('08031234567')).toBe('+2348031234567');
  });

  it('masks phone numbers', () => {
    expect(maskPhoneNumber('+2348031234567')).toBe('+234****567');
  });
});
