import { describe, expect, it } from 'vitest';

import { splitFullName } from './fullName';

describe('splitFullName', () => {
  it('splits an ordinary two-part name', () => {
    expect(splitFullName('Abdullahi Musa')).toEqual({
      firstName: 'Abdullahi',
      lastName: 'Musa',
    });
  });

  it('keeps a middle name with the surname rather than dropping it', () => {
    expect(splitFullName('Lawan Sadiq Bello')).toEqual({
      firstName: 'Lawan',
      lastName: 'Sadiq Bello',
    });
  });

  it('accepts a one-word name without inventing a surname', () => {
    expect(splitFullName('Hamza')).toEqual({ firstName: 'Hamza' });
  });

  it('ignores the stray spaces a phone keyboard adds', () => {
    expect(splitFullName('  Amina   Yusuf  ')).toEqual({
      firstName: 'Amina',
      lastName: 'Yusuf',
    });
  });

  it('refuses an empty name instead of saving a blank one', () => {
    expect(splitFullName('')).toBeNull();
    expect(splitFullName('   ')).toBeNull();
  });
});
