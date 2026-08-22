/**
 * Where the platform is based.
 *
 * Every map fallback and every "we have no location yet" default in the
 * product used to be Lagos (6.5244, 3.3792 and neighbours), left over from the
 * original pilot. Kano is the operating base, and Kano is ~830 km from Lagos —
 * far enough that a Lagos fallback is not a harmless placeholder. It opened
 * every map over the wrong city, and on the delivery path it was fed straight
 * into a haversine distance and became a real fee and a real ETA.
 *
 * One constant so there is one place to change when the base moves, rather
 * than six coordinate pairs drifting apart across four apps.
 *
 * The coordinates are Kano city centre to roughly 100 m. They are an anchor
 * for "no better point is known yet", not a surveyed operational address — if
 * dispatch should anchor on a specific depot or office instead, this is the
 * single line to change.
 */
export const PLATFORM_BASE_CENTRE = {
  latitude: 12.0022,
  longitude: 8.592,
} as const;

/** Human-readable name of the base, for placeholder copy and empty states. */
export const PLATFORM_BASE_CITY = 'Kano';

/** The state the base city sits in. */
export const PLATFORM_BASE_STATE = 'Kano';

/** The country the platform operates in. */
export const PLATFORM_BASE_COUNTRY = 'Nigeria';
