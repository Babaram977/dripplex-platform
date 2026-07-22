import { describe, expect, it } from 'vitest';

import { DRIPPLEX_BRAND } from './tokens';

describe('DRIPPLEX_BRAND', () => {
  it('exposes the official tagline exactly', () => {
    expect(DRIPPLEX_BRAND.tagline).toBe('life,Simplified');
  });

  it('exposes the official colour palette', () => {
    expect(DRIPPLEX_BRAND.colors).toEqual({
      primary: '#0E7A3E',
      secondary: '#0A2540',
      accent: '#FFC107',
      neutral: '#F4F6F8',
      white: '#FFFFFF',
    });
  });
});
