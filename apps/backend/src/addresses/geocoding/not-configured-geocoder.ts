import { Injectable } from '@nestjs/common';

import { GeocodeNotImplementedError, type Geocoder, type GeocodeResult } from './geocoder';

/**
 * Default forward geocoder. Always rejects, so a deployment without
 * GOOGLE_MAPS_SERVER_API_KEY fails loudly at the point of use rather than
 * silently placing merchants somewhere they are not.
 */
@Injectable()
export class NotConfiguredGeocoder implements Geocoder {
  public geocode(_query: string): Promise<GeocodeResult> {
    return Promise.reject(new GeocodeNotImplementedError('NOT_IMPLEMENTED'));
  }
}
