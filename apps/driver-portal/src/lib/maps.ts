/**
 * No Google Maps JS SDK integration exists anywhere in this codebase yet
 * (see MapCanvas doc comment) — but a real, zero-setup deep link into the
 * device's own Maps app needs no API key at all. This gives the driver
 * genuine turn-by-turn navigation today; swapping in an embedded map SDK
 * later is additive, not a replacement for this link.
 */
export interface NavDestination {
  latitude: number;
  longitude: number;
}

/** DPX-DRIVER Slice 2 — navigation handoff (founder-approved 2026-08-04):
 * nav-app handoff only, no in-app voice guidance. Google Maps, Apple Maps,
 * and Waze all support zero-setup universal links (no API key, no SDK) —
 * each opens the native app if installed, else falls back to a web/app-store
 * page, which is standard, expected behavior for a link the OS doesn't
 * recognize as installed; there's no reliable way for a web app to detect
 * "is this app installed" ahead of time, so that's left to each platform's
 * own link-handling rather than faked with a client-side check. */
export function buildGoogleMapsUrl(destination: NavDestination): string {
  const params = new URLSearchParams({
    api: '1',
    destination: `${String(destination.latitude)},${String(destination.longitude)}`,
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/** Apple Maps universal link (`dirflg=d` = driving directions). Works on
 * iOS/macOS regardless of whether the driver has an iPhone; on
 * Android/desktop it opens Apple's maps.apple.com web fallback. */
export function buildAppleMapsUrl(destination: NavDestination): string {
  const params = new URLSearchParams({
    daddr: `${String(destination.latitude)},${String(destination.longitude)}`,
    dirflg: 'd',
  });
  return `https://maps.apple.com/?${params.toString()}`;
}

/** Waze universal link — opens the Waze app with navigation started
 * immediately if installed, else the waze.com web fallback. */
export function buildWazeUrl(destination: NavDestination): string {
  const params = new URLSearchParams({
    ll: `${String(destination.latitude)},${String(destination.longitude)}`,
    navigate: 'yes',
  });
  return `https://waze.com/ul?${params.toString()}`;
}

export interface NavApp {
  label: string;
  url: string;
}

/** The three founder-approved nav-app handoff options, in the order they
 * should be presented. */
export function buildNavAppOptions(destination: NavDestination): NavApp[] {
  return [
    { label: 'Google Maps', url: buildGoogleMapsUrl(destination) },
    { label: 'Apple Maps', url: buildAppleMapsUrl(destination) },
    { label: 'Waze', url: buildWazeUrl(destination) },
  ];
}
