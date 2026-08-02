import { generateReferralCode } from './referral-code.util';
import { REFERRAL_CODE_ALPHABET, REFERRAL_CODE_LENGTH } from './referral.constants';

describe('generateReferralCode', () => {
  it('generates a code of the configured length using only alphabet characters', () => {
    const code = generateReferralCode();
    expect(code).toHaveLength(REFERRAL_CODE_LENGTH);
    expect(code.split('').every((char) => REFERRAL_CODE_ALPHABET.includes(char))).toBe(true);
  });

  it('excludes visually ambiguous characters', () => {
    for (const ambiguous of ['0', 'O', '1', 'I', 'L']) {
      expect(REFERRAL_CODE_ALPHABET).not.toContain(ambiguous);
    }
  });

  it('generates different codes across calls (extremely unlikely to collide)', () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateReferralCode()));
    expect(codes.size).toBeGreaterThan(45);
  });
});
