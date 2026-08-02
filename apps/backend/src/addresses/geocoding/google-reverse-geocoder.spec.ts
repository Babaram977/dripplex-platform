import { GoogleReverseGeocoder } from './google-reverse-geocoder';

import type { AppConfigService } from '../../config/app-config.service';

describe('GoogleReverseGeocoder', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  function makeGeocoder(): GoogleReverseGeocoder {
    return new GoogleReverseGeocoder({
      googleMapsServerApiKey: 'test-key',
    } as unknown as AppConfigService);
  }

  it('maps a successful Google response to ReverseGeocodeResult', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: () =>
        Promise.resolve({
          status: 'OK',
          results: [
            {
              formatted_address: 'Lagos, Nigeria',
              address_components: [
                { long_name: 'Lagos', short_name: 'Lagos', types: ['locality', 'political'] },
                {
                  long_name: 'Lagos',
                  short_name: 'LA',
                  types: ['administrative_area_level_1', 'political'],
                },
                { long_name: 'Nigeria', short_name: 'NG', types: ['country', 'political'] },
              ],
            },
          ],
        }),
    });

    const geocoder = makeGeocoder();
    const result = await geocoder.reverseGeocode({ latitude: 6.6, longitude: 3.35 });

    expect(result).toEqual({
      formattedAddress: 'Lagos, Nigeria',
      city: 'Lagos',
      state: 'Lagos',
      country: 'Nigeria',
    });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('https://maps.googleapis.com/maps/api/geocode/json?'),
    );
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('latlng=6.6%2C3.35'));
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('key=test-key'));
  });

  it('omits address components Google did not return', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: () =>
        Promise.resolve({
          status: 'OK',
          results: [{ formatted_address: 'Somewhere', address_components: [] }],
        }),
    });

    const result = await makeGeocoder().reverseGeocode({ latitude: 1, longitude: 2 });

    expect(result).toEqual({ formattedAddress: 'Somewhere' });
  });

  it('throws when Google denies the request', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: () =>
        Promise.resolve({
          status: 'REQUEST_DENIED',
          results: [],
          error_message: 'This API key is not authorized',
        }),
    });

    await expect(makeGeocoder().reverseGeocode({ latitude: 1, longitude: 2 })).rejects.toThrow(
      'REQUEST_DENIED',
    );
  });

  it('throws when Google returns no results', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve({ status: 'ZERO_RESULTS', results: [] }),
    });

    await expect(makeGeocoder().reverseGeocode({ latitude: 1, longitude: 2 })).rejects.toThrow(
      'ZERO_RESULTS',
    );
  });
});
