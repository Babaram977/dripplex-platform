/**
 * Forward geocoding — a written address to coordinates.
 *
 * The mirror of ReverseGeocoder (see reverse-geocoder.ts), and the half that
 * was missing. Minimal merchant onboarding takes a single free-text address
 * and no coordinates, so a merchant could be fully approved and trading with
 * latitude/longitude still at 0. Delivery dispatch then fell back to a
 * hardcoded city default, which put a Kano restaurant's pickup in Lagos and
 * priced its deliveries off an 835km journey.
 */

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  city?: string;
  state?: string;
  country?: string;
}

/** Provider-agnostic forward geocoding port. */
export interface Geocoder {
  /**
   * Resolve a written address. Throws rather than returning null: a caller
   * that cannot place a merchant must not quietly carry on with a guess,
   * which is the failure this port exists to end.
   */
  geocode(query: string): Promise<GeocodeResult>;
}

export const GEOCODER = Symbol('GEOCODER');

export class GeocodeNotImplementedError extends Error {
  public readonly code = 'NOT_IMPLEMENTED';

  constructor(message = 'Geocoding is not configured') {
    super(message);
    this.name = 'GeocodeNotImplementedError';
  }
}

export class GeocodeFailedError extends Error {
  public readonly code = 'GEOCODE_FAILED';

  constructor(message: string) {
    super(message);
    this.name = 'GeocodeFailedError';
  }
}
