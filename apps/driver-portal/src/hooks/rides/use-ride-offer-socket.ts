'use client';

import { useAuth } from '@dripplex/hooks';
import { useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { io, type Socket } from 'socket.io-client';

import { rideQueryKeys } from './query-keys';

/**
 * The gateway has no REST path prefix — it's a Socket.IO namespace on the
 * same Nest process, not behind /api/v1. Strips a trailing /api/... segment
 * off the REST base URL and appends /rides. Ported from customer-web's
 * identical helper (use-ride-tracking.ts) since the two apps don't share a
 * ride-hooks package yet.
 */
function deriveSocketUrl(apiBaseUrl: string): string {
  const withoutApiPath = apiBaseUrl.replace(/\/api(\/.*)?$/, '');
  return `${withoutApiPath}/rides`;
}

export interface RideOfferSocketState {
  connected: boolean;
}

/**
 * A driver socket auto-joins its own `driver:{id}` room on connect
 * (RideGateway.handleConnection) — no explicit join message needed here,
 * unlike the customer's per-ride room. `ride:offered` only carries
 * { rideId }, not the offer id, so the handler just invalidates the offers
 * list rather than trying to patch a specific offer into the cache.
 * Best-effort only: useRideOffers' own poll interval is the fallback if
 * this socket never connects.
 */
export function useRideOfferSocket(): RideOfferSocketState {
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();
  const [connected, setConnected] = React.useState(false);

  React.useEffect(() => {
    if (!accessToken || !user) {
      return undefined;
    }

    const baseUrl = process.env['NEXT_PUBLIC_API_BASE_URL'] ?? 'http://localhost:3000/api/v1';
    const socket: Socket = io(deriveSocketUrl(baseUrl), {
      auth: { token: accessToken },
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      setConnected(true);
    });
    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('ride:offered', () => {
      void queryClient.invalidateQueries({ queryKey: rideQueryKeys.offers() });
    });

    return () => {
      socket.disconnect();
    };
  }, [accessToken, user, queryClient]);

  return { connected };
}
