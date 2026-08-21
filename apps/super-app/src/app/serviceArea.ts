/**
 * Where the platform is based.
 *
 * Mirrors PLATFORM_BASE_CENTRE in @dripplex/types (packages/types/src/platform/
 * service-area.ts). This app is a standalone Vite build and does not depend on
 * the types package, so the value is duplicated here rather than imported —
 * if the base moves, both files change together.
 *
 * Kano is the operating base. These defaults were Lagos coordinates and the
 * literal strings 'Lagos'/'Lagos', ~830 km away, which opened every map over
 * the wrong city and wrote the wrong city onto saved addresses.
 */
export const SERVICE_AREA_CENTRE = {
  latitude: 12.0022,
  longitude: 8.592,
} as const;

export const SERVICE_AREA_CITY = 'Kano';
export const SERVICE_AREA_STATE = 'Kano';
export const SERVICE_AREA_COUNTRY = 'Nigeria';
