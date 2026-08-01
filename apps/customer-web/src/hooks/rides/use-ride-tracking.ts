'use client';

import { useAuth } from '@dripplex/hooks';
import { useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { io, type Socket } from 'socket.io-client';

import { rideQueryKeys } from './query-keys';

import type { RideDto, RideStatus } from '@dripplex/types';

interface RideStatusEvent {
  rideId: string;
  status: RideStatus;
  driverId: string | null;
}

interface RidePaymentEvent {
  rideId: string;
  paymentStatus: string;
  method: string;
}

interface RideDriverLocationEvent {
  rideId: string;
  latitude: number;
  longitude: number;
  at: string;
}

export interface RideTrackingState {
  connected: boolean;
  driverLocation: { latitude: number; longitude: number; at: string } | null;
}

/**
 * The gateway has no REST path prefix — it's a Socket.IO namespace on the
 * same Nest process, not behind /api/v1. Strips a trailing /api/... segment
 * off the REST base URL and appends /rides. See
 * docs/RIDE-003-INTEGRATION-MAP.md section 4 — not verified against the
 * real deployment topology yet, only against the gateway's own code.
 */
function deriveSocketUrl(apiBaseUrl: string): string {
  const withoutApiPath = apiBaseUrl.replace(/\/api(\/.*)?$/, '');
  return `${withoutApiPath}/rides`;
}

/**
 * Joins the `ride:{id}` room and keeps the React Query cache for that
 * ride's detail query in sync with `ride:status` / `ride:payment` events,
 * plus exposes live driver location from `ride:driver_location`. The
 * server side (RideGateway) is explicitly best-effort — dispatch and trip
 * transitions work over REST whether or not any socket is connected — so
 * this hook degrades to whatever useRide(rideId) already has cached if the
 * socket never connects, rather than blocking on it.
 */
export function useRideTracking(rideId: string | undefined): RideTrackingState {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [connected, setConnected] = React.useState(false);
  const [driverLocation, setDriverLocation] =
    React.useState<RideTrackingState['driverLocation']>(null);

  React.useEffect(() => {
    if (!rideId || !accessToken) {
      return undefined;
    }

    const baseUrl = process.env['NEXT_PUBLIC_API_BASE_URL'] ?? 'http://localhost:3000/api/v1';
    const socket: Socket = io(deriveSocketUrl(baseUrl), {
      auth: { token: accessToken },
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('ride:join', { rideId });
    });
    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('ride:status', (event: RideStatusEvent) => {
      if (event.rideId !== rideId) return;
      queryClient.setQueryData<RideDto | undefined>(rideQueryKeys.detail(rideId), (current) =>
        current ? { ...current, status: event.status, driverId: event.driverId } : current,
      );
    });

    socket.on('ride:payment', (event: RidePaymentEvent) => {
      if (event.rideId !== rideId) return;
      void queryClient.invalidateQueries({ queryKey: rideQueryKeys.detail(rideId) });
    });

    socket.on('ride:driver_location', (event: RideDriverLocationEvent) => {
      if (event.rideId !== rideId) return;
      setDriverLocation({ latitude: event.latitude, longitude: event.longitude, at: event.at });
    });

    return () => {
      socket.emit('ride:leave', { rideId });
      socket.disconnect();
    };
  }, [rideId, accessToken, queryClient]);

  return { connected, driverLocation };
}
