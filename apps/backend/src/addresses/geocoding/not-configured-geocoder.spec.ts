import { GeocodeNotImplementedError } from './geocoder';
import { NotConfiguredGeocoder } from './not-configured-geocoder';

describe('NotConfiguredGeocoder', () => {
  it('rejects, so a deployment without an API key fails loudly rather than guessing', async () => {
    await expect(new NotConfiguredGeocoder().geocode('anywhere')).rejects.toBeInstanceOf(
      GeocodeNotImplementedError,
    );
  });
});
