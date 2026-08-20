import { Injectable, Logger } from '@nestjs/common';

import { AppConfigService } from '../../config/app-config.service';

import { GeocodeFailedError, type Geocoder, type GeocodeResult } from './geocoder';

interface GoogleAddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

interface GoogleGeocodeResult {
  formatted_address: string;
  address_components: GoogleAddressComponent[];
  geometry: { location: { lat: number; lng: number } };
}

interface GoogleGeocodeResponse {
  results: GoogleGeocodeResult[];
  status: string;
  error_message?: string;
}

function componentByType(components: GoogleAddressComponent[], type: string): string | undefined {
  return components.find((component) => component.types.includes(type))?.long_name;
}

/**
 * Google Maps Geocoding API adapter for the Geocoder port. Same endpoint the
 * reverse adapter uses, with `address` instead of `latlng`, and bound the same
 * way via GOOGLE_MAPS_SERVER_API_KEY (addresses.module.ts).
 */
@Injectable()
export class GoogleGeocoder implements Geocoder {
  private readonly logger = new Logger(GoogleGeocoder.name);

  constructor(private readonly config: AppConfigService) {}

  public async geocode(query: string): Promise<GeocodeResult> {
    const trimmed = query.trim();
    if (trimmed === '') {
      throw new GeocodeFailedError('Cannot geocode an empty address');
    }

    const params = new URLSearchParams({
      address: trimmed,
      key: this.config.googleMapsServerApiKey,
      // Nigeria-biased: a bare street name like "840 tudun wada Birgade kano"
      // is ambiguous worldwide and unambiguous within one country.
      region: 'ng',
      components: 'country:NG',
    });

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`,
    );
    const body = (await response.json()) as GoogleGeocodeResponse;

    if (body.status !== 'OK' || body.results.length === 0) {
      this.logger.warn(
        `Geocode failed for "${trimmed}": ${body.status} ${body.error_message ?? ''}`,
      );
      throw new GeocodeFailedError(`Geocoding failed: ${body.status}`);
    }

    const result = body.results[0];
    if (!result) {
      throw new GeocodeFailedError('Geocoding failed: no results');
    }

    const { lat, lng } = result.geometry.location;
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
      // 0,0 is the Atlantic. Treat it as a failure rather than a location.
      throw new GeocodeFailedError('Geocoding returned an unusable location');
    }

    const components = result.address_components;
    const city = componentByType(components, 'locality');
    const state = componentByType(components, 'administrative_area_level_1');
    const country = componentByType(components, 'country');

    return {
      latitude: lat,
      longitude: lng,
      formattedAddress: result.formatted_address,
      ...(city !== undefined ? { city } : {}),
      ...(state !== undefined ? { state } : {}),
      ...(country !== undefined ? { country } : {}),
    };
  }
}
