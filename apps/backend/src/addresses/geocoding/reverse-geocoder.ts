import type { CoordinatesDto } from '@dripplex/types';

export interface ReverseGeocodeResult {
  formattedAddress: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
}

/**
 * Provider-agnostic reverse geocoding port.
 * Google/Mapbox adapters can implement this later.
 */
export interface ReverseGeocoder {
  reverseGeocode(coordinates: CoordinatesDto): Promise<ReverseGeocodeResult>;
}

export const REVERSE_GEOCODER = Symbol('REVERSE_GEOCODER');

export class ReverseGeocodeNotImplementedError extends Error {
  public readonly code = 'NOT_IMPLEMENTED';

  constructor(message = 'Reverse geocoding is not configured') {
    super(message);
    this.name = 'ReverseGeocodeNotImplementedError';
  }
}
