'use client';

import { useAuth } from '@dripplex/hooks';
import * as React from 'react';
import { io, type Socket } from 'socket.io-client';

/** Same derivation as useRideOfferSocket — the gateway is a bare Socket.IO
 * namespace, not behind /api/v1. */
function deriveSocketUrl(apiBaseUrl: string): string {
  const withoutApiPath = apiBaseUrl.replace(/\/api(\/.*)?$/, '');
  return `${withoutApiPath}/rides`;
}

/** Matches RIDE_LOCATION_THROTTLE_MS on the backend — no point emitting
 * more often than the gateway will actually persist. */
const REPORT_INTERVAL_MS = 5_000;

/**
 * Streams the driver's live position to RideGateway's existing
 * `driver:location` handler (apps/backend/src/rides/ride.gateway.ts) —
 * no backend change needed, that handler already exists and already does
 * two things with it: (1) keeps DriverAvailability.latitude/longitude
 * fresh, which RideTripService.startTrip's pickup-proximity gate reads,
 * and (2) broadcasts `ride:driver_location` to the customer's ride room
 * for live tracking, when there's an active ride. Only runs while the
 * driver is online — no point streaming location while not accepting
 * rides.
 */
export function useReportDriverLocation(online: boolean): void {
  const { accessToken, user } = useAuth();

  React.useEffect(() => {
    if (!online || !accessToken || !user || typeof navigator === 'undefined') {
      return undefined;
    }

    const baseUrl = process.env['NEXT_PUBLIC_API_BASE_URL'] ?? 'http://localhost:3000/api/v1';
    const socket: Socket = io(deriveSocketUrl(baseUrl), {
      auth: { token: accessToken },
      transports: ['websocket'],
    });

    let lastSentAt = 0;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now();
        if (now - lastSentAt < REPORT_INTERVAL_MS) {
          return;
        }
        lastSentAt = now;
        socket.emit('driver:location', {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 4_000 },
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
      socket.disconnect();
    };
  }, [online, accessToken, user]);
}
