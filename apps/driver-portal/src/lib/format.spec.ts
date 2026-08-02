import { describe, expect, it } from 'vitest';

import { formatCountdown, formatNaira, tierLabel } from './format';

describe('format', () => {
  it('formats naira amounts without decimals', () => {
    expect(formatNaira(40000)).toContain('40,000');
  });

  it('formats a countdown in days/hours when more than a day remains', () => {
    expect(formatCountdown(2 * 86_400 + 3 * 3_600)).toBe('2d 3h left');
  });

  it('formats a countdown in hours/minutes when less than a day remains', () => {
    expect(formatCountdown(3 * 3_600 + 15 * 60)).toBe('3h 15m left');
  });

  it('formats a countdown in minutes only when less than an hour remains', () => {
    expect(formatCountdown(25 * 60)).toBe('25m left');
  });

  it('reports no active campaign for a null countdown', () => {
    expect(formatCountdown(null)).toBe('No active campaign');
  });

  it('maps tiers to display labels', () => {
    expect(tierLabel('GOLD')).toBe('Gold');
    expect(tierLabel('SILVER')).toBe('Silver');
    expect(tierLabel('NONE')).toBe('Not yet ranked');
  });
});
