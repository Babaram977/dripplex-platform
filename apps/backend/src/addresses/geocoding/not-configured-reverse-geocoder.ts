import { Injectable } from '@nestjs/common';

import {
  ReverseGeocodeNotImplementedError,
  type ReverseGeocoder,
  type ReverseGeocodeResult,
} from './reverse-geocoder';

import type { CoordinatesDto } from '@dripplex/types';

/**
 * Default reverse geocoder stub. Always returns NOT_IMPLEMENTED.
 * Replace with Google/Mapbox adapters without changing AddressService.
 */
@Injectable()
export class NotConfiguredReverseGeocoder implements ReverseGeocoder {
  public reverseGeocode(_coordinates: CoordinatesDto): Promise<ReverseGeocodeResult> {
    return Promise.reject(new ReverseGeocodeNotImplementedError('NOT_IMPLEMENTED'));
  }
}
