import { NotConfiguredReverseGeocoder } from './not-configured-reverse-geocoder';
import { ReverseGeocodeNotImplementedError } from './reverse-geocoder';

describe('NotConfiguredReverseGeocoder', () => {
  it('rejects with NOT_IMPLEMENTED', async () => {
    const geocoder = new NotConfiguredReverseGeocoder();
    await expect(geocoder.reverseGeocode({ latitude: 6.6, longitude: 3.3 })).rejects.toBeInstanceOf(
      ReverseGeocodeNotImplementedError,
    );

    try {
      await geocoder.reverseGeocode({ latitude: 6.6, longitude: 3.3 });
    } catch (error) {
      expect((error as ReverseGeocodeNotImplementedError).code).toBe('NOT_IMPLEMENTED');
    }
  });
});
