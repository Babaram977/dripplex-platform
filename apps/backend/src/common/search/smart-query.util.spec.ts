import { parseSmartQuery } from './smart-query.util';

describe('parseSmartQuery', () => {
  it('extracts a price ceiling in naira notation', () => {
    expect(parseSmartQuery('Laptop under ₦500,000')).toEqual({
      keywords: 'Laptop',
      maxPrice: 500000,
      nearMe: false,
      openNow: false,
    });
  });

  it('extracts a price ceiling in "k" shorthand', () => {
    expect(parseSmartQuery('sneakers below 20k')).toEqual({
      keywords: 'sneakers',
      maxPrice: 20000,
      nearMe: false,
      openNow: false,
    });
  });

  it('extracts "near me" as a location hint', () => {
    expect(parseSmartQuery('Best shawarma near me')).toEqual({
      keywords: 'Best shawarma',
      maxPrice: undefined,
      nearMe: true,
      openNow: false,
    });
  });

  it('extracts "open now" as an availability hint', () => {
    expect(parseSmartQuery('Pharmacy open now')).toEqual({
      keywords: 'Pharmacy',
      maxPrice: undefined,
      nearMe: false,
      openNow: true,
    });
  });

  it('combines multiple hints in one query', () => {
    expect(parseSmartQuery('Fresh vegetables near me under 10000')).toEqual({
      keywords: 'Fresh vegetables',
      maxPrice: 10000,
      nearMe: true,
      openNow: false,
    });
  });

  it('leaves plain keyword queries untouched', () => {
    expect(parseSmartQuery('Fresh vegetables')).toEqual({
      keywords: 'Fresh vegetables',
      maxPrice: undefined,
      nearMe: false,
      openNow: false,
    });
  });

  it('is case-insensitive and trims whitespace', () => {
    expect(parseSmartQuery('  Laptop UNDER 500000  ')).toEqual({
      keywords: 'Laptop',
      maxPrice: 500000,
      nearMe: false,
      openNow: false,
    });
  });
});
