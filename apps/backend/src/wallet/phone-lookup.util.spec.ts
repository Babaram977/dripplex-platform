import { phoneLookupCandidates } from './phone-lookup.util';

describe('phoneLookupCandidates', () => {
  // The reported case: a Nigerian number typed the way Nigerians write it,
  // against an account the super-app stored in E.164.
  it('matches a local Nigerian number to its E.164 spelling', () => {
    expect(phoneLookupCandidates('08033968368')).toContain('+2348033968368');
  });

  it('matches an E.164 number to the local spelling other portals store', () => {
    expect(phoneLookupCandidates('+2348033968368')).toEqual(
      expect.arrayContaining(['+2348033968368', '2348033968368', '08033968368', '8033968368']),
    );
  });

  it('treats 234… without a plus as the same number', () => {
    expect(phoneLookupCandidates('2348033968368')).toEqual(phoneLookupCandidates('+2348033968368'));
  });

  it('accepts a national number with no trunk zero', () => {
    expect(phoneLookupCandidates('8033968368')).toContain('+2348033968368');
  });

  it('ignores spaces, dashes and brackets', () => {
    expect(phoneLookupCandidates('0803 396-8368')).toEqual(phoneLookupCandidates('08033968368'));
  });

  // Money is moving: a foreign number must not be reinterpreted as Nigerian,
  // or a sender could land on a stranger holding the same national digits.
  it('never widens an explicit foreign country code to +234', () => {
    const candidates = phoneLookupCandidates('+448033968368');
    expect(candidates).toEqual(['+448033968368', '448033968368']);
    expect(candidates).not.toContain('+2348033968368');
  });

  it('returns nothing for input too short to identify anyone', () => {
    expect(phoneLookupCandidates('0803')).toEqual([]);
    expect(phoneLookupCandidates('')).toEqual([]);
    expect(phoneLookupCandidates('   ')).toEqual([]);
  });

  it('never returns duplicates', () => {
    const candidates = phoneLookupCandidates('08033968368');
    expect(new Set(candidates).size).toBe(candidates.length);
  });
});
