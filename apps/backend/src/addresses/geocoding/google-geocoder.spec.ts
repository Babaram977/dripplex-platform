import { GeocodeFailedError } from './geocoder';
import { GoogleGeocoder } from './google-geocoder';

import type { AppConfigService } from '../../config/app-config.service';

describe('GoogleGeocoder', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  function makeGeocoder(): GoogleGeocoder {
    return new GoogleGeocoder({
      googleMapsServerApiKey: 'test-key',
    } as unknown as AppConfigService);
  }

  function respond(body: unknown): jest.Mock {
    const fetchMock = jest.fn().mockResolvedValue({ json: () => Promise.resolve(body) });
    global.fetch = fetchMock;
    return fetchMock;
  }

  const kano = {
    status: 'OK',
    results: [
      {
        formatted_address: 'Tudun Wada, Kano, Nigeria',
        geometry: { location: { lat: 11.9866717, lng: 8.5896134 } },
        address_components: [
          { long_name: 'Kano', short_name: 'Kano', types: ['locality', 'political'] },
          {
            long_name: 'Kano',
            short_name: 'KN',
            types: ['administrative_area_level_1', 'political'],
          },
          { long_name: 'Nigeria', short_name: 'NG', types: ['country', 'political'] },
        ],
      },
    ],
  };

  it('maps a successful Google response to coordinates', async () => {
    respond(kano);

    const result = await makeGeocoder().geocode('840 tudun wada Birgade kano');

    expect(result).toMatchObject({
      latitude: 11.9866717,
      longitude: 8.5896134,
      formattedAddress: 'Tudun Wada, Kano, Nigeria',
      city: 'Kano',
      state: 'Kano',
      country: 'Nigeria',
    });
  });

  it('biases the lookup to Nigeria', async () => {
    // "840 tudun wada Birgade kano" is ambiguous worldwide and unambiguous
    // within one country — an unbiased lookup is how a Kano address becomes
    // somewhere else entirely.
    const fetchMock = respond(kano);

    await makeGeocoder().geocode('840 tudun wada Birgade kano');

    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain('region=ng');
    expect(url).toContain('components=country%3ANG');
  });

  it('throws when Google finds nothing, rather than returning a guess', async () => {
    respond({ status: 'ZERO_RESULTS', results: [] });

    await expect(makeGeocoder().geocode('nowhere at all')).rejects.toBeInstanceOf(
      GeocodeFailedError,
    );
  });

  it('rejects 0,0 — the Atlantic is not a merchant location', async () => {
    respond({
      status: 'OK',
      results: [
        {
          formatted_address: 'Null Island',
          geometry: { location: { lat: 0, lng: 0 } },
          address_components: [],
        },
      ],
    });

    await expect(makeGeocoder().geocode('null island')).rejects.toBeInstanceOf(GeocodeFailedError);
  });

  it('refuses an empty address without calling Google', async () => {
    const fetchMock = respond(kano);

    await expect(makeGeocoder().geocode('   ')).rejects.toBeInstanceOf(GeocodeFailedError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
