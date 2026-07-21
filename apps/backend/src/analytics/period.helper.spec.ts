import { bucketDate, listPeriodBuckets, startOfUtcDay } from './period.helper';

describe('analytics period helpers', () => {
  it('normalizes to UTC day start', () => {
    expect(startOfUtcDay(new Date('2026-07-21T18:45:30.000Z')).toISOString()).toBe(
      '2026-07-21T00:00:00.000Z',
    );
  });

  it('buckets daily periods', () => {
    expect(bucketDate(new Date('2026-07-21T18:45:30.000Z'), 'daily')).toBe('2026-07-21');
  });

  it('buckets weekly periods using Monday starts', () => {
    expect(bucketDate(new Date('2026-07-26T18:45:30.000Z'), 'weekly')).toBe('2026-07-20');
  });

  it('buckets monthly periods', () => {
    expect(bucketDate(new Date('2026-07-21T18:45:30.000Z'), 'monthly')).toBe('2026-07');
  });

  it('buckets yearly periods', () => {
    expect(bucketDate(new Date('2026-07-21T18:45:30.000Z'), 'yearly')).toBe('2026');
  });

  it('lists daily buckets inclusively', () => {
    const buckets = listPeriodBuckets(
      new Date('2026-07-20T00:00:00.000Z'),
      new Date('2026-07-22T00:00:00.000Z'),
      'daily',
    );

    expect(buckets.map((bucket) => bucket.key)).toEqual(['2026-07-20', '2026-07-21', '2026-07-22']);
  });

  it('lists weekly buckets inclusively', () => {
    const buckets = listPeriodBuckets(
      new Date('2026-07-21T00:00:00.000Z'),
      new Date('2026-08-03T00:00:00.000Z'),
      'weekly',
    );

    expect(buckets.map((bucket) => bucket.key)).toEqual(['2026-07-20', '2026-07-27', '2026-08-03']);
  });

  it('lists monthly buckets inclusively', () => {
    const buckets = listPeriodBuckets(
      new Date('2026-01-15T00:00:00.000Z'),
      new Date('2026-03-02T00:00:00.000Z'),
      'monthly',
    );

    expect(buckets.map((bucket) => bucket.key)).toEqual(['2026-01', '2026-02', '2026-03']);
  });
});
