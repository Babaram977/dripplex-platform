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
