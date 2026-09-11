import {
  normaliseDocumentNumber,
  normaliseEmail,
  normalisePhone,
} from './referral-anti-abuse.service';

/**
 * These three are unit-tested on their own because each of them is the only
 * thing standing between a real check and a check that can never fire.
 * `User.phone` and `User.email` are unique columns, so comparing them directly
 * would be dead code — everything depends on the normalisation being right.
 */
describe('referral anti-abuse normalisation', () => {
  describe('normalisePhone', () => {
    it('treats every way of writing one Nigerian line as the same line', () => {
      const line = normalisePhone('+2348012345678');
      expect(normalisePhone('2348012345678')).toBe(line);
      expect(normalisePhone('08012345678')).toBe(line);
      expect(normalisePhone('+234 801 234 5678')).toBe(line);
      expect(line).toBe('8012345678');
    });

    it('keeps two different lines different', () => {
      expect(normalisePhone('+2348012345678')).not.toBe(normalisePhone('+2348012345679'));
    });

    it('does not truncate a short number into a false match', () => {
      // Reduced to the last ten digits only when there are more than ten. A
      // shorter number kept whole cannot collide with an unrelated one.
      expect(normalisePhone('12345')).toBe('12345');
    });

    it('returns null for nothing comparable', () => {
      expect(normalisePhone(null)).toBeNull();
      expect(normalisePhone('---')).toBeNull();
    });
  });

  describe('normaliseEmail', () => {
    it('collapses gmail dots and plus-tags to one inbox', () => {
      // The single most common self-referral: sign up again with a +tag.
      expect(normaliseEmail('a.b+dripplex@gmail.com')).toBe(normaliseEmail('ab@gmail.com'));
    });

    it('leaves providers that treat dots as significant alone', () => {
      // Collapsing everywhere would merge two different people's mailboxes and
      // reject a real referral.
      expect(normaliseEmail('a.b@example.com')).not.toBe(normaliseEmail('ab@example.com'));
    });

    it('is case-insensitive', () => {
      expect(normaliseEmail('Person@Example.com')).toBe('person@example.com');
    });
  });

  describe('normaliseDocumentNumber', () => {
    it('ignores case and the spacing one operator types and the next does not', () => {
      expect(normaliseDocumentNumber('abc-123 456')).toBe('ABC123456');
    });

    it('returns null when there is no number', () => {
      expect(normaliseDocumentNumber(null)).toBeNull();
      expect(normaliseDocumentNumber('  ')).toBeNull();
    });
  });
});
