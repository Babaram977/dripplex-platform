import { describe, expect, it } from 'vitest';

import { DRIPPLEX_BRAND } from './tokens';

describe('DRIPPLEX_BRAND', () => {
  it('exposes the official tagline exactly', () => {
    expect(DRIPPLEX_BRAND.tagline).toBe('life, Simplified');
  });

  it('exposes the official colour palette', () => {
    expect(DRIPPLEX_BRAND.colors).toEqual({
      primary: '#2BAC52',
      secondary: '#0A1628',
      accent: '#47CF72',
      neutral: '#112238',
      white: '#FFFFFF',
    });
  });
});
