// ─── Google Maps activation for the super-app ────────────────────────────────
// Loads the Google Maps JS API once, using VITE_GOOGLE_MAPS_KEY. Every map/
// location feature in the app goes through here, so setting the key in the
// environment "activates" maps everywhere. Without a key the loader resolves to
// null and callers fall back to their non-map behaviour (no crash).

const MAPS_KEY = (import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined)?.trim() ?? '';

export function mapsEnabled(): boolean {
  return MAPS_KEY.length > 0;
}

declare global {
  interface Window {
    google?: typeof google;
    __dxMapsPromise?: Promise<typeof google | null>;
  }
}

// Loads (once) and resolves the global `google` namespace, or null if no key.
export function loadGoogleMaps(): Promise<typeof google | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (!mapsEnabled()) return Promise.resolve(null);
  if (window.google?.maps) return Promise.resolve(window.google);
  if (window.__dxMapsPromise) return window.__dxMapsPromise;

  window.__dxMapsPromise = new Promise<typeof google | null>((resolve) => {
    const s = document.createElement('script');
    s.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(MAPS_KEY)}` +
      `&libraries=places,geometry&loading=async`;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve(window.google ?? null);
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
  });
  return window.__dxMapsPromise;
}

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

// Browser geolocation → coordinates (works with or without Google Maps).
export function getCurrentPosition(): Promise<GeoPoint | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  });
}

export interface ResolvedAddress {
  addressLine1: string;
  city: string;
  state: string;
  country: string;
  postalCode?: string;
}

export interface AddressPrediction {
  placeId: string;
  description: string;
}

/**
 * Address-bar autocomplete: typed text → Google Places predictions. Returns an
 * empty list (never throws) when Maps is not activated, so callers can fall back
 * to plain manual entry. Restricted to Nigeria — the launch market; widen the
 * componentRestrictions when the platform expands.
 */
export async function addressPredictions(query: string): Promise<AddressPrediction[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];
  const g = await loadGoogleMaps();
  if (!g?.maps?.places) return [];
  try {
    const service = new g.maps.places.AutocompleteService();
    const res = await service.getPlacePredictions({
      input: trimmed,
      componentRestrictions: { country: 'ng' },
    });
    return (res.predictions ?? []).map((p) => ({
      placeId: p.place_id,
      description: p.description,
    }));
  } catch {
    return [];
  }
}

function toResolved(r: google.maps.GeocoderResult): ResolvedAddress & GeoPoint {
  const comp = (type: string) =>
    r.address_components.find((c) => c.types.includes(type))?.long_name ?? '';
  const streetLine = [comp('street_number'), comp('route')].filter(Boolean).join(' ');
  return {
    addressLine1: streetLine || r.formatted_address.split(',')[0] || r.formatted_address,
    city: comp('locality') || comp('administrative_area_level_2') || '',
    state: comp('administrative_area_level_1') || '',
    country: comp('country') || 'Nigeria',
    postalCode: comp('postal_code') || undefined,
    latitude: r.geometry.location.lat(),
    longitude: r.geometry.location.lng(),
  };
}

/**
 * Forward-geocode: a picked place (placeId) or free-typed address → structured
 * address WITH coordinates. The backend requires latitude/longitude on every
 * saved address, so this is what turns a typed address into a savable one.
 * Resolves null when Maps is off or the address can't be resolved — callers must
 * surface that rather than inventing coordinates.
 */
export async function geocodeAddress(input: {
  placeId?: string;
  query?: string;
}): Promise<(ResolvedAddress & GeoPoint) | null> {
  const g = await loadGoogleMaps();
  if (!g?.maps) return null;
  const geocoder = new g.maps.Geocoder();
  try {
    const request = input.placeId
      ? { placeId: input.placeId }
      : { address: (input.query ?? '').trim(), componentRestrictions: { country: 'NG' } };
    if (!input.placeId && !(input.query ?? '').trim()) return null;
    const { results } = await geocoder.geocode(request);
    const r = results?.[0];
    return r ? toResolved(r) : null;
  } catch {
    return null;
  }
}

// Reverse-geocode coordinates → structured address via Google (when activated).
export async function reverseGeocode(point: GeoPoint): Promise<ResolvedAddress | null> {
  const g = await loadGoogleMaps();
  if (!g?.maps) return null;
  const geocoder = new g.maps.Geocoder();
  try {
    const { results } = await geocoder.geocode({
      location: { lat: point.latitude, lng: point.longitude },
    });
    const r = results?.[0];
    if (!r) return null;
    const comp = (type: string) =>
      r.address_components.find((c) => c.types.includes(type))?.long_name ?? '';
    return {
      addressLine1: r.formatted_address.split(',')[0] || r.formatted_address,
      city: comp('locality') || comp('administrative_area_level_2') || '',
      state: comp('administrative_area_level_1') || '',
      country: comp('country') || 'Nigeria',
      postalCode: comp('postal_code') || undefined,
    };
  } catch {
    return null;
  }
}
