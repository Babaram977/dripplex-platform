import { geocodableAddress, hasKnownLocation } from './business-location';

describe('hasKnownLocation', () => {
  it('treats 0,0 as no location, because that is the schema fallback', () => {
    // latitude and longitude are non-nullable columns, so createBusiness writes
    // `dto.latitude ?? located?.latitude ?? 0` when geocoding cannot resolve
    // the address. Nothing else distinguishes "we never found out" from a
    // reading — and 0,0 is the Gulf of Guinea, 1,637 km from Kano.
    expect(hasKnownLocation({ latitude: 0, longitude: 0 })).toBe(false);
  });

  it('accepts a real Kano location', () => {
    expect(hasKnownLocation({ latitude: 12.0022, longitude: 8.592 })).toBe(true);
  });

  it('does not discard a reading just because one coordinate is zero', () => {
    // The pair is written together, so a single zero is a real (if surprising)
    // reading rather than an absent one. Treating it as unknown would silently
    // hide a merchant whose location we actually have.
    expect(hasKnownLocation({ latitude: 0, longitude: 8.592 })).toBe(true);
    expect(hasKnownLocation({ latitude: 12.0022, longitude: 0 })).toBe(true);
  });

  it('reads Prisma Decimals, not just numbers', () => {
    // Business.latitude is Decimal(10,7). A truthiness check on the Decimal
    // object would call every merchant located, including the broken ones.
    const decimalZero = { toString: () => '0', valueOf: () => 0 } as unknown as number;
    expect(hasKnownLocation({ latitude: decimalZero, longitude: decimalZero })).toBe(false);
  });
});

describe('geocodableAddress', () => {
  it('sends everything the business knows, not just the street line', () => {
    // Minimal onboarding collects one free-text address field and leaves city
    // and state empty, so a bare street was often all the geocoder got.
    expect(
      geocodableAddress({
        address: '526 Yankaba Road',
        city: 'Kano',
        state: 'Kano',
        country: 'Nigeria',
      }),
    ).toBe('526 Yankaba Road, Kano, Nigeria');
  });

  it('does not repeat a place the address line already names', () => {
    // Three of the live merchants have addresses ending in "Kano". Appending
    // the city again gives "638 Murtala Muhammad way Kano, Kano", which is
    // worse input than the original.
    expect(
      geocodableAddress({
        address: '638 Murtala Muhammad way Kano',
        city: 'Kano',
        state: 'Kano',
        country: 'Nigeria',
      }),
    ).toBe('638 Murtala Muhammad way Kano, Nigeria');
  });

  it('is case-insensitive about that repetition', () => {
    expect(
      geocodableAddress({
        address: '840 tudun wada Birgade kano',
        city: 'Kano',
        country: 'Nigeria',
      }),
    ).toBe('840 tudun wada Birgade kano, Nigeria');
  });

  it('drops the parts the business does not have', () => {
    // The ordinary state of a minimally-onboarded merchant: an address and
    // nothing else. Empty strings must not become ", , ".
    expect(geocodableAddress({ address: '436 Kofar Dawanu Kansakali', city: '', state: '' })).toBe(
      '436 Kofar Dawanu Kansakali',
    );
  });

  it('returns nothing for a business with no address', () => {
    // The caller checks for this and skips the geocoder entirely — a lookup on
    // an empty string spends a request to learn nothing.
    expect(geocodableAddress({ address: '   ', city: '', state: '', country: '' })).toBe('');
  });

  it('keeps the country even when there is no city or state', () => {
    expect(geocodableAddress({ address: '187 Lawan Danbazau street', country: 'Nigeria' })).toBe(
      '187 Lawan Danbazau street, Nigeria',
    );
  });

  it('handles a null city and state without printing "null"', () => {
    expect(
      geocodableAddress({ address: '12 Zoo Road', city: null, state: null, country: 'Nigeria' }),
    ).toBe('12 Zoo Road, Nigeria');
  });
});
