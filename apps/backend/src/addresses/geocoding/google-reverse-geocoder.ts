import { Injectable, Logger } from '@nestjs/common';

import { AppConfigService } from '../../config/app-config.service';

import { type ReverseGeocoder, type ReverseGeocodeResult } from './reverse-geocoder';

import type { CoordinatesDto } from '@dripplex/types';

interface GoogleAddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

interface GoogleGeocodeResult {
  formatted_address: string;
  address_components: GoogleAddressComponent[];
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
 * Real Google Maps Geocoding API adapter for the ReverseGeocoder port
 * (see reverse-geocoder.ts). Binds in via GOOGLE_MAPS_SERVER_API_KEY
 * (addresses.module.ts) — no other code changes needed to activate it.
 */
@Injectable()
export class GoogleReverseGeocoder implements ReverseGeocoder {
  private readonly logger = new Logger(GoogleReverseGeocoder.name);

  constructor(private readonly config: AppConfigService) {}

  public async reverseGeocode(coordinates: CoordinatesDto): Promise<ReverseGeocodeResult> {
    const params = new URLSearchParams({
      latlng: `${String(coordinates.latitude)},${String(coordinates.longitude)}`,
      key: this.config.googleMapsServerApiKey,
    });

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`,
    );
    const body = (await response.json()) as GoogleGeocodeResponse;

    if (body.status !== 'OK' || body.results.length === 0) {
      this.logger.warn(`Reverse geocode failed: ${body.status} ${body.error_message ?? ''}`);
      throw new Error(`Reverse geocoding failed: ${body.status}`);
    }

    const result = body.results[0];
    if (!result) {
      throw new Error('Reverse geocoding failed: no results');
    }
    const components = result.address_components;

    const city = componentByType(components, 'locality');
    const state = componentByType(components, 'administrative_area_level_1');
    const country = componentByType(components, 'country');
    const postalCode = componentByType(components, 'postal_code');

    return {
      formattedAddress: result.formatted_address,
      ...(city !== undefined ? { city } : {}),
      ...(state !== undefined ? { state } : {}),
      ...(country !== undefined ? { country } : {}),
      ...(postalCode !== undefined ? { postalCode } : {}),
    };
  }
}
