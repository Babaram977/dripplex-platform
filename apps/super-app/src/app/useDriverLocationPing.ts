// ─── Driver location during a trip ────────────────────────────────────────────
//
// The driver's stored position is what the backend's start-ride gate measures
// against: POST /driver/rides/:id/start refuses unless DriverAvailability's
// last-known coordinates are within RIDE_START_PROXIMITY_METERS (50m) of the
// pickup point.
//
// That position was only ever written from DriverDashboardScreen — and App.tsx
// renders exactly one screen at a time, so accepting an offer unmounted the
// dashboard and the reporting stopped. From that moment the stored position was
// frozen wherever the driver happened to be when they accepted. Drive five
// kilometres to the pickup, tap Start, and the gate measures the *old* position:
// "Driver is too far from pickup to start the ride (5572m away, must be within
// 50m)" — with the driver parked at the kerb and the passenger already in the
// car. The same freeze is why the passenger's map shows the car pinned in one
// place for the whole approach.
//
// So the reporting belongs to the trip, not to the dashboard. This hook runs on
// every screen the driver passes through between accepting and completing.
//
// Two channels, deliberately:
//   • ws.pushLocation → the gateway's `driver:location` handler, which writes
//     DriverAvailability, appends RideTracking, and broadcasts to the passenger.
//     Ungated and cheap; this is the designed in-trip channel.
//   • POST /driver/rides/availability → the same coordinates over REST, so a
//     dropped socket cannot silently strand the driver behind the start gate.
//     The driver's own online/acceptingRides/vehicleType are read back and
//     echoed unchanged, so a heartbeat can never flip their availability.

import { api } from '../lib/api';
import { useLocationHeartbeat, type LocationHeartbeat } from '../lib/locationHeartbeat';
import { getCurrentPosition } from '../lib/maps';
import { ws } from '../lib/ws';

import type { GeoPoint } from '../lib/maps';

/** Three reports per offer-poll window. The gateway throttles to one write per
 *  5s per driver, so anything faster is discarded server-side. */
export const DRIVER_TRIP_PING_MS = 15_000;

/**
 * Send one position down both channels. Never throws: a failed report must not
 * break the screen that fired it.
 */
async function sendDriverPosition(
  position: { latitude: number; longitude: number },
  rideId?: string,
): Promise<void> {
  if (rideId) {
    try {
      ws.pushLocation(rideId, position);
    } catch {
      /* Socket down — the REST write below is the fallback. */
    }
  }

  const current = await api.driverRides.getAvailability();
  // No availability row, or one with no vehicle type, cannot be echoed back
  // without inventing a value the driver never chose. The socket ping above
  // writes the same coordinates, so the position still lands.
  if (!current?.vehicleType) return;
  await api.driverRides.setAvailability({
    online: current.online,
    acceptingRides: current.acceptingRides,
    vehicleType: current.vehicleType,
    latitude: position.latitude,
    longitude: position.longitude,
  });
}

/**
 * Take a fix right now and push it, then resolve with the position — or null
 * when the device would not give one. Used immediately before the start-ride
 * call so the gate reads a fix taken at the kerb rather than the newest
 * scheduled one, which could be up to DRIVER_TRIP_PING_MS old.
 */
export async function pushDriverLocationNow(rideId?: string): Promise<GeoPoint | null> {
  const pos = await getCurrentPosition();
  if (!pos) return null;
  try {
    await sendDriverPosition(pos, rideId);
  } catch {
    /* Availability write refused (identity re-check, commission block). The
       socket ping above may still have landed, and a trip already accepted is
       not the place to surface a go-online gate. */
  }
  return pos;
}

/**
 * Report position on mount and every DRIVER_TRIP_PING_MS while the screen is
 * mounted. `rideId` routes the socket ping to the passenger's map.
 *
 * Returns the shared heartbeat's health, so a screen can tell the driver their
 * device has stopped answering before it costs them the start gate.
 */
export function useDriverLocationPing(rideId?: string, enabled = true): LocationHeartbeat {
  return useLocationHeartbeat(
    enabled,
    async (position) => {
      await sendDriverPosition(position, rideId);
    },
    DRIVER_TRIP_PING_MS,
  );
}
